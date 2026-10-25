import { describe, expect, it } from 'vitest';
import { calendarCells, cutPerDay, dailyBudgetParts, datePickNote, dayTotals, evalAmount, pickerCells, planLabelOf, typicalRange, weekdaySplit } from './logView';
import { expensesIn } from './log';
import { B, entry, groups, item } from './testkit';

// TEST_CASES.md 6.4 (18 ต.ค. 69 · เงินเดือนเข้าวันที่ 27)
const TODAY = '2026-10-18';
const items = [
  item('variable', 'ค่ากิน', 4800, { logCategoryIds: ['c-food', 'c-drink'] }),
  item('variable', 'เดินทาง', 1200, { logCategoryIds: ['c-travel'] }),
  item('variable', 'ของใช้', 500, { logCategoryIds: ['c-household', 'c-shopping'] }),
  item('variable', 'ค่ามือถือ', 400)
];
const entries = [
  entry('2026-10-03', 'c-food', 1200), entry('2026-10-10', 'c-food', 800), entry('2026-10-10', 'c-drink', 182.75),
  entry('2026-10-05', 'c-travel', 900), entry('2026-10-12', 'c-household', 400),
  entry('2026-10-17', 'c-household', 845, 422.50, { billItemId: 'bi1' }), entry('2026-10-17', 'c-shopping', 200),
  entry('2026-10-18', 'c-fun', 300), entry('2026-10-01', 'i-other', 5000, 5000, { type: 'income' })
];
const exp = expensesIn(entries, '2026-10', 27);

describe('ขั้นที่ 7 บันทึก', () => {
  it('แป้นคิดเลข: + − × เป็นสตางค์', () => {
    expect(evalAmount('189')).toBe(B(189));
    expect(evalAmount('120 + 69.50')).toBe(B(189.5));
    expect(evalAmount('3 × 60 + 9')).toBe(B(189));
    expect(evalAmount('100 − 20.5')).toBe(B(79.5));
    expect(evalAmount('12 + ')).toBe(B(12));
    expect(evalAmount('')).toBeNull();
  });

  it('ปฏิทินรอบ ต.ค. 69: 21 ก.ย. – 1 พ.ย. (6 สัปดาห์ เริ่มวันจันทร์)', () => {
    const c = calendarCells('2026-10', 27, TODAY);
    expect(c).toHaveLength(42);
    expect([c[0].date, c.at(-1)!.date]).toEqual(['2026-09-21', '2026-11-01']);
    expect(c.filter((x) => x.inCycle)).toHaveLength(30);
    expect(c.find((x) => x.today)!.date).toBe(TODAY);
    expect(c.filter((x) => x.inCycle && x.future)).toHaveLength(8);
    expect(pickerCells(TODAY, 27)[0].date).toBe('2026-09-21');
  });

  it('เลือกวันที่: รอบก่อนนับเข้างบรอบนั้น', () => {
    expect(datePickNote('2026-09-26', TODAY, 27)).toEqual({ cycle: '2026-09', sameCycle: false, ago: 22 });
    expect(datePickNote('2026-10-17', TODAY, 27)).toMatchObject({ sameCycle: true, ago: 1 });
  });

  it('ยอดรายวัน: รายจ่ายนับส่วนของฉัน รายรับแยก', () => {
    const d = dayTotals(entries);
    expect(d.get('2026-10-17')).toEqual({ income: 0, expense: B(622.50) });
    expect(d.get('2026-10-01')).toEqual({ income: B(5000), expense: 0 });
  });

  it('งบรายวันแยกรายการ: ค่ากิน 2,182.75/4,800 · เดินทาง 900/1,200 · ของใช้ 1,022.50/500', () => {
    const p = dailyBudgetParts(groups, items, exp, '2026-10');
    expect(p.map((x) => [x.item.name, x.spent, x.budget])).toEqual([['ค่ากิน', B(2182.75), B(4800)], ['เดินทาง', B(900), B(1200)], ['ของใช้', B(1022.50), B(500)]]);
    expect(planLabelOf('c-drink', items)).toBe('ค่ากิน');
    expect(planLabelOf('c-fun', items)).toBeNull();
  });

  it('อินไซต์: เฉลี่ยวันธรรมดา 86.67 · เสาร์อาทิตย์ 443.61 · ลดวันละ 75 ให้พอดีงบ', () => {
    expect(weekdaySplit(exp, TODAY, 27)).toEqual({ weekdayAvg: 8667, weekendAvg: 44361 });
    expect(cutPerDay(B(4105.25), B(5000), B(5598.07), 8)).toBe(B(75));
    expect(cutPerDay(B(4105.25), B(6500), B(5598.07), 8)).toBeNull();
    expect(typicalRange([entry('2026-10-01', 'c-food', 50), entry('2026-10-02', 'c-food', 60), entry('2026-10-03', 'c-food', 70), entry('2026-10-04', 'c-food', 80), entry('2026-10-05', 'c-food', 300)])).toEqual({ low: B(60), high: B(80) });
  });
});

describe('เงินเดือนในหน้าบันทึก', () => {
  it('กดเข้าแล้ว: ยอดจริง · ไม่ได้กดเลย 7 วัน: ยอดในแผน · เข้าก่อนรอบ: แสดงวันแรกของรอบ', async () => {
    const { salaryEvent } = await import('./logView');
    const base = { cycle: '2026-10', pay: 27 as const, expected: '2026-09-25', planned: B(31000), today: TODAY };
    expect(salaryEvent({ ...base, received: { date: '2026-09-25', amount: B(30450) } })).toEqual({ date: '2026-09-27', amount: B(30450) });
    expect(salaryEvent({ ...base, received: null })).toEqual({ date: '2026-09-27', amount: B(31000) });
    expect(salaryEvent({ ...base, expected: '2026-10-15', received: null })).toBeNull();
  });
});

describe('เงินเดือนเข้าก่อนกำหนด', () => {
  it('กดเงินเดือนเข้าแล้ว 25 ต.ค. (กำหนด 27) → รอบ พ.ย. เริ่ม 25 ต.ค. · รายการตั้งแต่วันนั้นนับเข้า พ.ย.', async () => {
    const { effectiveStart, cycleForDate } = await import('./logView');
    const { entryCycle, expensesIn } = await import('./log');
    const rec = [{ id: '2026-11', status: 'received', date: '2026-10-25' }];
    expect(effectiveStart('2026-11', 27, rec)).toBe('2026-10-25');
    expect(effectiveStart('2026-11', 27, [])).toBe('2026-10-27');
    expect(cycleForDate('2026-10-25', 27, rec)).toBe('2026-11');
    expect(cycleForDate('2026-10-24', 27, rec)).toBe('2026-10');
    expect(cycleForDate('2026-10-25', 27, [])).toBe('2026-10');
    const e = entry('2026-10-25', 'c-food', 60, 60, { cycleMonth: '2026-11' });
    expect(entryCycle(e, 27)).toBe('2026-11');
    expect(expensesIn([e], '2026-11', 27)).toHaveLength(1);
  });
});
