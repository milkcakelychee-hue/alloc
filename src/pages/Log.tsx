// แท็บบันทึก · รายรับ-รายจ่าย (บอร์ด LogCalendar / LogCalendarDark): งบรายวัน · สรุปรอบ · ปฏิทินรอบ · รายการของวัน
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { LogEntry, Month } from '../db/types';
import { appCycle, addMonths, cycleOf, cycleRange, daysBetween, localToday, thaiDate } from '../calc/dates';
import { expectedPayDate } from '../calc/payday';
import { planTotals } from '../calc/plan';
import { goalAwareAmountOf } from '../calc/goals';
import { entryCycle, expensesIn, offBudgetTotal } from '../calc/log';
import { calendarCells, dailyBudgetParts, dayTotals, effectiveStart, planLabelOf, salaryEvent } from '../calc/logView';
import { Icon } from '../components/Icon';
import { BillList } from './bill/BillList';
import { baht } from './goals/goalUi';
import { thaiMonthLong } from './plan/planUi';
import { CatIcon, catStyle } from './log/catIcon';
import { useLogData, dayFull, type LogData } from './log/useLogData';
import { EntrySheet } from './log/EntrySheet';
import { weekday } from '../calc/payday';

export const dm = (d: string) => thaiDate(d).split(' ').slice(0, 2).join(' ');
const WD = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

export default function Log() {
  const [sp] = useSearchParams();
  if (sp.get('tab') === 'bill') return <BillList tabs={<Tabs bill />} />;
  return <LogCalendar />;
}

function Tabs({ bill }: { bill?: boolean }) {
  return (
    <div className="lg-tabs" role="tablist" aria-label="มุมมองบันทึก">
      <Link to="/log" role="tab" aria-selected={!bill} replace>รายรับ-รายจ่าย</Link>
      <Link to="/log?tab=bill" role="tab" aria-selected={!!bill} replace>บิลแชร์</Link>
    </div>
  );
}

function LogCalendar() {
  const data = useLogData();
  const nav = useNavigate();
  const today = localToday();
  const [cycleSel, setCycle] = useState<Month | null>(null);
  const [daySel, setDay] = useState<string | null>(null);
  const [open, setOpen] = useState<LogEntry | null>(null);
  const [tip, setTip] = useState(false);
  if (!data?.settings) return null;
  const s = data.settings;
  const cur = appCycle(today, s.pay, s.startCycle);
  const cycle = cycleSel ?? cur;
  // เงินเดือนเข้าก่อนกำหนด (กดยืนยันแล้ว) → รอบเริ่มวันที่เงินเข้า
  const r = { ...cycleRange(cycle, s.pay), start: effectiveStart(cycle, s.pay, data.receipts) };
  const isCur = cycle === cur;
  const amountOf = goalAwareAmountOf(data.goals, data.items, data.adjustments, cur);
  const catOf = (id: string) => data.categories.find((c) => c.id === id);

  const inCycle = data.entries.filter((e) => entryCycle(e, s.pay) === cycle);
  const exp = expensesIn(data.entries, cycle, s.pay);
  const parts = dailyBudgetParts(data.groups, data.items, exp, cycle, amountOf);
  const budget = parts.reduce((a, p) => a + p.budget, 0);
  const spentB = parts.reduce((a, p) => a + p.spent, 0);
  const remaining = budget - spentB;
  const notStarted = isCur && today < r.start; // ตั้งรอบเริ่มใช้แอปไว้ล่วงหน้า ยังไม่ถึงวันแรก
  const daysLeft = notStarted ? daysBetween(r.start, r.end) + 1 : isCur ? daysBetween(today, r.end) : 0;
  const perDay = Math.round(remaining / Math.max(daysLeft, 1));

  // เงินเดือนของรอบ (ไม่ได้จดเป็นรายการ)
  const rec = data.receipts.find((x) => x.id === cycle && x.status === 'received');
  const sal = salaryEvent({
    cycle, pay: s.pay, today, received: rec ? { date: rec.date, amount: rec.amount } : null,
    expected: expectedPayDate(s.pay, s.weekendShift, addMonths(cycle, -1), s.payOverrides).date,
    planned: planTotals(data.groups, data.items, cycle, amountOf).income, startAt: r.start
  });
  const totals = dayTotals(inCycle);
  if (sal) { const t = totals.get(sal.date) ?? { income: 0, expense: 0 }; totals.set(sal.date, { ...t, income: t.income + sal.amount }); }
  const incomeAll = [...totals.values()].reduce((a, t) => a + t.income, 0);
  const spentAll = exp.reduce((a, e) => a + e.myShare, 0);
  const off = offBudgetTotal(exp, data.items);
  const linkedAll = new Set(data.items.flatMap((i) => i.logCategoryIds));
  const offCats = [...new Set(exp.filter((e) => !linkedAll.has(e.categoryId)).map((e) => e.categoryId))].map(catOf).filter((c): c is NonNullable<typeof c> => !!c);

  const cells = calendarCells(cycle, s.pay, today, r.start);
  const lastWithData = [...totals.keys()].sort().at(-1) ?? r.end;
  const sel = daySel && daySel >= r.start && daySel <= r.end ? daySel : isCur ? (today < r.start ? r.start : today) : lastWithData;
  const dayEntries = inCycle.filter((e) => e.date === sel);
  const dayT = totals.get(sel);
  const salToday = sal && sal.date === sel ? sal : null;
  const canNext = !isCur;
  const fmtCell = (v: number) => baht(v);

  return (
    <main className="page lgp">
      <div className="lg-head">
        <h1>บันทึก</h1>
        <Link to="/log/spend" aria-label="สรุปรายจ่ายตามหมวด" className="lg-sq"><Icon name="chart" size={20} stroke={2} /></Link>
      </div>
      <Tabs />
      <div className="lg-cyc">
        <div className="t"><b>{thaiMonthLong(cycle)}</b>
          <span className="num"><span className="nw">รอบเงินเดือน {dm(r.start)} – {dm(r.end)}</span>{isCur && <> · <span className="nw">{notStarted ? `เริ่ม ${dm(r.start)}` : daysLeft === 0 ? 'วันสุดท้าย' : `อีก ${daysLeft} วัน`}</span></>}</span></div>
        <button className="lg-sq" aria-label="รอบก่อน" disabled={!!s.startCycle && cycle <= s.startCycle} onClick={() => { setCycle(addMonths(cycle, -1)); setDay(null); }}><Icon name="back" size={20} stroke={2} /></button>
        <button className="lg-sq" aria-label="รอบถัดไป" disabled={!canNext} onClick={() => { setCycle(addMonths(cycle, 1)); setDay(null); }}><Icon name="chevron" size={20} stroke={2} /></button>
      </div>

      <section className="lg-hero" aria-label="งบใช้จ่ายรายวันรอบนี้">
        <span className="cap">งบใช้จ่ายรายวัน · <span className="nw">คิดเฉพาะรายจ่ายผันแปร</span><span className="nw">ที่ผูกหมวดไว้</span></span>
        {budget > 0 ? <>
          <div className="top">
            <span className="l"><span className="k">{remaining < 0 ? 'ใช้เกินงบ' : 'เหลือ'}</span>
              <span className="v num"><b className={remaining < 0 ? 'over' : ''}>{baht(Math.abs(remaining))}</b><span> / {baht(budget)}</span></span></span>
            {isCur && remaining > 0 && <span className="r"><span className="k">ใช้ได้วันละ</span><b className="num">~{baht(Math.round(perDay / 100) * 100)}</b></span>}
          </div>
          {isCur && <span className="foot num">{notStarted ? `${daysLeft} วันในรอบ` : daysLeft === 0 ? 'วันสุดท้ายของรอบ' : `อีก ${daysLeft} วันหลังจากวันนี้`}</span>}
        </> : (
          <span style={{ fontSize: 15, lineHeight: 1.55 }}>ยังไม่มีงบ · <span className="nw">ผูกหมวดบันทึกกับรายจ่ายผันแปร</span> <span className="nw">ในแท็บแผน</span></span>
        )}
      </section>

      {(parts.length > 0 || offCats.length > 0) && (
        <section className="lg-budgets" aria-labelledby="lg-bud-h">
          <div className="h"><h2 id="lg-bud-h">งบแต่ละรายการ</h2><span>จดในหมวดที่ผูก <span className="nw">ยอดหักจากงบนั้น</span></span></div>
          {parts.map((p) => {
            const left = p.budget - p.spent;
            return (
              <div key={p.item.id} className="bd">
                <div className="r1"><span className="n">{p.item.name}</span>
                  <span className={`num v${left < 0 ? ' over' : ''}`}>{left < 0 ? `เกิน ${baht(-left)}` : `เหลือ ${baht(left)}`}</span></div>
                <span className="bar" aria-hidden="true"><span className={left < 0 ? 'over' : ''} style={{ width: `${Math.min(100, p.budget ? (p.spent / p.budget) * 100 : 0)}%` }} /></span>
                <div className="r2"><span className="cats">{p.item.logCategoryIds.map((id) => catOf(id)).filter(Boolean).map((c) => <span key={c!.id} className="chip" style={catStyle(c)}>{c!.name}</span>)}</span>
                  <span className="num s">{baht(p.spent)} / {baht(p.budget)}</span></div>
              </div>
            );
          })}
          {offCats.length > 0 && (
            <div className="bd off">
              <div className="r1"><span className="n">นอกงบ</span><span className="num v">{baht(off)}</span></div>
              <div className="r2"><span className="cats">{offCats.map((c) => <span key={c.id} className="chip" style={catStyle(c)}>{c.name}</span>)}</span>
                <span className="s">ยังไม่ผูกกับงบไหน</span></div>
            </div>
          )}
        </section>
      )}

      <h2 className="lg-sumh">สรุปรอบเงินเดือน{isCur ? 'นี้' : ''}</h2>
      <div className="lg-tiles">
        <div><span className="k">เงินเข้า</span><span className="v inc num">+{baht(incomeAll)}</span><span className="s"><span className="nw">เงินเดือน +</span> <span className="nw">รายได้อื่น</span></span></div>
        <div><span className="k">จ่ายไปแล้ว</span><span className="v exp num">{baht(spentAll)}</span><span className="s">ทุกรายการที่จด</span></div>
        <div><span className="k">ใช้นอกงบ<button className="lg-q" aria-label="ใช้นอกงบคืออะไร" aria-expanded={tip} onClick={() => setTip(!tip)}>?</button></span>
          <span className="v num">{baht(off)}</span><span className="s">อยู่ในยอดจ่ายแล้ว</span>
          {tip && <div className="lg-tip" role="tooltip" onClick={() => setTip(false)}>ใช้นอกงบ คือส่วนหนึ่งของ "จ่ายไปแล้ว" ที่จดในหมวดซึ่งไม่ได้ผูกกับรายการในแผน เช่น ซื้อของที่ไม่ได้ตั้งงบ หรือจ่ายเกินจากที่วางแผน ไม่รวมรายการที่อยู่ในแผนแล้ว แตะ ? อีกครั้งเพื่อปิด</div>}
        </div>
      </div>

      <section className="lg-cal" aria-label="ปฏิทินรอบนี้">
        <div className="lg-wd">{WD.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="lg-grid">
          {cells.map((c) => {
            const day = Number(c.date.slice(8));
            const label = day === 1 && !c.inCycle ? dm(c.date) : String(day);
            if (!c.inCycle) return <span key={c.date} className="lg-day off"><span className="d num">{label}</span></span>;
            if (c.future) return <span key={c.date} className="lg-day fut"><span className="d num">{label}</span></span>;
            const t = totals.get(c.date);
            return (
              <button key={c.date} className={`lg-day${c.today ? ' today' : ''}`} aria-pressed={c.date === sel} aria-label={dm(c.date)} onClick={() => setDay(c.date)}>
                <span className="d num">{label}</span>
                {t?.income ? <span className="i num">+{fmtCell(t.income)}</span> : null}
                {t?.expense ? <span className="e num">{fmtCell(t.expense)}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="lg-legend">
          <span><span className="num" style={{ color: 'var(--lg-inc)', fontWeight: 600 }}>+</span>รายรับ</span>
          <span><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--lg-exp)', display: 'inline-block' }} />รายจ่าย</span>
          <span><i style={{ width: 12, height: 10, borderRadius: 3, background: 'repeating-linear-gradient(135deg, var(--lg-hatch2) 0 2px, transparent 2px 4px)', display: 'inline-block' }} />นอกรอบนี้</span>
        </div>
      </section>

      <section className="lg-dayc" aria-label={`รายการวันที่ ${dm(sel)}`}>
        <div className="h"><h2>{dayFull(weekday(sel))} {dm(sel)}{sel === today ? ' · วันนี้' : ''}</h2>
          <span>{dayT?.income ? <><span className="num" style={{ color: 'var(--lg-inc)' }}>+{baht(dayT.income)}</span>{dayT.expense ? ' · ' : ''}</> : null}{dayT?.expense ? <span className="num">จ่าย {baht(dayT.expense)}</span> : null}</span></div>
        {dayEntries.length === 0 && !salToday ? (
          <div className="lg-empty">ยังไม่มีรายการ{sel === today ? 'วันนี้' : ''}</div>
        ) : (
          <ul>
            {salToday && (
              <li><div className="lg-row">
                <span className="cat-ic" style={catStyle(catOf('i-salary'))}><CatIcon icon="salary" /></span>
                <span className="t"><span>เงินเดือน</span><span>{rec ? 'ยืนยันเงินเข้าแล้ว' : 'ตามแผน (ยังไม่ได้ยืนยัน)'} · รายรับ</span></span>
                <span className="a"><b className="inc num">+{baht(salToday.amount)}</b></span>
              </div></li>
            )}
            {dayEntries.map((e) => <EntryRow key={e.id} e={e} data={data} onOpen={() => setOpen(e)} />)}
          </ul>
        )}
      </section>

      {today < r.start && isCur
        ? <span className="lg-fab off" role="status"><Icon name="calendar" size={20} stroke={2} />เริ่มบันทึกได้ {dm(r.start)}</span>
        : <Link to={`/log/add${sel !== today && daysBetween(sel, today) > 0 ? `?d=${sel}` : ''}`} className="lg-fab" aria-label="บันทึกรายการใหม่"><Icon name="plus" size={22} stroke={2.4} />บันทึก</Link>}
      {open && <EntrySheet entry={open} data={data} onClose={() => setOpen(null)} onEdit={() => nav(`/log/add?id=${open.id}`)} />}
    </main>
  );
}

function EntryRow({ e, data, onOpen }: { e: LogEntry; data: LogData; onOpen: () => void }) {
  const cat = data.categories.find((c) => c.id === e.categoryId);
  const label = e.type === 'income' ? 'รายรับ' : planLabelOf(e.categoryId, data.items);
  const title = e.note || cat?.name || 'อื่น ๆ';
  const sub = e.note ? cat?.name : e.type === 'income' ? 'รายรับ' : '';
  return (
    <li>
      <button className="lg-row" onClick={onOpen}>
        <span className="cat-ic" style={catStyle(cat)}><CatIcon icon={cat?.icon ?? 'other'} /></span>
        <span className="t"><span>{title}</span>
          <span className="tags">{e.type === 'expense' && <span className={`lg-tag${label ? ' in' : ' out'}`}>{label ? `งบ${label}` : 'นอกงบ'}</span>}{sub && <span>{sub}</span>}</span></span>
        <span className="a"><b className={`num${e.type === 'income' ? ' inc' : ''}`}>{e.type === 'income' ? '+' : ''}{baht(e.type === 'income' ? e.amountPaid : e.myShare)}</b>
          {e.type === 'expense' && e.myShare !== e.amountPaid && <span className="num">จาก {baht(e.amountPaid)}</span>}</span>
      </button>
    </li>
  );
}
