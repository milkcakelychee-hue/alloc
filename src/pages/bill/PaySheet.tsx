// แผ่นเด้ง บันทึกการชำระ (บอร์ด PaySheet): ส่วนของคนนี้ · ชำระแล้ว · รับเงินครั้งนี้ (ครบจำนวน / ครึ่งหนึ่ง / ใส่ยอดเอง)
// เงินที่เพื่อนคืนไม่นับเป็นรายรับในบันทึก
import { useState } from 'react';
import { db } from '../../db/db';
import type { Bill, Person } from '../../db/types';
import { localToday, thaiDate } from '../../calc/dates';
import { parseBaht } from '../../calc/money';
import { addPayment } from '../../db/billActions';
import { Icon } from '../../components/Icon';
import { baht } from '../goals/goalUi';
import { LgSheet } from '../log/EntrySheet';
import { Avatar } from './billUi';

type Props = { bill: Bill; person: Person; share: { share: number; paid: number; owed: number }; onClose: () => void };
type Mode = 'full' | 'half' | 'own';

const toText = (s: number) => (s % 100 === 0 ? String(s / 100) : (s / 100).toFixed(2));

export function PaySheet({ bill, person, share, onClose }: Props) {
  const half = Math.round(share.owed / 2);
  const [mode, setMode] = useState<Mode>('full');
  const [txt, setTxt] = useState(toText(share.owed));
  const [kb, setKb] = useState(false);
  const [date, setDate] = useState(localToday());
  const [busy, setBusy] = useState(false);
  const v = Math.min(parseBaht(txt || '0') ?? 0, 9999999);
  const paidNow = share.paid + v;
  const left = Math.max(0, share.share - paidNow);
  const key = (k: string) => {
    setMode('own');
    if (k === 'bs') return setTxt(txt.slice(0, -1));
    if (k === '.' && txt.includes('.')) return;
    if (/\.\d\d$/.test(txt)) return;
    setTxt((txt === '0' ? '' : txt) + k);
  };
  const pick = (m: Mode) => {
    setMode(m);
    if (m === 'own') { setTxt(''); setKb(true); } else { setTxt(toText(m === 'full' ? share.owed : half)); setKb(false); }
  };
  const save = async () => {
    if (v <= 0) return;
    setBusy(true);
    await addPayment(db, { billId: bill.id, personId: person.id, amount: v, date });
    onClose();
  };
  const today = date === localToday();

  return (
    <LgSheet label={`บันทึกการชำระของ${person.name}`} onClose={onClose}>
      <div className="lg-sh-h">
        <Avatar person={person} size={44} />
        <span className="t"><h2>บันทึกการชำระ · {person.name}</h2><span>บิล {bill.title}</span></span>
        <button className="lg-x" aria-label="ปิด" onClick={onClose}><Icon name="close" size={18} stroke={2.2} /></button>
      </div>
      <div className="ps-box">
        <div className="num r"><span>ส่วนของ{person.name} <b>{baht(share.share)}</b></span><span>ชำระแล้ว <b>{baht(paidNow)}</b></span></div>
        <span className="bar"><span style={{ width: `${Math.min(100, share.share ? (paidNow / share.share) * 100 : 0)}%` }} /></span>
        <span className={`num lf${left === 0 ? ' ok' : ''}`}>{left === 0 ? 'หลังบันทึก: ชำระครบ ไม่มียอดค้าง' : `หลังบันทึก: ยังค้าง ${baht(left)}`}</span>
      </div>
      <div className="ps-in">
        <span className="k">รับเงินครั้งนี้</span>
        <button className={`amt${kb ? ' on' : ''}`} aria-label="ใส่จำนวนเงิน" onClick={() => setKb(!kb)}><span>บาท</span><b className="num">{v ? baht(v) : '0'}</b></button>
        <div className="q">
          <button aria-pressed={mode === 'full'} onClick={() => pick('full')}><span>ครบจำนวน</span><span className="num">{baht(share.owed)}</span></button>
          {half > 0 && half < share.owed && <button aria-pressed={mode === 'half'} onClick={() => pick('half')}><span>ครึ่งหนึ่ง</span><span className="num">{baht(half)}</span></button>}
          <button aria-pressed={mode === 'own'} onClick={() => pick('own')}>ใส่ยอดเอง</button>
        </div>
        {kb && (
          <div className="kp">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((k) => <button key={k} className="num" onClick={() => key(k)}>{k}</button>)}
            <button aria-label="ลบ" className="bs" onClick={() => key('bs')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5h11v14H9l-6-7z" /><path d="m12.5 9.5 5 5M17.5 9.5l-5 5" /></svg></button>
          </div>
        )}
      </div>
      <label className="ps-date">
        <Icon name="calendar" size={16} stroke={2} /><span className="num">{today ? 'วันนี้ · ' : ''}{thaiDate(date).split(' ').slice(0, 2).join(' ')}</span>
        <input type="date" aria-label="วันที่รับเงิน" value={date} max={localToday()} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      <div className="lg-info"><Icon name="info" size={15} stroke={2} /><span>เงินที่เพื่อนคืน<span className="nw">ไม่นับเป็นรายรับในบันทึก</span> · <span className="nw">ลบครั้งที่รับเงินได้</span><span className="nw">จากประวัติในหน้าบิล</span></span></div>
      <button className="ps-save" disabled={v <= 0 || busy} onClick={save}>
        <span className="a"><Icon name="check" size={20} stroke={2.4} />บันทึกรับเงิน <span className="num">{baht(v)}</span></span>
        <span className="b">สถานะบิลจะอัปเดตให้อัตโนมัติ</span>
      </button>
    </LgSheet>
  );
}
