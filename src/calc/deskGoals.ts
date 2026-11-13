// หน้าเป้าหมายบนคอม (ALLOC_DESKTOP_SPEC ข้อ 8) · ตัวคำนวณล้วน: กราฟรายเดือน ประวัติยอด ลำดับเป้า
import type { Goal, GoalAdjustment, Month, PlanItem, Satang } from '../db/types';
import { addMonths, monthDiff } from './dates';
import { balanceAt, goalBalance, nextDepositCycle, planOf, projectGoal } from './goals';

export interface ChartBar { month: Month; value: Satang; actual: boolean }

/**
 * กราฟยอดจริงและคาดการณ์: ย้อนหลังไม่เกิน 5 รอบ (ไม่ก่อนรอบที่สร้างเป้า) + รอบนี้ + คาดการณ์
 * คาดการณ์ถึงเดือนที่ครบเป้า (ไม่มีวันครบ = ธ.ค. ปีหน้า) · รวมไม่เกิน max แท่ง
 * เป้าที่ปิดแล้วหรือครบแล้ว ไม่มีแท่งคาดการณ์
 */
export function goalChart(goal: Goal, items: PlanItem[], adjustments: GoalAdjustment[], cur: Month, createdCycle: Month, cycleOfAdj: (a: GoalAdjustment) => Month, max = 18): ChartBar[] {
  const back = Math.min(5, Math.max(monthDiff(createdCycle, cur), 0));
  const bars: ChartBar[] = [];
  for (let i = back; i >= 0; i--) {
    const m = addMonths(cur, -i);
    bars.push({ month: m, value: balanceAt(goal, adjustments, m, cycleOfAdj), actual: true });
  }
  const balance = goalBalance(goal, adjustments);
  if (goal.closed || balance >= goal.target) return bars;
  const horizon = `${Number(cur.slice(0, 4)) + 1}-12`;
  const from = nextDepositCycle(goal, adjustments, cur);
  const p = projectGoal({ balance, target: goal.target, from, planFor: planOf(goal, items), maxMonths: Math.max(max - bars.length + 1, 0), cap: goal.type !== 'pvd' });
  const end = p.reachMonth ?? horizon;
  for (const x of p.months) {
    if (monthDiff(cur, x.month) <= 0 || monthDiff(x.month, end) < 0 || bars.length >= max) continue;
    bars.push({ month: x.month, value: x.balance, actual: false });
  }
  return bars;
}

export interface HistoryRow { id: string; date: string; adj: GoalAdjustment | null; delta: Satang; after: Satang }

/** ประวัติยอดครบทุกรายการ ใหม่ไปเก่า พร้อมยอดหลังรายการ · แถวสุดท้ายคือยอดยกมา (adj = null) */
export function goalHistory(goal: Goal, adjustments: GoalAdjustment[]): HistoryRow[] {
  const mine = adjustments.filter((a) => a.goalId === goal.id).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  let run = goal.openingBalance;
  const rows: HistoryRow[] = mine.map((a) => { run += a.delta; return { id: a.id, date: a.date, adj: a, delta: a.delta, after: run }; });
  const created = new Date(goal.createdAt);
  const d = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
  return [...rows.reverse(), { id: `open-${goal.id}`, date: d, adj: null, delta: goal.openingBalance, after: goal.openingBalance }];
}

/** ลำดับเป้าในกลุ่ม: ตามที่ลากเรียงไว้ (order) แล้วตามวันที่สร้าง */
export const goalSort = (a: Goal, b: Goal) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt) || a.createdAt - b.createdAt;

/** ลากเป้า id ไปวางก่อน beforeId (null = ท้ายกลุ่ม) → ค่า order ใหม่ของทุกเป้าในกลุ่ม */
export function reorderGoals(list: Goal[], id: string, beforeId: string | null): { id: string; order: number }[] {
  const ids = [...list].sort(goalSort).map((g) => g.id).filter((x) => x !== id);
  const at = beforeId ? ids.indexOf(beforeId) : -1;
  ids.splice(at < 0 ? ids.length : at, 0, id);
  return ids.map((x, i) => ({ id: x, order: i + 1 }));
}
