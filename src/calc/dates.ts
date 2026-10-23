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
// payday ที่เกินจำนวนวันของเดือน (เช่น 31 ใน ก.พ.) ใช้วันสุดท้ายของเดือน
const paydayIn = (m: Month, payday: number): DateStr => `${m}-${pad(Math.min(payday, daysInMonth(m)))}`;

/** รอบเงินเดือนของวันที่ d */
export function cycleOf(d: DateStr, payday: number): Month {
  const m = d.slice(0, 7);
  return d >= paydayIn(m, payday) ? addMonths(m, 1) : m;
}

/** ช่วงวันของรอบ m: start รวม, end รวม */
export function cycleRange(m: Month, payday: number) {
  const start = paydayIn(addMonths(m, -1), payday);
  const end = addDays(paydayIn(m, payday), -1);
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
