import { describe, expect, it } from 'vitest';
import { billsBeforePay, cycleRangeByRule, expectedPayDate, nominalPayDate } from './payday';

const day27 = { kind: 'day', day: 27 } as const;

describe('กฎวันเงินเดือนเข้า', () => {
  it('วันที่ตายตัว: ตรงวันธรรมดาเข้าตามกำหนด', () => {
    expect(expectedPayDate(day27, 'before', '2026-11')).toEqual({ nominal: '2026-11-27', date: '2026-11-27', reason: 'onTime' });
  });
  it('ตรงเสาร์อาทิตย์: ก่อนวันหยุด / หลังวันหยุด / ไม่เลื่อน', () => {
    // 27 ธ.ค. 69 = วันอาทิตย์ · 27 ก.พ. 70 = วันเสาร์
    expect(expectedPayDate(day27, 'before', '2026-12').date).toBe('2026-12-25');
    expect(expectedPayDate(day27, 'after', '2026-12').date).toBe('2026-12-28');
    expect(expectedPayDate(day27, 'none', '2026-12')).toMatchObject({ date: '2026-12-27', reason: 'onTime' });
    expect(expectedPayDate(day27, 'before', '2027-02')).toMatchObject({ date: '2027-02-26', reason: 'weekend' });
  });
  it('สิ้นเดือน และ วันทำการสุดท้าย', () => {
    // 31 ต.ค. 69 = วันเสาร์ · 31 ม.ค. 70 = วันอาทิตย์
    expect(nominalPayDate({ kind: 'endOfMonth' }, '2026-10')).toBe('2026-10-31');
    expect(expectedPayDate({ kind: 'endOfMonth' }, 'before', '2026-10').date).toBe('2026-10-30');
    expect(nominalPayDate({ kind: 'lastBusinessDay' }, '2027-01')).toBe('2027-01-29');
    expect(nominalPayDate({ kind: 'day', day: 31 }, '2027-02')).toBe('2027-02-28');
  });
  it('แก้เฉพาะเดือนชนะกฎหลัก', () => {
    expect(expectedPayDate(day27, 'before', '2027-04', { '2027-04': '2027-04-10' })).toEqual({ nominal: '2027-04-27', date: '2027-04-10', reason: 'override' });
  });
  it('รอบงบยึดวันที่ตั้งไว้ ไม่ขยับตามวันเงินเข้าจริง', () => {
    expect(cycleRangeByRule(day27, '2027-01')).toEqual({ start: '2026-12-27', end: '2027-01-26', days: 31 });
    expect(cycleRangeByRule({ kind: 'endOfMonth' }, '2026-11')).toEqual({ start: '2026-10-31', end: '2026-11-29', days: 30 });
  });
  it('เตือนรายจ่ายที่ครบกำหนดก่อนเงินเข้าจริง (เงินเข้าช้า)', () => {
    const e = expectedPayDate(day27, 'after', '2026-12');
    expect(billsBeforePay(e.date, e.nominal, [
      { name: 'ค่าสมาชิก', date: '2026-12-27' },
      { name: 'ค่าบ้าน', date: '2026-12-25' },
      { name: 'ค่าเน็ต', date: '2026-12-28' }
    ]).map((b) => b.name)).toEqual(['ค่าสมาชิก']);
  });
});
