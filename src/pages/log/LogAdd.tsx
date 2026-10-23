// เพิ่ม/แก้รายการ (บอร์ด LogAdd · DatePick): ยอด (แป้นบวก ลบ คูณ) · วันที่ · โน้ต · ผลต่องบ · หมวด
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../db/db';
import type { LogType } from '../../db/types';
import { addDays, cycleOf, localToday, thaiDate } from '../../calc/dates';
import { weekday } from '../../calc/payday';
import { formatBaht } from '../../calc/money';
import { expensesIn, categoryBudget } from '../../calc/log';
import { datePickNote, evalAmount, pickerCells, planLabelOf } from '../../calc/logView';
import { goalAwareAmountOf } from '../../calc/goals';
import { addEntry, linkCategoryFirst, updateEntry } from '../../db/logActions';
import { Icon } from '../../components/Icon';
import { thaiMonthLong } from '../plan/planUi';
import { CatIcon, catStyle } from './catIcon';
import { useLogData, dayFull } from './useLogData';
import { LgSheet } from './EntrySheet';

const fmt = (s: number) => (s % 100 === 0 ? formatBaht(s, { decimals: false }) : formatBaht(s));
const dm = (d: string) => thaiDate(d).split(' ').slice(0, 2).join(' ');
const WD = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

export default function LogAdd() {
  const data = useLogData();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const editId = sp.get('id');
  const today = localToday();
  const [init, setInit] = useState(false);
  const [type, setType] = useState<LogType>('expense');
  const [expr, setExpr] = useState('');
  const [date, setDate] = useState(sp.get('d') && sp.get('d')! <= today ? sp.get('d')! : today);
  const [note, setNote] = useState('');
  const [cat, setCat] = useState<Record<LogType, string>>({ expense: '', income: '' });
  const [kb, setKb] = useState(false);
  const [pick, setPick] = useState(false);
  const [askLink, setAskLink] = useState<{ itemId: string; itemName: string; catId: string; catName: string } | null>(null);
  if (!data?.settings) return null;
  const s = data.settings;
  const editing = editId ? data.entries.find((e) => e.id === editId) : undefined;
  if (editId && editing && !init) {
    setInit(true);
    setType(editing.type);
    setExpr(String(editing.amountPaid / 100));
    setDate(editing.date);
    setNote(editing.note);
    setCat((c) => ({ ...c, [editing.type]: editing.categoryId }));
  }

  const E = type === 'expense';
  const cats = data.categories.filter((c) => c.type === type && (!c.hidden || c.id === cat[type]));
  const catId = cat[type] || (cats.find((c) => c.id === (E ? 'c-food' : 'i-salary')) ?? cats[0])?.id || '';
  const amount = evalAmount(expr) ?? 0;
  const hasOp = /[+−×]/.test(expr);
  const cycle = cycleOf(date, s.pay);
  const cur = cycleOf(today, s.pay);
  const amountOf = goalAwareAmountOf(data.goals, data.items, data.adjustments, cur);

  // ผลต่องบของหมวด (ไม่นับรายการที่กำลังแก้)
  const others = data.entries.filter((e) => e.id !== editId);
  const label = E ? planLabelOf(catId, data.items) : null;
  const b = E && label ? categoryBudget(catId, data.items, expensesIn(others, cycle, s.pay), cycle, amountOf) : null;
  const usedB = b ? b.spentSelf + b.spentSiblings : 0;
  const left = b ? b.budget! - usedB - (editing?.billItemId ? Math.round((amount * editing.myShare) / Math.max(editing.amountPaid, 1)) : amount) : 0;

  const key = (ch: string) => () => {
    let x = expr;
    if (/[+−×]/.test(ch)) { if (!x || / $/.test(x)) return; x = `${x} ${ch} `; }
    else if (ch === '.' && /\.\d*$/.test(x.split(' ').at(-1) ?? '')) return;
    else if (/\.\d\d$/.test(x)) return;
    else if (x === '0' && ch !== '.') x = ch === '00' ? '0' : ch;
    else x = x + ch;
    setExpr(x.slice(0, 32));
  };
  const back = () => setExpr(/ $/.test(expr) ? expr.slice(0, -3) : expr.slice(0, -1));

  const dateLabel = () => {
    const ago = Math.round((Date.parse(today) - Date.parse(date)) / 864e5);
    return `${ago === 0 ? 'วันนี้ · ' : ago === 1 ? 'เมื่อวาน · ' : ''}${ago > 1 ? `${['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][weekday(date)]} ` : ''}${dm(date)}`;
  };

  const save = async () => {
    if (amount <= 0 || !catId) return;
    const input = { type, amount, categoryId: catId, date, note };
    if (editing) {
      await updateEntry(db, editing.id, input);
      const item = editing.planItemId ? data.items.find((i) => i.id === editing.planItemId) : null;
      if (item && editing.categoryId !== catId && item.logCategoryIds[0] !== catId) {
        setAskLink({ itemId: item.id, itemName: item.name, catId, catName: data.categories.find((c) => c.id === catId)?.name ?? '' });
        return;
      }
    } else await addEntry(db, input);
    nav('/log', { replace: true });
  };

  return (
    <main className={`lga ${E ? 'exp' : 'inc'}`}>
      <div className="lga-top">
        <Link to="/log" aria-label="ปิด" className="lg-sq" replace><Icon name="close" size={20} stroke={2.2} /></Link>
        <div className="lga-tabs" role="tablist" aria-label="ประเภทรายการ">
          <button role="tab" className="e" aria-selected={E} onClick={() => setType('expense')}>รายจ่าย</button>
          <button role="tab" className="i" aria-selected={!E} onClick={() => setType('income')}>รายรับ</button>
        </div>
        <span style={{ width: 44, flex: 'none' }} />
      </div>

      <section className={`lga-amt${kb ? ' on' : ''}`} aria-label="จำนวนเงิน">
        <button aria-label="ใส่จำนวนเงิน" onClick={() => setKb(true)}>
          <span className="lb">{E ? 'จ่าย' : 'รับ'}</span>
          <span className="vv"><span className="ex num">{hasOp ? `${expr} =` : ''}</span>
            <span className={`big num${E ? '' : ' inc'}`}>{fmt(amount)}{kb && <span className="caret" />}</span></span>
        </button>
        <div className="lga-row2">
          <span className="lga-date">
            <button aria-label="วันก่อน" onClick={() => setDate(addDays(date, -1))}><Icon name="back" size={18} stroke={2} /></button>
            <button className="dl num" onClick={() => setPick(true)}>{dateLabel()}</button>
            <button aria-label="วันถัดไป" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}><Icon name="chevron" size={18} stroke={2} /></button>
          </span>
          <label className="lga-note"><Icon name="edit" size={16} stroke={2} /><input aria-label="โน้ต" value={note} placeholder="โน้ต เช่น ร้าน / ของที่ซื้อ" onChange={(e) => setNote(e.target.value)} maxLength={60} /></label>
        </div>
      </section>

      <div className={`lga-hint${b ? (left >= 0 ? ' left' : ' over') : ''}`}>
        <Icon name="info" size={16} stroke={2} />
        <span>{!E ? 'รายรับนอกแผน · ไม่เปลี่ยนตัวเลขในแผน' : b ? <>แผน{label} · ใช้ไป <span className="num">{fmt(usedB)} / {fmt(b.budget!)}</span></> : 'บันทึกเป็นรายจ่ายนอกแผน'}</span>
        {b && <b className="num">{left >= 0 ? `เหลือ ${fmt(left)}` : `เกิน ${fmt(-left)}`}</b>}
      </div>

      <section className="lga-cats" aria-label="หมวด">
        <div className="h"><h2>หมวด</h2><Link to={`/log/cats?type=${type}`}>แก้หมวด</Link></div>
        <div className={`lga-grid${E ? '' : ' inc'}`}>
          {cats.map((c) => (
            <button key={c.id} aria-label={c.name} aria-pressed={c.id === catId} onClick={() => setCat({ ...cat, [type]: c.id })}>
              <span className="cat-ic" style={catStyle(c)}><CatIcon icon={c.icon} size={E ? 22 : 26} /></span>
              <span className="n">{c.name}</span>
            </button>
          ))}
          <Link to={`/log/cats?type=${type}`} aria-label="เพิ่มหมวด" className="add"><span><Icon name="plus" size={20} stroke={2} /></span>เพิ่มหมวด</Link>
        </div>
      </section>

      <button className="lga-save" disabled={amount <= 0 || !catId} onClick={save}><Icon name="check" size={20} stroke={2.4} />บันทึก <span className="num">{fmt(amount)}</span></button>

      {kb && <>
        <div className="lga-kb-bg" aria-hidden="true" onClick={() => setKb(false)} />
        <div className="lga-kb" role="dialog" aria-label="แป้นตัวเลข">
          <span className="grab" />
          <div className="lga-keys num">
            {['7', '8', '9'].map((k) => <button key={k} onClick={key(k)}>{k}</button>)}
            <button className="op bs" aria-label="ลบ" onClick={back}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8.5 5.5H20v13H8.5L3.5 12z" /><path d="m11.5 9.5 5 5M16.5 9.5l-5 5" /></svg></button>
            {['4', '5', '6'].map((k) => <button key={k} onClick={key(k)}>{k}</button>)}
            <button className="op" aria-label="คูณ" onClick={key('×')}>×</button>
            {['1', '2', '3'].map((k) => <button key={k} onClick={key(k)}>{k}</button>)}
            <button className="op" aria-label="ลบออก" onClick={key('−')}>−</button>
            <button onClick={key('.')}>.</button><button onClick={key('0')}>0</button><button onClick={key('00')}>00</button>
            <button className="op" aria-label="บวก" onClick={key('+')}>+</button>
          </div>
          <button className="done" onClick={() => setKb(false)}>เสร็จ</button>
        </div>
      </>}

      {pick && <DatePick date={date} today={today} kind={E ? 'exp' : 'inc'} pay={s.pay} days={new Set(data.entries.map((e) => e.date))} onPick={(d) => { setDate(d); setPick(false); }} onClose={() => setPick(false)} />}

      {askLink && (
        <LgSheet label="ใช้หมวดนี้กับรายการในแผน" onClose={() => nav('/log', { replace: true })}>
          <div className="lg-sh-h"><span className="t"><h2>ใช้หมวด "{askLink.catName}" กับ "{askLink.itemName}" ในเดือนถัดไปไหม</h2>
            <span>การ์ด "จ่ายหรือยัง" ครั้งหน้าจะบันทึกเป็นหมวดนี้ให้เลย</span></span></div>
          <div className="lg-2">
            <button className="out" onClick={() => nav('/log', { replace: true })}>ไม่ต้อง</button>
            <button className="pri" onClick={async () => { await linkCategoryFirst(db, askLink.itemId, askLink.catId); nav('/log', { replace: true }); }}>ใช้หมวดนี้</button>
          </div>
        </LgSheet>
      )}
    </main>
  );
}

function DatePick({ date, today, kind, pay, days, onPick, onClose }: {
  date: string; today: string; kind: 'exp' | 'inc'; pay: number | import('../../calc/dates').PayRule; days: Set<string>;
  onPick: (d: string) => void; onClose: () => void;
}) {
  const [sel, setSel] = useState(date);
  const cells = pickerCells(today, pay);
  const n = datePickNote(sel, today, pay);
  const lab = `${n.ago === 0 ? 'วันนี้ · ' : n.ago === 1 ? 'เมื่อวาน · ' : ''}${dayFull(weekday(sel))} ${dm(sel)}`;
  const curName = thaiMonthLong(cycleOf(today, pay)).split(' ')[0];
  return (
    <LgSheet label="เลือกวันที่" onClose={onClose}>
      <div className="lg-sh-h"><span className="t"><h2 style={{ fontSize: 17 }} className="num">{lab}</h2></span>
        <button className="lg-x" aria-label="ปิด" onClick={onClose}><Icon name="close" size={18} stroke={2.2} /></button></div>
      <div className={`lga-vars ${kind}`}>
        <div className="lg-dp-wd">{WD.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="lg-dp-grid">
          {cells.map((c) => {
            const day = Number(c.date.slice(8));
            if (c.future) return <span key={c.date} aria-disabled="true" className={`fut${c.inCycle ? ' in' : ''}`}><span className="num">{day}</span></span>;
            return (
              <button key={c.date} aria-label={dm(c.date)} aria-pressed={c.date === sel} className={`${c.inCycle ? 'in' : 'prev'}${c.today ? ' today' : ''}`} onClick={() => setSel(c.date)}>
                <span className="n num">{day}</span>{days.has(c.date) && <span className="dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className={`lg-dp-note${n.sameCycle ? '' : ' warn'}`}><Icon name="info" size={16} stroke={2} />
        <span>{n.sameCycle ? <>อยู่ในรอบนี้ · <span className="nw">นับเข้างบเดือน{curName}</span> · <span className="nw">จดย้อนหลังได้</span> <span className="nw">แต่เลือกวันในอนาคตไม่ได้</span></>
          : <>วันนี้อยู่ในรอบก่อน ({thaiMonthLong(n.cycle).split(' ')[0]}) · <span className="nw">รายการจะไปนับในงบรอบเดือน{thaiMonthLong(n.cycle).split(' ')[0]}</span></>}</span></div>
      <button className={`lg-dp-ok lga-vars ${kind}`} onClick={() => onPick(sel)}>แก้เป็นวันที่นี้</button>
    </LgSheet>
  );
}
