// แท็บเป้าหมาย · ภาพรวม (บอร์ด Goals / GoalsDark): ก้อนรวม + หมวด 2×2 · โหมดแก้ไข ลากเรียงหมวด + ลบหมวด
import { useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GoalType } from '../db/types';
import { db } from '../db/db';
import { cycleOf, localToday } from '../calc/dates';
import { goalBalance, goalOutlook, planOf } from '../calc/goals';
import { Icon } from '../components/Icon';
import { deleteGoalCategory, goalCats, reorderGoalCats } from '../db/goalActions';
import { CAT, baht, barW, pctText, useGoalsData, type GoalsData } from './goals/goalUi';

// ก้อนหมวดแสดงเต็มบาท (ตามบอร์ด) · ยอดละเอียดดูในหน้าหมวด
const whole = (s: number) => baht(Math.round(s / 100) * 100);
const TILE: Record<GoalType, string> = { saving: 't-sav', invest: 't-inv', goalSpend: 't-spend', pvd: 't-pvd' };
const EMPTY_EX: Record<GoalType, string> = {
  saving: 'เช่น เงินสำรอง · เก็บเงินก้อน', invest: 'เช่น กองทุนรวม · นับเฉพาะเงินต้น',
  goalSpend: 'เช่น ทริปเที่ยว · นับเป็นรายจ่าย', pvd: 'กองทุนสำรองเลี้ยงชีพ · แยกจากงบ'
};

function catSummary(data: GoalsData, type: GoalType, cur: string) {
  const goals = data.goals.filter((g) => g.type === type && !g.closed);
  const balance = goals.reduce((s, g) => s + goalBalance(g, data.adjustments), 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  const plan = goals.reduce((s, g) => s + planOf(g, data.items)(cur), 0);
  const warns = goals.filter((g) => goalOutlook(g, data.items, data.adjustments, cur).stopsAt).length;
  return { goals, balance, target, plan, warns, pct: target ? balance / target : 0 };
}

export default function Goals() {
  const data = useGoalsData();
  const nav = useNavigate();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState<GoalType | null>(null);
  const [dragOrder, setDragOrder] = useState<GoalType[] | null>(null);
  const [dragging, setDragging] = useState<GoalType | null>(null);
  const moved = useRef(false);
  if (!data?.settings) return null;
  const s = data.settings;
  const cur = cycleOf(localToday(), s.pay);
  const order = dragOrder ?? goalCats(s).order;
  const sum = Object.fromEntries((['saving', 'invest', 'goalSpend', 'pvd'] as GoalType[]).map((t) => [t, catSummary(data, t, cur)])) as Record<GoalType, ReturnType<typeof catSummary>>;

  // ก้อนรวม: เงินออม + ลงทุน (ไม่รวม PVD) · รายจ่ายตามเป้าแสดงแยก
  const total = sum.saving.balance + sum.invest.balance;
  const target = sum.saving.target + sum.invest.target;
  const pct = target ? total / target : 0;
  const C = 251.3;
  const segS = target ? Math.min(sum.saving.balance / target, 1) * C : 0;
  const segI = target ? Math.min(sum.invest.balance / target, 1) * C : 0;
  const gap = segS > 0 && segI > 0 ? 2 : 0;
  const [int, dec] = baht(total).split('.');

  // ลากเรียงหมวด (โหมดแก้ไข)
  const onDown = (t: GoalType) => (e: RPointerEvent) => {
    if (!edit || (e.target as HTMLElement).closest('.gx-del')) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ไม่มี pointer จริง */ }
    moved.current = false;
    setDragging(t);
    setDragOrder(order);
  };
  const onMove = (e: RPointerEvent) => {
    if (!dragging || !dragOrder) return;
    const el = document.elementsFromPoint(e.clientX, e.clientY).map((x) => x.closest<HTMLElement>('[data-cat]')).find((x) => x && x.dataset.cat !== dragging);
    const over = el?.dataset.cat as GoalType | undefined;
    if (!over) return;
    const next = dragOrder.filter((x) => x !== dragging);
    next.splice(dragOrder.indexOf(over), 0, dragging);
    moved.current = true;
    setDragOrder(next);
  };
  const onUp = async () => {
    if (!dragging) return;
    if (dragOrder && moved.current) await reorderGoalCats(db, [...dragOrder, ...goalCats(s).hidden]);
    setDragging(null);
    setDragOrder(null);
  };

  const list = (names: string[]) => names.map((n, i) => <span key={i}>{i ? ', ' : ''}<span className="nw">{n}</span></span>);
  const delInfo = (t: GoalType): ReactNode => {
    const all = data.goals.filter((g) => g.type === t);
    const ids = new Set(all.map((g) => g.id));
    const items = data.items.filter((i) => i.goalId && ids.has(i.goalId));
    const bal = all.reduce((x, g) => x + goalBalance(g, data.adjustments), 0);
    if (t === 'pvd') return all.length ? <>ยอด PVD <span className="num nw">{baht(bal)} บาท</span> และประวัติการสมทบจะถูกลบด้วย</> : 'ยังไม่ได้ตั้งค่า PVD ลบแล้วเพิ่มกลับได้จากหน้าสร้างเป้า';
    if (!all.length) return 'ยังไม่มีเป้าในหมวดนี้ ลบแล้วเพิ่มกลับได้จากหน้าสร้างเป้า';
    return <>เป้า {all.length} รายการ ({list(all.map((g) => g.name))}) {t === 'invest' ? 'ยอดเงินต้น' : 'ยอดสะสม'} <span className="num nw">{baht(bal)} บาท</span>
      {items.length ? <> และรายการในแผน {items.length} รายการ ({list(items.map((i) => i.name))}) จะถูกลบด้วย</> : ' จะถูกลบด้วย'}</>;
  };

  return (
    <main className={`page gx${edit ? ' gx-edit' : ''}`}>
      <div className="gx-head">
        <h1>เป้าหมาย</h1>
        <button className="gx-hbtn" style={{ marginRight: 0 }} aria-pressed={edit} onClick={() => { setEdit(!edit); setDel(null); }}>{edit ? 'เสร็จ' : 'แก้ไข'}</button>
        <Link to="/goals/new" aria-label="สร้างเป้าหมายใหม่" className="gx-add"><Icon name="plus" size={20} stroke={2.2} /></Link>
      </div>

      <section className="gx-hero" aria-label="เป้าหมายรวม">
        <div className="gx-hero-top">
          <span className="gx-ring" style={{ width: 104, height: 104 }}>
            <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`ความคืบหน้ารวม ${pctText(pct)} แบ่งเป็น เงินออม ${baht(sum.saving.balance)} และ ลงทุน ${baht(sum.invest.balance)}`}>
              <circle cx="52" cy="52" r="40" fill="none" stroke="rgba(22,35,28,.12)" strokeWidth="12" />
              {segS > 0 && <circle cx="52" cy="52" r="40" fill="none" stroke="#1E3B2C" strokeWidth="12" strokeDasharray={`${segS.toFixed(1)} ${C}`} transform="rotate(-90 52 52)" />}
              {segI > 0 && <circle cx="52" cy="52" r="40" fill="none" stroke="#FFFFFF" strokeWidth="12" strokeDasharray={`${Math.max(segI - gap, 0).toFixed(1)} ${C}`} strokeDashoffset={-(segS + gap)} transform="rotate(-90 52 52)" />}
            </svg>
            <span className="gx-ring-c"><span className="num" style={{ fontSize: 24, fontWeight: 700 }}>{pctText(pct)}</span><span style={{ fontSize: 11, color: '#2F4214' }}>ของเป้า</span></span>
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="k">เงินในเป้าหมายรวม</span>
            <span className="v num"><b>{int}</b>{dec && <small>.{dec}</small>}</span>
            <span className="s num">จาก {baht(target)} · ไม่รวม PVD</span>
            {sum.saving.plan + sum.invest.plan > 0 && <span className="pill num">+{baht(sum.saving.plan + sum.invest.plan)} เดือนนี้</span>}
          </span>
        </div>
        <div className="gx-stats3">
          <div><span className="gx-mini" style={{ background: '#1E3B2C', color: '#D9F06A' }}><Icon name="coins" size={16} stroke={2} /></span><span className="t"><span>เงินออม</span><b className="num">{baht(sum.saving.balance)}</b></span></div>
          <div><span className="gx-mini" style={{ background: '#FFFFFF', color: '#1E3B2C' }}><Icon name="trend" size={16} stroke={2.1} /></span><span className="t"><span>ลงทุน</span><b className="num">{baht(sum.invest.balance)}</b></span></div>
          <div><span className="gx-mini" style={{ border: '1.5px dashed rgba(22,35,28,.45)', color: '#2F4214' }}><Icon name="flag" size={16} stroke={2} /></span><span className="t"><span>ตามเป้า</span><b className="num">{baht(sum.goalSpend.balance)}</b></span></div>
        </div>
      </section>

      {edit && (
        <div className="gx-hintbar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flex: 'none' }}><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
          <span style={{ flex: 1 }}>ลากก้อนเพื่อเรียงใหม่ · กด × เพื่อลบหมวด <span className="nw">(หมวดในแท็บวางแผนจะหายด้วย)</span></span>
        </div>
      )}

      <div className="gx-grid" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {order.map((t) => {
          const c = sum[t];
          const empty = c.goals.length === 0;
          const to = empty ? `/goals/new?type=${t}` : `/goals/${CAT[t].path}`;
          const label = empty ? `${CAT[t].name} ยังไม่มีเป้า ตั้งเป้าใหม่` : `${CAT[t].name} ${baht(c.balance)} จาก ${baht(c.target)} ดูรายละเอียด`;
          return (
            <div key={t} data-cat={t} className={`gx-cell${dragging === t ? ' drag' : ''}`} onPointerDown={onDown(t)}>
              <Link to={to} aria-label={label} className={`gx-tile ${empty ? 't-empty' : TILE[t]}`} draggable={false}
                onClick={(e) => { if (edit) e.preventDefault(); }}>
                {empty ? (
                  <>
                    <span className="ic"><Icon name={CAT[t].icon} size={20} stroke={1.9} /></span>
                    <span className="nm">{t === 'goalSpend' ? <>รายจ่าย<br />ตามเป้าหมาย</> : CAT[t].name}</span>
                    <span className="ex">{EMPTY_EX[t].split(' · ').map((x, i) => <span key={x}>{i ? ' · ' : ''}<span className="nw">{x}</span></span>)}</span>
                    <span className="cta"><Icon name="plus" size={16} stroke={2.4} />{t === 'pvd' ? 'ตั้งค่า PVD' : 'ตั้งเป้า'}</span>
                  </>
                ) : (
                  <>
                    <span className="top">
                      <span className="ic"><Icon name={CAT[t].icon} size={20} stroke={1.9} /></span>
                      {c.warns > 0 ? <span className="gx-warnpill">{c.warns} เตือน</span> : <span className="sub"><Icon name="upRight" size={20} stroke={2} /></span>}
                    </span>
                    <span className="nm">{t === 'goalSpend' ? <>รายจ่าย<br />ตามเป้าหมาย</> : CAT[t].name}{t === 'invest' && <small className="sub"> · เงินต้น</small>}{t === 'pvd' && <small className="sub"> · แยกจากงบ</small>}</span>
                    <span className="amt num"><b>{whole(c.balance)}</b> <span className="sub nw">/ {whole(c.target)}</span></span>
                    <span className="gx-bar"><span style={{ width: barW(c.pct) }} /></span>
                    <span className="ft sub">{t === 'pvd' ? <span className="num">+{baht(c.plan)} / เดือน</span> : <span>{c.goals.length} เป้า</span>}<b className="num">{pctText(c.pct)}</b></span>
                  </>
                )}
              </Link>
              {edit && (
                <>
                  {!empty && <span className="gx-dash" aria-hidden="true" />}
                  <span className="gx-handle" aria-hidden="true" />
                  <button className="gx-del" aria-label={`ลบหมวด${CAT[t].name}`} onClick={() => setDel(t)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {order.length < 4 && !edit && (
        <button className="gx-dashadd" onClick={() => nav('/goals/new')}><Icon name="plus" size={18} stroke={2.2} />เพิ่มหมวดที่ลบไป</button>
      )}

      {del && (
        <div className="gx-alert-wrap" onClick={() => setDel(null)}>
          <div className="gx-alert" role="alertdialog" aria-labelledby="del-title" onClick={(e) => e.stopPropagation()}>
            <span className="aic"><Icon name="alert" size={24} stroke={2} /></span>
            <h2 id="del-title">ลบหมวด "{CAT[del].name}" ?</h2>
            <p>{delInfo(del)}</p>
            <p className="small">เงินในบัญชีจริงไม่ได้หายไป แค่ลบข้อมูลออกจากแอป และจะหายจากแท็บแผนด้วย</p>
            <div className="gx-2btn">
              <button onClick={() => setDel(null)}>ยกเลิก</button>
              <button className="danger" onClick={async () => { await deleteGoalCategory(db, del); setDel(null); }}>ลบหมวด</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
