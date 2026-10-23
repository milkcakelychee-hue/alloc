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

// ---------- ขั้นที่ 5: หน้าเป้าหมาย ----------

/** ยอดสมทบ PVD จาก % ของเงินเดือนก่อนหัก · bp = basis points (500 = 5%) · ปัดเป็นสตางค์ */
export const pvdFromRate = (gross: Satang, bp: number): Satang => Math.round((gross * bp) / 10000);

/** ยอดตามแผนต่อเดือนของเป้า (PVD = ส่วนของฉัน + นายจ้าง) */
export const planOf = (goal: Goal, items: PlanItem[]) => (goal.type === 'pvd' ? pvdMonthly(goal) : plannedFor(goal.id, items));

/** รอบแรกที่ยังไม่ได้บวกตามแผน: ถ้ารอบนี้บวกแล้ว (เงินเดือนเข้าแล้ว) เริ่มรอบหน้า */
export function nextDepositCycle(goal: Goal, adjustments: GoalAdjustment[], currentCycle: Month): Month {
  const done = adjustments.some((a) => a.goalId === goal.id && a.cycleMonth === currentCycle && (a.kind === 'planDeposit' || a.kind === 'employer'));
  return done ? addMonths(currentCycle, 1) : currentCycle;
}

/** ยอดต่อเดือนคงที่ → ครบเป้าเดือนไหน (นับ start เป็นเดือนแรก) */
export function reachByMonthly(missing: Satang, perMonth: Satang, start: Month) {
  if (missing <= 0) return { months: 0, reachMonth: start };
  if (perMonth <= 0) return { months: 0, reachMonth: null as Month | null };
  const months = Math.ceil(missing / perMonth);
  return { months, reachMonth: addMonths(start, months - 1) as Month | null };
}

/** ยอดคงเหลือ ณ สิ้นรอบ m (ยอดยกมา + ทุกรายการที่อยู่ในรอบ m หรือก่อนหน้า) */
export function balanceAt(goal: Goal, adjustments: GoalAdjustment[], m: Month, cycleOfAdj: (a: GoalAdjustment) => Month) {
  let b = goal.openingBalance;
  for (const a of adjustments) if (a.goalId === goal.id && monthDiff(cycleOfAdj(a), m) >= 0) b += a.delta;
  return b;
}

export interface GoalOutlook {
  balance: Satang; remaining: Satang; pct: number; planNow: Satang;
  reachMonth: Month | null; done: boolean;
  horizon: Month; atHorizon: Satang; // ยอดคาดการณ์ ณ ธ.ค. ปีหน้า (ถ้าไม่ครบก่อน)
  stopsAt: { year: number; balance: Satang } | null; // แผนปีหน้าไม่มีรายการของเป้านี้
  changes: { month: Month; amount: Satang }[]; // ยอดแผนเปลี่ยนใน 12 เดือนข้างหน้า
}

/**
 * มุมมองของเป้าหนึ่งเป้า: ยอด % แผนรอบนี้ คาดการณ์วันครบ
 * ขอบคาดการณ์ = ธ.ค. ของปีถัดไป · PVD ไม่ตัดเดือนสุดท้าย
 */
export function goalOutlook(goal: Goal, items: PlanItem[], adjustments: GoalAdjustment[], currentCycle: Month): GoalOutlook {
  const balance = goalBalance(goal, adjustments);
  const planFor = planOf(goal, items);
  const year = Number(currentCycle.slice(0, 4));
  const horizon = `${year + 1}-12`;
  const from = nextDepositCycle(goal, adjustments, currentCycle);
  const p = projectGoal({ balance, target: goal.target, from, planFor, maxMonths: 600, cap: goal.type !== 'pvd' });
  const span = Math.max(monthDiff(from, horizon) + 1, 0);
  const upTo = (end: Month) => p.months.filter((x) => monthDiff(x.month, end) >= 0).at(-1)?.balance ?? balance;
  const atHorizon = p.reachMonth && monthDiff(p.reachMonth, horizon) >= 0 ? goal.target : (span ? upTo(horizon) : balance);
  // แผนปีหน้าว่าง แต่ปีนี้ยังมีแผน และยังไม่ครบเป้าภายในปีนี้
  let stopsAt: GoalOutlook['stopsAt'] = null;
  const nextYear = Array.from({ length: 12 }, (_, i) => `${year + 1}-${String(i + 1).padStart(2, '0')}`);
  const reachedThisYear = p.done || (p.reachMonth !== null && Number(p.reachMonth.slice(0, 4)) <= year);
  const plannedThisYear = monthDiff(currentCycle, `${year}-12`) >= 0 && Array.from({ length: monthDiff(currentCycle, `${year}-12`) + 1 }, (_, i) => addMonths(currentCycle, i)).some((m) => planFor(m) > 0);
  if (goal.type !== 'pvd' && !reachedThisYear && plannedThisYear && nextYear.every((m) => planFor(m) === 0)) {
    stopsAt = { year: year + 1, balance: upTo(`${year}-12`) };
  }
  const changes: GoalOutlook['changes'] = [];
  for (let i = 1; i <= 12; i++) {
    const m = addMonths(currentCycle, i);
    const a = planFor(m), prev = planFor(addMonths(m, -1));
    if (a !== prev && a > 0 && !(p.reachMonth && monthDiff(p.reachMonth, m) > 0)) changes.push({ month: m, amount: a });
  }
  return {
    balance, remaining: Math.max(goal.target - balance, 0), pct: goal.target > 0 ? balance / goal.target : 0,
    planNow: planFor(currentCycle), reachMonth: p.reachMonth, done: p.done, horizon, atHorizon, stopsAt, changes
  };
}
