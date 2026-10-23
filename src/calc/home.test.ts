import { describe, expect, it } from 'vitest';
import { assetsSummary, incomeSplit, planNextPrompt } from './home';
import { planTotals } from './plan';
import { B, adj, goal, groups, item } from './testkit';

// TEST_CASES.md 6.2 รอบ ต.ค. 69
const items = [
  item('income', 'เงินเดือน', 31000), item('fixed', 'ค่าบ้าน', 9000.75), item('fixed', 'ค่าโทรศัพท์', 1250),
  item('variable', 'ค่ากิน', 8400), item('goalSpend', 'ทริปเกาหลี', 1200),
  item('saving', 'เงินสำรอง', 6000), item('invest', 'กองทุน A', 3000), item('invest', 'กองทุน B', 1000)
];

describe('หน้าหลัก สรุป', () => {
  it('สินทรัพย์รวม 55,350 · เงินเก็บ 27.1% ลงทุน 72.9%', () => {
    const gs = [goal('saving', 'เงินสำรอง', 25000, 12000), goal('saving', 'เก็บก้อน', 9000, 3000), goal('invest', 'กองทุน A', 48000, 28000), goal('invest', 'กองทุน B', 20000, 12350), goal('pvd', 'PVD', 80000, 67500.40)];
    const a = assetsSummary(gs, []);
    expect(a).toMatchObject({ saving: B(15000), invest: B(40350), total: B(55350), savingPct: 27.1, investPct: 72.9 });
    expect(assetsSummary([], []).investPct).toBe(0);
    expect(assetsSummary(gs, [adj(gs[0].id, -15000)]).total).toBe(B(40350));
  });

  it('Savings Rate 32.3% · ออม 19.4% ลงทุน 12.9% รายจ่าย 64.0%', () => {
    const s = incomeSplit(planTotals(groups, items, '2026-10'));
    expect(s).toMatchObject({ ratePct: 32.3, savingPct: 19.4, investPct: 12.9, expensePct: 64, expense: B(19850.75) });
  });

  it('วางแผนเดือนหน้า: 10 วันก่อนเงินเข้า และแผนรอบหน้าติดลบหรือว่าง', () => {
    const base = { pay: { kind: 'day' as const, day: 25 }, shift: 'before' as const, overrides: {} };
    const neg = () => ({ ...planTotals(groups, items, '2026-11'), income: B(31000), leftover: -B(175.50) });
    expect(planNextPrompt({ ...base, today: '2026-10-18', totalsOf: neg })).toEqual({ cycle: '2026-11', payDate: '2026-10-23', daysLeft: 5, leftover: -B(175.50), empty: false });
    expect(planNextPrompt({ ...base, today: '2026-10-10', totalsOf: neg })).toBeNull(); // เกิน 10 วัน
    expect(planNextPrompt({ ...base, today: '2026-10-18', totalsOf: () => planTotals(groups, items, '2026-11') })).toBeNull(); // แผนไม่ติดลบ
    expect(planNextPrompt({ ...base, today: '2026-10-18', totalsOf: () => planTotals(groups, [], '2026-11') })?.empty).toBe(true);
  });
});
