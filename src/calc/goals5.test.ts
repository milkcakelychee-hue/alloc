import { describe, expect, it } from 'vitest';
import { B, goal, item } from './testkit';
import { goalOutlook, pvdFromRate, reachByMonthly } from './goals';
import { fundedThrough } from './payday';
import type { GoalAdjustment } from '../db/types';

describe('ขั้นที่ 5 เป้าหมาย', () => {
  it('PVD จาก % ของเงินเดือนก่อนหัก', () => {
    expect(pvdFromRate(B(25000), 500)).toBe(B(1250));
    expect(pvdFromRate(B(26005), 500)).toBe(B(1300.25));
  });

  it('ยอดต่อเดือน → ครบเป้าเดือนไหน', () => {
    expect(reachByMonthly(B(35000), B(4000), '2026-11')).toEqual({ months: 9, reachMonth: '2027-07' });
    expect(reachByMonthly(B(35000), 0, '2026-11').reachMonth).toBeNull();
  });

  it('เงินเดือนเข้าแล้วหรือยัง: ยืนยัน หรือเลยวันเงินเข้า 7 วัน', () => {
    const base = { pay: { kind: 'day' as const, day: 25 }, shift: 'before' as const, overrides: {}, today: '2026-10-23' };
    expect(fundedThrough({ ...base, received: new Map() }).cycle).toBe('2026-10');
    expect(fundedThrough({ ...base, today: '2026-10-30', received: new Map() }).cycle).toBe('2026-11');
    const f = fundedThrough({ ...base, received: new Map([['2026-11', '2026-10-23']]) });
    expect(f.cycle).toBe('2026-11');
    expect(f.dateOf('2026-11')).toBe('2026-10-23');
    expect(f.dateOf('2026-10')).toBe('2026-09-25');
  });

  it('แผนปีหน้าว่าง: เตือนยอดจะหยุด', () => {
    const g = goal('saving', 'เงินสำรอง', 25000, 12000);
    const it1 = item('saving', 'เงินสำรอง', 2000, { goalId: g.id, period: { start: '2026-01', endMode: 'month', endMonth: '2026-12' } });
    const done: GoalAdjustment = { id: 'x', createdAt: 0, updatedAt: 0, goalId: g.id, date: '2026-09-25', delta: 0, kind: 'planDeposit', reason: '', cycleMonth: '2026-10' };
    const o = goalOutlook(g, [it1], [done], '2026-10');
    expect(o.stopsAt).toEqual({ year: 2027, balance: B(16000) });
    expect(o.atHorizon).toBe(B(16000));
    expect(o.planNow).toBe(B(2000));
  });

  it('คาดการณ์ครบเป้า: เม.ย. 70 และยอดแผนที่เปลี่ยน', () => {
    const g = goal('saving', 'เงินสำรอง', 25000, 12000);
    const it1 = item('saving', 'เงินสำรอง', 2000, { goalId: g.id, monthOverrides: { '2026-12': B(3500) }, period: { start: '2026-11', endMode: 'goal' } });
    const o = goalOutlook(g, [it1], [], '2026-10');
    expect(o.reachMonth).toBe('2027-04');
    expect(o.stopsAt).toBeNull();
    expect(o.changes.map((c) => [c.month, c.amount])).toEqual([['2026-11', B(2000)], ['2026-12', B(3500)], ['2027-01', B(2000)]]);
  });
});
