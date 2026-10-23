import { describe, expect, it } from 'vitest';
import { backupStatus } from './reminders';
import { dueDateInCycle, dueItems, payPrompts } from './reminders';
import { B, groups, item } from './testkit';
import type { PayReceipt } from '../db/types';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 18, 12);

describe('เตือนสำรองข้อมูล', () => {
  it('ยังไม่เคยสำรอง → เตือน', () => {
    expect(backupStatus(null, now)).toEqual({ never: true, days: null, due: true });
  });
  it('14 วันยังไม่เตือน · 15 วันเตือน', () => {
    expect(backupStatus(now - 14 * DAY, now)).toEqual({ never: false, days: 14, due: false });
    expect(backupStatus(now - 15 * DAY - 1, now)).toEqual({ never: false, days: 15, due: true });
  });
});


const day27 = { kind: 'day', day: 27 } as const;
const s = (shift: 'before' | 'after') => ({ pay: day27, weekendShift: shift, payOverrides: {} });
const income = () => B(31000);
const rec = (id: string, status: PayReceipt['status'], snoozeUntil: string | null = null): PayReceipt =>
  ({ id, status, date: null, amount: null, snoozeUntil, createdAt: 0, updatedAt: 0 });

describe('วันครบกำหนดในรอบ', () => {
  it('หาวันในช่วงรอบ · เดือนสั้นใช้วันสุดท้าย', () => {
    const oct = { start: '2026-09-27', end: '2026-10-26' };
    expect(dueDateInCycle(18, oct)).toBe('2026-10-18');
    expect(dueDateInCycle(28, oct)).toBe('2026-09-28');
    expect(dueDateInCycle(31, { start: '2027-02-27', end: '2027-03-26' })).toBe('2027-02-28');
  });
});

describe('การ์ด จ่ายหรือยัง', () => {
  it('ขึ้นเมื่อถึงวันครบกำหนด ยังไม่ติ๊ก ไม่ใช่รายรับ', () => {
    const phone = item('fixed', 'ค่าโทรศัพท์', 1250, { dueDay: 18 });
    const house = item('fixed', 'ค่าบ้าน', 9000, { dueDay: 25 });
    const gym = item('fixed', 'ค่ายิม', 900, { dueDay: 28 });
    const net = item('fixed', 'ค่าเน็ต', 599, { dueDay: 10 });
    const salary = item('income', 'เงินเดือน', 31000, { dueDay: 1 });
    const checks = [{ id: 'x', cycleMonth: '2026-10', planItemId: net.id, checked: true, createdAt: 0, updatedAt: 0 }];
    const due = dueItems({ groups, items: [phone, house, gym, net, salary], checks, today: '2026-10-18', pay: day27, amountOf: (i) => i.defaultAmount });
    expect(due.map((d) => [d.item.name, d.dueDate])).toEqual([['ค่ายิม', '2026-09-28'], ['ค่าโทรศัพท์', '2026-10-18']]);
  });
});

describe('การ์ด เงินเดือนเข้าแล้วหรือยัง (ทุกวันที่ 27 · 27 ธ.ค. 69 = อาทิตย์)', () => {
  const base = { receipts: [] as PayReceipt[], plannedIncome: income, items: [] };
  it('ก่อนเงินเข้า 2 วัน: บอกล่วงหน้า', () => {
    const p = payPrompts({ ...base, settings: s('before'), today: '2026-12-23' });
    expect(p.confirm).toBeNull();
    expect(p.upcoming).toMatchObject({ cycle: '2027-01', expected: '2026-12-25', nominal: '2026-12-27', reason: 'weekend', daysLeft: 2 });
  });
  it('ถึงวันคาดว่าเข้า: ถามยืนยัน · ยังไม่เข้า = ถามอีกทีพรุ่งนี้ · ยืนยันแล้วไม่ถาม', () => {
    expect(payPrompts({ ...base, settings: s('before'), today: '2026-12-25' }).confirm).toMatchObject({ cycle: '2027-01', planned: B(31000) });
    const snoozed = [rec('2027-01', 'snoozed', '2026-12-26')];
    expect(payPrompts({ ...base, receipts: snoozed, settings: s('before'), today: '2026-12-25' }).confirm).toBeNull();
    expect(payPrompts({ ...base, receipts: snoozed, settings: s('before'), today: '2026-12-26' }).confirm?.cycle).toBe('2027-01');
    expect(payPrompts({ ...base, receipts: [rec('2027-01', 'received')], settings: s('before'), today: '2026-12-26' }).confirm).toBeNull();
  });
  it('เพิ่งเริ่มใช้กลางรอบ ไม่ถามย้อนเงินที่เข้านานแล้ว', () => {
    expect(payPrompts({ ...base, settings: s('before'), today: '2026-10-23' }).confirm).toBeNull();
  });
  it('เงินเข้าช้า (หลังวันหยุด): เตือนรายการที่ครบกำหนดก่อนเงินเข้า', () => {
    const items = [item('fixed', 'ค่าสมาชิก', 299, { dueDay: 27 }), item('fixed', 'ค่าบ้าน', 9000, { dueDay: 25 })];
    const p = payPrompts({ ...base, items, settings: s('after'), today: '2026-12-27' });
    expect(p.upcoming).toMatchObject({ cycle: '2027-01', expected: '2026-12-28', nominal: '2026-12-27' });
    expect(p.lateBills).toEqual([{ name: 'ค่าสมาชิก', date: '2026-12-27', amount: B(299) }]);
  });
});
