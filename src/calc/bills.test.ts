import { describe, expect, it } from 'vitest';
import { ME_ID } from '../db/types';
import { billDateLabel, billShares, billSummary, billTotal, monthBars, personLines, personStatus, receiptFor, receiptText, shareOf, splitItem } from './bills';
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

describe('ขั้นที่ 8 หน้าบิลแชร์', () => {
  const items = [
    { id: 'i1', name: 'ชาบู', price: B(700), peopleIds: [ME_ID, KOY, BEAM] },
    { id: 'i2', name: 'น้ำ', price: B(85), peopleIds: [ME_ID, KOY, BEAM] },
    { id: 'i3', name: 'ขนม', price: B(125), peopleIds: [KOY, BEAM] }
  ];

  it('วันที่ของบิล: วันเดียว · ช่วงในเดือน · ข้ามเดือน · ข้ามปี', () => {
    expect(billDateLabel('2026-10-13')).toBe('13 ต.ค. 69');
    expect(billDateLabel('2026-10-01', '2026-10-18')).toBe('1–18 ต.ค. 69');
    expect(billDateLabel('2026-10-28', '2026-11-03')).toBe('28 ต.ค. – 3 พ.ย. 69');
    expect(billDateLabel('2026-12-30', '2027-01-02')).toBe('30 ธ.ค. 69 – 2 ม.ค. 70');
    expect(billDateLabel('2026-10-13', '2026-10-13')).toBe('13 ต.ค. 69');
  });

  it('รายการของแต่ละคน: ÷n และส่วนของคนนั้น (เศษอยู่ที่ฉัน)', () => {
    expect(personLines(items, KOY)).toEqual([
      { id: 'i1', name: 'ชาบู', n: 3, share: B(233.33) }, { id: 'i2', name: 'น้ำ', n: 3, share: B(28.33) }, { id: 'i3', name: 'ขนม', n: 2, share: B(62.50) }
    ]);
    expect(personLines(items, ME_ID).map((l) => l.share)).toEqual([B(233.34), B(28.34)]);
    expect(billTotal(items)).toBe(B(910));
  });

  it('ยอดของคนในบิล: ทุกคน / คนเดียว / ไม่อยู่ในบิล', () => {
    const pays = [{ personId: KOY, amount: B(200) }];
    expect(shareOf(items, pays, 'all')).toMatchObject({ share: B(648.32), paid: B(200), owed: B(448.32), status: 'partial', inBill: true });
    expect(shareOf(items, pays, KOY)).toMatchObject({ share: B(324.16), paid: B(200), owed: B(124.16), status: 'partial' });
    expect(shareOf(items, pays, 'p-other')).toMatchObject({ share: 0, owed: 0, inBill: false });
    // จ่ายเกินไม่นับเกินส่วน
    expect(shareOf(items, [{ personId: KOY, amount: B(400) }], KOY)).toMatchObject({ paid: B(324.16), owed: 0, status: 'paid' });
  });

  it('แท่งเลือกเดือน: ชำระแล้ว / ค้าง ต่อเดือน · เดือนหลังเดือนนี้ = รอเรียกเก็บ', () => {
    const bills = [{ id: 'b1', cycleMonth: '2026-10' }, { id: 'b2', cycleMonth: '2026-11' }, { id: 'b3', cycleMonth: '2026-10' }];
    const its: Record<string, typeof items> = { b1: items, b2: [{ id: 'x', name: 'เน็ต', price: B(599), peopleIds: [ME_ID, KOY] }], b3: [{ id: 'y', name: 'แท็กซี่', price: B(240), peopleIds: [ME_ID, BEAM] }] };
    const pays: Record<string, { personId: string; amount: number }[]> = { b1: [{ personId: BEAM, amount: B(324.16) }], b2: [], b3: [{ personId: BEAM, amount: B(120) }] };
    const bars = monthBars(bills, (id) => its[id], (id) => pays[id], ['2026-09', '2026-10', '2026-11', '2026-12'], '2026-10', 'all');
    expect(bars).toEqual([
      { month: '2026-09', paid: 0, open: 0, future: false },
      { month: '2026-10', paid: B(444.16), open: B(324.16), future: false },
      { month: '2026-11', paid: 0, open: B(299.50), future: true },
      { month: '2026-12', paid: 0, open: 0, future: true }
    ]);
    expect(monthBars(bills, (id) => its[id], (id) => pays[id], ['2026-10'], '2026-10', BEAM)[0]).toMatchObject({ paid: B(444.16), open: 0 });
  });
});

describe('ใบแจ้งยอด', () => {
  const its: Record<string, { id: string; name: string; price: number; peopleIds: string[] }[]> = {
    b1: [{ id: 'i1', name: 'ค่าไฟ', price: B(845), peopleIds: [ME_ID, KOY] }],
    b2: [{ id: 'i2', name: 'ชาบู', price: B(700), peopleIds: [ME_ID, KOY, BEAM] }, { id: 'i3', name: 'ขนม', price: B(125), peopleIds: [KOY, BEAM] }],
    b3: [{ id: 'i4', name: 'แท็กซี่', price: B(240), peopleIds: [ME_ID, BEAM] }]
  };
  const pays: Record<string, { personId: string; amount: number }[]> = { b1: [], b2: [{ personId: KOY, amount: B(100) }], b3: [] };
  const bills = [
    { id: 'b1', title: 'ค่าน้ำค่าไฟ', dateLabel: '1–18 ต.ค. 69', note: 'โอนภายในสิ้นเดือน' },
    { id: 'b2', title: 'ชาบู', dateLabel: '13 ต.ค. 69', note: '' },
    { id: 'b3', title: 'แท็กซี่', dateLabel: '4 ต.ค. 69', note: '' }
  ];

  it('ก้อยจากหลายบิล: ข้ามบิลที่ไม่มีส่วน · หักที่ชำระแล้ว', () => {
    const r = receiptFor(KOY, bills, (id) => its[id], (id) => pays[id]);
    expect(r.blocks.map((b) => [b.bill.id, b.share, b.paid, b.due])).toEqual([['b1', B(422.50), 0, B(422.50)], ['b2', B(295.83), B(100), B(195.83)]]);
    expect(r.grand).toBe(B(618.33));
    expect(receiptText('ก้อย', '27 ต.ค. 69', r, 'พร้อมเพย์ของฉัน')).toBe([
      'ใบแจ้งยอด ถึง ก้อย', 'ออกเมื่อ 27 ต.ค. 69 · 2 บิล', '',
      'ค่าน้ำค่าไฟ (1–18 ต.ค. 69)', '- ค่าไฟ ÷2  422.50', 'รวมบิลนี้  422.50', 'หมายเหตุ: โอนภายในสิ้นเดือน', '',
      'ชาบู (13 ต.ค. 69)', '- ชาบู ÷3  233.33', '- ขนม ÷2  62.50', 'ชำระแล้ว  -100', 'รวมบิลนี้  195.83', '',
      'ยอดที่ต้องโอน 618.33 บาท', 'โอนเข้า: พร้อมเพย์ของฉัน'
    ].join('\n'));
  });
});
