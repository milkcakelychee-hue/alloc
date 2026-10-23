import { describe, expect, it } from 'vitest';
import { ME_ID } from '../db/types';
import { billShares, billSummary, personStatus, splitItem } from './bills';
import { B } from './testkit';

const KOY = 'p-koy', BEAM = 'p-beam';
const shabu = [
  { price: B(700), peopleIds: [ME_ID, KOY, BEAM] },
  { price: B(85), peopleIds: [ME_ID, KOY, BEAM] },
  { price: B(125), peopleIds: [KOY, BEAM] }
];
const obj = (m: Map<string, number>) => Object.fromEntries(m);

describe('6.5 บิลแชร์', () => {
  it('ค่าน้ำค่าไฟ 845 หาร 2 → 422.50 / 422.50', () => {
    expect(obj(splitItem(B(845), [ME_ID, KOY]))).toEqual({ [ME_ID]: B(422.50), [KOY]: B(422.50) });
  });

  it('ชาบู: เศษสตางค์ให้ฉัน → ฉัน 261.68 · ก้อย 324.16 · บีม 324.16 รวม 910', () => {
    const s = billShares(shabu);
    expect(obj(s)).toEqual({ [ME_ID]: B(261.68), [KOY]: B(324.16), [BEAM]: B(324.16) });
    expect([...s.values()].reduce((a, b) => a + b)).toBe(B(910));
  });

  it('ฉันไม่ได้หารรายการนั้น ก็ยังรับเศษ: 100 หาร 3 คนอื่น', () => {
    expect(obj(splitItem(B(100), ['a', 'b', 'c']))).toEqual({ a: B(33.33), b: B(33.33), c: B(33.33), [ME_ID]: 1 });
  });

  it('สถานะต่อคน', () => {
    expect([0, 200, 324.16, 400].map((p) => personStatus(B(324.16), B(p)))).toEqual(['unpaid', 'partial', 'paid', 'paid']);
  });

  it('สถานะบิลและค้างรับ · เงินคืนเป็นแค่ payment', () => {
    expect(billSummary(shabu, [])).toMatchObject({ myShare: B(261.68), outstanding: B(648.32), status: 'unpaid' });
    const s = billSummary(shabu, [{ personId: KOY, amount: B(200) }, { personId: KOY, amount: B(124.16) }]);
    expect(s.people.find((p) => p.personId === KOY)).toMatchObject({ paid: B(324.16), owed: 0, status: 'paid' });
    expect(s).toMatchObject({ outstanding: B(324.16), status: 'partial' });
    expect(billSummary(shabu, [{ personId: KOY, amount: B(324.16) }, { personId: BEAM, amount: B(324.16) }]).status).toBe('paid');
  });
});
