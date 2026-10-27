import { describe, expect, it } from 'vitest';
import { bahtText, cell, logCsv, planCsv, planMonths } from './csv';
import { B, entry, groups, item } from './testkit';
import type { LogCategory } from '../db/types';

const lines = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n');

describe('ส่งออก CSV', () => {
  it('ยอดเงินเป็นบาทจากสตางค์ ไม่ปัดเศษผิด', () => {
    expect(bahtText(B(9000.75))).toBe('9000.75');
    expect(bahtText(B(1149.25))).toBe('1149.25');
    expect(bahtText(5)).toBe('0.05');
    expect(bahtText(-B(12.3))).toBe('-12.30');
    expect(bahtText(0)).toBe('0.00');
  });

  it('ช่องข้อความ: ครอบ "" เมื่อมีจุลภาค และกันสูตร', () => {
    expect(cell('ค่ากิน')).toBe('ค่ากิน');
    expect(cell('ข้าว, น้ำ')).toBe('"ข้าว, น้ำ"');
    expect(cell('ว่า "ดี"')).toBe('"ว่า ""ดี"""');
    expect(cell('=1+1')).toBe("'=1+1");
  });

  it('บันทึก: เรียงตามวันที่ มีหมวดและส่วนของฉัน', () => {
    const cats = [{ id: 'c-food', name: 'อาหาร' }, { id: 'i-side', name: 'รายได้เสริม' }] as LogCategory[];
    const csv = logCsv([
      entry('2026-10-12', 'c-food', 900, 300, { note: 'ข้าว, หาร 3' }),
      entry('2026-10-01', 'i-side', 2000, 2000, { type: 'income' })
    ], cats);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines(csv)).toEqual([
      'วันที่,ประเภท,หมวด,ยอดที่จ่าย,ส่วนของฉัน,โน้ต',
      '2026-10-01,รายรับ,รายได้เสริม,2000.00,2000.00,',
      '2026-10-12,รายจ่าย,อาหาร,900.00,300.00,"ข้าว, หาร 3"'
    ]);
  });

  it('แผน: เดือนตั้งแต่รายการแรกถึง 12 รอบหลังรอบนี้ · ยอดตามช่วงเวลาและยอดเฉพาะเดือน', () => {
    // TEST_CASES 6.2 ยอดตามเดือน
    const a = item('fixed', 'ค่าเน็ต', 1000, { monthOverrides: { '2026-12': B(1500) }, period: { start: '2026-11', endMode: 'none' }, accountId: 'acc1' });
    const inc = item('income', 'เงินเดือน', 31000, { period: { start: '2026-10', endMode: 'none' } });
    const months = planMonths([a, inc], '2026-10');
    expect(months[0]).toBe('2026-10');
    expect(months.at(-1)).toBe('2027-10');
    expect(planMonths([a, inc], '2026-10', '2026-11')[0]).toBe('2026-11');
    const rows = lines(planCsv(groups, [a, inc], [{ id: 'acc1', name: 'บัญชีบ้าน', order: 0, createdAt: 0, updatedAt: 0 }], months.slice(0, 3)));
    expect(rows).toEqual([
      'หมวดใหญ่,รายการ,บัญชีปลายทาง,ต.ค. 69,พ.ย. 69,ธ.ค. 69',
      'รายรับ,เงินเดือน,,31000.00,31000.00,31000.00',
      'รายจ่ายคงที่,ค่าเน็ต,บัญชีบ้าน,0.00,1000.00,1500.00'
    ]);
  });

  it('แผน: ไม่ใส่หมวดใหญ่ที่ปิดอยู่', () => {
    const off = groups.map((g) => (g.kind === 'fixed' ? { ...g, enabled: false } : g));
    const rows = lines(planCsv(off, [item('fixed', 'ค่าเน็ต', 100)], [], ['2026-10']));
    expect(rows).toHaveLength(1);
  });
});
