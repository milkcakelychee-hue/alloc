// กฎวันเงินเดือนเข้า (docs/decisions.md)
// แยก "วันที่ตั้งไว้" (nominal ใช้แบ่งรอบงบ) ออกจาก "วันที่เงินเข้าจริง" (expected/actual ใช้ดูเรื่องเวลา)
import type { DateStr, Month } from '../db/types';
import { addDays, cycleRange, nominalPayDate, toDate, type PayRule } from './dates';

export type WeekendShift = 'before' | 'after' | 'none';
export { nominalPayDate, type PayRule } from './dates';

export const weekday = (d: DateStr) => toDate(d).getUTCDay(); // 0 อาทิตย์ … 6 เสาร์
const isWeekend = (d: DateStr) => { const w = weekday(d); return w === 0 || w === 6; };

/** วันที่คาดว่าเงินเข้าจริง: แก้เฉพาะเดือน > เลื่อนตามเสาร์อาทิตย์ > วันที่ตั้งไว้ */
export function expectedPayDate(rule: PayRule, shift: WeekendShift, m: Month, overrides: Record<Month, DateStr> = {}) {
  const nominal = nominalPayDate(rule, m);
  if (overrides[m]) return { nominal, date: overrides[m], reason: 'override' as const };
  let date = nominal;
  if (shift !== 'none') while (isWeekend(date)) date = addDays(date, shift === 'before' ? -1 : 1);
  return { nominal, date, reason: date === nominal ? ('onTime' as const) : ('weekend' as const) };
}

/** รอบงบตามกฎ (ยึดวันที่ตั้งไว้) */
export const cycleRangeByRule = (rule: PayRule, m: Month) => cycleRange(m, rule);

/**
 * รายจ่ายที่ครบกำหนดหลังวันที่ตั้งไว้ แต่ก่อนเงินเข้าจริง (เงินเข้าช้ากว่ากำหนด) = เสี่ยงเงินขาดมือ
 */
export function billsBeforePay(expected: DateStr, nominal: DateStr, dues: { name: string; date: DateStr }[]) {
  return dues.filter((b) => b.date >= nominal && b.date < expected);
}
