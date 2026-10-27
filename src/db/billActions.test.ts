import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocDB } from './db';
import { ensureDefaults } from './defaults';
import { addPayment, billsOfPerson, deleteBill, removePerson, saveBill, savePerson } from './billActions';
import { ME_ID } from './types';
import { B } from '../calc/testkit';

let n = 0;
let cur: AllocDB;
afterEach(async () => { await cur?.delete(); });
const fresh = async () => {
  cur = new AllocDB(`bill-${n++}`); await ensureDefaults(cur, 1);
  await cur.settings.update('app', { pay: { kind: 'day', day: 25 } });
  return cur;
};

// TEST_CASES.md 6.5 (คน: ฉัน, ก้อย, บีม)
describe('บิลแชร์ ข้อมูล', () => {
  it('บิลชาบู: ส่วนของฉันลงบันทึก 1 รายการ · จ่ายจริงเต็มบิล', async () => {
    const d = await fresh();
    const koy = await savePerson(d, null, { name: ' ก้อย ', icon: 'letter', colorIndex: 1, note: '' });
    const beam = await savePerson(d, null, { name: 'บีม', icon: 'cat', colorIndex: 2, note: 'ห้องข้าง ๆ' });
    expect(koy.name).toBe('ก้อย');
    const all = [ME_ID, koy.id, beam.id];
    const id = await saveBill(d, { title: 'ชาบู', date: '2026-10-13', endDate: null, categoryId: 'c-food', note: '', peopleIds: [koy.id, beam.id],
      items: [{ name: 'ชาบู', price: B(700), peopleIds: all }, { name: 'น้ำ', price: B(85), peopleIds: all }, { name: 'ขนม', price: B(125), peopleIds: [koy.id, beam.id] }] });
    const bill = (await d.bills.get(id))!;
    expect(bill).toMatchObject({ cycleMonth: '2026-10', dateLabel: '13 ต.ค. 69', peopleIds: all });
    expect((await d.billItems.where('billId').equals(id).sortBy('order')).map((i) => i.name)).toEqual(['ชาบู', 'น้ำ', 'ขนม']);
    expect(await d.logEntries.get(bill.logEntryId!)).toMatchObject({ amountPaid: B(910), myShare: B(261.68), categoryId: 'c-food', note: 'ชาบู', billId: id, date: '2026-10-13' });
    expect(await billsOfPerson(d, beam.id)).toBe(1);
    await expect(removePerson(d, beam.id)).rejects.toThrow();
    await expect(removePerson(d, ME_ID)).rejects.toThrow();
  });

  it('แก้บิล: รายการในบันทึกอัปเดตตาม ไม่สร้างซ้ำ · เอาคนออกแล้วประวัติรับเงินของคนนั้นหาย', async () => {
    const d = await fresh();
    const koy = await savePerson(d, null, { name: 'ก้อย', icon: 'letter', colorIndex: 1, note: '' });
    const id = await saveBill(d, { title: 'ค่าน้ำค่าไฟ', date: '2026-10-26', endDate: '2026-11-03', categoryId: 'c-bill', note: 'โอนภายในสิ้นเดือน', peopleIds: [koy.id],
      items: [{ name: 'ค่าไฟ', price: B(845), peopleIds: [ME_ID, koy.id] }] });
    let bill = (await d.bills.get(id))!;
    expect(bill).toMatchObject({ cycleMonth: '2026-11', dateLabel: '26 ต.ค. – 3 พ.ย. 69' }); // เงินเข้า 25 → 26 ต.ค. อยู่รอบ พ.ย.
    await addPayment(d, { billId: id, personId: koy.id, amount: B(200), date: '2026-10-27' });
    const items = await d.billItems.where('billId').equals(id).toArray();
    await saveBill(d, { id, title: 'ค่าน้ำค่าไฟ', date: '2026-10-26', endDate: null, categoryId: 'c-bill', note: '', peopleIds: [],
      items: [{ id: items[0].id, name: 'ค่าไฟ', price: B(845), peopleIds: [ME_ID, koy.id] }, { name: 'ค่าน้ำ', price: B(120), peopleIds: [ME_ID] }] });
    bill = (await d.bills.get(id))!;
    expect(bill.peopleIds).toEqual([ME_ID]);
    expect(await d.logEntries.count()).toBe(1);
    expect(await d.logEntries.get(bill.logEntryId!)).toMatchObject({ amountPaid: B(965), myShare: B(965) });
    expect(await d.payments.count()).toBe(0);
    expect((await d.billItems.where('billId').equals(id).toArray()).every((i) => i.peopleIds.every((p) => p === ME_ID))).toBe(true);
  });

  it('เงินที่เพื่อนคืนไม่นับเป็นรายรับ · ลบบิลแล้วรายการในบันทึกและประวัติรับเงินหายด้วย', async () => {
    const d = await fresh();
    const koy = await savePerson(d, null, { name: 'ก้อย', icon: 'letter', colorIndex: 1, note: '' });
    const id = await saveBill(d, { title: 'ของใช้', date: '2026-10-10', endDate: null, categoryId: 'c-household', note: '', peopleIds: [koy.id],
      items: [{ name: 'สบู่', price: B(129), peopleIds: [ME_ID, koy.id] }] });
    await addPayment(d, { billId: id, personId: koy.id, amount: B(64.5), date: '2026-10-11' });
    expect(await d.logEntries.where('type').equals('income').count()).toBe(0);
    await deleteBill(d, id);
    expect(await d.logEntries.count()).toBe(0);
    expect(await d.payments.count()).toBe(0);
    expect(await d.billItems.count()).toBe(0);
  });
});
