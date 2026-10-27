// เงินเก็บเป็นสตางค์ (จำนวนเต็ม) ทั้งหมด แปลงเป็นบาทตอนแสดงผลเท่านั้น
import type { Satang } from '../db/types';

export const sum = (xs: Satang[]) => xs.reduce((a, b) => a + b, 0);

/** 114925 → '1,149.25' · ติดลบ → '-175.50' */
export function formatBaht(s: Satang, { decimals = true } = {}) {
  const neg = s < 0;
  const abs = Math.abs(s);
  const baht = Math.floor(abs / 100);
  const st = abs % 100;
  const int = baht.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${int}${decimals ? `.${String(st).padStart(2, '0')}` : ''}`;
}

/** ปัดเป็นบาทใกล้สุด (ใช้ตอนแสดง "~299/วัน") */
export const roundBaht = (s: Satang) => Math.round(s / 100);

/** สัดส่วนเป็น % ทศนิยม 1 ตำแหน่ง (สำหรับแสดงผล ไม่ใช้บวกลบเงิน) */
export const pct1 = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

/** '1,234.5' / '1234.50' → 123450 · ไม่ผ่าน float */
export function parseBaht(text: string): Satang | null {
  const t = text.replace(/,/g, '').trim();
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const v = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  return m[1] ? -v : v;
}

/** ช่องแคบ (ปฏิทิน ตาราง แท่งกราฟ): ปัดเป็นบาทเต็ม ไม่แสดงสตางค์ · ยอดจริงยังเก็บเป็นสตางค์ */
export const formatWhole = (s: Satang) => formatBaht(Math.round(s / 100) * 100, { decimals: false });
