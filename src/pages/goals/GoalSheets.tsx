// แผ่นเด้งของแท็บเป้าหมาย: ปรับยอด (บอร์ด GoalAdjust) · แก้เป้า · เลือกสี/ไอคอน (ดีไซน์ใหม่) · เงินสมทบ PVD
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../db/db';
import type { Goal, GoalType, Month, Satang } from '../../db/types';
import { formatBaht, parseBaht } from '../../calc/money';
import { localToday, thaiMonth } from '../../calc/dates';
import { pvdContribution } from '../../calc/goals';
import { Icon } from '../../components/Icon';
import type { IconName } from '../plan/planUi';
import { adjustDelta, adjustGoal, pvdEntry, setPvdContribution, updateGoal, type AdjustMode } from '../../db/goalActions';
import { GOAL_COLORS, GOAL_ICONS, baht, barW, pctText } from './goalUi';
import { MonthField, gstyle } from './parts';

export function GSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div className="scrim" onClick={onClose}>
      <section className="sheet gx-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <span className="grab" aria-hidden="true" />
        {children}
      </section>
    </div>,
    document.body
  );
}

const CloseBtn = ({ onClose }: { onClose: () => void }) => (
  <button aria-label="ปิด" className="gx-hbtn gx-sq" onClick={onClose}><Icon name="close" size={18} stroke={2.2} /></button>
);

const MODES: { k: AdjustMode; label: string; help: string; field: string; r1: string }[] = [
  { k: 'add', label: 'เพิ่มเงิน', help: 'ใส่เงินเข้าเป้านอกแผน เช่น ได้ดอกเบี้ย โบนัส', field: 'จำนวนที่เพิ่ม', r1: 'ได้ดอกเบี้ย/เงินพิเศษ' },
  { k: 'out', label: 'ถอนออก', help: 'เอาเงินออกจากเป้า เช่น ใช้จ่ายฉุกเฉิน', field: 'จำนวนที่ถอน', r1: 'ใช้ฉุกเฉิน' },
  { k: 'set', label: 'แก้ยอดคงเหลือ', help: '', field: 'ยอดคงเหลือจริงตอนนี้', r1: 'เช็กกับแอปธนาคาร' }
];

/** ปรับยอดคงเหลือ (บอร์ด GoalAdjust) */
export function AdjustSheet({ goal, balance, onClose }: { goal: Goal; balance: Satang; onClose: () => void }) {
  const [mode, setMode] = useState<AdjustMode>('add');
  const [text, setText] = useState('');
  const [reason, setReason] = useState(0);
  const [note, setNote] = useState('');
  const m = MODES.find((x) => x.k === mode)!;
  const amt = parseBaht(text);
  const valid = amt !== null && amt >= 0 && (mode === 'set' || amt > 0);
  const delta = valid ? adjustDelta(mode, amt!, balance) : 0;
  const after = balance + delta;
  const reasons = [m.r1, 'ยอดไม่ตรงกับบัญชี', 'อื่น ๆ'];
  const t = goal.target || 1;
  const base = Math.min(Math.max(Math.min(balance, after), 0) / t, 1);
  const dw = Math.min(Math.abs(delta) / t, 1 - base);
  const help = mode === 'set'
    ? <>พิมพ์ยอดเงินที่มีจริงในบัญชีตอนนี้ แอปคิดส่วนต่างให้{valid && delta !== 0 && <> <span className="nw num">(ครั้งนี้ {delta > 0 ? '+' : '−'}{baht(Math.abs(delta))})</span></>} · <span className="nw num">เป้า {baht(goal.target)} ไม่เปลี่ยน</span></>
    : m.help;
  return (
    <GSheet label="ปรับยอดคงเหลือ" onClose={onClose}>
      <div className="gx-adj-h gcol" style={gstyle(goal.color)}>
        <span className="gx-styleic" style={{ alignSelf: 'center' }}><Icon name={goal.icon as IconName} size={20} stroke={2.1} /></span>
        <span className="t">
          <h2>ปรับยอดคงเหลือ</h2>
          <span className="g">{goal.name}</span>
          <span className="s num">คงเหลือ {baht(balance)} · เป้า {baht(goal.target)}</span>
        </span>
        <CloseBtn onClose={onClose} />
      </div>
      <div className="gx-seg2 three" role="radiogroup" aria-label="ประเภทการปรับ">
        {MODES.map((x) => <button key={x.k} role="radio" aria-checked={mode === x.k} onClick={() => { setMode(x.k); setReason(0); setText(x.k === 'set' ? formatBaht(balance) : ''); }}>{x.label}</button>)}
      </div>
      <p className="gx-adj-help"><Icon name="info" size={15} stroke={2} /><span>{help}</span></p>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="gx-adj-lbl">{m.field}</span>
        <span className="gx-amt">
          {mode !== 'set' && <span className={`sg num ${mode === 'add' ? 'plus' : 'minus'}`}>{mode === 'add' ? '+' : '−'}</span>}
          <input className="num" inputMode="decimal" value={text} placeholder="0.00" onChange={(e) => setText(e.target.value)} aria-invalid={text !== '' && !valid} />
          <span className="u">บาท</span>
        </span>
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="gx-adj-lbl">เหตุผล</span>
        <div className="gx-chips">{reasons.map((r, i) => <button key={r} aria-pressed={reason === i} onClick={() => setReason(i)}>{r}</button>)}</div>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="gx-adj-lbl">โน้ต <small>(ไม่ใส่ก็ได้)</small></span>
        <input className="gx-notein" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
      </label>
      <div className="gx-after">
        <div className="r">
          <span>หลังบันทึก</span>
          <span className="v num">{baht(balance)}<Icon name="arrowR" size={14} stroke={2.2} /><b>{baht(after)}</b><i style={{ color: delta < 0 ? 'var(--gx-neg)' : 'var(--gx-ok)' }}>{pctText(after / t)}</i></span>
        </div>
        <div className="bar">
          <span style={{ left: 0, width: barW(base), background: '#3E7D5A' }} />
          {delta !== 0 && <span style={{ left: barW(base), width: barW(dw), background: delta > 0 ? '#9DBFA6' : 'repeating-linear-gradient(135deg, #E9B8AC 0 3px, #FFF0F0 3px 6px)' }} />}
        </div>
        <span className="ft"><Icon name="info" size={14} stroke={2} />ไม่เปลี่ยนแผนรายเดือน · บันทึกไว้ในประวัติยอด</span>
      </div>
      <div className="gx-sheetbtns">
        <button onClick={onClose}>ยกเลิก</button>
        <button className="pri" disabled={!valid || delta === 0} onClick={async () => {
          await adjustGoal(db, { goalId: goal.id, mode, amount: amt!, balance, reason: reasons[reason], note, today: localToday() });
          onClose();
        }}>บันทึก</button>
      </div>
    </GSheet>
  );
}

/** เลือกสีและไอคอนของเป้า (ดีไซน์ใหม่ รอเจ้าของดู) */
export function StyleSheet({ name, icon, color, onPick, onClose }: { name: string; icon: string; color: string; onPick: (v: { icon: string; color: string }) => void; onClose: () => void }) {
  const [ic, setIc] = useState(icon);
  const [co, setCo] = useState(color);
  return (
    <GSheet label="สีและไอคอนของเป้า" onClose={onClose}>
      <div className="gx-adj-h"><span className="t"><h3>สีและไอคอนของเป้า</h3></span><CloseBtn onClose={onClose} /></div>
      <div className="gx-pick-prev gcol" style={gstyle(co)}>
        <span className="gx-styleic" style={{ alignSelf: 'center' }}><Icon name={ic as IconName} size={22} stroke={2} /></span>
        <span className="nm">{name || 'เป้าหมายใหม่'}</span>
      </div>
      <span className="gx-adj-lbl">สี</span>
      <div className="gx-colors" role="radiogroup" aria-label="สี">
        {GOAL_COLORS.map((c) => (
          <button key={c.id} role="radio" aria-checked={co === c.id} aria-label={c.label} style={{ background: c.ring }} onClick={() => setCo(c.id)}>
            {co === c.id && <Icon name="check" size={16} stroke={3} />}
          </button>
        ))}
      </div>
      <span className="gx-adj-lbl">ไอคอน</span>
      <div className="gx-icons gcol" style={gstyle(co)} role="radiogroup" aria-label="ไอคอน">
        {GOAL_ICONS.map((n) => <button key={n} role="radio" aria-checked={ic === n} aria-label={n} onClick={() => setIc(n)}><Icon name={n} size={22} stroke={2} /></button>)}
      </div>
      <div className="gx-sheetbtns">
        <button onClick={onClose}>ยกเลิก</button>
        <button className="pri" onClick={() => { onPick({ icon: ic, color: co }); onClose(); }}>ใช้แบบนี้</button>
      </div>
    </GSheet>
  );
}

/** แก้เป้า: ชื่อ สี/ไอคอน ยอดเป้า วันครบ โน้ต (ไม่เปลี่ยนแผนเอง) */
export function EditGoalSheet({ goal, onClose }: { goal: Goal; onClose: () => void; focusDue?: boolean }) {
  const [name, setName] = useState(goal.name);
  const [style, setStyle] = useState({ icon: goal.icon, color: goal.color });
  const [target, setTarget] = useState(baht(goal.target));
  const [due, setDue] = useState<Month | ''>(goal.dueMonth ?? '');
  const [note, setNote] = useState(goal.note);
  const [picking, setPicking] = useState(false);
  const tgt = parseBaht(target);
  const ok = name.trim() !== '' && tgt !== null && tgt > 0;
  return (
    <GSheet label="แก้เป้า" onClose={onClose}>
      <div className="gx-adj-h"><span className="t"><h3>แก้เป้า</h3></span><CloseBtn onClose={onClose} /></div>
      <div className="gx-form" style={{ padding: 0, boxShadow: 'none', background: 'transparent' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="gx-styleic gcol" style={gstyle(style.color)} aria-label="เปลี่ยนสีและไอคอน" onClick={() => setPicking(true)}>
            <Icon name={style.icon as IconName} size={22} stroke={1.9} /><span className="pen"><Icon name="edit" size={11} stroke={2.2} /></span>
          </button>
          <label style={{ flex: 1 }}><span className="lbl">ชื่อเป้า</span><input className="in" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
        </div>
        <label><span className="lbl">ยอดเป้า (บาท)</span><input className="in amt num" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} aria-invalid={!ok} /></label>
        {goal.type !== 'pvd' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <MonthField label={<>กำหนดเวลา <small style={{ color: 'var(--ink3)' }}>(ไม่ใส่ก็ได้)</small></>} value={due} placeholder="ไม่กำหนด" onChange={(v) => setDue(v)} />
            {due && <button className="lnk" style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: 'var(--link)', minHeight: 32 }} onClick={() => setDue('')}>ไม่กำหนดเวลา</button>}
          </div>
        )}
        <label><span className="lbl">โน้ต <small style={{ color: 'var(--ink3)' }}>(ไม่ใส่ก็ได้)</small></span><input className="in" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} /></label>
        <p className="gx-adj-help" style={{ margin: 0 }}><Icon name="info" size={15} stroke={2} /><span>แก้ยอดเป้าหรือวันครบ จะไม่เปลี่ยนแผนเอง · <span className="nw">แก้ยอดต่อเดือนที่แท็บแผน</span></span></p>
      </div>
      <div className="gx-sheetbtns">
        <button onClick={onClose}>ยกเลิก</button>
        <button className="pri" disabled={!ok} onClick={async () => {
          await updateGoal(db, goal.id, { name, icon: style.icon, color: style.color, target: tgt!, dueMonth: due || null, note: note.trim() });
          onClose();
        }}>บันทึก</button>
      </div>
      {picking && <StyleSheet name={name} icon={style.icon} color={style.color} onPick={setStyle} onClose={() => setPicking(false)} />}
    </GSheet>
  );
}

/** ช่อง % (ทศนิยม 2 ตำแหน่ง) → basis points */
export const parsePct = (t: string) => {
  const m = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(t.trim());
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return bp <= 1500 ? bp : null; // PVD ตามกฎหมาย 2–15%
};
export const bpText = (bp: number) => (bp % 100 === 0 ? String(bp / 100) : (bp / 100).toFixed(2).replace(/0$/, ''));

export function PvdFields({ gross, mine, employer, from, onChange }: {
  gross: string; mine: string; employer: string; from: Month;
  onChange: (v: Partial<{ gross: string; mine: string; employer: string; from: Month }>) => void;
}) {
  const g = parseBaht(gross), a = parsePct(mine), b = parsePct(employer);
  const e = g !== null && a !== null && b !== null ? pvdEntry(from, g, a, b) : null;
  return (
    <>
      <label><span className="lbl">เงินเดือนก่อนหัก (บาท)</span>
        <input className="in amt num" inputMode="decimal" value={gross} onChange={(x) => onChange({ gross: x.target.value })} aria-invalid={g === null} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <label><span className="lbl">ส่วนของคุณ (%)</span><input className="in amt num" inputMode="decimal" value={mine} onChange={(x) => onChange({ mine: x.target.value })} aria-invalid={a === null} /></label>
        <label><span className="lbl">นายจ้างสมทบ (%)</span><input className="in amt num" inputMode="decimal" value={employer} onChange={(x) => onChange({ employer: x.target.value })} aria-invalid={b === null} /></label>
      </div>
      <MonthField label="มีผลตั้งแต่เดือน" value={from} onChange={(v) => v && onChange({ from: v })} />
      <div className="gx-result">
        <span className="a"><span>สมทบต่อเดือน</span><b className="num">{e ? baht(e.mine + e.employer) : '–'}</b></span>
        <span className="r num">{e ? <>คุณ {baht(e.mine)}<br />นายจ้าง {baht(e.employer)}</> : <>ใส่ % 0–15</>}</span>
      </div>
    </>
  );
}

/** แก้เงินสมทบ PVD (ดีไซน์ใหม่ รอเจ้าของดู) */
export function PvdSheet({ goal, current, onClose }: { goal: Goal; current: Month; onClose: () => void }) {
  const c = pvdContribution(goal, current);
  const [v, setV] = useState({ gross: c?.gross ? baht(c.gross) : '', mine: c?.mineBp !== undefined ? bpText(c.mineBp) : '', employer: c?.employerBp !== undefined ? bpText(c.employerBp) : '', from: current });
  const g = parseBaht(v.gross), a = parsePct(v.mine), b = parsePct(v.employer);
  const ok = g !== null && g > 0 && a !== null && b !== null;
  return (
    <GSheet label="เงินสมทบ PVD" onClose={onClose}>
      <div className="gx-adj-h"><span className="t"><h3>เงินสมทบ PVD</h3><span className="s">คิดจาก % ของเงินเดือนก่อนหัก</span></span><CloseBtn onClose={onClose} /></div>
      <div className="gx-form" style={{ padding: 0, boxShadow: 'none', background: 'transparent' }}>
        <PvdFields {...v} onChange={(x) => setV({ ...v, ...x })} />
        <p className="gx-adj-help" style={{ margin: 0 }}><Icon name="info" size={15} stroke={2} /><span>เงินเดือนขึ้นเมื่อไหร่ ใส่ยอดใหม่และเดือนที่มีผล <span className="nw">เดือนก่อนหน้าไม่เปลี่ยน</span> · <span className="nw">ยอดในแผนเป็นเงินเดือนสุทธิ</span> <span className="nw">จึงต้องใส่ยอดก่อนหักแยก</span></span></p>
      </div>
      <div className="gx-sheetbtns">
        <button onClick={onClose}>ยกเลิก</button>
        <button className="pri" disabled={!ok} onClick={async () => { await setPvdContribution(db, goal, pvdEntry(v.from, g!, a!, b!)); onClose(); }}>บันทึก</button>
      </div>
    </GSheet>
  );
}

export const typeName: Record<GoalType, string> = { saving: 'ออม', invest: 'ลงทุน', goalSpend: 'กันเงิน', pvd: 'สมทบ' };
export const monthLabel = (m: Month | null) => (m ? thaiMonth(m) : '–');
