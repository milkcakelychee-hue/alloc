// บันทึกรายรับรายจ่ายและงบ (SPEC 6.4) · รายจ่ายนับ myShare เสมอ
import type { DateStr, LogEntry, Month, PlanGroup, PlanItem, Satang } from '../db/types';
import { cycleOf, cycleRange, daysBetween, type Pay } from './dates';
import { rawAmount, type AmountOf } from './plan';

/** รอบของรายการ: รอบที่บันทึกไว้ (เช่น จดหลังเงินเดือนเข้าก่อนกำหนด) ไม่งั้นรอบของวันที่ */
export const entryCycle = (e: Pick<LogEntry, 'date' | 'cycleMonth'>, payday: Pay): Month => e.cycleMonth ?? cycleOf(e.date, payday);

export const expensesIn = (entries: LogEntry[], cycle: Month, payday: Pay) =>
  entries.filter((e) => e.type === 'expense' && entryCycle(e, payday) === cycle);

export function spentByCategory(entries: LogEntry[]) {
  const m = new Map<string, Satang>();
  for (const e of entries) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + e.myShare);
  return m;
}

/**
 * งบของหมวด = ผลรวมยอดในแผนของรายการที่ผูกหมวดนั้น − ที่ใช้ไปในรอบของทุกหมวดที่ใช้งบเดียวกัน (หมวดพี่น้อง)
 * หมวดที่ไม่ผูก = นอกงบ (budget null)
 */
export function categoryBudget(categoryId: string, items: PlanItem[], cycleExpenses: LogEntry[], m: Month, amountOf: AmountOf = rawAmount) {
  const linked = items.filter((i) => i.logCategoryIds.includes(categoryId));
  const spent = spentByCategory(cycleExpenses);
  const spentSelf = spent.get(categoryId) ?? 0;
  if (linked.length === 0) return { budget: null, spentSelf, spentSiblings: 0, remaining: null as Satang | null };
  const budget = linked.reduce((s, i) => s + amountOf(i, m), 0);
  const siblings = new Set(linked.flatMap((i) => i.logCategoryIds));
  siblings.delete(categoryId);
  let spentSiblings = 0;
  for (const c of siblings) spentSiblings += spent.get(c) ?? 0;
  return { budget, spentSelf, spentSiblings, remaining: budget - spentSelf - spentSiblings };
}

/** วันที่ของรอบ: วันที่ผ่านไป (รวมวันนี้) และจำนวนวันที่เหลือหลังวันนี้ */
export function cycleDays(today: DateStr, payday: Pay) {
  const r = cycleRange(cycleOf(today, payday), payday);
  const elapsed = daysBetween(r.start, today) + 1;
  return { ...r, elapsed, daysLeft: r.days - elapsed };
}

/**
 * งบใช้จ่ายรายวัน = ผลรวมรายการในหมวดผันแปรที่ผูกหมวดบันทึกอย่างน้อย 1 หมวด − ที่ใช้ไปในหมวดเหล่านั้น
 * ใช้ได้วันละ = ที่เหลือ ÷ จำนวนวันที่เหลือหลังวันนี้ · วันสุดท้ายของรอบใช้ที่เหลือทั้งหมด
 */
export function dailyBudget(groups: PlanGroup[], items: PlanItem[], entries: LogEntry[], today: DateStr, payday: Pay, amountOf: AmountOf = rawAmount) {
  const cycle = cycleOf(today, payday);
  const variable = new Set(groups.filter((g) => g.enabled && g.kind === 'variable').map((g) => g.id));
  const linked = items.filter((i) => variable.has(i.groupId) && i.logCategoryIds.length > 0);
  const budget = linked.reduce((s, i) => s + amountOf(i, cycle), 0);
  const cats = new Set(linked.flatMap((i) => i.logCategoryIds));
  const spent = expensesIn(entries, cycle, payday).filter((e) => cats.has(e.categoryId)).reduce((s, e) => s + e.myShare, 0);
  const remaining = budget - spent;
  const d = cycleDays(today, payday);
  const perDay = Math.round(remaining / Math.max(d.daysLeft, 1));
  return { cycle, budget, spent, remaining, daysLeft: d.daysLeft, perDay };
}

/** จังหวะงบ: ใช้ไป% เทียบวันที่ผ่านไป% · คาดการณ์ปลายรอบ = ใช้ไป ÷ วันที่ผ่าน × วันในรอบ */
export function pace(spent: Satang, budget: Satang, today: DateStr, payday: Pay) {
  const d = cycleDays(today, payday);
  return {
    usedRatio: budget === 0 ? 0 : spent / budget,
    elapsedRatio: d.elapsed / d.days,
    projected: Math.round((spent * d.days) / d.elapsed)
  };
}

export interface CategoryShare { categoryId: string | 'other'; total: Satang; ratio: number; count: number; avg: Satang }

/** เงินไปไหน: สัดส่วนต่อหมวด = ยอดหมวด ÷ รายจ่ายรวมรอบ · เกิน 7 หมวดรวมเป็น "อื่น ๆ" */
export function whereMoneyGoes(cycleExpenses: LogEntry[], max = 7): { total: Satang; rows: CategoryShare[] } {
  const by = new Map<string, { total: Satang; count: number }>();
  for (const e of cycleExpenses) {
    const r = by.get(e.categoryId) ?? { total: 0, count: 0 };
    r.total += e.myShare; r.count += 1;
    by.set(e.categoryId, r);
  }
  const total = [...by.values()].reduce((s, r) => s + r.total, 0);
  const sorted = [...by.entries()].sort((a, b) => b[1].total - a[1].total);
  const row = (categoryId: string, t: Satang, count: number): CategoryShare =>
    ({ categoryId, total: t, ratio: total === 0 ? 0 : t / total, count, avg: Math.round(t / count) });
  const rows = sorted.slice(0, sorted.length > max ? max - 1 : max).map(([id, r]) => row(id, r.total, r.count));
  if (sorted.length > max) {
    const rest = sorted.slice(max - 1);
    rows.push(row('other', rest.reduce((s, [, r]) => s + r.total, 0), rest.reduce((s, [, r]) => s + r.count, 0)));
  }
  return { total, rows };
}

/** อินไซต์จากตัวเลข: รวมนอกงบ และวันที่จ่ายมากสุด */
export function offBudgetTotal(cycleExpenses: LogEntry[], items: PlanItem[]) {
  const linked = new Set(items.flatMap((i) => i.logCategoryIds));
  return cycleExpenses.filter((e) => !linked.has(e.categoryId)).reduce((s, e) => s + e.myShare, 0);
}
export function topDay(cycleExpenses: LogEntry[]) {
  const by = new Map<DateStr, Satang>();
  for (const e of cycleExpenses) by.set(e.date, (by.get(e.date) ?? 0) + e.myShare);
  let best: { date: DateStr; total: Satang } | null = null;
  for (const [date, total] of by) if (!best || total > best.total) best = { date, total };
  return best;
}
