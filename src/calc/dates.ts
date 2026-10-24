// วันที่และรอบเงินเดือน (SPEC 6.1)
// รอบ = วันที่ payday ของเดือนก่อน ถึงวันก่อน payday ของเดือนนี้ · ชื่อรอบใช้เดือนที่สิ้นสุด
// คำนวณด้วยเลขวันที่ล้วน (UTC) ไม่ขึ้นกับเขตเวลาของเครื่อง
import type { DateStr, Month } from '../db/types';

const pad = (n: number) => String(n).padStart(2, '0');
const DAY = 86_400_000;

export const toDate = (d: DateStr) => new Date(`${d}T00:00:00Z`);
export const fromDate = (d: Date): DateStr => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const localToday = (now = new Date()): DateStr => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export const addDays = (d: DateStr, n: number): DateStr => fromDate(new Date(toDate(d).getTime() + n * DAY));
export const daysBetween = (a: DateStr, b: DateStr) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);

export function addMonths(m: Month, n: number): Month {
  const [y, mo] = m.split('-').map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}
/** จำนวนเดือนจาก a ถึง b (b − a) */
export const monthDiff = (a: Month, b: Month) => {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
};

const daysInMonth = (m: Month) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};
// กฎวันเงินเดือนเข้า · ตัวเลขเดียว = "ทุกวันที่ X" (รูปแบบเดิมก่อน schema 2)
export type PayRule = { kind: 'day'; day: number } | { kind: 'endOfMonth' } | { kind: 'lastBusinessDay' };
export type Pay = number | PayRule;
export const toRule = (p: Pay): PayRule => (typeof p === 'number' ? { kind: 'day', day: p } : p);
const isWeekend = (d: DateStr) => { const w = toDate(d).getUTCDay(); return w === 0 || w === 6; };

/** วันที่ตั้งไว้ของเดือน m (ใช้แบ่งรอบงบ ไม่เลื่อนตามวันหยุด) · วันที่เกินจำนวนวันของเดือนใช้วันสุดท้าย */
export function nominalPayDate(p: Pay, m: Month): DateStr {
  const rule = toRule(p);
  if (rule.kind === 'day') return `${m}-${pad(Math.min(rule.day, daysInMonth(m)))}`;
  let d: DateStr = `${m}-${pad(daysInMonth(m))}`;
  if (rule.kind === 'lastBusinessDay') while (isWeekend(d)) d = addDays(d, -1);
  return d;
}

/** รอบเงินเดือนของวันที่ d */
export function cycleOf(d: DateStr, p: Pay): Month {
  const m = d.slice(0, 7);
  return d >= nominalPayDate(p, m) ? addMonths(m, 1) : m;
}

/** ช่วงวันของรอบ m: start รวม, end รวม · ยึดวันที่ตั้งไว้ ไม่ขยับตามวันเงินเข้าจริง */
export function cycleRange(m: Month, p: Pay) {
  const start = nominalPayDate(p, addMonths(m, -1));
  const end = addDays(nominalPayDate(p, m), -1);
  return { start, end, days: daysBetween(start, end) + 1 };
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const beShort = (y: number) => pad((y + 543) % 100);

/** '2026-10-18' → '18 ต.ค. 69' */
export function thaiDate(d: DateStr) {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${TH_MONTHS[m - 1]} ${beShort(y)}`;
}
/** '2026-10' → 'ต.ค. 69' */
export function thaiMonth(m: Month) {
  const [y, mo] = m.split('-').map(Number);
  return `${TH_MONTHS[mo - 1]} ${beShort(y)}`;
}

/** รอบที่แอปใช้ตอนนี้: รอบของวันนี้ แต่ไม่ก่อนรอบที่เริ่มใช้แอป */
export function appCycle(today: DateStr, p: Pay, startCycle?: Month | null): Month {
  const c = cycleOf(today, p);
  return startCycle && startCycle > c ? startCycle : c;
}
