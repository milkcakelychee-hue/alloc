// ประวัติยอดของเป้า (บอร์ด GoalHistory): ยอดตอนนี้ · กราฟ 5 เดือน (จริง + คาดการณ์) · รายการแยกตามรอบ ใหม่ไปเก่า
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { GoalAdjustment } from '../../db/types';
import { addMonths, cycleOf, localToday, monthDiff, thaiDate, thaiMonth } from '../../calc/dates';
import { balanceAt, goalBalance, nextDepositCycle, planOf, projectGoal } from '../../calc/goals';
import { Icon } from '../../components/Icon';
import type { IconName } from '../plan/planUi';
import { thaiMonthLong } from '../plan/planUi';
import { CAT, baht, pctText, useGoalsData } from './goalUi';
import { gstyle } from './parts';
import { AdjustSheet } from './GoalSheets';

const dayMonth = (d: string) => thaiDate(d).split(' ').slice(0, 2).join(' ');

export default function GoalHistory() {
  const { id } = useParams();
  const data = useGoalsData();
  const [adjust, setAdjust] = useState(false);
  if (!data?.settings) return null;
  const g = data.goals.find((x) => x.id === id);
  if (!g) return <Navigate to="/goals" replace />;
  const pay = data.settings.pay;
  const cur = cycleOf(localToday(), pay);
  const cyc = (a: GoalAdjustment) => a.cycleMonth ?? cycleOf(a.date, pay);
  const mine = data.adjustments.filter((a) => a.goalId === g.id);
  const balance = goalBalance(g, data.adjustments);
  const pct = g.target ? balance / g.target : 0;
  const created = cycleOf(localToday(new Date(g.createdAt)), pay);

  // กราฟ 5 เดือน: ย้อนหลังไม่เกิน 2 รอบ (ไม่ก่อนสร้างเป้า) + รอบนี้ + คาดการณ์ให้ครบ 5
  const back = Math.min(2, Math.max(monthDiff(created, cur), 0));
  const months = Array.from({ length: 5 }, (_, i) => addMonths(cur, i - back));
  const from = nextDepositCycle(g, data.adjustments, cur);
  const proj = projectGoal({ balance, target: g.type === 'pvd' ? Number.MAX_SAFE_INTEGER : g.target, from, planFor: planOf(g, data.items), maxMonths: 6, cap: g.type !== 'pvd' });
  const valueAt = (m: string) => monthDiff(m, cur) >= 0 ? balanceAt(g, data.adjustments, m, cyc) : proj.months.find((x) => x.month === m)?.balance ?? proj.months.at(-1)?.balance ?? balance;
  const vals = months.map(valueAt);
  const top = Math.max(g.target, ...vals, 1);
  const H = 124; // พื้นที่ 148 เว้นป้ายตัวเลขบนแท่ง
  const hOf = (v: number) => Math.max(Math.round((Math.max(v, 0) / top) * H), 3);
  const tgtBottom = 22 + Math.round((g.target / top) * H);

  // รายการ: ใหม่ไปเก่า แยกตามรอบ · ยอดคงเหลือหลังแต่ละรายการ
  let run = g.openingBalance;
  const rows = mine.map((a) => { run += a.delta; return { a, after: run }; }).reverse();
  const groups: { m: string; rows: typeof rows }[] = [];
  for (const r of rows) {
    const m = cyc(r.a);
    const last = groups.at(-1);
    if (last && last.m === m) last.rows.push(r); else groups.push({ m, rows: [r] });
  }
  const itemName = data.items.find((i) => i.goalId === g.id)?.name ?? g.name;
  const rowText = (a: GoalAdjustment): { t: string; s: string; ic: IconName; tone: 'up' | 'down' | 'flat' } => {
    const note = [a.reason, a.note].filter(Boolean).join(' · ');
    switch (a.kind) {
      case 'planDeposit': return g.type === 'pvd'
        ? { t: 'ส่วนของคุณ', s: `หักจากเงินเดือน · ${dayMonth(a.date)}`, ic: 'calendar', tone: 'up' }
        : { t: 'บวกตามแผน', s: `รายการ "${itemName}" · ${dayMonth(a.date)}`, ic: 'calendar', tone: 'up' };
      case 'employer': return { t: 'นายจ้างสมทบ', s: `ตามเงินสมทบ · ${dayMonth(a.date)}`, ic: 'calendar', tone: 'up' };
      case 'deposit': return { t: 'เพิ่มเงิน', s: `${note ? `${note} · ` : ''}${dayMonth(a.date)}`, ic: 'plus', tone: 'up' };
      case 'withdraw': return { t: 'ถอนออก', s: `${note ? `${note} · ` : ''}${dayMonth(a.date)}`, ic: 'wallet', tone: 'down' };
      case 'spent': return { t: 'ใช้เงินก้อนนี้แล้ว', s: `บันทึกเป็นรายจ่าย · ${dayMonth(a.date)}`, ic: 'check', tone: 'down' };
      default: return { t: 'แก้ยอดคงเหลือ', s: `${note ? `${note} · ` : ''}${dayMonth(a.date)}`, ic: 'edit', tone: a.delta < 0 ? 'down' : 'up' };
    }
  };
  const sign = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${baht(Math.abs(d))}`;
  const lastGroup = groups.at(-1);
  const openingInLast = lastGroup && lastGroup.m === created;

  return (
    <main className="page gx gcol" style={gstyle(g.color)}>
      <div className="gx-hist-h">
        <Link to={`/goals/${CAT[g.type].path}`} aria-label={`กลับไปหมวด${CAT[g.type].name}`} className="gx-hbtn gx-sq"><Icon name="back" size={20} stroke={2} /></Link>
        <span className="t"><span>ประวัติยอด</span><h1>{g.name}</h1></span>
        <span className="gx-gic"><Icon name={g.icon as IconName} size={20} stroke={2.1} /></span>
      </div>

      <section className="gx-sec" aria-label="ยอดสะสมรายเดือน" style={{ ['--gx-tgt' as string]: 'var(--h)' }}>
        <div className="gx-now">
          <span className="l"><span>ยอดตอนนี้</span><span className="num"><b className="big">{baht(balance)}</b> <span className="of">/ {baht(g.target)}</span></span></span>
          <span className="pp num">{pctText(pct)}</span>
        </div>
        <div className="gx-chart" style={{ marginTop: 12 }}>
          <div className="tgt" style={{ bottom: tgtBottom }} />
          <div className="base" />
          <div className="cols" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
            {months.map((m, i) => {
              const past = monthDiff(m, cur) > 0, now = m === cur;
              return (
                <div key={m}>
                  <span className={`lb num${now ? ' now' : ''}`}>{baht(Math.round(vals[i] / 100) * 100)}</span>
                  <span className="b" style={now ? { height: hOf(vals[i]), background: 'var(--gr)' }
                    : past ? { height: hOf(vals[i]), background: 'var(--gx-past)' }
                      : { height: hOf(vals[i]), border: '1.5px dashed var(--h)', background: 'repeating-linear-gradient(135deg, var(--t) 0 4px, var(--card) 4px 8px)' }} />
                </div>
              );
            })}
          </div>
          <div className="xl" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
            {months.map((m) => <span key={m} className={m === cur ? 'now' : ''}>{thaiMonth(m).split(' ')[0]}</span>)}
          </div>
        </div>
        <div className="gx-legend">
          <span><i style={{ background: 'var(--gr)' }} />ยอดจริงในแอป</span>
          <span><i style={{ border: '1.5px dashed var(--h)' }} />คาดการณ์ตามแผน</span>
          <span><i className="line" /><span className="num">เป้า {baht(g.target)}</span></span>
        </div>
      </section>

      <section className="gx-list" aria-label="รายการเปลี่ยนแปลงยอด">
        <div className="lh"><h2>รายการ</h2><span>ใหม่ไปเก่า</span></div>
        {groups.map((gr) => (
          <div key={gr.m}>
            <div className="mh">{thaiMonthLong(gr.m)}</div>
            {gr.rows.map(({ a, after }) => {
              const r = rowText(a);
              return (
                <div key={a.id} className="gx-row">
                  <span className={`ri ${r.tone}`}><Icon name={r.ic} size={18} stroke={2} /></span>
                  <span className="rt"><span>{r.t}</span><span>{r.s}</span></span>
                  <span className="rv num"><b className={r.tone}>{sign(a.delta)}</b><span>{baht(after)}</span></span>
                </div>
              );
            })}
            {openingInLast && gr === lastGroup && <Opening value={g.openingBalance} />}
          </div>
        ))}
        {!openingInLast && (<div><div className="mh">{thaiMonthLong(created)}</div><Opening value={g.openingBalance} /></div>)}
      </section>

      <button className="gx-pri" onClick={() => setAdjust(true)}><Icon name="edit" size={18} stroke={2.2} />ปรับยอด</button>
      {adjust && <AdjustSheet goal={g} balance={balance} onClose={() => setAdjust(false)} />}
    </main>
  );
}

function Opening({ value }: { value: number }) {
  return (
    <div className="gx-row">
      <span className="ri flat"><Icon name="flag" size={18} stroke={2} /></span>
      <span className="rt"><span>ยอดยกมา</span><span>ตอนสร้างเป้า</span></span>
      <span className="rv num"><b>{baht(value)}</b><span>{baht(value)}</span></span>
    </div>
  );
}
