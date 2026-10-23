import { describe, expect, it } from 'vitest';
import { itemChanges, yearMonths, yearSummary } from './planYear';
import { rawAmount } from './plan';
import { B, groups, item } from './testkit';

// แผนสมมติปี 2570: เงินเดือนเริ่ม มี.ค. · ผ่อนจบ พ.ค. · ค่ากิน ธ.ค. เพิ่ม · ลงทุนเริ่ม ก.ค.
const items = [
  item('income', 'เงินเดือน', 32000, { period: { start: '2027-03', endMode: 'none' } }),
  item('fixed', 'ผ่อนโทรศัพท์', 2000, { period: { start: '2027-01', endMode: 'month', endMonth: '2027-05' } }),
  item('variable', 'ค่ากิน', 5000, { monthOverrides: { '2027-12': B(31500) } }),
  item('saving', 'เงินสำรอง', 4000),
  item('invest', 'กองทุน A', 3000, { period: { start: '2027-07', endMode: 'none' } })
];

describe('มุมมองปี', () => {
  const y = yearSummary(groups, items, 2027, rawAmount);

  it('รวมเฉพาะเดือนที่มีรายรับในแผน (มี.ค.–ธ.ค. = 10 เดือน)', () => {
    expect(y.activeMonths).toBe(10);
    expect(y.income).toBe(B(320000));
    expect(y.fixed).toBe(B(6000)); // มี.ค.–พ.ค.
    expect(y.saving + y.invest).toBe(B(40000 + 18000));
    expect(Math.round(y.savingsRate * 1000) / 10).toBe(18.1);
  });

  it('เดือนที่เงินเหลือน้อยสุด / รายจ่ายสูงสุด / ติดลบ', () => {
    expect(y.minLeft).toEqual({ month: '2027-12', leftover: B(32000 - 31500 - 4000 - 3000) });
    expect(y.maxExpense).toEqual({ month: '2027-12', expense: B(31500) });
    expect(y.negative.map((n) => n.month)).toEqual(['2027-12']);
  });

  it('สรุปตามหมวด: รวม เฉลี่ยต่อเดือน เดือนสูงสุด', () => {
    const fixed = y.groups.find((g) => g.kind === 'fixed')!;
    expect(fixed).toMatchObject({ total: B(6000), avg: B(600), max: { month: '2027-03', amount: B(2000) }, items: 1 });
  });

  it('ยอดที่เปลี่ยน: เริ่ม / เปลี่ยน / จบ', () => {
    const ch = itemChanges(items, yearMonths(2027), rawAmount).map((c) => [c.kind, c.item.name, c.month]);
    expect(ch).toEqual([
      ['started', 'เงินเดือน', '2027-03'],
      ['ended', 'ผ่อนโทรศัพท์', '2027-05'],
      ['changed', 'ค่ากิน', '2027-12'],
      ['started', 'กองทุน A', '2027-07']
    ]);
  });
});

describe('คัดลอกแผนไปปีถัดไป', () => {
  it('ยอดแต่ละเดือนไปเดือนเดียวกันปีหน้า · รายการที่จบแล้วไม่คัดลอก', async () => {
    const { copyYearToNext } = await import('./planYear');
    const changed = copyYearToNext(items, 2027, rawAmount);
    expect(changed.map((i) => i.name)).toEqual(['เงินเดือน', 'ค่ากิน', 'กองทุน A']);
    const food = changed.find((i) => i.name === 'ค่ากิน')!;
    expect(rawAmount(food, '2028-12')).toBe(B(31500));
    expect(rawAmount(food, '2028-11')).toBe(B(5000));
    const sal = changed.find((i) => i.name === 'เงินเดือน')!;
    expect(['2028-02', '2028-03'].map((m) => rawAmount(sal, m))).toEqual([0, B(32000)]);
    const fund = changed.find((i) => i.name === 'กองทุน A')!;
    expect(['2028-06', '2028-07'].map((m) => rawAmount(fund, m))).toEqual([0, B(3000)]);
  });
});
