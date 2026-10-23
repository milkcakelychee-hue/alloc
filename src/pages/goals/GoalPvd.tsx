// หน้า PVD (บอร์ด GoalPVD): ยอด · เงินสมทบต่อเดือน · คาดการณ์ 4 จุด · แยกจากงบ
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { cycleOf, localToday, monthDiff, thaiMonth } from '../../calc/dates';
import { goalBalance, goalOutlook, nextDepositCycle, projectGoal, pvdContribution, pvdMonthly } from '../../calc/goals';
import { Icon } from '../../components/Icon';
import { baht, barW, pctText, useGoalsData } from './goalUi';
import { BackHead } from './parts';
import { AdjustSheet, EditGoalSheet, PvdSheet, bpText } from './GoalSheets';

export default function GoalPvd() {
  const data = useGoalsData();
  const [sheet, setSheet] = useState<'adjust' | 'edit' | 'pvd' | null>(null);
  if (!data?.settings) return null;
  const g = data.goals.find((x) => x.type === 'pvd');
  if (!g) return <Navigate to="/goals/new?type=pvd" replace />;
  const cur = cycleOf(localToday(), data.settings.pay);
  const balance = goalBalance(g, data.adjustments);
  const o = goalOutlook(g, data.items, data.adjustments, cur);
  const c = pvdContribution(g, cur);
  const monthly = c ? c.mine + c.employer : 0;
  const next = (g.contributions ?? []).filter((x) => monthDiff(cur, x.from) > 0).sort((a, b) => a.from.localeCompare(b.from))[0];
  const year = Number(cur.slice(0, 4));

  // คาดการณ์ 4 จุด: ตอนนี้ · ธ.ค. ปีนี้ · เดือนที่ครบเป้า · ธ.ค. ปีหน้า
  const pts = [...new Set([cur, `${year}-12`, o.reachMonth, `${year + 1}-12`].filter((m): m is string => !!m && monthDiff(cur, m) >= 0))].sort();
  const last = pts.at(-1)!;
  const from = nextDepositCycle(g, data.adjustments, cur);
  const proj = projectGoal({ balance, target: Number.MAX_SAFE_INTEGER, from, planFor: pvdMonthly(g), maxMonths: Math.max(monthDiff(from, last) + 1, 0), cap: false });
  const valueAt = (m: string) => (m === cur && from !== cur ? balance : m === cur ? balance : proj.months.find((x) => x.month === m)?.balance ?? balance);
  const vals = pts.map(valueAt);
  const max = Math.max(...vals, g.target, 1);
  const H = 124; // แท่งสูงสุด (พื้นที่ 148 เว้นป้ายตัวเลข)
  const hOf = (v: number) => Math.max(Math.round((v / max) * H), 4);

  return (
    <main className="page gx">
      <BackHead to="/goals" label="กลับไปหน้าเป้าหมาย" title="PVD" />

      <section className="gx-sum t-pvd" aria-label="สรุป PVD">
        <div className="row1">
          <span className="ic"><Icon name="bank" size={22} stroke={1.9} /></span>
          <span className="mid">
            <span className="num"><b className="big">{baht(balance)}</b> <span className="of sub">/ {baht(g.target)}</span></span>
            <span className="s sub">กองทุนสำรองเลี้ยงชีพ · แยกจากงบ</span>
          </span>
          <span className="p num">{pctText(o.pct)}</span>
          <button className="gx-editic" aria-label="แก้เป้า PVD" onClick={() => setSheet('edit')}><Icon name="edit" size={18} stroke={2} /></button>
        </div>
        <span className="gx-bar"><span style={{ width: barW(o.pct) }} /></span>
        <span className="foot sub num">{o.done ? 'ครบเป้าแล้ว' : <>เหลืออีก <b>{baht(o.remaining)}</b>{o.reachMonth && <> · ครบเป้าประมาณ <b>{thaiMonth(o.reachMonth)}</b></>}</>}</span>
      </section>

      <section className="gx-sec" aria-label="เงินสมทบต่อเดือน">
        <div className="h"><h2>เงินสมทบต่อเดือน</h2><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>+{baht(monthly)}</span></div>
        {monthly > 0 && (
          <span className="gx-split"><span style={{ flex: c!.mine, background: 'var(--gx-pvd-now)' }} /><span style={{ flex: c!.employer, background: '#A9B79A' }} /></span>
        )}
        <div className="gx-tiles two">
          <div className="gx-st"><span className="k" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}><i className="gx-dot" style={{ background: 'var(--gx-pvd-now)' }} />ส่วนของคุณ</span><span className="v num" style={{ fontSize: 15 }}>{baht(c?.mine ?? 0)}</span><span className="k">{c?.mineBp !== undefined ? `${bpText(c.mineBp)}% หักจากเงินเดือน` : 'หักจากเงินเดือน'}</span></div>
          <div className="gx-st"><span className="k" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}><i className="gx-dot" style={{ background: '#A9B79A' }} />นายจ้างสมทบ</span><span className="v num" style={{ fontSize: 15 }}>{baht(c?.employer ?? 0)}</span><span className="k">{c && c.employer === c.mine ? 'เท่ากับส่วนของคุณ' : c?.employerBp !== undefined ? `${bpText(c.employerBp)}% ของเงินเดือน` : ''}</span></div>
        </div>
        {next && (
          <div className="gx-box pvd">
            <Icon name="trend" size={16} stroke={2} />
            <span>ตั้งแต่ <span className="num">{thaiMonth(next.from)}</span> {next.mine + next.employer >= monthly ? 'เพิ่ม' : 'ลด'}เป็น <b className="num nw">{baht(next.mine)} + {baht(next.employer)} = {baht(next.mine + next.employer)}</b>{next.gross ? <> <span className="nw">ตามเงินเดือน <span className="num">{baht(next.gross)}</span></span></> : null}</span>
          </div>
        )}
        <button className="gx-ghost" onClick={() => setSheet('pvd')}><Icon name="edit" size={16} stroke={2} />แก้เงินสมทบ / เงินเดือนขึ้น</button>
      </section>

      <section className="gx-sec" aria-label="คาดการณ์ยอด PVD" style={{ ['--gx-tgt' as string]: '#9DBFA6' }}>
        <div className="h" style={{ paddingBottom: 6 }}><h2>คาดการณ์ตามเงินสมทบ</h2><span style={{ fontSize: 12, color: 'var(--ink3)' }}>เงินต้นอย่างเดียว</span></div>
        <div className="gx-chart">
          <div className="tgt" style={{ bottom: 22 + hOf(g.target) }} />
          <div className="base" />
          <div className="cols" style={{ gridTemplateColumns: `repeat(${pts.length}, minmax(0, 1fr))` }}>
            {pts.map((m, i) => (
              <div key={m}>
                <span className={`lb num${i === 0 ? ' now' : ''}`}>{baht(Math.round(vals[i] / 100) * 100)}</span>
                <span className="b" style={i === 0
                  ? { height: hOf(vals[i]), background: 'var(--gx-pvd-now)' }
                  : { height: hOf(vals[i]), background: 'repeating-linear-gradient(135deg, var(--gx-pvd-hatch) 0 4px, var(--gx-hatch-gap) 4px 8px)', border: '1.5px dashed var(--gx-pvd-dash)' }} />
              </div>
            ))}
          </div>
          <div className="xl" style={{ gridTemplateColumns: `repeat(${pts.length}, minmax(0, 1fr))` }}>
            {pts.map((m, i) => <span key={m} className={i === 0 ? 'now' : ''}>{thaiMonth(m)}</span>)}
          </div>
        </div>
        <div className="gx-legend">
          <span><i style={{ background: 'var(--gx-pvd-now)' }} />ยอดตอนนี้</span>
          <span><i style={{ border: '1.5px dashed var(--gx-pvd-dash)' }} />คาดการณ์</span>
          <span><i className="line" /><span className="num">เป้า {baht(g.target)}</span></span>
        </div>
      </section>

      <div className="gx-info"><Icon name="info" size={16} stroke={2} /><span>นับเฉพาะเงินต้น ไม่รวมผลตอบแทน · ไม่นับรวมใน <span className="nw">"เงินเก็บ / ลงทุน"</span> หน้าหลัก <span className="nw">เพราะถอนก่อนออกจากงานไม่ได้</span> · <span className="nw">ยอดจริงดูจาก statement กองทุน</span>แล้วกด <span className="nw">"ปรับยอด"</span></span></div>
      <div className="gx-btns">
        <button onClick={() => setSheet('adjust')}>ปรับยอด</button>
        <Link to={`/goals/g/${g.id}`}>ประวัติยอด</Link>
      </div>

      {sheet === 'adjust' && <AdjustSheet goal={g} balance={balance} onClose={() => setSheet(null)} />}
      {sheet === 'edit' && <EditGoalSheet goal={g} onClose={() => setSheet(null)} />}
      {sheet === 'pvd' && <PvdSheet goal={g} current={cur} onClose={() => setSheet(null)} />}
    </main>
  );
}
