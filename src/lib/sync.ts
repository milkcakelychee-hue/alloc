// ซิงก์ข้ามเครื่องผ่าน Supabase: ตาราง app_data (1 แถวต่อผู้ใช้ต่อแอป) · เข้าสู่ระบบด้วยอีเมล + รหัสผ่าน
// (ลิงก์จากอีเมลเปิดใน Safari ไม่ใช่ในแอปที่ติดตั้งบน iPhone จึงไม่ใช้ลิงก์ / OTP)
import { createClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { db } from '../db/db';
import { backupFileName, type BackupFile } from '../db/backup';
import { push, resolveAsk, syncOnce, trackChanges, type Remote, type SyncDeps, type SyncMeta } from '../db/sync';
import { syncThemeFromDb } from './theme';

// publishable key: ออกแบบมาให้อยู่ในโค้ดฝั่งผู้ใช้ได้ · ข้อมูลกันด้วยรหัสผ่านและกฎ RLS (เห็นได้เฉพาะแถวของตัวเอง)
const SB_URL = 'https://riudqjmefgsdyyumbepd.supabase.co';
const SB_KEY = 'sb_publishable_RDdo7sP9ZHmAQVHyRXRjWw_dk-mCZlg';
const APP = 'alloc';
const META_KEY = 'alloc-sync';
const CONFLICT_KEY = 'alloc-sync-conflict';

const sb = createClient(SB_URL, SB_KEY);

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error' | 'ask';
export interface SyncState { email: string | null; status: SyncStatus; error: string; notice: string; hasConflictCopy: boolean }

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* เต็มหรือถูกปิด: ไม่เป็นไร */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* ไม่เป็นไร */ } }
};

const meta: SyncMeta = (() => { try { return JSON.parse(ls.get(META_KEY) ?? '') || {}; } catch { return {}; } })();
const saveMeta = () => ls.set(META_KEY, JSON.stringify(meta));

let userId: string | null = null;
let state: SyncState = { email: null, status: 'off', error: '', notice: '', hasConflictCopy: !!ls.get(CONFLICT_KEY) };
const subs = new Set<() => void>();
const set = (p: Partial<SyncState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const useSync = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
export const clearNotice = () => set({ notice: '' });

const remote: Remote = {
  async pull() {
    const { data, error } = await sb.from('app_data').select('data, updated_at').eq('user_id', userId!).eq('app', APP)
      .abortSignal(AbortSignal.timeout(12000)).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { data: data.data, updatedAt: data.updated_at as string } : null;
  },
  async push(data, updatedAt) {
    const { error } = await sb.from('app_data').upsert({ user_id: userId!, app: APP, data, updated_at: updatedAt });
    if (error) throw new Error(error.message);
  }
};
const deps = (): SyncDeps => ({
  db, remote, meta,
  keepConflict: (b: BackupFile) => { ls.set(CONFLICT_KEY, JSON.stringify(b)); set({ hasConflictCopy: !!ls.get(CONFLICT_KEY) }); }
});

const fail = (e: unknown) => {
  const m = (e as Error).message ?? '';
  set({ status: 'error', error: /อัปเดตแอป/.test(m) ? 'ข้อมูลบนคลาวด์มาจากแอปเวอร์ชันใหม่กว่า กรุณาอัปเดตแอปก่อน' : 'ซิงก์ไม่สำเร็จ จะลองใหม่เมื่อเปิดแอปอีกครั้ง' });
};

let flight: Promise<void> | null = null;
/** หนึ่งรอบซิงก์ (เปิดแอป / กลับเข้าแอป / กดซิงก์ตอนนี้) · เรียกซ้อนกันได้ จะได้รอบเดียวกัน */
export function syncNow(): Promise<void> {
  if (!userId || !navigator.onLine) return Promise.resolve();
  if (state.status === 'ask') return Promise.resolve(); // รอผู้ใช้เลือกก่อน
  flight ??= (async () => {
    set({ status: 'syncing', error: '' });
    try {
      const r = await syncOnce(deps());
      saveMeta();
      if (r === 'ask') { set({ status: 'ask' }); return; }
      if (r === 'pulled' || r === 'pulled-conflict') await syncThemeFromDb();
      set({ status: 'ok', notice: r === 'pulled-conflict' ? 'มีข้อมูลใหม่จากอีกเครื่อง · เก็บของเดิมในเครื่องนี้ไว้เป็นสำเนาแล้ว' : state.notice });
    } catch (e) { saveMeta(); fail(e); }
  })().finally(() => { flight = null; });
  return flight;
}
/** รอรอบซิงก์ที่กำลังทำอยู่ (ถ้ามี) ให้จบก่อน · ใช้ก่อนงานที่เขียนข้อมูลเองตอนเปิดแอป */
export const syncSettled = (): Promise<void> => flight ?? Promise.resolve();

let timer: ReturnType<typeof setTimeout> | undefined;
async function pushNow() {
  if (!userId || !navigator.onLine || state.status === 'ask') return;
  if (flight) { await flight; if (!meta.dirty) return; }
  set({ status: 'syncing', error: '' });
  try { await push(deps()); saveMeta(); set({ status: 'ok' }); }
  catch (e) { saveMeta(); fail(e); }
}
// ทุกครั้งที่ข้อมูลในเครื่องเปลี่ยน: รอหยุดแก้ 1.5 วินาทีแล้วค่อยส่งขึ้น
function queuePush() {
  meta.dirty = true; saveMeta();
  if (!userId) return;
  clearTimeout(timer); timer = setTimeout(pushNow, 1500);
}

/** ผู้ใช้เลือกว่าจะใช้ข้อมูลชุดไหน (เครื่องที่มีข้อมูลอยู่แล้วเข้าสู่ระบบครั้งแรก) */
export async function chooseData(use: 'cloud' | 'local') {
  set({ status: 'syncing', error: '' });
  try {
    await resolveAsk(deps(), use);
    saveMeta();
    if (use === 'cloud') await syncThemeFromDb();
    set({ status: 'ok' });
  } catch (e) { saveMeta(); fail(e); set({ status: 'ask' }); }
}

/** เข้าสู่ระบบ / สร้างบัญชี · คืนข้อความ error ภาษาไทย หรือ null เมื่อสำเร็จ */
export async function signIn(email: string, password: string, signup: boolean): Promise<string | null> {
  if (!navigator.onLine) return 'ต้องต่ออินเทอร์เน็ตก่อน';
  const cred = { email: email.trim(), password };
  const { data, error } = signup ? await sb.auth.signUp(cred) : await sb.auth.signInWithPassword(cred);
  if (error) return signup ? `สร้างบัญชีไม่สำเร็จ: ${error.message}` : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (!data.session || !data.user) return 'ยังเข้าสู่ระบบไม่ได้ ต้องปิด Confirm email ใน Supabase ก่อน';
  userId = data.user.id;
  set({ email: data.user.email ?? cred.email, status: 'off' });
  await syncNow();
  return null;
}

/** ออกจากระบบ: ข้อมูลในเครื่องยังอยู่ · เข้าใหม่ครั้งหน้าจะเทียบกับบนคลาวด์ใหม่ทั้งหมด */
export async function signOut() {
  clearTimeout(timer);
  await sb.auth.signOut().catch(() => {});
  userId = null;
  delete meta.syncedAt; delete meta.dirty; saveMeta();
  set({ email: null, status: 'off', error: '' });
}

/** ดาวน์โหลดสำเนาของเครื่องนี้ที่ถูกเก็บไว้ก่อนโดนแทนที่ (เป็นไฟล์สำรอง กู้คืนได้จากหน้าตั้งค่า) */
export function downloadConflictCopy() {
  const body = ls.get(CONFLICT_KEY);
  if (!body) return;
  const url = URL.createObjectURL(new File([body], backupFileName().replace('alloc-backup', 'alloc-before-sync'), { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url; a.download = backupFileName().replace('alloc-backup', 'alloc-before-sync');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export function dropConflictCopy() { ls.del(CONFLICT_KEY); set({ hasConflictCopy: false }); }

let started = false;
/** เรียกครั้งเดียวตอนเริ่มแอป (หลัง ensureDefaults) · จบเมื่อซิงก์รอบแรกเสร็จหรือข้ามไป */
export async function startSync(): Promise<void> {
  if (started) return;
  started = true;
  trackChanges(db, queuePush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  window.addEventListener('online', () => { syncNow(); });
  try {
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    if (!u) return;
    userId = u.id;
    set({ email: u.email ?? '' });
    await syncNow();
  } catch { /* ออฟไลน์หรืออ่าน session ไม่ได้: ใช้ข้อมูลในเครื่องต่อไป */ }
}

export function syncLabel(s: SyncState): string {
  if (!s.email) return 'ยังไม่ได้เข้าสู่ระบบ';
  if (s.status === 'syncing') return 'กำลังซิงก์…';
  if (s.status === 'error') return s.error;
  if (s.status === 'ask') return 'รอเลือกว่าจะใช้ข้อมูลชุดไหน';
  return `ซิงก์แล้ว · ${s.email}`;
}
