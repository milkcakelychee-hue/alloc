// เป้าหมาย (SPEC 6.3)
import type { Goal, GoalAdjustment, Month, PlanItem, PvdContribution, Satang } from '../db/types';
import { addMonths, monthDiff } from './dates';
import { rawAmount, type AmountOf } from './plan';

/** ยอดปัจจุบัน = openingBalance + ผลรวม goalAdjustments */
export function goalBalance(goal: Goal, adjustments: GoalAdjustment[]): Satang {
  let b = goal.openingBalance;
  for (const a of adjustments) if (a.goalId === goal.id) b += a.delta;
  return b;
}

export interface ProjectionMonth { month: Month; deposit: Satang; balance: Satang }

/**
 * คาดการณ์วันครบ: ไล่ยอดตามแผนทีละเดือนตั้งแต่ from (ไม่ใช้สูตรหาร เพราะแต่ละเดือนยอดต่างกันได้)
 * เดือนสุดท้ายใส่เท่าที่ขาด (cap) · PVD ไม่ตัด เพราะสมทบต่อทุกเดือน
 * reachMonth = null ถ้าไม่ครบภายใน maxMonths หรือแผนเป็น 0
 */
export function projectGoal(opts: { balance: Satang; target: Satang; from: Month; planFor: (m: Month) => Satang; maxMonths?: number; cap?: boolean }) {
  const { target, from, planFor, maxMonths = 600, cap = true } = opts;
  let balance = opts.balance;
  const months: ProjectionMonth[] = [];
  if (balance >= target) return { months, reachMonth: null as Month | null, done: true };
  for (let i = 0; i < maxMonths; i++) {
    const month = addMonths(from, i);
    const deposit = cap ? Math.min(planFor(month), target - balance) : planFor(month);
    balance += deposit;
    months.push({ month, deposit, balance });
    if (balance >= target) return { months, reachMonth: month, done: false };
  }
  return { months, reachMonth: null, done: false };
}

/** สร้างเป้าก่อน: ยอดต่อเดือน = ยอดที่ขาด ÷ จำนวนเดือน ปัดขึ้นหลักสิบ · นับเดือนถัดจากรอบปัจจุบันถึงเดือนครบ */
export function suggestMonthly(missing: Satang, currentCycle: Month, dueMonth: Month) {
  const months = monthDiff(currentCycle, dueMonth);
  if (months <= 0 || missing <= 0) return { months: Math.max(months, 0), perMonth: Math.max(missing, 0) };
  const perMonth = Math.ceil(missing / months / 1000) * 1000; // 1000 สตางค์ = 10 บาท
  return { months, perMonth };
}

/** ยอดตามแผนต่อเดือนของเป้า = ผลรวมรายการในแผนที่ผูกเป้านั้น (ก่อนตัดเดือนสุดท้าย) */
export const plannedFor = (goalId: string, items: PlanItem[]) => (m: Month) =>
  items.filter((i) => i.goalId === goalId).reduce((s, i) => s + rawAmount(i, m), 0);

/**
 * AmountOf ที่ตัดรายการ endMode 'goal': เดือนหลังรอบปัจจุบันไล่ยอดคาดการณ์ เดือนที่ครบใส่เท่าที่ขาด หลังจากนั้นเป็น 0
 * รอบปัจจุบันและก่อนหน้าใช้ยอดตามแผน (ฝากไปแล้วตามจริง)
 */
export function goalAwareAmountOf(goals: Goal[], items: PlanItem[], adjustments: GoalAdjustment[], currentCycle: Month): AmountOf {
  const cache = new Map<string, Map<Month, Satang>>();
  const depositsOf = (g: Goal) => {
    let d = cache.get(g.id);
    if (!d) {
      const p = projectGoal({ balance: goalBalance(g, adjustments), target: g.target, from: addMonths(currentCycle, 1), planFor: plannedFor(g.id, items) });
      d = new Map(p.months.map((x) => [x.month, x.deposit]));
      cache.set(g.id, d);
    }
    return d;
  };
  const byId = new Map(goals.map((g) => [g.id, g]));
  return (item, m) => {
    const raw = rawAmount(item, m);
    const g = item.goalId ? byId.get(item.goalId) : undefined;
    if (!g || item.period.endMode !== 'goal' || monthDiff(currentCycle, m) <= 0) return raw;
    if (g.closed) return 0;
    // หลายรายการผูกเป้าเดียว: ตัดยอดตามลำดับรายการ
    let left = depositsOf(g).get(m) ?? 0;
    for (const other of items) {
      if (other.goalId !== g.id) continue;
      const a = Math.min(rawAmount(other, m), left);
      if (other.id === item.id) return a;
      left -= a;
    }
    return 0;
  };
}

/** ยอดสมทบ PVD ที่มีผลในเดือน m */
export function pvdContribution(goal: Goal, m: Month): PvdContribution | null {
  let cur: PvdContribution | null = null;
  for (const c of goal.contributions ?? []) if (monthDiff(c.from, m) >= 0 && (!cur || monthDiff(cur.from, c.from) > 0)) cur = c;
  return cur;
}
export const pvdMonthly = (goal: Goal) => (m: Month) => {
  const c = pvdContribution(goal, m);
  return c ? c.mine + c.employer : 0;
};

/**
 * วันเงินเดือนเข้า: รายการ adjustment ที่ต้องสร้างอัตโนมัติ ตั้งแต่รอบ fromCycle ถึงรอบปัจจุบัน ที่ยังไม่เคยสร้าง
 * เป้าทั่วไป → planDeposit ตามยอดในแผน (เดือนสุดท้ายเท่าที่ขาด) · PVD → planDeposit (ส่วนของฉัน) + employer (นายจ้าง)
 */
export function dueDeposits(
  goals: Goal[], items: PlanItem[], adjustments: GoalAdjustment[], currentCycle: Month,
  fromCycleOf: (g: Goal) => Month
): Omit<GoalAdjustment, 'id' | 'createdAt' | 'updatedAt' | 'date'>[] {
  const out: Omit<GoalAdjustment, 'id' | 'createdAt' | 'updatedAt' | 'date'>[] = [];
  for (const g of goals) {
    if (g.closed) continue;
    const done = new Set(adjustments.filter((a) => a.goalId === g.id && a.cycleMonth && (a.kind === 'planDeposit' || a.kind === 'employer')).map((a) => `${a.kind}|${a.cycleMonth}`));
    let balance = goalBalance(g, adjustments);
    for (let m = fromCycleOf(g); monthDiff(m, currentCycle) >= 0; m = addMonths(m, 1)) {
      if (g.type === 'pvd') {
        const c = pvdContribution(g, m);
        if (!c) continue;
        if (c.mine && !done.has(`planDeposit|${m}`)) out.push({ goalId: g.id, delta: c.mine, kind: 'planDeposit', reason: 'ส่วนของฉัน', cycleMonth: m });
        if (c.employer && !done.has(`employer|${m}`)) out.push({ goalId: g.id, delta: c.employer, kind: 'employer', reason: 'นายจ้างสมทบ', cycleMonth: m });
        continue;
      }
      if (done.has(`planDeposit|${m}`)) continue;
      const planned = plannedFor(g.id, items)(m);
      const capped = items.some((i) => i.goalId === g.id && i.period.endMode === 'goal') ? Math.min(planned, Math.max(g.target - balance, 0)) : planned;
      if (capped > 0) {
        out.push({ goalId: g.id, delta: capped, kind: 'planDeposit', reason: 'ฝากตามแผน', cycleMonth: m });
        balance += capped;
      }
    }
  }
  return out;
}

/** สินทรัพย์รวม = ยอดเป้าหมวดออม + เงินต้นเป้าหมวดลงทุน · ไม่รวม PVD และรายจ่ายตามเป้าหมาย ไม่หักหนี้ */
export function totalAssets(goals: Goal[], adjustments: GoalAdjustment[]) {
  let saving = 0, invest = 0;
  for (const g of goals) {
    if (g.type === 'saving') saving += goalBalance(g, adjustments);
    else if (g.type === 'invest') invest += goalBalance(g, adjustments);
  }
  return { saving, invest, total: saving + invest };
}
