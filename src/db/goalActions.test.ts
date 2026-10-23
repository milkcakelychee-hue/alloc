import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocDB } from './db';
import { ensureDefaults } from './defaults';
import { adjustDelta, createGoal, deleteGoalCategory, goalCats, pvdEntry, syncDeposits, spendGoal } from './goalActions';
import { confirmPay } from './actions';
import { goalBalance } from '../calc/goals';
import { rawAmount } from '../calc/plan';
import { B } from '../calc/testkit';

let n = 0;
let cur: AllocDB;
afterEach(async () => { await cur?.delete(); });
const fresh = async () => {
  cur = new AllocDB(`goal-${n++}`);
  await ensureDefaults(cur, 1);
  await cur.settings.update('app', { pay: { kind: 'day', day: 25 }, weekendShift: 'before' });
  return cur;
};
const created = new Date(2026, 9, 10).getTime(); // 10 ต.ค. 69 อยู่ในรอบ ต.ค. 69

describe('สร้างเป้า + บวกยอดเมื่อเงินเดือนเข้า', () => {
  it('สร้างเป้า + เพิ่มลงแผน: รายการในแผนเริ่มรอบหน้า จนถึงเป้า', async () => {
    const d = await fresh();
    const id = await createGoal(d, { type: 'goalSpend', name: 'ทริปเกาหลี', icon: 'travel', color: 'brown', target: B(35000), opening: 0, dueMonth: '2027-09', plan: { amount: B(3190), start: '2026-11' } }, '2026-10', created);
    const items = await d.planItems.where('goalId').equals(id).toArray();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ groupId: 'g-goalSpend', defaultAmount: B(3190), period: { start: '2026-11', endMode: 'goal' } });
  });

  it('บวกตามแผนเฉพาะรอบที่เงินเข้าแล้ว ครั้งเดียวต่อรอบ', async () => {
    const d = await fresh();
    const id = await createGoal(d, { type: 'saving', name: 'เงินสำรอง', icon: 'shield', color: 'green', target: B(25000), opening: B(12000), dueMonth: null, plan: { amount: B(2000), start: '2026-11' } }, '2026-10', created);
    expect(await syncDeposits(d, '2026-10-23', created)).toBe(0); // รอบ พ.ย. ยังไม่ยืนยัน
    await confirmPay(d, { cycle: '2026-11', date: '2026-10-23', amount: B(31000) }); // กดเงินเดือนเข้าแล้ว = บวกทันที
    expect(await d.goalAdjustments.count()).toBe(1);
    expect(await syncDeposits(d, '2026-10-24', created)).toBe(0);
    const adj = await d.goalAdjustments.toArray();
    expect(adj[0]).toMatchObject({ kind: 'planDeposit', delta: B(2000), cycleMonth: '2026-11', date: '2026-10-23' });
    expect(goalBalance((await d.goals.get(id))!, adj)).toBe(B(14000));
  });

  it('PVD: สมทบจาก % ทั้งส่วนของฉันและนายจ้าง', async () => {
    const d = await fresh();
    await createGoal(d, { type: 'pvd', name: 'PVD', icon: 'bank', color: 'olive', target: B(80000), opening: B(60000.40), dueMonth: null, pvd: pvdEntry('2026-10', B(25000), 500, 500) }, '2026-10', created);
    expect(await syncDeposits(d, '2026-10-23', created)).toBe(2);
    expect((await d.goalAdjustments.toArray()).map((a) => [a.kind, a.delta]).sort()).toEqual([['employer', B(1250)], ['planDeposit', B(1250)]]);
  });
});

describe('ปรับยอด / ใช้เงิน / ลบหมวด', () => {
  it('แก้ยอดคงเหลือ: คิดส่วนต่างให้', () => {
    expect(adjustDelta('set', B(11250), B(12000))).toBe(-B(750));
    expect(adjustDelta('out', B(1500), B(12000))).toBe(-B(1500));
    expect(adjustDelta('add', B(1500), B(12000))).toBe(B(1500));
  });

  it('ใช้เงินก้อนนี้แล้ว: บันทึกรายจ่าย ปิดเป้า แผนหยุดรอบถัดไป', async () => {
    const d = await fresh();
    const id = await createGoal(d, { type: 'goalSpend', name: 'ทริปเกาหลี', icon: 'travel', color: 'brown', target: B(35000), opening: B(3190), dueMonth: '2027-09', plan: { amount: B(3190), start: '2026-10' } }, '2026-09', created);
    const g = (await d.goals.get(id))!;
    await spendGoal(d, { goal: g, balance: B(3190), currentCycle: '2026-10', today: '2026-10-23' });
    expect(await d.logEntries.toArray()).toMatchObject([{ amountPaid: B(3190), categoryId: 'c-other', cycleMonth: '2026-10', type: 'expense' }]);
    expect((await d.goals.get(id))!.closed).toBe(true);
    expect(goalBalance((await d.goals.get(id))!, await d.goalAdjustments.toArray())).toBe(0);
    const it1 = (await d.planItems.where('goalId').equals(id).first())!;
    expect([rawAmount(it1, '2026-10'), rawAmount(it1, '2026-11')]).toEqual([B(3190), 0]);
  });

  it('ลบหมวด: ลบเป้า ประวัติ รายการในแผนที่ผูก ซ่อนหมวดในแผน · สร้างเป้าใหม่ = หมวดกลับมา', async () => {
    const d = await fresh();
    await createGoal(d, { type: 'invest', name: 'กองทุนดัชนี', icon: 'trend', color: 'blue', target: B(48000), opening: B(28000), dueMonth: null, plan: { amount: B(3000), start: '2026-11' } }, '2026-10', created);
    await deleteGoalCategory(d, 'invest');
    expect(await d.goals.count()).toBe(0);
    expect(await d.planItems.count()).toBe(0);
    expect((await d.planGroups.get('g-invest'))!.enabled).toBe(false);
    expect(goalCats(await d.settings.get('app')).order).toEqual(['saving', 'goalSpend', 'pvd']);
    await createGoal(d, { type: 'invest', name: 'กองทุนดัชนี', icon: 'trend', color: 'blue', target: B(48000), opening: 0, dueMonth: null }, '2026-10', created);
    expect((await d.planGroups.get('g-invest'))!.enabled).toBe(true);
    expect(goalCats(await d.settings.get('app')).order).toContain('invest');
  });
});
