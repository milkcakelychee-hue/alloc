// การกระทำในหน้าตั้งค่า (ขั้นที่ 9): บัญชีปลายทาง · ซ่อนตัวเลขตอนเปิดแอป · ล้างข้อมูลทั้งหมด
import type { AllocDB } from './db';
import { TABLES } from './db';
import { ensureDefaults } from './defaults';
import type { Account } from './types';

export async function addAccount(db: AllocDB, name: string, now = Date.now()) {
  const n = name.trim();
  if (!n) return null;
  const max = (await db.accounts.toArray()).reduce((m, a) => Math.max(m, a.order), 0);
  const a: Account = { id: crypto.randomUUID(), name: n, order: max + 1, createdAt: now, updatedAt: now };
  await db.accounts.add(a);
  return a;
}

export async function renameAccount(db: AllocDB, id: string, name: string, now = Date.now()) {
  const n = name.trim();
  if (n) await db.accounts.update(id, { name: n, updatedAt: now });
}

export async function reorderAccounts(db: AllocDB, ids: string[], now = Date.now()) {
  await db.transaction('rw', db.accounts, async () => {
    for (let i = 0; i < ids.length; i++) await db.accounts.update(ids[i], { order: i + 1, updatedAt: now });
  });
}

/** ลบบัญชี: รายการแผนที่โอนเข้าบัญชีนี้กลับไปอยู่ในบัญชีเงินเดือน (ไม่โอน) · ยอดแผนไม่เปลี่ยน */
export async function deleteAccount(db: AllocDB, id: string, now = Date.now()) {
  await db.transaction('rw', [db.accounts, db.planItems], async () => {
    await db.planItems.where('accountId').equals(id).modify({ accountId: null, updatedAt: now });
    await db.accounts.delete(id);
  });
}

/** เปิดแอปครั้งใหม่: ถ้าตั้งซ่อนตัวเลขตอนเปิดแอปไว้ ให้ซ่อนก่อนทุกครั้ง */
export async function applyHideOnOpen(db: AllocDB, now = Date.now()) {
  const s = await db.settings.get('app');
  if (s?.hideOnOpen && !s.hideNumbers) await db.settings.update('app', { hideNumbers: true, updatedAt: now });
}

/** ล้างข้อมูลทั้งหมดในเครื่องนี้ แล้วใส่ค่าตั้งต้นใหม่ (กลับไปหน้าเริ่มใช้งาน) */
export async function clearAllData(db: AllocDB, now = Date.now()) {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear();
  });
  await ensureDefaults(db, now);
}
