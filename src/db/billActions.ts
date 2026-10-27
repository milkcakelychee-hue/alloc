// บิลแชร์ (SPEC 6.5 · ขั้นที่ 8): คน · บิล · รายการ · รับเงิน
// ส่วนของฉันในบิล = รายจ่ายในบันทึก 1 รายการต่อบิล (เจ้าของตกลงแล้ว) · เงินที่เพื่อนคืนเป็นแค่ payment ไม่ใช่รายรับ
import type { AllocDB } from './db';
import { ME_ID, type Bill, type BillItem, type DateStr, type LogEntry, type Payment, type Person, type Satang, type Settings } from './types';
import { billDateLabel, billShares, billTotal } from '../calc/bills';
import { cycleOf } from '../calc/dates';
import { cycleForDate } from '../calc/logView';
import { FALLBACK_CAT } from './logActions';

const stamp = (now: number) => ({ id: crypto.randomUUID(), createdAt: now, updatedAt: now });

// ---------- คน ----------

export type PersonInput = { name: string; icon: string; colorIndex: number; note: string };

export async function savePerson(db: AllocDB, id: string | null, p: PersonInput, now = Date.now()): Promise<Person> {
  const data = { name: p.name.trim(), icon: p.icon, colorIndex: p.colorIndex, note: p.note.trim() };
  if (id) {
    await db.people.update(id, { ...data, updatedAt: now });
    return (await db.people.get(id))!;
  }
  const person: Person = { ...stamp(now), ...data };
  await db.people.add(person);
  return person;
}

/** จำนวนบิลที่คนนี้อยู่ */
export async function billsOfPerson(db: AllocDB, personId: string) {
  return (await db.bills.toArray()).filter((b) => b.peopleIds.includes(personId)).length;
}

/** ลบคน: "ฉัน" ลบไม่ได้ · ยังอยู่ในบิลลบไม่ได้ (ยอดของคนอื่นจะเปลี่ยน) ให้เอาออกจากบิลก่อน */
export async function removePerson(db: AllocDB, id: string) {
  if (id === ME_ID) throw new Error('ลบ "ฉัน" ไม่ได้');
  if (await billsOfPerson(db, id)) throw new Error('ยังอยู่ในบิล');
  await db.people.delete(id);
}

// ---------- บิล ----------

export type ItemDraft = { id?: string; name: string; price: Satang; peopleIds: string[] };
export type BillDraft = {
  id?: string; title: string; date: DateStr; endDate: DateStr | null; categoryId: string; note: string;
  peopleIds: string[]; items: ItemDraft[];
};

/**
 * บันทึกบิลทั้งใบ (หัวบิล + รายการ) แล้วอัปเดตรายการในบันทึก
 * รอบของบิลตามวันที่บิล (นับเงินเดือนเข้าก่อนกำหนดเหมือนหน้าบันทึก)
 */
export async function saveBill(db: AllocDB, d: BillDraft, now = Date.now()): Promise<string> {
  const s = (await db.settings.get('app'))!;
  const receipts = await db.payReceipts.toArray();
  const id = d.id ?? crypto.randomUUID();
  await db.transaction('rw', [db.bills, db.billItems, db.logEntries, db.payments], async () => {
    const old = d.id ? await db.bills.get(d.id) : undefined;
    const peopleIds = [ME_ID, ...d.peopleIds.filter((p) => p !== ME_ID)];
    const bill: Bill = {
      id, createdAt: old?.createdAt ?? now, updatedAt: now,
      title: d.title.trim(), date: d.date, endDate: d.endDate && d.endDate > d.date ? d.endDate : null,
      cycleMonth: cycleForDate(d.date, s.pay, receipts), dateLabel: billDateLabel(d.date, d.endDate),
      note: d.note.trim(), peopleIds, categoryId: d.categoryId, logEntryId: old?.logEntryId ?? null
    };
    const oldItems = await db.billItems.where('billId').equals(id).toArray();
    const keep = new Set(d.items.map((i) => i.id).filter(Boolean));
    await db.billItems.bulkDelete(oldItems.filter((i) => !keep.has(i.id)).map((i) => i.id));
    const items: BillItem[] = d.items.map((it, i) => {
      const prev = oldItems.find((o) => o.id === it.id);
      return { id: it.id ?? crypto.randomUUID(), createdAt: prev?.createdAt ?? now, updatedAt: now, billId: id, name: it.name.trim(), price: it.price, order: i,
        peopleIds: it.peopleIds.filter((p) => peopleIds.includes(p)), logEntryId: null };
    });
    await db.billItems.bulkPut(items);
    // คนที่ถูกเอาออกจากบิล: ลบประวัติรับเงินของคนนั้นด้วย (หน้าบิลเตือนก่อน)
    await db.payments.where('billId').equals(id).filter((p) => !peopleIds.includes(p.personId)).delete();
    bill.logEntryId = await syncLog(db, bill, items, s.pay, now);
    await db.bills.put(bill);
  });
  return id;
}

/** รายการในบันทึกของบิล: จ่ายจริง = ราคารวม · ส่วนของฉัน = รายจ่าย · ยอดรวม 0 = ไม่มีรายการ */
async function syncLog(db: AllocDB, bill: Bill, items: BillItem[], pay: Settings['pay'], now: number): Promise<string | null> {
  const total = billTotal(items);
  const mine = billShares(items).get(ME_ID) ?? 0;
  const prevId = bill.logEntryId;
  if (total === 0) {
    if (prevId) await db.logEntries.delete(prevId);
    return null;
  }
  const prev = prevId ? await db.logEntries.get(prevId) : undefined;
  const entry: LogEntry = {
    id: prev?.id ?? crypto.randomUUID(), createdAt: prev?.createdAt ?? now, updatedAt: now,
    date: bill.date!, type: 'expense', amountPaid: total, myShare: mine, categoryId: bill.categoryId ?? FALLBACK_CAT.expense,
    note: bill.title, billItemId: null, billId: bill.id,
    cycleMonth: bill.cycleMonth !== cycleOf(bill.date!, pay) ? bill.cycleMonth : null
  };
  await db.logEntries.put(entry);
  return entry.id;
}

/** ลบบิล: รายการ · ประวัติรับเงิน · รายการในบันทึก */
export async function deleteBill(db: AllocDB, id: string) {
  await db.transaction('rw', [db.bills, db.billItems, db.payments, db.logEntries], async () => {
    const b = await db.bills.get(id);
    await db.billItems.where('billId').equals(id).delete();
    await db.payments.where('billId').equals(id).delete();
    await db.logEntries.filter((e) => e.billId === id).delete();
    if (b?.logEntryId) await db.logEntries.delete(b.logEntryId);
    await db.bills.delete(id);
  });
}

// ---------- รับเงิน ----------

export async function addPayment(db: AllocDB, p: { billId: string; personId: string; amount: Satang; date: DateStr; channel?: Payment['channel'] }, now = Date.now()) {
  const pay: Payment = { ...stamp(now), billId: p.billId, personId: p.personId, amount: p.amount, date: p.date, channel: p.channel ?? 'transfer' };
  await db.payments.add(pay);
  return pay;
}

export async function deletePayment(db: AllocDB, id: string) {
  await db.payments.delete(id);
}
