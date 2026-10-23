import type { DateStr, Month, PaidCheck, PayReceipt, PlanGroup, PlanItem, Satang, Settings } from '../db/types';
import { addDays, addMonths, cycleOf, cycleRange, daysBetween } from './dates';
import { billsBeforePay, expectedPayDate } from './payday';
import type { AmountOf } from './plan';

// เตือนสำรองข้อมูล (SPEC 9 ข้อ 2): ยังไม่เคยสำรอง หรือผ่านไปเกิน 14 วัน
export const BACKUP_WARN_DAYS = 14;
const DAY = 86_400_000;

export function backupStatus(lastBackupAt: number | null | undefined, now = Date.now()) {
  if (!lastBackupAt) return { never: true, days: null as number | null, due: true };
  const days = Math.floor((now - lastBackupAt) / DAY);
  return { never: false, days, due: days > BACKUP_WARN_DAYS };
}

// ===== การ์ดในหน้าหลัก: "จ่ายหรือยัง" และ "เงินเดือนเข้าแล้วหรือยัง" (docs/decisions.md) =====

/** วันครบกำหนดของรายการในรอบ: วันในช่วงรอบที่ตรงกับ dueDay (เดือนที่สั้นกว่าใช้วันสุดท้าย) */
export function dueDateInCycle(dueDay: number, range: { start: DateStr; end: DateStr }): DateStr | null {
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
    const [y, m, day] = d.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (day === Math.min(dueDay, last)) return d;
  }
  return null;
}

/** รายการที่ถึงวันครบกำหนดแล้วในรอบปัจจุบัน และยังไม่ได้ติ๊กจ่ายแล้ว */
export function dueItems(opts: {
  groups: PlanGroup[]; items: PlanItem[]; checks: PaidCheck[]; today: DateStr; pay: Settings['pay']; amountOf: AmountOf;
}) {
  const cycle = cycleOf(opts.today, opts.pay);
  const range = cycleRange(cycle, opts.pay);
  const kind = new Map(opts.groups.filter((g) => g.enabled).map((g) => [g.id, g.kind]));
  const done = new Set(opts.checks.filter((c) => c.cycleMonth === cycle && c.checked).map((c) => c.planItemId));
  const out: { item: PlanItem; dueDate: DateStr; amount: Satang; cycle: Month }[] = [];
  for (const it of opts.items) {
    const k = kind.get(it.groupId);
    if (!k || k === 'income' || !it.dueDay || done.has(it.id)) continue;
    const amount = opts.amountOf(it, cycle);
    const dueDate = dueDateInCycle(it.dueDay, range);
    if (amount > 0 && dueDate && dueDate <= opts.today) out.push({ item: it, dueDate, amount, cycle });
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * การ์ดเงินเดือน: confirm = ถึงวันคาดว่าเงินเข้าแล้ว ยังไม่ได้ยืนยัน (ข้ามถ้ากด "ยังไม่เข้า" จนถึงวันที่เลื่อนไว้)
 * upcoming = เงินจะเข้าภายใน 3 วัน หรือเข้าช้ากว่ากำหนด · lateBills = รายการที่ครบกำหนดก่อนเงินเข้าจริง
 */
export function payPrompts(opts: {
  settings: Pick<Settings, 'pay' | 'weekendShift' | 'payOverrides'>; receipts: PayReceipt[]; today: DateStr;
  plannedIncome: (cycle: Month) => Satang; items: PlanItem[];
}) {
  const { settings: s, today } = opts;
  const m = cycleOf(today, s.pay);
  const rec = new Map(opts.receipts.map((r) => [r.id, r]));
  let confirm: { cycle: Month; expected: DateStr; nominal: DateStr; planned: Satang } | null = null;
  let upcoming: { cycle: Month; expected: DateStr; nominal: DateStr; reason: string; daysLeft: number } | null = null;
  for (const payMonth of [addMonths(m, -1), m]) {
    const target = addMonths(payMonth, 1);
    const e = expectedPayDate(s.pay, s.weekendShift, payMonth, s.payOverrides);
    const r = rec.get(target);
    if (r?.status === 'received') continue;
    const planned = opts.plannedIncome(target);
    if (planned <= 0) continue;
    if (e.date <= today) {
      if (daysBetween(e.date, today) > 7) continue; // เงินเข้านานแล้ว (เช่น เพิ่งเริ่มใช้แอปกลางรอบ) ไม่ถามย้อน
      if (r?.status === 'snoozed' && r.snoozeUntil && today < r.snoozeUntil) continue;
      confirm = { cycle: target, expected: e.date, nominal: e.nominal, planned };
    } else {
      const daysLeft = daysBetween(today, e.date);
      if (daysLeft <= 3 || e.nominal <= today) upcoming = upcoming ?? { cycle: target, expected: e.date, nominal: e.nominal, reason: e.reason, daysLeft };
    }
  }
  // เงินเข้าช้ากว่าวันที่ตั้งไว้: รายการที่ครบกำหนดระหว่างวันที่ตั้งไว้กับวันเงินเข้าจริง
  let lateBills: { name: string; date: DateStr; amount: Satang }[] = [];
  if (upcoming && upcoming.expected > upcoming.nominal) {
    const range = cycleRange(upcoming.cycle, s.pay);
    const dues = opts.items.filter((i) => i.dueDay).map((i) => ({ name: i.name, date: dueDateInCycle(i.dueDay!, range) ?? '', amount: i.defaultAmount }));
    lateBills = billsBeforePay(upcoming.expected, upcoming.nominal, dues).map((b) => ({ ...b, amount: dues.find((d) => d.name === b.name)!.amount }));
  }
  return { confirm, upcoming, lateBills };
}
