// สร้างเป้าหมายใหม่ (บอร์ด GoalCreate): ชื่อ หมวด ยอดเป้า · กำหนดจากวันครบ/ยอดต่อเดือน · เพิ่มลงแผนรายเดือน (ดูผลต่อเงินเหลือก่อนยืนยัน)
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../db/db';
import type { GoalType, Month } from '../../db/types';
import { addMonths, cycleOf, localToday, monthDiff, thaiMonth } from '../../calc/dates';
import { formatBaht, parseBaht } from '../../calc/money';
import { goalAwareAmountOf, reachByMonthly, suggestMonthly } from '../../calc/goals';
import { planTotals } from '../../calc/plan';
import { Icon } from '../../components/Icon';
import type { IconName } from '../plan/planUi';
import { GOAL_TYPES, createGoal, goalCats, pvdEntry } from '../../db/goalActions';
import { CAT, baht, pickStyle, useGoalsData } from './goalUi';
import { MonthField, gstyle } from './parts';
import { GSheet, PvdFields, StyleSheet, parsePct } from './GoalSheets';

const PILL: Record<GoalType, { bg: string; fg: string }> = {
  saving: { bg: 'var(--gx-sav)', fg: 'var(--gx-sub)' }, invest: { bg: '#D9EF84', fg: '#3D4A1E' },
  goalSpend: { bg: 'var(--gx-spend)', fg: 'var(--gx-sub-spend)' }, pvd: { bg: 'var(--gx-pvd)', fg: 'var(--ink2)' }
};
const CAT_HINT: Record<GoalType, string> = {
  saving: 'เงินเก็บ ใช้เมื่อจำเป็น', invest: 'นับเฉพาะเงินต้น', goalSpend: 'กันเงินไว้จ่าย นับเป็นรายจ่าย', pvd: 'กองทุนสำรองเลี้ยงชีพ แยกจากงบ'
};
const signed = (s: number) => `${s < 0 ? '−' : ''}${formatBaht(Math.abs(s))}`;

export default function GoalCreate() {
  const data = useGoalsData();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const qType = sp.get('type') as GoalType | null;
  // เปิดจากหน้าหมวด: ปิดแล้วกลับไปหมวดเดิม
  const back = sp.get('from') ? `/goals/${sp.get('from')}` : '/goals';
  const [type, setType] = useState<GoalType | null>(qType && GOAL_TYPES.includes(qType) ? qType : null);
  const [name, setName] = useState('');
  const [style, setStyle] = useState<{ icon: string; color: string } | null>(null);
  const [target, setTarget] = useState('');
  const [opening, setOpening] = useState('0');
  const [by, setBy] = useState<'date' | 'month'>('date');
  const [due, setDue] = useState<Month | ''>('');
  const [perText, setPerText] = useState('');
  const [add, setAdd] = useState(true);
  const [pvd, setPvd] = useState({ gross: '', mine: '5', employer: '5', from: '' as Month });
  const [sheet, setSheet] = useState<'style' | 'cat' | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data?.settings) return null;
  const s = data.settings;
  const cur = cycleOf(localToday(), s.pay);
  const start = addMonths(cur, 1);
  const hasPvd = data.goals.some((g) => g.type === 'pvd');
  const t: GoalType = type ?? (qType && GOAL_TYPES.includes(qType) ? qType : 'saving');
  const st = style ?? pickStyle(t, data.goals);
  const hidden = goalCats(s).hidden;

  const tgt = parseBaht(target);
  const have = parseBaht(opening || '0');
  const missing = tgt !== null && have !== null ? Math.max(tgt - have, 0) : 0;
  const dueM = due || addMonths(cur, 12);
  const sugg = suggestMonthly(missing, cur, dueM);
  const per = by === 'date' ? sugg.perMonth : parseBaht(perText) ?? 0;
  const reach = reachByMonthly(missing, per, start);
  const reachM = by === 'date' ? dueM : reach.reachMonth;
  const months = by === 'date' ? sugg.months : reach.months;

  // ผลต่อเงินเหลือของเดือนแรกในแผน
  const amountOf = goalAwareAmountOf(data.goals, data.items, data.adjustments, cur);
  const before = planTotals(data.groups, data.items, start, amountOf).leftover;
  const planAmt = Math.min(per, missing);
  const after = before - planAmt;
  const short = thaiMonth(start).split(' ')[0];

  const isPvd = t === 'pvd';
  const pvdFrom = pvd.from || cur;
  const g = parseBaht(pvd.gross), a = parsePct(pvd.mine), b = parsePct(pvd.employer);
  const pvdOk = g !== null && g > 0 && a !== null && b !== null;
  const nameOk = isPvd || name.trim() !== '';
  const ok = nameOk && tgt !== null && tgt > 0 && have !== null && have >= 0 && (isPvd ? pvdOk && !hasPvd : by === 'date' ? monthDiff(cur, dueM) > 0 : true) && (!add || isPvd || planAmt > 0);
  const withPlan = add && !isPvd && planAmt > 0;

  const save = async () => {
    if (!ok || busy) return;
    setBusy(true);
    await createGoal(db, {
      type: t, name: isPvd ? (name.trim() || 'PVD') : name, icon: st.icon, color: st.color, target: tgt!, opening: have!,
      dueMonth: isPvd ? null : by === 'date' ? dueM : t === 'goalSpend' ? reachM : null,
      plan: withPlan ? { amount: planAmt, start } : null,
      pvd: isPvd ? pvdEntry(pvdFrom, g!, a!, b!) : null
    }, cur);
    nav(`/goals/${CAT[t].path}`, { replace: true });
  };

  return (
    <main className="page gx" style={{ gap: 14 }}>
      <div className="gx-head">
        <Link to={back} aria-label="ปิด" className="gx-hbtn gx-sq"><Icon name="close" size={18} stroke={2.2} /></Link>
        <h1 style={{ fontSize: 20 }}>เป้าหมายใหม่</h1>
      </div>

      <section className="gx-form">
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="gx-styleic gcol" style={gstyle(st.color)} aria-label="เปลี่ยนสีและไอคอน" onClick={() => setSheet('style')}>
            <Icon name={st.icon as IconName} size={22} stroke={1.8} /><span className="pen"><Icon name="edit" size={11} stroke={2.2} /></span>
          </button>
          <label style={{ flex: 1 }}><span className="lbl">ชื่อเป้า</span>
            <input className="in" value={isPvd && !name ? '' : name} placeholder={isPvd ? 'PVD' : 'เช่น เงินสำรอง'} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
        </div>
        <button className="gx-catrow" onClick={() => setSheet('cat')}>
          <span className="k">หมวด</span>
          <span className="gx-catpill" style={{ background: PILL[t].bg, color: PILL[t].fg }}>{CAT[t].name}</span>
          <Icon name="chevron" size={16} stroke={2} />
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <label><span className="lbl">ยอดเป้า (บาท)</span><input className="in amt num" inputMode="decimal" value={target} placeholder="0" onChange={(e) => setTarget(e.target.value)} /></label>
          <label><span className="lbl">มีแล้ว (บาท)</span><input className="in amt num" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} aria-invalid={have === null} /></label>
        </div>
      </section>

      {isPvd ? (
        <section className="gx-form">
          <span className="lbl" style={{ fontWeight: 600 }}>เงินสมทบ</span>
          {hasPvd && <span className="gx-err">มีเป้า PVD แล้ว แก้เงินสมทบได้ที่หน้า PVD</span>}
          <PvdFields {...pvd} from={pvdFrom} onChange={(x) => setPvd({ ...pvd, ...x, from: x.from ?? pvdFrom })} />
          <p className="gx-adj-help" style={{ margin: 0 }}><Icon name="info" size={15} stroke={2} /><span>PVD แยกจากงบ ไม่อยู่ในแผนรายเดือน · <span className="nw">บวกยอดให้ทุกเดือนเมื่อเงินเดือนเข้า</span></span></p>
        </section>
      ) : (
        <>
          <section className="gx-form" style={{ gap: 12 }}>
            <span id="gc-by" className="lbl" style={{ fontWeight: 600 }}>กำหนดจาก</span>
            <div className="gx-seg2" role="radiogroup" aria-labelledby="gc-by">
              <button role="radio" aria-checked={by === 'date'} onClick={() => setBy('date')}>วันครบ</button>
              <button role="radio" aria-checked={by === 'month'} onClick={() => setBy('month')}>ยอดต่อเดือน</button>
            </div>
            {by === 'date'
              ? <MonthField label="วันครบ" value={dueM} min={start} onChange={(v) => v && setDue(v)} />
              : <label className="gx-inrow"><span className="k">ยอดต่อเดือน</span><input inputMode="decimal" value={perText} placeholder="0" onChange={(e) => setPerText(e.target.value)} /></label>}
            <div className="gx-result" aria-live="polite">
              <span className="a">
                <span>{by === 'date' ? (t === 'goalSpend' ? 'ต้องกันเดือนละ' : 'ต้องออมเดือนละ') : 'จะครบเป้า'}</span>
                <b className="num">{by === 'date' ? baht(sugg.perMonth) : reach.reachMonth && missing > 0 ? thaiMonth(reach.reachMonth) : '–'}</b>
              </span>
              {months > 0 && reachM && <span className="r num">{months} เดือน<br />{thaiMonth(start)} – {thaiMonth(reachM)}</span>}
            </div>
          </section>

          <section className="gx-form" style={{ gap: 12 }}>
            <button className="gx-switch" role="switch" aria-checked={add} onClick={() => setAdd(!add)}>
              <span className="a">
                <span>เพิ่มลงแผนรายเดือน</span>
                <span className="num">เริ่ม {thaiMonth(start)} · เดือนละ {baht(planAmt)} · จนถึงเป้า</span>
              </span>
              <span className="gx-sw" aria-hidden="true" />
            </button>
            {add && planAmt > 0 && (
              <div className={`gx-impact${after < 0 ? ' isneg' : ''}`}>
                <span className="t">ผลต่อแผน {thaiMonth(start)}</span>
                <div className="rows num">
                  <div><span className="k">เงินเหลือตอนนี้</span><b>{signed(before)}</b></div>
                  <div><span className="k">เพิ่ม "{name.trim() || 'เป้านี้'}"</span><b>−{formatBaht(planAmt)}</b></div>
                  <div className="tot"><span className="k">เงินเหลือหลังเพิ่ม</span><b>{signed(after)}</b></div>
                </div>
                {after < 0 && (
                  <div className="w">
                    <span><Icon name="alert" size={15} stroke={2} /><span><span className="nw">แผน {short} จะติดลบ{before < 0 ? 'มากขึ้น' : ''}</span> <span className="nw">ลองลดรายการอื่น</span> <span className="nw">หรือลดยอดเป้า/</span><span className="nw">ยืดวันครบ</span></span></span>
                    <Link to={`/?tab=plan&m=${start}`}>ไปดูแผน {short}<Icon name="chevron" size={14} stroke={2.4} /></Link>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}

      <div className="gx-cta">
        <button disabled={!ok || busy} onClick={save}>{withPlan ? 'สร้างเป้า + เพิ่มลงแผน' : 'สร้างเป้าอย่างเดียว'}</button>
        <span>แก้ยอดเป้าหรือวันครบทีหลัง จะไม่เปลี่ยนแผนเอง</span>
      </div>

      {sheet === 'style' && <StyleSheet name={name} icon={st.icon} color={st.color} onPick={setStyle} onClose={() => setSheet(null)} />}
      {sheet === 'cat' && (
        <GSheet label="เลือกหมวด" onClose={() => setSheet(null)}>
          <div className="gx-adj-h"><span className="t"><h3>เลือกหมวด</h3></span></div>
          <div className="gx-catlist" role="radiogroup" aria-label="หมวด">
            {GOAL_TYPES.map((x) => {
              const off = x === 'pvd' && hasPvd;
              return (
                <button key={x} role="radio" aria-checked={t === x} disabled={off} style={off ? { opacity: .5 } : undefined}
                  onClick={() => { setType(x); setSheet(null); }}>
                  <span className="ic" style={{ background: PILL[x].bg, color: PILL[x].fg }}><Icon name={CAT[x].icon} size={20} stroke={1.9} /></span>
                  <span className="t"><b>{CAT[x].name}</b><span>{off ? 'มีแล้ว แก้ได้ที่หน้า PVD' : hidden.includes(x) ? 'เคยลบหมวดนี้ สร้างเป้าแล้วหมวดจะกลับมา' : CAT_HINT[x]}</span></span>
                </button>
              );
            })}
          </div>
        </GSheet>
      )}
    </main>
  );
}
