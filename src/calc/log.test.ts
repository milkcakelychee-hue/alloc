import { describe, expect, it } from 'vitest';
import { categoryBudget, cycleDays, dailyBudget, expensesIn, offBudgetTotal, pace, topDay, whereMoneyGoes } from './log';
import { B, entry, groups, item } from './testkit';
import { roundBaht } from './money';

const TODAY = '2026-10-18';
const items = [
  item('variable', 'ค่ากิน', 4800, { logCategoryIds: ['c-food', 'c-drink'] }),
  item('variable', 'เดินทาง', 1200, { logCategoryIds: ['c-travel'] }),
  item('variable', 'ของใช้', 500, { logCategoryIds: ['c-household', 'c-shopping'] }),
  item('variable', 'ค่ามือถือ', 400),
  item('variable', 'ให้ที่บ้าน', 1500)
];
// TEST_CASES.md 6.4: ใช้ไปในหมวดที่ผูกงบ 4,105.25
const entries = [
  entry('2026-10-03', 'c-food', 1200),
  entry('2026-10-10', 'c-food', 800),
  entry('2026-10-10', 'c-drink', 182.75),
  entry('2026-10-05', 'c-travel', 900),
  entry('2026-10-12', 'c-household', 400),
  entry('2026-10-17', 'c-household', 845, 422.50, { billItemId: 'bi1' }),
  entry('2026-10-17', 'c-shopping', 200),
  entry('2026-10-18', 'c-fun', 300), // นอกงบ
  entry('2026-09-26', 'c-food', 1000), // รอบ ก.ย.
  entry('2026-10-01', 'c-other', 5000, 5000, { type: 'income' })
];
const cycleExp = expensesIn(entries, '2026-10', 27);

describe('6.4 งบใช้จ่ายรายวัน (18 ต.ค. 69)', () => {
  it('งบ 6,500 ใช้ไป 4,105.25 เหลือ 2,394.75 อีก 8 วัน ~299/วัน', () => {
    const d = dailyBudget(groups, items, entries, TODAY, 27);
    expect(d).toMatchObject({ cycle: '2026-10', budget: B(6500), spent: B(4105.25), remaining: B(2394.75), daysLeft: 8 });
    expect(d.perDay).toBe(B(299.34));
    expect(roundBaht(d.perDay)).toBe(299);
  });

  it('วันสุดท้ายของรอบ ใช้ได้วันละ = ที่เหลือทั้งหมด', () => {
    const d = dailyBudget(groups, items, entries, '2026-10-26', 27);
    expect(d.daysLeft).toBe(0);
    expect(d.perDay).toBe(d.remaining);
  });

  it('วันที่ผ่านไปรวมวันนี้: 18 ต.ค. = วันที่ 22 จาก 30', () => {
    expect(cycleDays(TODAY, 27)).toMatchObject({ elapsed: 22, days: 30, daysLeft: 8 });
  });

  it('รายจ่ายที่หารนับ myShare', () => {
    expect(cycleExp.find((e) => e.billItemId === 'bi1')?.myShare).toBe(B(422.50));
  });
});

describe('6.4 งบของหมวด', () => {
  it('หมวดพี่น้องใช้งบเดียวกัน: อาหาร เหลือ 4,800 − (2,000 + 182.75)', () => {
    expect(categoryBudget('c-food', items, cycleExp, '2026-10')).toEqual({ budget: B(4800), spentSelf: B(2000), spentSiblings: B(182.75), remaining: B(2617.25) });
  });
  it('ใช้เกินงบ: ของใช้ เกิน 522.50', () => {
    expect(categoryBudget('c-household', items, cycleExp, '2026-10').remaining).toBe(B(-522.50));
  });
  it('หมวดที่ไม่ผูก = นอกงบ', () => {
    expect(categoryBudget('c-fun', items, cycleExp, '2026-10')).toMatchObject({ budget: null, remaining: null, spentSelf: B(300) });
  });
});

describe('6.4 เงินไปไหน + อินไซต์', () => {
  it('สัดส่วน ยอด และเฉลี่ยต่อครั้ง', () => {
    const w = whereMoneyGoes(cycleExp);
    expect(w.total).toBe(B(4405.25));
    expect(w.rows[0]).toMatchObject({ categoryId: 'c-food', total: B(2000), count: 2, avg: B(1000) });
    expect(Math.round(w.rows[0].ratio * 1000) / 10).toBe(45.4);
  });
  it('เกิน 7 หมวดรวมเป็น อื่น ๆ', () => {
    const many = Array.from({ length: 9 }, (_, i) => entry('2026-10-02', `c${i}`, 100 + i));
    const w = whereMoneyGoes(many);
    expect(w.rows).toHaveLength(7);
    expect(w.rows[6]).toMatchObject({ categoryId: 'other', count: 3, total: B(100 + 101 + 102) });
  });
  it('จังหวะงบและคาดการณ์ปลายรอบ', () => {
    const p = pace(B(4105.25), B(6500), TODAY, 27);
    expect(Math.round(p.usedRatio * 1000) / 10).toBe(63.2);
    expect(Math.round(p.elapsedRatio * 1000) / 10).toBe(73.3);
    expect(p.projected).toBe(B(5598.07));
  });
  it('รวมนอกงบ และวันที่จ่ายมากสุด', () => {
    expect(offBudgetTotal(cycleExp, items)).toBe(B(300));
    expect(topDay(cycleExp)).toEqual({ date: '2026-10-03', total: B(1200) });
  });
});
