// ส่วนที่ใช้ร่วมกันในหน้าบิลแชร์ (บอร์ด BillList / BillDetail / People / PaySheet / BillSummary)
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { ME_ID, type Bill, type BillItem, type Payment, type Person } from '../../db/types';
import type { PayStatus } from '../../calc/bills';

// สีประจำตัวบุคคล (SPEC หัวข้อ 3) พาสเทล ตัวอักษรเข้ม · "ฉัน" วงเขียวเข้มตัวขาว (เจ้าของเลือก)
export const PERSON_COLORS = ['#B9D8C2', '#F6C9A8', '#CFC3EE', '#BBD6F2', '#F5B8B8', '#D8E8A6', '#F3C4DE', '#F3DFA2'];

export const PERSON_ICONS: { id: string; label: string; d?: React.ReactNode }[] = [
  { id: 'letter', label: 'ตัวอักษรแรก' },
  { id: 'leaf', label: 'ใบไม้', d: <><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" /><path d="M5 19 13 11" /></> },
  { id: 'cat', label: 'แมว', d: <><path d="M5 9V4l4 3h6l4-3v5a7 7 0 0 1-14 0z" /><path d="M9.5 12h.01M14.5 12h.01" /></> },
  { id: 'home', label: 'บ้าน', d: <><path d="M4 10.5 12 4l8 6.5V20H4z" /><path d="M10 20v-5h4v5" /></> },
  { id: 'star', label: 'ดาว', d: <path d="M12 3.5 14.4 9l5.9.5-4.5 3.9 1.4 5.8L12 16.1l-5.2 3.1 1.4-5.8L3.7 9.5 9.6 9z" /> },
  { id: 'heart', label: 'หัวใจ', d: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /> }
];

/** ตัวอักษรแรกของชื่อ (ข้ามสระหน้า เ แ โ ใ ไ) */
export const initial = (name: string) => (name || '?').replace(/^[เแโใไ]/, '').charAt(0);

export function Avatar({ person, size = 26, ring }: { person: Pick<Person, 'id' | 'name' | 'icon' | 'colorIndex'> | undefined; size?: number; ring?: boolean }) {
  const me = person?.id === ME_ID;
  const ic = PERSON_ICONS.find((i) => i.id === person?.icon && i.d);
  return (
    <span aria-hidden="true" className={`bl-av${me ? ' me' : ''}${ring ? ' ring' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: me ? undefined : PERSON_COLORS[person?.colorIndex ?? 0] }}>
      {ic && !me
        ? <svg width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ic.d}</svg>
        : initial(person?.name ?? '?')}
    </span>
  );
}

export const STATUS_LABEL: Record<PayStatus, string> = { unpaid: 'ยังไม่ชำระ', partial: 'ชำระบางส่วน', paid: 'ชำระครบแล้ว' };

export function StatusPill({ s, small }: { s: PayStatus; small?: boolean }) {
  return <span className={`bl-st ${s}${small ? ' sm' : ''}`}>{STATUS_LABEL[s]}</span>;
}

/** ใบเสร็จ: แถบดำด้านบน + กระดาษหยัก */
export function Receipt({ children, pad = '22px 20px 26px', id }: { children: React.ReactNode; pad?: string; id?: string }) {
  return (
    <div className="bl-rc" id={id}>
      <div className="slot" aria-hidden="true" />
      <div className="paper-wrap"><div className="paper" style={{ padding: pad }}>{children}</div></div>
    </div>
  );
}

export function Barcode({ h = 22 }: { h?: number }) {
  const bars = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 1, 3];
  let x = 0;
  const rects = bars.map((w, i) => { const r = <rect key={i} x={x} y="0" width={w} height={h} fill="#2B3A31" />; x += w + 2 + (i % 3); return r; });
  return <svg width={x} height={h} viewBox={`0 0 ${x} ${h}`} aria-hidden="true" style={{ flex: 'none' }}>{rects}</svg>;
}

export const Dots = () => <span aria-hidden="true" className="bl-dots" />;

export interface BillData {
  people: Person[]; bills: Bill[]; items: BillItem[]; payments: Payment[];
}

export function useBillData(): BillData | undefined {
  return useLiveQuery(async () => {
    const [people, bills, items, payments] = await Promise.all([db.people.toArray(), db.bills.toArray(), db.billItems.toArray(), db.payments.toArray()]);
    people.sort((a, b) => (a.id === ME_ID ? -1 : b.id === ME_ID ? 1 : a.createdAt - b.createdAt));
    bills.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.createdAt - a.createdAt);
    items.sort((a, b) => a.order - b.order);
    return { people, bills, items, payments };
  });
}

export const itemsOf = (d: BillData, billId: string) => d.items.filter((i) => i.billId === billId);
export const paymentsOf = (d: BillData, billId: string) => d.payments.filter((p) => p.billId === billId);
