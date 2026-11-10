// แกนของการซิงก์ข้ามเครื่อง: ข้อมูลทั้งก้อน (รูปเดียวกับไฟล์สำรอง) 1 แถวต่อผู้ใช้ · ใหม่กว่าชนะ
// ไฟล์นี้ไม่รู้จัก Supabase (ต่อจริงใน lib/sync.ts) จึงเทสได้ด้วย remote ปลอม
import type { AllocDB } from './db';
import { TABLES } from './db';
import { buildBackup, parseBackup, restoreBackup, type BackupFile } from './backup';
import { ensureDefaults } from './defaults';

export interface RemoteRow { data: unknown; updatedAt: string }
export interface Remote {
  pull(): Promise<RemoteRow | null>;
  push(data: BackupFile, updatedAt: string): Promise<void>;
}
/** syncedAt = updated_at ของแถวบนเซิร์ฟเวอร์ที่ตรงกับเครื่องล่าสุด · dirty = มีแก้ในเครื่องที่ยังไม่ได้ส่ง */
export interface SyncMeta { syncedAt?: string; dirty?: boolean }

export type Decision = 'pull' | 'push' | 'ask' | 'none';

/**
 * เปิดแอป / กลับเข้าแอป: ของบนเซิร์ฟเวอร์ใหม่กว่า → ดึงมาแทน · ไม่งั้นถ้าเครื่องมีแก้ค้าง → ส่งขึ้น
 * ask = เครื่องนี้มีข้อมูลแล้วแต่ยังไม่เคยซิงก์ และบนเซิร์ฟเวอร์ก็มีข้อมูล → ให้ผู้ใช้เลือกเองว่าใช้ชุดไหน
 * เครื่องที่ยังไม่ผ่านหน้าเริ่มใช้งานไม่ส่งขึ้น (กันข้อมูลว่างไปทับของจริง)
 */
export function decide(meta: SyncMeta, remoteUpdatedAt: string | null, localOnboarded: boolean): Decision {
  const newer = !!remoteUpdatedAt && (!meta.syncedAt || Date.parse(remoteUpdatedAt) > Date.parse(meta.syncedAt));
  if (newer) return !meta.syncedAt && localOnboarded ? 'ask' : 'pull';
  if (!localOnboarded) return 'none';
  return !remoteUpdatedAt || meta.dirty ? 'push' : 'none';
}

// ค่าที่เป็นของเครื่องใครเครื่องมัน: แก้อย่างเดียวไม่นับว่ามีของใหม่ต้องส่ง (ไม่งั้นเปิดแอปทีไรก็ส่งขึ้นทุกครั้ง)
const LOCAL_ONLY = new Set(['hideNumbers', 'lastBackupAt', 'updatedAt']);

let muted = 0;
/** ทำงานโดยไม่นับเป็นการแก้ของผู้ใช้ (ใช้ตอนเขียนข้อมูลที่ดึงมาจากเซิร์ฟเวอร์) */
export async function withoutTracking<T>(f: () => Promise<T>): Promise<T> {
  muted++;
  try { return await f(); } finally { muted--; }
}

/** เรียก onChange ทุกครั้งที่มีการเพิ่ม แก้ ลบ ในตารางใดก็ตาม */
export function trackChanges(db: AllocDB, onChange: () => void) {
  const fire = () => { if (!muted) onChange(); };
  for (const t of TABLES) {
    const table = db.table(t);
    table.hook('creating', () => { fire(); });
    table.hook('deleting', () => { fire(); });
    table.hook('updating', (mods) => {
      if (t === 'settings' && Object.keys(mods).every((k) => LOCAL_ONLY.has(k))) return;
      fire();
    });
  }
}

/** แทนที่ข้อมูลในเครื่องด้วยชุดจากเซิร์ฟเวอร์ (โยน error ถ้าชุดนั้นมาจากแอปเวอร์ชันใหม่กว่า) */
export async function applyRemote(db: AllocDB, row: RemoteRow) {
  const b = parseBackup(JSON.stringify(row.data));
  await withoutTracking(async () => {
    await restoreBackup(db, b);
    await ensureDefaults(db);
  });
}

export type SyncResult = 'pulled' | 'pulled-conflict' | 'pushed' | 'ask' | 'none';
export interface SyncDeps {
  db: AllocDB;
  remote: Remote;
  meta: SyncMeta;
  /** เก็บชุดในเครื่องที่กำลังจะถูกทับ (มีแก้ค้างแต่ของบนเซิร์ฟเวอร์ใหม่กว่า) */
  keepConflict?: (b: BackupFile) => void;
  now?: () => Date;
}

const onboarded = async (db: AllocDB) => !!(await db.settings.get('app'))?.onboardedAt;

export async function push(d: SyncDeps): Promise<boolean> {
  if (!(await onboarded(d.db))) return false;
  const at = (d.now?.() ?? new Date()).toISOString();
  // ล้าง dirty ก่อนอ่าน: ถ้ามีการแก้ระหว่างส่ง dirty จะกลับมาเป็นจริงและถูกส่งรอบถัดไป
  d.meta.dirty = false;
  try { await d.remote.push(await buildBackup(d.db), at); }
  catch (e) { d.meta.dirty = true; throw e; }
  d.meta.syncedAt = at;
  return true;
}

export async function pullInto(d: SyncDeps, row: RemoteRow, conflict: boolean) {
  if (conflict) d.keepConflict?.(await buildBackup(d.db));
  await applyRemote(d.db, row);
  d.meta.syncedAt = row.updatedAt;
  d.meta.dirty = false;
}

/** หนึ่งรอบซิงก์ · คืน ask พร้อมไม่ทำอะไร ถ้าต้องให้ผู้ใช้เลือก (แล้วเรียก resolveAsk) */
export async function syncOnce(d: SyncDeps): Promise<SyncResult> {
  const row = await d.remote.pull();
  const what = decide(d.meta, row?.updatedAt ?? null, await onboarded(d.db));
  if (what === 'ask') return 'ask';
  if (what === 'pull' && row) {
    const conflict = !!d.meta.dirty && (await onboarded(d.db));
    await pullInto(d, row, conflict);
    return conflict ? 'pulled-conflict' : 'pulled';
  }
  if (what === 'push') return (await push(d)) ? 'pushed' : 'none';
  return 'none';
}

/** ผู้ใช้เลือกแล้ว: cloud = ใช้ของบนเซิร์ฟเวอร์ (เก็บของเครื่องนี้ไว้เป็นสำเนา) · local = ส่งของเครื่องนี้ขึ้นไปทับ */
export async function resolveAsk(d: SyncDeps, use: 'cloud' | 'local') {
  if (use === 'local') { await push(d); return; }
  const row = await d.remote.pull();
  if (row) await pullInto(d, row, true);
}
