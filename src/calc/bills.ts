// บิลแชร์ (SPEC 6.5) · หารเท่าเท่านั้น (V1)
import { ME_ID, type BillItem, type Payment, type Satang } from '../db/types';

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
