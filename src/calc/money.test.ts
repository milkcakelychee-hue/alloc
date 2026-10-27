import { describe, expect, it } from 'vitest';
import { formatWhole } from './money';

describe('ช่องแคบแสดงบาทเต็ม', () => {
  it('ปัดสตางค์เป็นบาทใกล้สุด', () => {
    expect([formatWhole(900075), formatWhole(51650), formatWhole(29950), formatWhole(-12345)]).toEqual(['9,001', '517', '300', '-123']);
  });
});
