// การกระทำในแท็บเป้าหมาย (ขั้นที่ 5 · docs/decisions.md)
import type { AllocDB } from './db';
import type { DateStr, Goal, GoalAdjustment, GoalType, Month, PlanItem, PvdContribution, Satang, Settings } from './types';
import { addMonths, cycleOf, monthDiff } from '../calc/dates';
import { fundedThrough } from '../calc/payday';
import { dueDeposits, pvdFromRate } from '../calc/goals';
import { stopFrom } from '../calc/plan';

export const GOAL_TYPES: GoalType[] = ['saving', 'invest', 'goalSpend', 'pvd'];
/** หมวดเป้า → หมวดใหญ่ในแผน (PVD แยกจากงบ ไม่มีในแผน) */
export const GROUP_OF: Record<GoalType, string | null> = { saving: 'g-saving', invest: 'g-invest', goalSpend: 'g-goalSpend', pvd: null };

export const goalCats = (s: Settings | undefined) => {
  const c = s?.goalCats ?? { order: GOAL_TYPES, hidden: [] };
  const order = [...c.order, ...GOAL_TYPES.filter((t) => !c.order.includes(t))];
  return { order: order.filter((t) => !c.hidden.includes(t)), hidden: c.hidden };
};

const stamp = (now: number) => ({ id: crypto.randomUUID(), createdAt: now, updatedAt: now });
const localDate = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * บวกยอดเป้าตามแผนเมื่อเงินเดือนเข้า: ทุกรอบที่ "เข้าแล้ว" (กดยืนยัน หรือเลยวันเงินเข้า 7 วัน) ที่ยังไม่เคยบวก
 * เรียกตอนเปิดแอปและหลังกด "เงินเดือนเข้าแล้ว" · บวกซ้ำไม่ได้ (เช็กจาก cycleMonth)
 */
export async function syncDeposits(db: AllocDB, today: DateStr, now = Date.now()) {
  const s = await db.settings.get('app');
  if (!s) return 0;
  return db.transaction('rw', [db.goals, db.goalAdjustments, db.planItems, db.payReceipts], async () => {
    const [goals, items, adjustments, receipts] = await Promise.all([db.goals.toArray(), db.planItems.toArray(), db.goalAdjustments.toArray(), db.payReceipts.toArray()]);
    if (!goals.length) return 0;
    const received = new Map(receipts.filter((r) => r.status === 'received').map((r) => [r.id, r.date]));
    const f = fundedThrough({ pay: s.pay, shift: s.weekendShift, overrides: s.payOverrides, today, received });
    const fromOf = (g: Goal) => g.depositFrom ?? addMonths(cycleOf(localDate(g.createdAt), s.pay), 1);
    const due = dueDeposits(goals, items, adjustments, f.cycle, fromOf);
    for (const d of due) await db.goalAdjustments.add({ ...stamp(now), ...d, date: f.dateOf(d.cycleMonth!) });
    return due.length;
  });
}

export interface NewGoal {
  type: GoalType; name: string; icon: string; color: string; target: Satang; opening: Satang;
  dueMonth: Month | null; note?: string;
  plan?: { amount: Satang; start: Month } | null; // เพิ่มลงแผนรายเดือน: ทุกเดือนจนถึงเป้า
  pvd?: PvdContribution | null;
}

/** สร้างเป้า (+ รายการในแผน) · หมวดที่เคยลบจะกลับมา */
export async function createGoal(db: AllocDB, g: NewGoal, currentCycle: Month, now = Date.now()) {
  return db.transaction('rw', [db.goals, db.planItems, db.planGroups, db.settings], async () => {
    const goal: Goal = {
      ...stamp(now), type: g.type, name: g.name.trim(), icon: g.icon, color: g.color, target: g.target,
      dueMonth: g.dueMonth, note: g.note ?? '', openingBalance: g.opening, closed: false,
      depositFrom: g.plan?.start ?? addMonths(currentCycle, 1),
      ...(g.type === 'pvd' && g.pvd ? { contributions: [g.pvd], depositFrom: g.pvd.from } : {})
    };
    await db.goals.add(goal);
    const groupId = GROUP_OF[g.type];
    if (groupId) await db.planGroups.update(groupId, { enabled: true, updatedAt: now });
    if (groupId && g.plan && g.plan.amount > 0) {
      const order = (await db.planItems.where('groupId').equals(groupId).toArray()).reduce((m, i) => Math.max(m, i.order), 0) + 1;
      const item: PlanItem = {
        ...stamp(now), groupId, name: goal.name, icon: g.type === 'invest' ? 'trend' : g.type === 'saving' ? 'piggy' : 'gift',
        defaultAmount: g.plan.amount, monthOverrides: {}, period: { start: g.plan.start, endMode: 'goal' },
        accountId: null, goalId: goal.id, logCategoryIds: [], order, dueDay: null
      };
      await db.planItems.add(item);
    }
    const s = await db.settings.get('app');
    if (s?.goalCats?.hidden.includes(g.type)) {
      await db.settings.update('app', { goalCats: { order: s.goalCats.order, hidden: s.goalCats.hidden.filter((t) => t !== g.type) }, updatedAt: now });
    }
    return goal.id;
  });
}

export type AdjustMode = 'add' | 'out' | 'set';
/** ส่วนต่างที่จะบันทึก · แก้ยอดคงเหลือ: พิมพ์ยอดจริง แอปคิดส่วนต่างให้ */
export const adjustDelta = (mode: AdjustMode, amount: Satang, balance: Satang): Satang =>
  mode === 'add' ? amount : mode === 'out' ? -amount : amount - balance;

/** ปรับยอดคงเหลือ (ไม่เปลี่ยนแผนรายเดือน · บันทึกในประวัติยอด) */
export async function adjustGoal(db: AllocDB, o: { goalId: string; mode: AdjustMode; amount: Satang; balance: Satang; reason: string; note: string; today: DateStr; now?: number }) {
  const delta = adjustDelta(o.mode, o.amount, o.balance);
  if (delta === 0) return null;
  const kind: GoalAdjustment['kind'] = o.mode === 'add' ? 'deposit' : o.mode === 'out' ? 'withdraw' : 'correction';
  const a: GoalAdjustment = { ...stamp(o.now ?? Date.now()), goalId: o.goalId, date: o.today, delta, kind, reason: o.reason, note: o.note.trim() };
  await db.goalAdjustments.add(a);
  return a;
}

/**
 * รายจ่ายตามเป้าหมาย "ใช้เงินก้อนนี้แล้ว": ยอดที่กันไว้บันทึกเป็นรายจ่ายรอบนี้ · ปิดเป้า · แผนหยุดกันเงินตั้งแต่รอบถัดไป
 * หมวดบันทึก = หมวดแรกที่รายการในแผนผูกไว้ ไม่ผูก = อื่น ๆ
 */
export async function spendGoal(db: AllocDB, o: { goal: Goal; balance: Satang; currentCycle: Month; today: DateStr; now?: number }) {
  const now = o.now ?? Date.now();
  const next = addMonths(o.currentCycle, 1);
  await db.transaction('rw', [db.goals, db.goalAdjustments, db.planItems, db.logEntries], async () => {
    const items = await db.planItems.filter((i) => i.goalId === o.goal.id).toArray();
    if (o.balance > 0) {
      await db.logEntries.add({
        ...stamp(now), date: o.today, type: 'expense', amountPaid: o.balance, myShare: o.balance,
        categoryId: items.find((i) => i.logCategoryIds.length)?.logCategoryIds[0] ?? 'c-other',
        note: o.goal.name, billItemId: null, planItemId: null, cycleMonth: o.currentCycle
      });
      await db.goalAdjustments.add({ ...stamp(now), goalId: o.goal.id, date: o.today, delta: -o.balance, kind: 'spent', reason: 'ใช้เงินก้อนนี้แล้ว' });
    }
    for (const it of items) {
      const ended = it.period.endMode === 'month' && it.period.endMonth && monthDiff(it.period.endMonth, next) > 0;
      if (!ended && monthDiff(it.period.start, next) >= 0) await db.planItems.put({ ...stopFrom(it, next), updatedAt: now });
      else if (monthDiff(it.period.start, next) < 0) await db.planItems.delete(it.id); // ยังไม่เริ่ม: ลบทิ้ง
    }
    await db.goals.update(o.goal.id, { closed: true, updatedAt: now });
  });
}

/** ลบหมวดเป้า: ลบเป้า ประวัติยอด รายการในแผนที่ผูก · ซ่อนหมวดในแผน · เพิ่มกลับได้จากหน้าสร้างเป้า */
export async function deleteGoalCategory(db: AllocDB, type: GoalType, now = Date.now()) {
  await db.transaction('rw', [db.goals, db.goalAdjustments, db.planItems, db.paidChecks, db.planGroups, db.settings], async () => {
    const ids = (await db.goals.where('type').equals(type).toArray()).map((g) => g.id);
    await db.goalAdjustments.where('goalId').anyOf(ids).delete();
    const itemIds = (await db.planItems.where('goalId').anyOf(ids).toArray()).map((i) => i.id);
    await db.planItems.bulkDelete(itemIds);
    await db.paidChecks.filter((c) => itemIds.includes(c.planItemId)).delete();
    await db.goals.bulkDelete(ids);
    const groupId = GROUP_OF[type];
    if (groupId) await db.planGroups.update(groupId, { enabled: false, updatedAt: now });
    const s = await db.settings.get('app');
    const c = s?.goalCats ?? { order: GOAL_TYPES, hidden: [] };
    await db.settings.update('app', { goalCats: { order: c.order, hidden: [...new Set([...c.hidden, type])] }, updatedAt: now });
  });
}

export async function reorderGoalCats(db: AllocDB, order: GoalType[], now = Date.now()) {
  const s = await db.settings.get('app');
  await db.settings.update('app', { goalCats: { order, hidden: s?.goalCats?.hidden ?? [] }, updatedAt: now });
}

/** ตั้งเงินสมทบ PVD จาก % ของเงินเดือนก่อนหัก มีผลตั้งแต่รอบ from (แทนรายการเดิมที่ from เดียวกัน) */
export function pvdEntry(from: Month, gross: Satang, mineBp: number, employerBp: number): PvdContribution {
  return { from, gross, mineBp, employerBp, mine: pvdFromRate(gross, mineBp), employer: pvdFromRate(gross, employerBp) };
}
export async function setPvdContribution(db: AllocDB, goal: Goal, c: PvdContribution, now = Date.now()) {
  const list = (goal.contributions ?? []).filter((x) => x.from !== c.from).concat(c).sort((a, b) => a.from.localeCompare(b.from));
  await db.goals.update(goal.id, { contributions: list, updatedAt: now });
}

/** แก้ชื่อ ไอคอน สี ยอดเป้า วันครบ โน้ต · ไม่เปลี่ยนแผนเอง (ผู้ใช้ไปแก้ที่แท็บแผน) */
export async function updateGoal(db: AllocDB, id: string, patch: Partial<Pick<Goal, 'name' | 'icon' | 'color' | 'target' | 'dueMonth' | 'note'>>, now = Date.now()) {
  await db.transaction('rw', [db.goals, db.planItems], async () => {
    await db.goals.update(id, { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}), updatedAt: now });
  });
}

/** ลบเป้าเดียว: ลบประวัติยอดและรายการในแผนที่ผูก */
export async function deleteGoal(db: AllocDB, id: string) {
  await db.transaction('rw', [db.goals, db.goalAdjustments, db.planItems, db.paidChecks], async () => {
    await db.goalAdjustments.where('goalId').equals(id).delete();
    const itemIds = (await db.planItems.where('goalId').equals(id).toArray()).map((i) => i.id);
    await db.planItems.bulkDelete(itemIds);
    await db.paidChecks.filter((c) => itemIds.includes(c.planItemId)).delete();
    await db.goals.delete(id);
  });
}
