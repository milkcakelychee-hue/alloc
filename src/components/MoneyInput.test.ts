import { describe, expect, it } from 'vitest';
import { withCommas } from './MoneyInput';
import { parseBaht } from '../calc/money';

describe('ช่องใส่เงิน', () => {
  it('ใส่ , คั่นหลักพันระหว่างพิมพ์ ค่าที่ได้ยังแปลงเป็นสตางค์ได้', () => {
    expect(withCommas('31000')).toBe('31,000');
    expect(withCommas('1234567.5')).toBe('1,234,567.5');
    expect(withCommas('9,0000.255')).toBe('90,000.25');
    expect(withCommas('0045')).toBe('45');
    expect(withCommas('12.')).toBe('12.');
    expect(withCommas('abc')).toBe('abc');
    expect(parseBaht(withCommas('31000.75'))).toBe(3100075);
  });
});
