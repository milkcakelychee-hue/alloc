import { describe, expect, it } from 'vitest';
import { addMonths, cycleOf, cycleRange, monthDiff, thaiDate, thaiMonth } from './dates';
import { formatBaht, parseBaht, pct1, roundBaht } from './money';

describe('6.1 รอบเงินเดือน (payday 27)', () => {
  it.each([
    ['2026-10', '2026-09-27', '2026-10-26', 30],
    ['2027-01', '2026-12-27', '2027-01-26', 31],
    ['2027-03', '2027-02-27', '2027-03-26', 28]
  ])('รอบ %s = %s – %s (%i วัน)', (m, start, end, days) => {
    expect(cycleRange(m, 27)).toEqual({ start, end, days });
  });

  it('รายการนับเข้ารอบของวันที่จด', () => {
    expect(cycleOf('2026-10-26', 27)).toBe('2026-10');
    expect(cycleOf('2026-10-27', 27)).toBe('2026-11');
    expect(cycleOf('2026-12-27', 27)).toBe('2027-01');
  });

  it('เดือนบวกลบข้ามปี', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(monthDiff('2026-10', '2027-09')).toBe(11);
  });

  it('แสดงผลเป็น พ.ศ. ย่อ', () => {
    expect(thaiDate('2026-10-18')).toBe('18 ต.ค. 69');
    expect(thaiMonth('2027-04')).toBe('เม.ย. 70');
  });
});

describe('เงินเป็นสตางค์', () => {
  it('แสดงผล', () => {
    expect(formatBaht(114925)).toBe('1,149.25');
    expect(formatBaht(-17550)).toBe('-175.50');
    expect(formatBaht(3100000, { decimals: false })).toBe('31,000');
    expect(roundBaht(29934)).toBe(299);
    expect(pct1(1000000, 3100000)).toBe(32.3);
  });
  it('อ่านตัวเลขที่พิมพ์ ไม่ผ่าน float', () => {
    expect(parseBaht('1,149.25')).toBe(114925);
    expect(parseBaht('0.1')).toBe(10);
    expect(parseBaht('12.345')).toBeNull();
  });
});

describe('รอบที่เริ่มใช้แอป', () => {
  it('ยังไม่ถึงรอบเริ่ม: ใช้รอบเริ่ม · เลยแล้ว: ใช้รอบของวันนี้', async () => {
    const { appCycle } = await import('./dates');
    expect(appCycle('2026-10-24', 27, '2026-11')).toBe('2026-11');
    expect(appCycle('2026-10-28', 27, '2026-11')).toBe('2026-11');
    expect(appCycle('2026-12-01', 27, '2026-11')).toBe('2026-12');
    expect(appCycle('2026-10-24', 27, null)).toBe('2026-10');
  });
});
