import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocDB } from './db';
import { ensureDefaults } from './defaults';
import { applyActualSalary, confirmPay, deleteLogEntry, markDuePaid, snoozePay, unmarkPaid } from './actions';
import { B, item } from '../calc/testkit';
import { rawAmount } from '../calc/plan';

let n = 0;
let cur: AllocDB;
afterEach(async () => { await cur?.delete(); });
const fresh = async () => { cur = new AllocDB(`act-${n++}`); await ensureDefaults(cur, 1); return cur; };

describe('การ์ด จ่ายหรือยัง', () => {
  it('ติ๊กจ่ายแล้ว: ติ๊กในแผน + บันทึกรายจ่ายยอดตามแผน หมวดแรกที่ผูก', async () => {
    const d = await fresh();
    const it1 = item('fixed', 'ค่าเน็ต', 599, { logCategoryIds: ['c-bill', 'c-other'] });
    const id = await markDuePaid(d, { item: it1, kind: 'fixed', cycle: '2026-10', amount: B(599), today: '2026-10-18' });
    expect(await d.logEntries.get(id!)).toMatchObject({ amountPaid: B(599), myShare: B(599), categoryId: 'c-bill', date: '2026-10-18', planItemId: it1.id, type: 'expense' });
    expect(await d.paidChecks.get(`2026-10|${it1.id}`)).toMatchObject({ checked: true, logEntryId: id });
  });

  it('ไม่ได้ผูกหมวด: บันทึกเป็น อื่น ๆ (นอกงบ)', async () => {
    const d = await fresh();
    const id = await markDuePaid(d, { item: item('fixed', 'ค่าธรรมเนียม', 30), kind: 'fixed', cycle: '2026-10', amount: B(30), today: '2026-10-18' });
    expect((await d.logEntries.get(id!))?.categoryId).toBe('c-other');
  });

  it('ติ๊กในหน้าแผนแล้วยกเลิก: รายจ่ายที่บันทึกให้หายด้วย · กันเงินเข้าเป้าไม่บันทึก', async () => {
    const d = await fresh();
    const it1 = item('fixed', 'ค่าเน็ต', 599, { logCategoryIds: ['c-bill'] });
    await markDuePaid(d, { item: it1, kind: 'fixed', cycle: '2026-11', amount: B(599), today: '2026-10-27' });
    expect(await d.logEntries.get((await d.paidChecks.get(`2026-11|${it1.id}`))!.logEntryId!)).toMatchObject({ cycleMonth: '2026-11', categoryId: 'c-bill' });
    await unmarkPaid(d, '2026-11', it1.id);
    expect([await d.logEntries.count(), await d.paidChecks.count()]).toEqual([0, 0]);
    expect(await markDuePaid(d, { item: item('goalSpend', 'ทริป', 1200), kind: 'goalSpend', cycle: '2026-11', amount: B(1200), today: '2026-10-27' })).toBeNull();
  });

  it('รายการออม: ติ๊กอย่างเดียว ไม่บันทึกเป็นรายจ่าย', async () => {
    const d = await fresh();
    const id = await markDuePaid(d, { item: item('saving', 'เงินสำรอง', 6000), kind: 'saving', cycle: '2026-10', amount: B(6000), today: '2026-10-18' });
    expect(id).toBeNull();
    expect(await d.logEntries.count()).toBe(0);
    expect(await d.paidChecks.count()).toBe(1);
  });

  it('ลบรายการในหน้าบันทึก = ยกเลิกติ๊กจ่ายแล้วด้วย', async () => {
    const d = await fresh();
    const it1 = item('fixed', 'ค่าเน็ต', 599);
    const id = await markDuePaid(d, { item: it1, kind: 'fixed', cycle: '2026-10', amount: B(599), today: '2026-10-18' });
    await deleteLogEntry(d, id!);
    expect(await d.logEntries.count()).toBe(0);
    expect(await d.paidChecks.count()).toBe(0);
  });
});

describe('การ์ด เงินเดือนเข้าแล้วหรือยัง', () => {
  it('ยืนยัน / เลื่อนไปพรุ่งนี้', async () => {
    const d = await fresh();
    await snoozePay(d, { cycle: '2027-01', today: '2026-12-25' });
    expect(await d.payReceipts.get('2027-01')).toMatchObject({ status: 'snoozed', snoozeUntil: '2026-12-26' });
    await confirmPay(d, { cycle: '2027-01', date: '2026-12-26', amount: B(30450) });
    expect(await d.payReceipts.get('2027-01')).toMatchObject({ status: 'received', date: '2026-12-26', amount: B(30450), snoozeUntil: null });
  });

  it('ใช้ยอดจริงในแผนเดือนนั้น: เป็นยอดเฉพาะเดือน เดือนอื่นไม่เปลี่ยน', async () => {
    const d = await fresh();
    const sal = item('income', 'เงินเดือน', 31000);
    await d.planItems.put(sal);
    await applyActualSalary(d, { item: sal, cycle: '2027-01', actual: B(30450) });
    const after = (await d.planItems.get(sal.id))!;
    expect([rawAmount(after, '2026-12'), rawAmount(after, '2027-01'), rawAmount(after, '2027-02')]).toEqual([B(31000), B(30450), B(31000)]);
  });
});

describe('ลากเรียงรายการในแผน', () => {
  it('เรียงเฉพาะที่แสดง รายการที่ซ่อนคงตำแหน่ง', async () => {
    const { reorderPlanItems } = await import('./actions');
    const d = await fresh();
    const [a, b, c, z] = ['ค่ากิน', 'เดินทาง', 'ของใช้', 'ค่าเรียน'].map((n, i) => item('variable', n, 100, { order: i }));
    await d.planItems.bulkPut([a, b, c, z]);
    await reorderPlanItems(d, a.groupId, [c.id, a.id, b.id]); // z ซ่อนอยู่ท้าย
    const got = (await d.planItems.where('groupId').equals(a.groupId).toArray()).sort((x, y) => x.order - y.order).map((x) => x.name);
    expect(got).toEqual(['ของใช้', 'ค่ากิน', 'เดินทาง', 'ค่าเรียน']);
  });
});
