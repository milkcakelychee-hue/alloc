// ตาราง 12 เดือนบนคอม (ALLOC_DESKTOP_SPEC ข้อ 4): ตัวเลขทุกช่องคิดจากกฎเดิม (planTotals / amountOf) เท่านั้น
import type { GroupKind, Month, PlanGroup, PlanItem, Satang } from '../db/types';
import { addMonths } from './dates';
import { inPeriod, planTotals, rawAmount, type AmountOf, type PlanTotals } from './plan';
import { yearMonths } from './planYear';

/** ช่องของรายการ: null = นอกช่วงที่มีผล (ลายขีด ไม่ใช่ 0) · trend = เทียบเดือนก่อน (เฉพาะเมื่อทั้งสองเดือนอยู่ในช่วง) */
export interface GridCell { month: Month; amount: Satang | null; trend: 'up' | 'down' | null }
export interface GridItemRow { item: PlanItem; cells: GridCell[]; total: Satang }
export interface GridGroup { group: PlanGroup; rows: GridItemRow[]; totals: Satang[]; total: Satang }
export interface GridSummary { income: Satang[]; expense: Satang[]; saveInvest: Satang[]; leftover: Satang[] }
export interface PlanGrid { months: Month[]; groups: GridGroup[]; summary: GridSummary; yearTotal: { income: Satang; expense: Satang; saveInvest: Satang; leftover: Satang } }

export function planGrid(groups: PlanGroup[], items: PlanItem[], year: number, amountOf: AmountOf = rawAmount): PlanGrid {
  const months = yearMonths(year);
  const totals: PlanTotals[] = months.map((m) => planTotals(groups, items, m, amountOf));
  const gs = groups.filter((g) => g.enabled).map((group) => {
    const rows = items.filter((i) => i.groupId === group.id).map((item) => {
      const cells = months.map((month): GridCell => {
        if (!inPeriod(item, month)) return { month, amount: null, trend: null };
        const amount = amountOf(item, month);
        const prevM = addMonths(month, -1);
        let trend: GridCell['trend'] = null;
        if (inPeriod(item, prevM)) {
          const prev = amountOf(item, prevM);
          if (amount > prev) trend = 'up';
          else if (amount < prev) trend = 'down';
        }
        return { month, amount, trend };
      });
      return { item, cells, total: cells.reduce((a, c) => a + (c.amount ?? 0), 0) };
    });
    const t = months.map((_, i) => rows.reduce((a, r) => a + (r.cells[i].amount ?? 0), 0));
    return { group, rows, totals: t, total: t.reduce((a, b) => a + b, 0) };
  });
  const summary: GridSummary = {
    income: totals.map((t) => t.income),
    expense: totals.map((t) => t.fixed + t.variable + t.goalSpend),
    saveInvest: totals.map((t) => t.saving + t.invest),
    leftover: totals.map((t) => t.leftover)
  };
  const s = (xs: Satang[]) => xs.reduce((a, b) => a + b, 0);
  return { months, groups: gs, summary, yearTotal: { income: s(summary.income), expense: s(summary.expense), saveInvest: s(summary.saveInvest), leftover: s(summary.leftover) } };
}

/** ช่วงปีที่เลือกได้: ย้อนถึงปีแรกที่มีแผน · ไปข้างหน้าได้แค่ปีถัดจากปีปัจจุบัน */
export function yearBounds(items: PlanItem[], currentYear: number) {
  let min = currentYear;
  for (const i of items) {
    const ys = [i.period.start, ...Object.keys(i.monthOverrides)].map((m) => Number(m.slice(0, 4)));
    for (const y of ys) if (y < min) min = y;
  }
  return { min, max: currentYear + 1 };
}

export const clampYear = (y: number, b: { min: number; max: number }) => Math.min(Math.max(y, b.min), b.max);

export const kindTone = (k: GroupKind) => (k === 'income' ? 'inc' : k === 'goalSpend' ? 'goal' : k === 'saving' || k === 'invest' ? 'sav' : 'exp');
