// หน้าบันทึก (ขั้นที่ 7 · SPEC 6.4): แป้นคิดเลข ปฏิทินรอบ ยอดรายวัน งบแยกรายการ อินไซต์
import type { DateStr, LogEntry, Month, PlanGroup, PlanItem, Satang } from '../db/types';
import { addDays, cycleOf, cycleRange, daysBetween, type Pay } from './dates';
import { weekday } from './payday';
import { parseBaht } from './money';
import { rawAmount, type AmountOf } from './plan';
import { categoryBudget, cycleDays } from './log';

// ---------- แป้นตัวเลข ----------

/**
 * คิดยอดจากแป้น "120 + 69.50" "3 × 60 − 9" เป็นสตางค์ · × ทำก่อน + − (ไม่ผ่าน float บวกลบ)
 * ตัวคูณปัดเป็นสตางค์ทีละครั้ง · พิมพ์ค้างท้ายด้วยเครื่องหมาย = ไม่นับตัวท้าย
 */
export function evalAmount(expr: string): Satang | null {
  const tokens = expr.replace(/\s/g, '').match(/[0-9.]+|[+−×]/g);
  if (!tokens) return null;
  let total = 0, sign = 1, term: Satang | null = null, mul = false;
  const flush = () => { if (term !== null) total += sign * term; term = null; };
  for (const t of tokens) {
    if (t === '+' || t === '−') { flush(); sign = t === '+' ? 1 : -1; mul = false; continue; }
    if (t === '×') { mul = true; continue; }
    const v = parseBaht(t.endsWith('.') ? t.slice(0, -1) : t);
    if (v === null) return null;
    term = mul && term !== null ? Math.round((term * v) / 100) : v;
    mul = false;
  }
  flush();
  return total;
}

// ---------- ปฏิทินรอบเงินเดือน ----------

export interface CalCell { date: DateStr; inCycle: boolean; future: boolean; today: boolean }

/** ช่องปฏิทินของรอบ: เริ่มวันจันทร์ จบวันอาทิตย์ · วันนอกรอบแสดงแบบลายทาง */
export function calendarCells(cycle: Month, pay: Pay, today: DateStr): CalCell[] {
  const r = cycleRange(cycle, pay);
  const mon = (d: DateStr) => addDays(d, -((weekday(d) + 6) % 7));
  const start = mon(r.start);
  const end = addDays(mon(r.end), 6);
  const out: CalCell[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    out.push({ date: d, inCycle: d >= r.start && d <= r.end, future: d > today, today: d === today });
  }
  return out;
}

/** วันที่เลือกได้ในหน้าเลือกวันที่: ย้อนไป 3 สัปดาห์ก่อนรอบนี้ (เริ่มวันจันทร์) ถึงสิ้นสัปดาห์ของวันสิ้นรอบ · วันอนาคตเลือกไม่ได้ */
export function pickerCells(today: DateStr, pay: Pay): CalCell[] {
  const cycle = cycleOf(today, pay);
  const r = cycleRange(cycle, pay);
  const from = [r.start, addDays(today, -21)].sort()[0];
  const mon = (d: DateStr) => addDays(d, -((weekday(d) + 6) % 7));
  const out: CalCell[] = [];
  for (let d = mon(from); d <= addDays(mon(r.end), 6); d = addDays(d, 1)) {
    out.push({ date: d, inCycle: d >= r.start && d <= r.end, future: d > today, today: d === today });
  }
  return out;
}

/** วันที่เลือกอยู่รอบไหน: รอบนี้ / รอบก่อน (นับเข้างบรอบนั้น) */
export function datePickNote(date: DateStr, today: DateStr, pay: Pay) {
  const cur = cycleOf(today, pay);
  const c = cycleOf(date, pay);
  return { cycle: c, sameCycle: c === cur, ago: daysBetween(date, today) };
}

/** ยอดรายวัน: รายรับ (+) และรายจ่าย (ส่วนของฉัน) */
export function dayTotals(entries: LogEntry[]) {
  const m = new Map<DateStr, { income: Satang; expense: Satang }>();
  for (const e of entries) {
    const r = m.get(e.date) ?? { income: 0, expense: 0 };
    if (e.type === 'income') r.income += e.amountPaid; else r.expense += e.myShare;
    m.set(e.date, r);
  }
  return m;
}

// ---------- งบรายวัน แยกรายการในแผน ----------

/** งบใช้จ่ายรายวันแยกตามรายการผันแปรที่ผูกหมวดบันทึก: ยอดแผน และที่ใช้ไปในหมวดที่ผูก */
export function dailyBudgetParts(groups: PlanGroup[], items: PlanItem[], cycleExpenses: LogEntry[], cycle: Month, amountOf: AmountOf = rawAmount) {
  const variable = new Set(groups.filter((g) => g.enabled && g.kind === 'variable').map((g) => g.id));
  return items
    .filter((i) => variable.has(i.groupId) && i.logCategoryIds.length > 0)
    .map((i) => {
      const cats = new Set(i.logCategoryIds);
      return { item: i, budget: amountOf(i, cycle), spent: cycleExpenses.filter((e) => cats.has(e.categoryId)).reduce((s, e) => s + e.myShare, 0) };
    })
    .filter((p) => p.budget > 0);
}

/** รายการในแผนที่หมวดนั้นนับเข้างบ (ชื่อแรก + จำนวนที่เหลือ) · null = นอกงบ */
export function planLabelOf(categoryId: string, items: PlanItem[]) {
  const linked = items.filter((i) => i.logCategoryIds.includes(categoryId));
  if (!linked.length) return null;
  return linked.length === 1 ? linked[0].name : `${linked[0].name} +${linked.length - 1}`;
}

/** งบที่รายการนี้ตัด (ตอนแก้/ดูรายการ): ชื่อแผน · เหลือ / งบ */
export function entryBudget(e: LogEntry, items: PlanItem[], cycleExpenses: LogEntry[], cycle: Month, amountOf: AmountOf = rawAmount) {
  const label = planLabelOf(e.categoryId, items);
  if (!label) return null;
  const b = categoryBudget(e.categoryId, items, cycleExpenses, cycle, amountOf);
  return { label, budget: b.budget!, remaining: b.remaining! };
}

// ---------- อินไซต์ (สร้างจากตัวเลขเท่านั้น) ----------

/** เฉลี่ยต่อวัน วันธรรมดา vs เสาร์อาทิตย์ (นับทุกวันที่ผ่านไปในรอบ รวมวันที่ไม่ได้จ่าย) */
export function weekdaySplit(cycleExpenses: LogEntry[], today: DateStr, pay: Pay) {
  const d = cycleDays(today, pay);
  const end = today < d.end ? today : d.end;
  let wdDays = 0, weDays = 0, wd = 0, we = 0;
  for (let x = d.start; x <= end; x = addDays(x, 1)) {
    const w = weekday(x);
    if (w === 0 || w === 6) weDays++; else wdDays++;
  }
  for (const e of cycleExpenses) {
    if (e.date > end) continue;
    const w = weekday(e.date);
    if (w === 0 || w === 6) we += e.myShare; else wd += e.myShare;
  }
  return { weekdayAvg: wdDays ? Math.round(wd / wdDays) : 0, weekendAvg: weDays ? Math.round(we / weDays) : 0 };
}

/** ช่วงยอดต่อครั้งที่พบบ่อย (ควอร์ไทล์ล่าง–บน) */
export function typicalRange(list: LogEntry[]) {
  const v = list.map((e) => e.myShare).sort((a, b) => a - b);
  if (v.length < 3) return null;
  const q = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
  return { low: q(0.25), high: q(0.75) };
}

/** ลดวันละเท่าไรให้พอดีงบ (ปัดขึ้นหลักบาท) · null = ไม่เกินอยู่แล้ว */
export function cutPerDay(spent: Satang, budget: Satang, projected: Satang, daysLeft: number) {
  if (projected <= budget || daysLeft <= 0) return null;
  const left = budget - spent;
  const pace = (projected - spent) / daysLeft;
  return Math.max(Math.ceil((pace - left / daysLeft) / 100) * 100, 100);
}

/**
 * เงินเดือนของรอบในหน้าบันทึก (ไม่ได้จดเป็นรายการ): ยอดจริงจากการกด "เงินเดือนเข้าแล้ว"
 * ไม่ได้กด: ถือว่าเข้าเมื่อเลยวันที่ควรเข้า 7 วัน ใช้ยอดในแผน · แสดงในวันที่เข้า ถ้าเข้าก่อนรอบเริ่มแสดงวันแรกของรอบ
 */
export function salaryEvent(o: {
  cycle: Month; pay: Pay; expected: DateStr; received: { date: DateStr | null; amount: Satang | null } | null;
  planned: Satang; today: DateStr;
}): { date: DateStr; amount: Satang } | null {
  const r = cycleRange(o.cycle, o.pay);
  let date: DateStr, amount: Satang;
  if (o.received?.date && o.received.amount !== null) { date = o.received.date; amount = o.received.amount; }
  else if (addDays(o.expected, 7) <= o.today && o.planned > 0) { date = o.expected; amount = o.planned; }
  else return null;
  if (date < r.start) date = r.start;
  if (date > r.end) return null;
  return { date, amount };
}
