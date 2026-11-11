import { describe, expect, it } from 'vitest';
import { clampYear, planGrid, yearBounds } from './planGrid';
import { planTotals } from './plan';
import { B, groups, item } from './testkit';

// ตัวเลขสมมติจาก TEST_CASES.md 6.2
const items = [
  item('income', 'เงินเดือน', 31000, { monthOverrides: { '2026-07': B(33000) } }),
  item('fixed', 'ค่าบ้าน', 9000.75),
  item('variable', 'ค่ากิน', 4800, { monthOverrides: { '2026-03': B(4000) } }),
  item('goalSpend', 'ทริปเกาหลี', 1200, { period: { start: '2026-04', endMode: 'month', endMonth: '2026-09' } }),
  item('saving', 'เงินสำรอง', 6000),
  item('invest', 'กองทุน A', 3000)
];

describe('ตาราง 12 เดือน', () => {
  const g = planGrid(groups, items, 2026);

  it('ยอดรวมหมวดและแถวสรุปตรงกับ planTotals ทุกเดือน', () => {
    g.months.forEach((m, i) => {
      const t = planTotals(groups, items, m);
      for (const gg of g.groups) expect(gg.totals[i]).toBe(t[gg.group.kind]);
      expect(g.summary.income[i]).toBe(t.income);
      expect(g.summary.expense[i]).toBe(t.fixed + t.variable + t.goalSpend);
      expect(g.summary.saveInvest[i]).toBe(t.saving + t.invest);
      expect(g.summary.leftover[i]).toBe(t.leftover);
    });
  });

  it('รวมทั้งปีเท่ากับผลรวม 12 เดือน', () => {
    expect(g.yearTotal.income).toBe(B(31000) * 11 + B(33000));
    expect(g.yearTotal.leftover).toBe(g.summary.leftover.reduce((a, b) => a + b, 0));
  });

  it('นอกช่วงที่มีผลเป็น null ไม่ใช่ 0', () => {
    const trip = g.groups.find((x) => x.group.kind === 'goalSpend')!.rows[0];
    expect(trip.cells[2].amount).toBeNull(); // มี.ค.
    expect(trip.cells[3].amount).toBe(B(1200)); // เม.ย.
    expect(trip.cells[9].amount).toBeNull(); // ต.ค.
    expect(trip.total).toBe(B(1200) * 6);
  });

  it('สามเหลี่ยมเทียบเดือนก่อน: เพิ่ม / ลด / เดือนแรกของช่วงไม่มี', () => {
    const pay = g.groups[0].rows[0].cells;
    expect(pay[6].trend).toBe('up'); // ก.ค. 33,000
    expect(pay[7].trend).toBe('down'); // ส.ค. กลับ 31,000
    expect(pay[5].trend).toBeNull();
    const food = g.groups.find((x) => x.group.kind === 'variable')!.rows[0].cells;
    expect(food[2].trend).toBe('down');
    expect(food[3].trend).toBe('up');
    const trip = g.groups.find((x) => x.group.kind === 'goalSpend')!.rows[0].cells;
    expect(trip[3].trend).toBeNull(); // เริ่มช่วง ไม่ถือว่าเพิ่ม
  });

  it('หมวดที่ปิดไว้ไม่แสดงและไม่นับ', () => {
    const off = groups.map((x) => (x.kind === 'invest' ? { ...x, enabled: false } : x));
    const g2 = planGrid(off, items, 2026);
    expect(g2.groups.some((x) => x.group.kind === 'invest')).toBe(false);
    expect(g2.summary.saveInvest[0]).toBe(B(6000));
  });
});

describe('เลื่อนปี', () => {
  it('ไปข้างหน้าได้ไม่เกินปีถัดจากปีปัจจุบัน', () => {
    const b = yearBounds(items, 2026);
    expect(b.max).toBe(2027);
    expect(clampYear(2028, b)).toBe(2027);
  });
  it('ย้อนได้ถึงปีแรกที่มีแผน', () => {
    const old = [...items, item('fixed', 'เก่า', 100, { period: { start: '2024-05', endMode: 'none' } })];
    expect(yearBounds(old, 2026).min).toBe(2024);
    expect(yearBounds(items, 2026).min).toBe(2026);
    expect(clampYear(2020, yearBounds(old, 2026))).toBe(2024);
  });
});
