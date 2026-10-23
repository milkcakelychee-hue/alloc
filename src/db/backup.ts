// สำรอง / กู้คืนเป็นไฟล์ .alloc (JSON เดียว มี schemaVersion + ทุกตาราง) · กู้คืนแล้วได้ทุกอย่างเหมือนเดิม
import type { AllocDB, TableName } from './db';
import { SCHEMA_VERSION, TABLES } from './db';
import { migrateV1toV2 } from './migrations';

export const BACKUP_APP = 'alloc';

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

// migration ของไฟล์สำรอง: MIGRATIONS[n] แปลงไฟล์จาก schemaVersion n เป็น n + 1
// เพิ่มรายการที่นี่ทุกครั้งที่ขึ้น SCHEMA_VERSION
type Migration = (tables: Record<string, unknown[]>) => Record<string, unknown[]>;
export const MIGRATIONS: Record<number, Migration> = { 1: migrateV1toV2 };

export async function buildBackup(db: AllocDB, now = new Date()): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>;
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) tables[t] = await db.table(t).toArray();
  });
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), tables };
}

export function parseBackup(text: string, migrations: Record<number, Migration> = MIGRATIONS, target = SCHEMA_VERSION): BackupFile {
  let j: Partial<BackupFile>;
  try { j = JSON.parse(text); } catch { throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Alloc (อ่านไฟล์ไม่ได้)'); }
  if (!j || j.app !== BACKUP_APP || typeof j.schemaVersion !== 'number' || !j.tables || typeof j.tables !== 'object') {
    throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Alloc');
  }
  if (j.schemaVersion > target) throw new Error('ไฟล์นี้มาจาก Alloc เวอร์ชันใหม่กว่า กรุณาอัปเดตแอปก่อน');
  let tables = j.tables as Record<string, unknown[]>;
  for (let v = j.schemaVersion; v < target; v++) {
    const m = migrations[v];
    if (!m) throw new Error(`ไม่มีวิธีแปลงไฟล์สำรองเวอร์ชัน ${v}`);
    tables = m(tables);
  }
  const out = {} as Record<TableName, unknown[]>;
  for (const t of TABLES) out[t] = Array.isArray(tables[t]) ? tables[t] : [];
  return { app: BACKUP_APP, schemaVersion: target, exportedAt: String(j.exportedAt ?? ''), tables: out };
}

export function summarize(b: BackupFile) {
  const n = (t: TableName) => b.tables[t].length;
  return { exportedAt: b.exportedAt, planItems: n('planItems'), goals: n('goals'), logEntries: n('logEntries'), bills: n('bills') };
}

/** กู้คืน = แทนที่ข้อมูลทั้งหมดในเครื่องนี้ด้วยข้อมูลในไฟล์ */
export async function restoreBackup(db: AllocDB, b: BackupFile) {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      if (b.tables[t].length) await db.table(t).bulkPut(b.tables[t]);
    }
  });
}

export const backupFileName = (d = new Date()) =>
  `alloc-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.alloc`;

/**
 * ส่งไฟล์สำรองออก: iPhone ใช้หน้าแชร์ของระบบ (บันทึกลงไฟล์ / AirDrop) · เครื่องอื่นดาวน์โหลด
 * บันทึก lastBackupAt เมื่อแชร์หรือดาวน์โหลดสำเร็จ
 */
export async function exportBackup(db: AllocDB): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const body = JSON.stringify(await buildBackup(db));
  const name = backupFileName();
  // octet-stream: iPhone จะไม่พยายามเปิดดูตัวอย่างไฟล์ JSON
  let file = new File([body], name, { type: 'application/octet-stream' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare && !nav.canShare({ files: [file] })) file = new File([body], name.replace(/\.alloc$/, '.json'), { type: 'application/json' });
  let result: 'shared' | 'downloaded' | 'cancelled' = 'downloaded';
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try { await nav.share({ files: [file], title: 'สำรองข้อมูล Alloc' }); result = 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; result = 'downloaded'; }
  }
  if (result === 'downloaded') {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  await db.settings.update('app', { lastBackupAt: Date.now(), updatedAt: Date.now() });
  return result;
}
