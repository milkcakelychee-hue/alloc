// บิลแชร์ (SPEC 6.5) · หารเท่าเท่านั้น (V1)
import { ME_ID, type BillItem, type DateStr, type Month, type Payment, type Satang } from '../db/types';

/**
 * ส่วนต่อคนของรายการ = price ÷ จำนวนคนที่ติ๊ก ปัดลงเป็นสตางค์
 * เศษสตางค์ให้ "ฉัน" รับเสมอ (แม้ไม่ได้หารรายการนั้น) เพื่อให้ผลรวมตรงราคา
 */
export function splitItem(price: Satang, peopleIds: string[]): Map<string, Satang> {
  const out = new Map<string, Satang>();
  if (peopleIds.length === 0) { out.set(ME_ID, price); return out; }
  const per = Math.floor(price / peopleIds.length);
  for (const p of peopleIds) out.set(p, per);
  const rest = price - per * peopleIds.length;
  if (rest) out.set(ME_ID, (out.get(ME_ID) ?? 0) + rest);
  return out;
}

/** ส่วนของแต่ละคนในบิล (รวมทุกรายการ) */
export function billShares(items: Pick<BillItem, 'price' | 'peopleIds'>[]) {
  const total = new Map<string, Satang>();
  for (const it of items) for (const [p, s] of splitItem(it.price, it.peopleIds)) total.set(p, (total.get(p) ?? 0) + s);
  return total;
}

export type PayStatus = 'unpaid' | 'partial' | 'paid';

/** paid = 0 → ยังไม่ชำระ · 0 < paid < share → ชำระบางส่วน · paid ≥ share → ชำระครบแล้ว */
export function personStatus(share: Satang, paid: Satang): PayStatus {
  if (paid <= 0) return 'unpaid';
  return paid < share ? 'partial' : 'paid';
}

/** สถานะบิล: ครบเมื่อทุกคนครบ · ยังไม่ชำระเมื่อไม่มีใครจ่าย · นอกนั้นบางส่วน */
export function billStatus(statuses: PayStatus[]): PayStatus {
  if (statuses.every((s) => s === 'paid')) return 'paid';
  if (statuses.every((s) => s === 'unpaid')) return 'unpaid';
  return 'partial';
}

/**
 * สรุปบิล: ส่วนของฉัน (= รายจ่ายในบันทึก) · สถานะและค้างรับของคนอื่น
 * เงินที่เพื่อนคืนเป็นแค่ payment ไม่นับเป็นรายรับ
 */
export function billSummary(items: Pick<BillItem, 'price' | 'peopleIds'>[], payments: Pick<Payment, 'personId' | 'amount'>[]) {
  const shares = billShares(items);
  const paidBy = new Map<string, Satang>();
  for (const p of payments) paidBy.set(p.personId, (paidBy.get(p.personId) ?? 0) + p.amount);
  const people = [...shares.entries()].filter(([id]) => id !== ME_ID).map(([id, share]) => {
    const paid = paidBy.get(id) ?? 0;
    return { personId: id, share, paid, owed: Math.max(share - paid, 0), status: personStatus(share, paid) };
  });
  return {
    myShare: shares.get(ME_ID) ?? 0,
    people,
    outstanding: people.reduce((s, p) => s + p.owed, 0), // ค้างรับ
    status: billStatus(people.map((p) => p.status))
  };
}

// ---------- ขั้นที่ 8: หน้าบิลแชร์ ----------

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const parts = (d: DateStr) => d.split('-').map(Number);

/** วันที่ของบิล: '13 ต.ค. 69' · มีวันสิ้นสุด '1–18 ต.ค. 69' · ข้ามเดือน '28 ต.ค. – 3 พ.ย. 69' · ข้ามปีใส่ปีทั้งสองฝั่ง */
export function billDateLabel(date: DateStr, endDate?: DateStr | null): string {
  const [y, m, d] = parts(date);
  const be = (yy: number) => String((yy + 543) % 100).padStart(2, '0');
  if (!endDate || endDate <= date) return `${d} ${TH_M[m - 1]} ${be(y)}`;
  const [y2, m2, d2] = parts(endDate);
  if (y === y2 && m === m2) return `${d}–${d2} ${TH_M[m - 1]} ${be(y)}`;
  if (y === y2) return `${d} ${TH_M[m - 1]} – ${d2} ${TH_M[m2 - 1]} ${be(y)}`;
  return `${d} ${TH_M[m - 1]} ${be(y)} – ${d2} ${TH_M[m2 - 1]} ${be(y2)}`;
}

type ItemLike = Pick<BillItem, 'id' | 'name' | 'price' | 'peopleIds'>;

/** รายการที่คนหนึ่งต้องจ่ายในบิล: ชื่อ · หารกี่คน · ส่วนของคนนั้น (รวมเศษสตางค์ถ้าเป็น "ฉัน") */
export function personLines(items: ItemLike[], personId: string) {
  return items.filter((it) => it.peopleIds.includes(personId))
    .map((it) => ({ id: it.id, name: it.name, n: it.peopleIds.length, share: splitItem(it.price, it.peopleIds).get(personId)! }));
}

/** ยอดรวมราคาในบิล */
export const billTotal = (items: Pick<BillItem, 'price'>[]) => items.reduce((a, i) => a + i.price, 0);

export interface BillRef { id: string; cycleMonth: Month }

/** ยอดของคนหนึ่ง (หรือทุกคนที่ไม่ใช่ฉัน) ในบิลเดียว: ส่วน · จ่ายแล้ว · ค้าง · สถานะ */
export function shareOf(items: Pick<BillItem, 'price' | 'peopleIds'>[], payments: Pick<Payment, 'personId' | 'amount'>[], who: string | 'all') {
  const s = billSummary(items, payments);
  const ps = who === 'all' ? s.people : s.people.filter((p) => p.personId === who);
  const share = ps.reduce((a, p) => a + p.share, 0);
  const paid = ps.reduce((a, p) => a + Math.min(p.paid, p.share), 0);
  return { share, paid, owed: ps.reduce((a, p) => a + p.owed, 0), status: who === 'all' ? s.status : ps[0]?.status ?? 'paid', inBill: ps.length > 0 };
}

/**
 * แท่งเลือกเดือน (หน้ารวมบิล): ต่อเดือน = ชำระแล้ว / ค้าง ของคนอื่น (กรองคนได้)
 * เดือนหลังเดือนนี้ = รอเรียกเก็บ (ยอดค้างทั้งหมดของเดือนนั้น)
 */
export function monthBars(
  bills: BillRef[], itemsOf: (billId: string) => Pick<BillItem, 'price' | 'peopleIds'>[], paymentsOf: (billId: string) => Pick<Payment, 'personId' | 'amount'>[],
  months: Month[], current: Month, who: string | 'all'
) {
  return months.map((m) => {
    let paid = 0, open = 0;
    for (const b of bills) {
      if (b.cycleMonth !== m) continue;
      const s = shareOf(itemsOf(b.id), paymentsOf(b.id), who);
      paid += s.paid; open += s.owed;
    }
    return { month: m, paid, open, future: m > current };
  });
}

export interface ReceiptBill { id: string; title: string; dateLabel: string; note: string }
export interface ReceiptBlock { bill: ReceiptBill; lines: ReturnType<typeof personLines>; share: Satang; paid: Satang; due: Satang }

/** ใบแจ้งยอดของคนหนึ่งจากหลายบิล: รายการที่ต้องจ่าย (÷n) · ชำระแล้ว · รวมบิลนี้ · ยอดที่ต้องโอน */
export function receiptFor(personId: string, bills: ReceiptBill[], itemsOf: (id: string) => ItemLike[], paymentsOf: (id: string) => Pick<Payment, 'personId' | 'amount'>[]) {
  const blocks: ReceiptBlock[] = [];
  for (const b of bills) {
    const lines = personLines(itemsOf(b.id), personId);
    if (!lines.length) continue;
    const x = shareOf(itemsOf(b.id), paymentsOf(b.id), personId);
    blocks.push({ bill: b, lines, share: x.share, paid: x.paid, due: x.owed });
  }
  return { blocks, grand: blocks.reduce((a, b) => a + b.due, 0) };
}

const bt = (s: Satang) => {
  const v = (Math.abs(s) / 100).toLocaleString('en-US', { minimumFractionDigits: s % 100 ? 2 : 0, maximumFractionDigits: 2 });
  return s < 0 ? `-${v}` : v;
};

/** ใบแจ้งยอดเป็นข้อความ (คัดลอก / แชร์) */
export function receiptText(name: string, issued: string, r: ReturnType<typeof receiptFor>, receiveInfo: string) {
  const out = [`ใบแจ้งยอด ถึง ${name}`, `ออกเมื่อ ${issued} · ${r.blocks.length} บิล`, ''];
  for (const b of r.blocks) {
    out.push(`${b.bill.title} (${b.bill.dateLabel})`);
    for (const l of b.lines) out.push(`- ${l.name} ÷${l.n}  ${bt(l.share)}`);
    if (b.paid) out.push(`ชำระแล้ว  -${bt(b.paid)}`);
    out.push(`รวมบิลนี้  ${bt(b.due)}`);
    if (b.bill.note) out.push(`หมายเหตุ: ${b.bill.note}`);
    out.push('');
  }
  out.push(`ยอดที่ต้องโอน ${bt(r.grand)} บาท`);
  if (receiveInfo.trim()) out.push(`โอนเข้า: ${receiveInfo.trim()}`);
  return out.join('\n');
}
