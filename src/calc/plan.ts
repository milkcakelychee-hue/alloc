// แผนรายเดือน (SPEC 6.2)
import type { GroupKind, Month, PlanGroup, PlanItem, Satang } from '../db/types';
import { monthDiff } from './dates';

/** ยอดของรายการในเดือน m ถ้าไม่จำกัดด้วยเป้า (endMode 'goal' ให้ goals.ts ตัดเดือนสุดท้าย) */
export type AmountOf = (item: PlanItem, m: Month) => Satang;

export function inPeriod(item: PlanItem, m: Month) {
  const p = item.period;
  if (monthDiff(p.start, m) < 0) return false;
  if (p.endMode === 'month' && p.endMonth && monthDiff(m, p.endMonth) < 0) return false;
  return true;
}

export const rawAmount: AmountOf = (item, m) => (inPeriod(item, m) ? item.monthOverrides[m] ?? item.defaultAmount : 0);

export type PlanTotals = Record<GroupKind, Satang> & {
  leftover: Satang; // เงินเหลือ
  savingsRate: number; // (ออม + ลงทุน) ÷ รายรับ เป็นสัดส่วน 0–1 (ไม่รวม PVD)
};

/** รวมยอดตามหมวดใหญ่ · หมวดที่ปิดไว้ไม่นับ */
export function planTotals(groups: PlanGroup[], items: PlanItem[], m: Month, amountOf: AmountOf = rawAmount): PlanTotals {
  const t: Record<GroupKind, Satang> = { income: 0, fixed: 0, variable: 0, goalSpend: 0, saving: 0, invest: 0 };
  const kindOf = new Map(groups.filter((g) => g.enabled).map((g) => [g.id, g.kind]));
  for (const it of items) {
    const k = kindOf.get(it.groupId);
    if (k) t[k] += amountOf(it, m);
  }
  const out = t.fixed + t.variable + t.goalSpend + t.saving + t.invest;
  return { ...t, leftover: t.income - out, savingsRate: t.income === 0 ? 0 : (t.saving + t.invest) / t.income };
}

/** ยอดโอนเข้าแต่ละบัญชี และที่เหลือในบัญชีเงินเดือน = รายรับ − ยอดโอนทุกบัญชี */
export function accountTransfers(groups: PlanGroup[], items: PlanItem[], m: Month, amountOf: AmountOf = rawAmount) {
  const enabled = new Map(groups.filter((g) => g.enabled).map((g) => [g.id, g.kind]));
  const byAccount = new Map<string, Satang>();
  let income = 0;
  for (const it of items) {
    const k = enabled.get(it.groupId);
    if (!k) continue;
    const a = amountOf(it, m);
    if (k === 'income') { income += a; continue; }
    if (it.accountId) byAccount.set(it.accountId, (byAccount.get(it.accountId) ?? 0) + a);
  }
  let transferred = 0;
  for (const v of byAccount.values()) transferred += v;
  return { byAccount, salaryLeft: income - transferred };
}
