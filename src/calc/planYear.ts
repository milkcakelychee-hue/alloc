// มุมมองปีและ 3 เดือน (ต้นแบบ PlanYear / PlanMonthsB) · ตัวเลขสรุปคำนวณสดจากแผน
import type { GroupKind, Month, PlanGroup, PlanItem, Satang } from '../db/types';
import { addMonths } from './dates';
import { planTotals, type AmountOf, type PlanTotals } from './plan';

export const yearMonths = (year: number): Month[] => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

export interface YearSummary {
  months: { month: Month; t: PlanTotals; expense: Satang; saveInvest: Satang }[];
  activeMonths: number; // เดือนที่มีรายรับในแผน
  income: Satang; fixed: Satang; variable: Satang; goalSpend: Satang; saving: Satang; invest: Satang; leftover: Satang;
  savingsRate: number;
  minLeft: { month: Month; leftover: Satang } | null;
  maxExpense: { month: Month; expense: Satang } | null;
  negative: { month: Month; leftover: Satang }[];
  groups: { kind: GroupKind; total: Satang; avg: Satang; max: { month: Month; amount: Satang } | null; items: number }[];
}

export function yearSummary(groups: PlanGroup[], items: PlanItem[], year: number, amountOf: AmountOf): YearSummary {
  const months = yearMonths(year).map((month) => {
    const t = planTotals(groups, items, month, amountOf);
    return { month, t, expense: t.fixed + t.variable + t.goalSpend, saveInvest: t.saving + t.invest };
  });
  const active = months.filter((m) => m.t.income > 0);
  const sum = (k: keyof PlanTotals) => active.reduce((s, m) => s + (m.t[k] as number), 0);
  const income = sum('income'), saving = sum('saving'), invest = sum('invest');
  const pick = <T,>(xs: T[], better: (a: T, b: T) => boolean) => xs.reduce<T | null>((best, x) => (best === null || better(x, best) ? x : best), null);
  const minLeftM = pick(active, (a, b) => a.t.leftover < b.t.leftover);
  const maxExpM = pick(active, (a, b) => a.expense > b.expense);
  const enabled = groups.filter((g) => g.enabled);
  const groupStats = (['fixed', 'variable', 'goalSpend', 'saving', 'invest'] as GroupKind[])
    .filter((k) => enabled.some((g) => g.kind === k))
    .map((kind) => {
      const ids = new Set(enabled.filter((g) => g.kind === kind).map((g) => g.id));
      const total = active.reduce((s, m) => s + m.t[kind], 0);
      const best = pick(active.filter((m) => m.t[kind] > 0), (a, b) => a.t[kind] > b.t[kind]);
      const used = items.filter((i) => ids.has(i.groupId) && active.some((m) => amountOf(i, m.month) > 0)).length;
      return { kind, total, avg: active.length ? Math.round(total / active.length) : 0, max: best ? { month: best.month, amount: best.t[kind] } : null, items: used };
    });
  return {
    months, activeMonths: active.length,
    income, fixed: sum('fixed'), variable: sum('variable'), goalSpend: sum('goalSpend'), saving, invest, leftover: sum('leftover'),
    savingsRate: income ? (saving + invest) / income : 0,
    minLeft: minLeftM ? { month: minLeftM.month, leftover: minLeftM.t.leftover } : null,
    maxExpense: maxExpM ? { month: maxExpM.month, expense: maxExpM.expense } : null,
    negative: active.filter((m) => m.t.leftover < 0).map((m) => ({ month: m.month, leftover: m.t.leftover })),
    groups: groupStats
  };
}

export type ItemChange =
  | { kind: 'changed'; item: PlanItem; month: Month; from: Satang; to: Satang }
  | { kind: 'started'; item: PlanItem; month: Month; to: Satang }
  | { kind: 'ended'; item: PlanItem; month: Month; from: Satang }; // month = เดือนสุดท้ายที่มียอด

/** ยอดของรายการที่เปลี่ยนจากเดือนก่อน (ใช้ทำ ▲▼ ในมุมมอง 3 เดือน และ "จุดที่ควรรู้ปีนี้") */
export function itemChanges(items: PlanItem[], months: Month[], amountOf: AmountOf): ItemChange[] {
  const out: ItemChange[] = [];
  for (const item of items) {
    let prev = amountOf(item, addMonths(months[0], -1));
    for (const m of months) {
      const cur = amountOf(item, m);
      if (prev > 0 && cur > 0 && cur !== prev) out.push({ kind: 'changed', item, month: m, from: prev, to: cur });
      else if (prev === 0 && cur > 0 && m !== months[0]) out.push({ kind: 'started', item, month: m, to: cur });
      else if (prev > 0 && cur === 0) out.push({ kind: 'ended', item, month: addMonths(m, -1), from: prev });
      prev = cur;
    }
  }
  return out;
}
