import { describe, expect, it } from 'vitest';
import { accountTransfers, applyAmountChange, planTotals, rawAmount, stopFrom } from './plan';
import { B, groups, item } from './testkit';

const M = '2026-10';
const acc = (id: string) => ({ accountId: id });

// TEST_CASES.md 6.2 รอบ ต.ค. 69
const items = [
  item('income', 'เงินเดือน', 31000),
  item('fixed', 'ค่าบ้าน', 9000.75, acc('บัญชีบ้าน')),
  item('fixed', 'ค่าโทรศัพท์', 1250, acc('บัญชีใช้จ่าย')),
  item('variable', 'ค่ากิน', 4800, acc('บัญชีใช้จ่าย')),
  item('variable', 'เดินทาง', 1200, acc('บัญชีใช้จ่าย')),
  item('variable', 'ของใช้', 500, acc('บัญชีใช้จ่าย')),
  item('variable', 'ค่ามือถือ', 400, acc('บัญชีใช้จ่าย')),
  item('variable', 'ให้ที่บ้าน', 1500, acc('บัญชีใช้จ่าย')),
  item('goalSpend', 'ทริปเกาหลี', 1200, acc('บัญชีเป้าหมาย')),
  item('saving', 'เงินสำรอง', 6000, acc('บัญชีออม')),
  item('invest', 'กองทุน A', 3000, acc('บัญชีลงทุน A')),
  item('invest', 'กองทุน B', 1000, acc('บัญชีลงทุน B'))
];

describe('6.2 แผนรายเดือน', () => {
  it('ยอดรวมหมวด เงินเหลือ และ Savings Rate', () => {
    const t = planTotals(groups, items, M);
    expect(t).toMatchObject({ income: B(31000), fixed: B(10250.75), variable: B(8400), goalSpend: B(1200), saving: B(6000), invest: B(4000) });
    expect(t.leftover).toBe(B(1149.25));
    expect(Math.round(t.savingsRate * 1000) / 10).toBe(32.3);
  });

  it('แยกบัญชี: ยอดโอนแต่ละบัญชี และเหลือในบัญชีเงินเดือน', () => {
    const { byAccount, salaryLeft } = accountTransfers(groups, items, M);
    expect(Object.fromEntries(byAccount)).toEqual({
      บัญชีบ้าน: B(9000.75), บัญชีใช้จ่าย: B(9650), บัญชีเป้าหมาย: B(1200),
      บัญชีออม: B(6000), 'บัญชีลงทุน A': B(3000), 'บัญชีลงทุน B': B(1000)
    });
    expect(salaryLeft).toBe(B(1149.25));
  });

  it('ยอดตามเดือน: monthOverrides และช่วง period', () => {
    const it2 = item('fixed', 'ค่าเรียน', 1000, { monthOverrides: { '2026-12': B(1500) }, period: { start: '2026-11', endMode: 'none' } });
    expect(rawAmount(it2, '2026-10')).toBe(0);
    expect(rawAmount(it2, '2026-11')).toBe(B(1000));
    expect(rawAmount(it2, '2026-12')).toBe(B(1500));
  });

  it('endMode month นับถึงเดือนสุดท้ายแล้วหยุด', () => {
    const it3 = item('fixed', 'ผ่อน', 500, { period: { start: '2026-10', endMode: 'month', endMonth: '2026-12' } });
    expect(['2026-12', '2027-01'].map((m) => rawAmount(it3, m))).toEqual([B(500), 0]);
  });

  it('หมวดที่ปิดไม่นับ', () => {
    const off = groups.map((g) => (g.kind === 'goalSpend' ? { ...g, enabled: false } : g));
    expect(planTotals(off, items, M).leftover).toBe(B(2349.25));
  });
});

describe('แก้ยอดรายการ', () => {
  const base = () => item('variable', 'ค่ากิน', 4800, { period: { start: '2026-08', endMode: 'none' }, monthOverrides: { '2026-12': B(5500) } });

  it('เฉพาะเดือนนี้: เก็บเป็นยอดเฉพาะเดือน · ใส่เท่ายอดปกติ = ลบยอดเฉพาะเดือน', () => {
    const a = applyAmountChange(base(), '2026-10', B(4500), 'month');
    expect(a.monthOverrides).toEqual({ '2026-10': B(4500), '2026-12': B(5500) });
    expect(applyAmountChange(a, '2026-10', B(4800), 'month').monthOverrides).toEqual({ '2026-12': B(5500) });
  });

  it('ทุกเดือนตั้งแต่เดือนนี้: เดือนก่อนหน้าคงยอดเดิม เดือนนี้เป็นต้นไปใช้ยอดใหม่', () => {
    const a = applyAmountChange(base(), '2026-10', B(5000), 'from');
    expect(a.defaultAmount).toBe(B(5000));
    expect(['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'].map((m) => rawAmount(a, m)))
      .toEqual([B(4800), B(4800), B(5000), B(5000), B(5500)]);
  });

  it('หยุดตั้งแต่เดือนนี้: เดือนก่อนยังอยู่ เดือนนี้เป็นต้นไปเป็น 0', () => {
    const s = stopFrom(base(), '2026-10');
    expect(['2026-09', '2026-10'].map((m) => rawAmount(s, m))).toEqual([B(4800), 0]);
  });
});
