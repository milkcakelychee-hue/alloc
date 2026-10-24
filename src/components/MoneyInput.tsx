// ช่องใส่เงิน: ใส่ , คั่นหลักพันระหว่างพิมพ์ (ตำแหน่งเคอร์เซอร์ไม่กระโดด) · ทศนิยมไม่เกิน 2 ตำแหน่ง
import type { ChangeEvent, InputHTMLAttributes } from 'react';

/** '1234567.5' → '1,234,567.5' (ค่าที่ไม่ใช่ตัวเลขคืนตามเดิม) */
export function withCommas(raw: string) {
  const t = raw.replace(/,/g, '');
  const m = /^(-?)(\d*)(\.\d*)?$/.exec(t);
  if (!m) return raw;
  const int = m[2].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${m[1]}${int}${(m[3] ?? '').slice(0, 3)}`;
}

export function MoneyInput({ onChange, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = el.value.slice(0, caret).replace(/,/g, '').length;
    const next = withCommas(el.value);
    if (next !== el.value) {
      el.value = next;
      let pos = 0, seen = 0;
      while (pos < next.length && seen < digitsBefore) { if (next[pos] !== ',') seen++; pos++; }
      try { el.setSelectionRange(pos, pos); } catch { /* บางชนิดช่องไม่รองรับ */ }
    }
    onChange?.(e);
  };
  return <input inputMode="decimal" autoComplete="off" {...props} onChange={handle} />;
}
