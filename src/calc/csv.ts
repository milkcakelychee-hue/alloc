// ส่งออก CSV (เปิดใน Numbers / Excel ได้) · ยอดเงินเขียนเป็นบาทจากสตางค์ด้วยจำนวนเต็ม ไม่ผ่าน float
import type { Account, LogCategory, LogEntry, Month, PlanGroup, PlanItem, Satang } from '../db/types';
import { addMonths, thaiMonth } from './dates';
import { rawAmount } from './plan';

/** 123450 → '1234.50' · −5 → '-0.05' */
export function bahtText(s: Satang) {
  const a = Math.abs(s);
  return `${s < 0 ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

/** ช่องข้อความ: ใส่ "" เมื่อมี , " หรือขึ้นบรรทัด · กันสูตรใน Excel ด้วย ' นำหน้า = + - @ */
export function cell(v: string) {
  let t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  if (/[",\r\n]/.test(t)) t = `"${t.replace(/"/g, '""')}"`;
  return t;
}

// BOM ให้ Excel อ่านภาษาไทยถูก · ขึ้นบรรทัดแบบ CRLF ตามมาตรฐาน CSV
const toCsv = (rows: string[][]) => '﻿' + rows.map((r) => r.join(',')).join('\r\n') + '\r\n';

export function logCsv(entries: LogEntry[], cats: LogCategory[]) {
  const name = new Map(cats.map((c) => [c.id, c.name]));
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  return toCsv([
    ['วันที่', 'ประเภท', 'หมวด', 'ยอดที่จ่าย', 'ส่วนของฉัน', 'โน้ต'].map(cell),
    ...sorted.map((e) => [
      e.date, cell(e.type === 'income' ? 'รายรับ' : 'รายจ่าย'), cell(name.get(e.categoryId) ?? 'ไม่มีหมวด'),
      bahtText(e.amountPaid), bahtText(e.myShare), cell(e.note)
    ])
  ]);
}

/** เดือนที่ส่งออกแผน: ตั้งแต่เดือนแรกที่มีรายการ (ไม่ก่อนรอบที่เริ่มใช้แอป) ถึง 12 รอบหลังรอบนี้ */
export function planMonths(items: PlanItem[], current: Month, startCycle?: Month | null): Month[] {
  let from = items.reduce((m, i) => (i.period.start < m ? i.period.start : m), current);
  if (startCycle && startCycle > from) from = startCycle;
  const to = addMonths(current, 12);
  const out: Month[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function planCsv(groups: PlanGroup[], items: PlanItem[], accounts: Account[], months: Month[]) {
  const acc = new Map(accounts.map((a) => [a.id, a.name]));
  const rows: string[][] = [['หมวดใหญ่', 'รายการ', 'บัญชีปลายทาง', ...months.map(thaiMonth)].map(cell)];
  for (const g of [...groups].filter((g) => g.enabled).sort((a, b) => a.order - b.order)) {
    for (const i of items.filter((i) => i.groupId === g.id).sort((a, b) => a.order - b.order)) {
      rows.push([cell(g.name), cell(i.name), cell(i.accountId ? acc.get(i.accountId) ?? '' : ''), ...months.map((m) => bahtText(rawAmount(i, m)))]);
    }
  }
  return toCsv(rows);
}
