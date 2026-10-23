// กฎวันเงินเดือนเข้า (ออกแบบ · ยังไม่ใช้จริงจนกว่าเจ้าของอนุมัติ)
// แยก "วันที่ตั้งไว้" (nominal ใช้แบ่งรอบงบ) ออกจาก "วันที่เงินเข้าจริง" (expected/actual ใช้ดูเรื่องเวลา)
import type { DateStr, Month } from '../db/types';
import { addDays, addMonths, daysBetween, toDate } from './dates';

export type PayRule = { kind: 'day'; day: number } | { kind: 'endOfMonth' } | { kind: 'lastBusinessDay' };
export type WeekendShift = 'before' | 'after' | 'none';

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (m: Month) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};
export const weekday = (d: DateStr) => toDate(d).getUTCDay(); // 0 อาทิตย์ … 6 เสาร์
const isWeekend = (d: DateStr) => { const w = weekday(d); return w === 0 || w === 6; };

/** วันที่ตั้งไว้ของเดือน m (ใช้แบ่งรอบงบ ไม่เลื่อนตามวันหยุด) */
export function nominalPayDate(rule: PayRule, m: Month): DateStr {
  if (rule.kind === 'day') return `${m}-${pad(Math.min(rule.day, lastDay(m)))}`;
  let d: DateStr = `${m}-${pad(lastDay(m))}`;
  if (rule.kind === 'lastBusinessDay') while (isWeekend(d)) d = addDays(d, -1);
  return d;
}

/** วันที่คาดว่าเงินเข้าจริง: แก้เฉพาะเดือน > เลื่อนตามเสาร์อาทิตย์ > วันที่ตั้งไว้ */
export function expectedPayDate(rule: PayRule, shift: WeekendShift, m: Month, overrides: Record<Month, DateStr> = {}) {
  const nominal = nominalPayDate(rule, m);
  if (overrides[m]) return { nominal, date: overrides[m], reason: 'override' as const };
  let date = nominal;
  if (shift !== 'none') while (isWeekend(date)) date = addDays(date, shift === 'before' ? -1 : 1);
  return { nominal, date, reason: date === nominal ? ('onTime' as const) : ('weekend' as const) };
}

/**
 * รอบงบเดือน m = วันที่ตั้งไว้ของเดือนก่อน ถึงวันก่อนวันที่ตั้งไว้ของเดือนนี้
 * เงินที่เข้าก่อนหรือหลังกำหนดยังนับเป็นรายรับของรอบที่ตั้งไว้ รายรับจึงไม่หายหรือเบิ้ลข้ามเดือน
 */
export function cycleRangeByRule(rule: PayRule, m: Month) {
  const start = nominalPayDate(rule, addMonths(m, -1));
  const end = addDays(nominalPayDate(rule, m), -1);
  return { start, end, days: daysBetween(start, end) + 1 };
}

/**
 * รายจ่ายที่ครบกำหนดหลังวันที่ตั้งไว้ แต่ก่อนเงินเข้าจริง (เงินเข้าช้ากว่ากำหนด) = เสี่ยงเงินขาดมือ
 * (ข้อเสนอ รอเจ้าของยืนยันช่วงวันที่เตือน)
 */
export function billsBeforePay(expected: DateStr, nominal: DateStr, dues: { name: string; date: DateStr }[]) {
  return dues.filter((b) => b.date >= nominal && b.date < expected);
}
