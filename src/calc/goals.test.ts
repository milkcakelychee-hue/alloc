import { describe, expect, it } from 'vitest';
import { dueDeposits, goalAwareAmountOf, goalBalance, projectGoal, pvdMonthly, suggestMonthly, totalAssets } from './goals';
import { adj, B, goal, item } from './testkit';

describe('6.3 เป้าหมาย', () => {
  it('ยอดปัจจุบัน = ยอดยกมา + การปรับยอด', () => {
    const g = goal('saving', 'เงินสำรอง', 25000, 10000);
    expect(goalBalance(g, [adj(g.id, 2500), adj(g.id, -500, 'withdraw'), adj('อื่น', 99)])).toBe(B(12000));
  });

  it('คาดการณ์วันครบ: ครบ เม.ย. 70 เดือนนั้นใส่แค่ 1,500', () => {
    const plan: Record<string, number> = { '2026-11': B(2000), '2026-12': B(3500) };
    const p = projectGoal({ balance: B(12000), target: B(25000), from: '2026-11', planFor: (m) => plan[m] ?? B(2000) });
    expect(p.reachMonth).toBe('2027-04');
    expect(p.months.at(-1)).toEqual({ month: '2027-04', deposit: B(1500), balance: B(25000) });
  });

  it('แผนเป็น 0 → ไม่มีวันครบ', () => {
    expect(projectGoal({ balance: 0, target: B(100), from: '2026-11', planFor: () => 0, maxMonths: 24 }).reachMonth).toBeNull();
  });

  it('เสนอยอดต่อเดือน ปัดขึ้นหลักสิบ', () => {
    expect(suggestMonthly(B(35000), '2026-10', '2027-09')).toEqual({ months: 11, perMonth: B(3190) });
    expect(suggestMonthly(B(24000), '2026-10', '2027-10')).toEqual({ months: 12, perMonth: B(2000) });
  });

  it('endMode goal: เดือนสุดท้ายในแผนใส่เท่าที่ขาด แล้วหยุดเอง', () => {
    const g = goal('saving', 'เงินสำรอง', 25000, 12000);
    const it1 = item('saving', 'ออมสำรอง', 2000, {
      goalId: g.id, monthOverrides: { '2026-12': B(3500) }, period: { start: '2026-01', endMode: 'goal' }
    });
    const amountOf = goalAwareAmountOf([g], [it1], [], '2026-10');
    expect(['2026-10', '2026-11', '2026-12', '2027-03', '2027-04', '2027-05'].map((m) => amountOf(it1, m)))
      .toEqual([B(2000), B(2000), B(3500), B(2000), B(1500), 0]);
  });

  it('วันเงินเดือนเข้า: สร้าง planDeposit ครั้งเดียวต่อรอบ และตัดที่เป้า', () => {
    const g = goal('saving', 'เงินสำรอง', 25000, 24000);
    const it1 = item('saving', 'ออมสำรอง', 2000, { goalId: g.id, period: { start: '2026-01', endMode: 'goal' } });
    const first = dueDeposits([g], [it1], [], '2026-11', () => '2026-11');
    expect(first).toEqual([{ goalId: g.id, delta: B(1000), kind: 'planDeposit', reason: 'ฝากตามแผน', cycleMonth: '2026-11' }]);
    const saved = first.map((a, i) => ({ ...a, id: `x${i}`, createdAt: 0, updatedAt: 0, date: '2026-10-27' }));
    expect(dueDeposits([g], [it1], saved, '2026-11', () => '2026-11')).toEqual([]);
  });

  it('PVD: 60,000.40 + 2,500 × 3 = 67,500.40 แล้ว +2,600.50 ตั้งแต่ ม.ค. 70 → ครบ 80,000 พ.ค. 70', () => {
    const g = goal('pvd', 'PVD', 80000, 60000.40, {
      contributions: [
        { from: '2026-10', mine: B(1250), employer: B(1250) },
        { from: '2027-01', mine: B(1300.25), employer: B(1300.25) }
      ]
    });
    const p = projectGoal({ balance: g.openingBalance, target: g.target, from: '2026-10', planFor: pvdMonthly(g), cap: false });
    expect(p.months[2]).toEqual({ month: '2026-12', deposit: B(2500), balance: B(67500.40) });
    expect(p.reachMonth).toBe('2027-05');
    expect(p.months.at(-1)?.balance).toBe(B(80502.90));

    const deps = dueDeposits([g], [], [], '2026-10', () => '2026-10');
    expect(deps.map((d) => [d.kind, d.delta])).toEqual([['planDeposit', B(1250)], ['employer', B(1250)]]);
  });

  it('สินทรัพย์รวม: ออม + เงินต้นลงทุน ไม่รวม PVD และรายจ่ายตามเป้าหมาย', () => {
    const goals = [
      goal('saving', 'เงินสำรอง', 25000, 12000),
      goal('saving', 'เงินเที่ยว', 10000, 3000),
      goal('invest', 'กองทุน A', 45000, 28000),
      goal('invest', 'กองทุน B', 20000, 12350),
      goal('pvd', 'PVD', 80000, 67500.40),
      goal('goalSpend', 'ทริปเกาหลี', 35000, 4800)
    ];
    expect(totalAssets(goals, [])).toEqual({ saving: B(15000), invest: B(40350), total: B(55350) });
  });
});
