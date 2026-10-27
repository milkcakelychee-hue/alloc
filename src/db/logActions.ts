// การกระทำในหน้าบันทึก (ขั้นที่ 7 · docs/decisions.md)
import type { AllocDB } from './db';
import type { DateStr, LogCategory, LogEntry, LogType, Month, Satang } from './types';

const stamp = (now: number) => ({ id: crypto.randomUUID(), createdAt: now, updatedAt: now });

export interface EntryInput { type: LogType; amount: Satang; categoryId: string; date: DateStr; note: string; cycleMonth?: Month | null }

/** เพิ่มรายการ · ไม่ได้หาร: ส่วนของฉัน = จ่ายจริง */
export async function addEntry(db: AllocDB, e: EntryInput, now = Date.now()) {
  const entry: LogEntry = { ...stamp(now), date: e.date, type: e.type, amountPaid: e.amount, myShare: e.amount, categoryId: e.categoryId, note: e.note.trim(), billItemId: null, ...(e.cycleMonth ? { cycleMonth: e.cycleMonth } : {}) };
  await db.logEntries.add(entry);
  return entry;
}

/** แก้รายการ · รายการที่หารในบิล: ปรับส่วนของฉันตามสัดส่วนเดิม (บิลคำนวณใหม่ในขั้นบิลแชร์) */
export async function updateEntry(db: AllocDB, id: string, e: EntryInput, now = Date.now()) {
  const old = await db.logEntries.get(id);
  if (!old) return;
  const myShare = old.amountPaid && old.myShare !== old.amountPaid ? Math.round((e.amount * old.myShare) / old.amountPaid) : e.amount;
  await db.logEntries.update(id, { type: e.type, amountPaid: e.amount, myShare, categoryId: e.categoryId, date: e.date, note: e.note.trim(), cycleMonth: e.cycleMonth ?? null, updatedAt: now });
}

/** จดซ้ำวันนี้: ยอด หมวด โน้ตเดิม วันที่วันนี้ (ไม่ผูกบิล/การ์ดจ่ายแล้ว) */
export async function repeatEntry(db: AllocDB, id: string, today: DateStr, now = Date.now()) {
  const old = await db.logEntries.get(id);
  if (!old) return null;
  return addEntry(db, { type: old.type, amount: old.amountPaid, categoryId: old.categoryId, date: today, note: old.note }, now);
}

// ---------- จัดการหมวด ----------

export async function addCategory(db: AllocDB, c: { type: LogType; name: string; icon: string; bg: string; fg: string }, now = Date.now()) {
  const order = (await db.logCategories.where('type').equals(c.type).toArray()).reduce((m, x) => Math.max(m, x.order), -1) + 1;
  const cat: LogCategory = { ...stamp(now), type: c.type, name: c.name.trim(), icon: c.icon, bg: c.bg, fg: c.fg, order, hidden: false };
  await db.logCategories.add(cat);
  return cat;
}

/** เลื่อนลำดับหมวดในประเภทเดียวกัน (d = −1 ขึ้น, +1 ลง) */
export async function moveCategory(db: AllocDB, id: string, d: -1 | 1, now = Date.now()) {
  const cat = await db.logCategories.get(id);
  if (!cat) return;
  const list = (await db.logCategories.where('type').equals(cat.type).toArray()).sort((a, b) => a.order - b.order);
  const i = list.findIndex((x) => x.id === id), j = i + d;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.transaction('rw', db.logCategories, async () => {
    for (let k = 0; k < list.length; k++) if (list[k].order !== k) await db.logCategories.update(list[k].id, { order: k, updatedAt: now });
  });
}

/** ซ่อนหมวดที่ไม่ได้ใช้ (รายการเก่ายังอยู่) */
export async function toggleCategoryHidden(db: AllocDB, id: string, now = Date.now()) {
  const cat = await db.logCategories.get(id);
  if (cat) await db.logCategories.update(id, { hidden: !cat.hidden, updatedAt: now });
}

/** เลือกงบของหมวด (เลือกได้หลายงบ · ว่าง = นอกงบ): ใส่/เอาหมวดออกจาก logCategoryIds ของแต่ละรายการ */
export async function setCategoryBudgets(db: AllocDB, categoryId: string, planItemIds: string[], now = Date.now()) {
  const want = new Set(planItemIds);
  await db.transaction('rw', db.planItems, async () => {
    for (const it of await db.planItems.toArray()) {
      const has = it.logCategoryIds.includes(categoryId);
      if (want.has(it.id) && !has) await db.planItems.update(it.id, { logCategoryIds: [...it.logCategoryIds, categoryId], updatedAt: now });
      if (!want.has(it.id) && has) await db.planItems.update(it.id, { logCategoryIds: it.logCategoryIds.filter((c) => c !== categoryId), updatedAt: now });
    }
  });
}

export const cycleOfEntry = (e: LogEntry): Month | null => e.cycleMonth ?? null;

/** แก้ชื่อ ไอคอน สีของหมวด (รายการเก่ายังอยู่ในหมวดเดิม) */
export async function updateCategory(db: AllocDB, id: string, patch: Partial<Pick<LogCategory, 'name' | 'icon' | 'bg' | 'fg'>>, now = Date.now()) {
  await db.logCategories.update(id, { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}), updatedAt: now });
}

/** หมวดสำรองที่ลบไม่ได้: รายการจากการ์ด "จ่ายหรือยัง" ที่ไม่ได้ผูกหมวดใช้หมวดนี้ */
export const FALLBACK_CAT: Record<LogType, string> = { expense: 'c-other', income: 'i-other' };

/**
 * ลบหมวด: รายการที่จดในหมวดนี้ย้ายไป "อื่น ๆ" ของประเภทเดียวกัน · เอาหมวดออกจากรายการในแผนที่ผูกไว้
 * หมวด "อื่น ๆ" ลบไม่ได้
 */
export async function deleteCategory(db: AllocDB, id: string, now = Date.now()) {
  const cat = await db.logCategories.get(id);
  if (!cat || id === FALLBACK_CAT[cat.type]) return 0;
  const to = FALLBACK_CAT[cat.type];
  return db.transaction('rw', [db.logCategories, db.logEntries, db.planItems, db.bills], async () => {
    const moved = await db.logEntries.where('categoryId').equals(id).modify({ categoryId: to, updatedAt: now });
    await db.bills.filter((b) => b.categoryId === id).modify({ categoryId: to, updatedAt: now }); // บิลที่ลงบันทึกหมวดนี้
    for (const it of await db.planItems.toArray()) {
      if (it.logCategoryIds.includes(id)) await db.planItems.update(it.id, { logCategoryIds: it.logCategoryIds.filter((c) => c !== id), updatedAt: now });
    }
    await db.logCategories.delete(id);
    return moved;
  });
}

/** เรียงหมวดใหม่จากการลาก (ประเภทเดียวกัน) */
export async function reorderCategories(db: AllocDB, ids: string[], now = Date.now()) {
  await db.transaction('rw', db.logCategories, async () => {
    for (let i = 0; i < ids.length; i++) await db.logCategories.update(ids[i], { order: i, updatedAt: now });
  });
}
