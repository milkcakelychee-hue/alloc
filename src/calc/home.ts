// หน้าหลัก สรุป (SPEC 6.2 / 6.3 · ขั้นที่ 6)
import type { DateStr, Goal, GoalAdjustment, Month, Satang } from '../db/types';
import { addMonths, cycleOf, daysBetween, type PayRule } from './dates';
import { expectedPayDate, type WeekendShift } from './payday';
import { pct1 } from './money';
import { totalAssets } from './goals';
import type { PlanTotals } from './plan';

/** สินทรัพย์รวม + สัดส่วนเงินเก็บ / ลงทุน (% ทศนิยม 1 ตำแหน่ง รวมกันได้ 100) */
export function assetsSummary(goals: Goal[], adjustments: GoalAdjustment[]) {
  const a = totalAssets(goals, adjustments);
  const savingPct = pct1(a.saving, a.total);
  return { ...a, savingPct, investPct: a.total ? Math.round((100 - savingPct) * 10) / 10 : 0 };
}

/** สินทรัพย์รวมเปลี่ยนไปเท่าไหร่ในรอบนี้ (เงินเก็บ + ลงทุน) · นับรายการปรับยอดของรอบ ไม่นับยอดตั้งต้นของเป้า */
export function assetsChange(goals: Goal[], adjustments: GoalAdjustment[], cycle: Month, pay: PayRule): Satang {
  const ids = new Set(goals.filter((g) => g.type === 'saving' || g.type === 'invest').map((g) => g.id));
  let d = 0;
  for (const a of adjustments) if (ids.has(a.goalId) && (a.cycleMonth ?? cycleOf(a.date, pay)) === cycle) d += a.delta;
  return d;
}

/** แบ่งรายรับของรอบตามแผน: ออม / ลงทุน / รายจ่าย (คงที่ + ผันแปร + รายจ่ายตามเป้าหมาย) */
export function incomeSplit(t: PlanTotals) {
  const expense: Satang = t.fixed + t.variable + t.goalSpend;
  return {
    income: t.income, saving: t.saving, invest: t.invest, expense,
    savingPct: pct1(t.saving, t.income), investPct: pct1(t.invest, t.income), expensePct: pct1(expense, t.income),
    ratePct: pct1(t.saving + t.invest, t.income)
  };
}

export const PLAN_NEXT_DAYS = 10;

/**
 * การ์ด "วางแผนเดือนหน้า": ภายใน 10 วันก่อนเงินเดือนรอบหน้าเข้า และแผนรอบหน้ายังไม่มีรายรับหรือติดลบ
 * วันเงินเข้าใช้วันที่คาดว่าเข้าจริง (เลื่อนตามเสาร์อาทิตย์ / แก้เฉพาะเดือน)
 */
export function planNextPrompt(o: {
  pay: PayRule; shift: WeekendShift; overrides: Record<Month, DateStr>; today: DateStr;
  totalsOf: (m: Month) => PlanTotals;
}) {
  const cur = cycleOf(o.today, o.pay);
  const next = addMonths(cur, 1);
  const payDate = expectedPayDate(o.pay, o.shift, cur, o.overrides).date; // เงินของรอบหน้าเข้าในเดือนของรอบนี้
  const daysLeft = daysBetween(o.today, payDate);
  if (daysLeft < 0 || daysLeft > PLAN_NEXT_DAYS) return null;
  const t = o.totalsOf(next);
  if (t.income > 0 && t.leftover >= 0) return null;
  return { cycle: next, payDate, daysLeft, leftover: t.leftover, empty: t.income === 0 };
}
