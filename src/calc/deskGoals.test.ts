import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { B, adj, goal, item } from './testkit';
import { goalChart, goalHistory, goalSort, reorderGoals } from './deskGoals';
import { AllocDB } from '../db/db';
import { ensureDefaults } from '../db/defaults';
import { pvdAddedFor } from '../db/goalActions';
import type { GoalAdjustment } from '../db/types';

const cyc = (a: GoalAdjustment) => a.cycleMonth ?? '2026-10';

describe('กราฟเป้าบนคอม', () => {
  it('ย้อนหลังไม่ก่อนรอบที่สร้าง แล้วคาดการณ์ถึงเดือนที่ครบเป้า', () => {
    const g = goal('saving', 'เงินสำรอง', 20000, 10000);
    const it1 = item('saving', 'ออม', 4000, { goalId: g.id });
    const bars = goalChart(g, [it1], [], '2026-11', '2026-09', cyc);
    expect(bars.filter((b) => b.actual).map((b) => b.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    const proj = bars.filter((b) => !b.actual);
    // รอบนี้ยังไม่บวก: 10,000 → 14,000 (พ.ย. ยังนับเป็นจริง) · คาดการณ์ ธ.ค. 18,000 · ม.ค. 20,000 ครบ
    expect(proj.map((b) => [b.month, b.value])).toEqual([['2026-12', B(18000)], ['2027-01', B(20000)]]);
  });
  it('ครบเป้าแล้วหรือปิดเป้า ไม่มีแท่งคาดการณ์', () => {
    const g = goal('goalSpend', 'ทริป', 5000, 5000);
    expect(goalChart(g, [], [], '2026-11', '2026-11', cyc).every((b) => b.actual)).toBe(true);
  });
  it('ไม่เกินจำนวนแท่งที่กำหนด', () => {
    const g = goal('saving', 'ก้อนใหญ่', 900000, 0);
    const it1 = item('saving', 'ออม', 1000, { goalId: g.id });
    expect(goalChart(g, [it1], [], '2026-11', '2025-01', cyc, 18)).toHaveLength(18);
  });
});

describe('ประวัติยอด', () => {
  it('ใหม่ไปเก่า ยอดหลังรายการถูก และปิดท้ายด้วยยอดยกมา', () => {
    const g = goal('saving', 'เงินสำรอง', 20000, 1000);
    const a1 = { ...adj(g.id, 500, 'deposit'), date: '2026-10-01' };
    const a2 = { ...adj(g.id, -200, 'withdraw'), date: '2026-10-05' };
    const rows = goalHistory(g, [a2, a1]);
    expect(rows.map((r) => r.after)).toEqual([B(1300), B(1500), B(1000)]);
    expect(rows.at(-1)!.adj).toBeNull();
  });
});

describe('ลากเรียงเป้า', () => {
  it('ย้ายไปก่อนเป้าอื่น และไปท้ายกลุ่ม', () => {
    const a = goal('saving', 'a', 1, 0, { createdAt: 1 }), b = goal('saving', 'b', 1, 0, { createdAt: 2 }), c = goal('saving', 'c', 1, 0, { createdAt: 3 });
    expect(reorderGoals([a, b, c], c.id, a.id).map((x) => x.id)).toEqual([c.id, a.id, b.id]);
    const o = reorderGoals([a, b, c], a.id, null);
    expect(o.map((x) => x.id)).toEqual([b.id, c.id, a.id]);
    const sorted = [{ ...a, order: 3 }, { ...b, order: 1 }, { ...c, order: 2 }].sort(goalSort).map((x) => x.name);
    expect(sorted).toEqual(['b', 'c', 'a']);
  });
});

describe('บอกยอดเข้า PVD หลังเงินเดือนเข้า', () => {
  let d: AllocDB;
  afterEach(async () => { await d?.delete(); });
  it('รวมส่วนของฉันและนายจ้างของรอบนั้น', async () => {
    d = new AllocDB('pvd-note'); await ensureDefaults(d, 1);
    const g = goal('pvd', 'PVD', 90000, 0);
    await d.goals.add(g);
    await d.goalAdjustments.bulkAdd([
      { ...adj(g.id, 1250, 'planDeposit'), cycleMonth: '2026-11' },
      { ...adj(g.id, 1250, 'employer'), cycleMonth: '2026-11' },
      { ...adj(g.id, 1250, 'planDeposit'), cycleMonth: '2026-10' }
    ]);
    expect(await pvdAddedFor(d, '2026-11')).toEqual({ mine: B(1250), employer: B(1250), total: B(2500) });
    expect(await pvdAddedFor(d, '2026-12')).toBeNull();
  });
});
