// รายละเอียดหมวด (จากหน้าเงินไปไหน): ยอดรอบนี้ · กราฟ 6 รอบ · ตัวเลขสรุป · ประวัติทุกรายการแบ่งตามรอบ
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { LogEntry, Month } from '../../db/types';
import { appCycle, localToday, thaiDate, thaiMonth } from '../../calc/dates';
import { budgetPools, categoryBudget, entryCycle, expensesIn, fundedItems } from '../../calc/log';
import { categoryHistory, planLabelOf } from '../../calc/logView';
import { goalAwareAmountOf } from '../../calc/goals';
import { Icon } from '../../components/Icon';
import { baht } from '../goals/goalUi';
import { thaiMonthLong } from '../plan/planUi';
import { EntryRow } from '../Log';
import { CatIcon, catStyle } from './catIcon';
import { EntrySheet } from './EntrySheet';
import { useLogData, dayFull } from './useLogData';
import { weekday } from '../../calc/payday';

const mon = (m: Month) => thaiMonth(m).split(' ')[0];
const dm = (d: string) => thaiDate(d).split(' ').slice(0, 2).join(' ');
const r100 = (v: number) => Math.round(v / 100) * 100;

export default function LogCat() {
  const { id = '' } = useParams();
  const data = useLogData();
  const nav = useNavigate();
  const [open, setOpen] = useState<LogEntry | null>(null);
  if (!data?.settings) return null;
  const s = data.settings;
  const today = localToday();
  const cur = appCycle(today, s.pay, s.startCycle);
  const cat = data.categories.find((c) => c.id === id);
  const name = cat?.name ?? 'อื่น ๆ';
  const amountOf = goalAwareAmountOf(data.goals, data.items, data.adjustments, cur);

  const h = categoryHistory(data.entries, id, s.pay, cur);
  const now = h.rows[h.rows.length - 1];
  const funded = fundedItems(data.items, cur, amountOf);
  const label = planLabelOf(id, funded);
  const exp = expensesIn(data.entries, cur, s.pay);
  const b = label ? categoryBudget(id, data.items, exp, cur, amountOf) : null;
  // เส้นงบในกราฟ: งบของกลุ่มที่หมวดนี้ผูกในแต่ละรอบ (ไม่มีงบ = ไม่มีเส้น)
  const pool = budgetPools(data.items).find((p) => p.cats.includes(id));
  const budgetAt = (m: Month) => (pool ? pool.items.reduce((a, i) => a + amountOf(i, m), 0) : 0);
  const sharedPool = !!pool && pool.cats.length > 1;
  const max = Math.max(...h.rows.map((r) => Math.max(r.total, sharedPool ? 0 : budgetAt(r.cycle))), 1);

  // ประวัติทุกรายการ ใหม่สุดก่อน แบ่งตามรอบ
  const all = data.entries.filter((e) => e.type === 'expense' && e.categoryId === id)
    .sort((a, b2) => (a.date === b2.date ? b2.updatedAt - a.updatedAt : a.date < b2.date ? 1 : -1));
  const byCycle = new Map<Month, LogEntry[]>();
  for (const e of all) { const c = entryCycle(e, s.pay); byCycle.set(c, [...(byCycle.get(c) ?? []), e]); }

  return (
    <main className="page lgp lgp-sub">
      <div className="lg-head">
        <button className="lg-sq" aria-label="กลับ" onClick={() => nav(-1)}><Icon name="back" size={20} stroke={2} /></button>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}><span style={{ fontSize: 12, color: 'var(--ink3)' }}>เงินไปไหน · หมวด</span><b style={{ fontSize: 20, fontWeight: 700 }}>{name}</b></span>
      </div>

      <section className="lgc-hero" aria-label={`${name} รอบนี้`}>
        <span className="cat-ic" style={{ ...catStyle(cat), width: 44, height: 44, borderRadius: 14 }}><CatIcon icon={cat?.icon ?? 'other'} /></span>
        <span className="k">รอบนี้ · {thaiMonthLong(cur)}</span>
        <b className="num">{baht(now.total)}</b>
        <span className="s num">จด {now.count} ครั้ง · {b ? (b.remaining! < 0 ? <>งบ{label} <span className="over">เกิน {baht(-b.remaining!)}</span> / {baht(b.budget!)}</> : <>งบ{label} เหลือ {baht(b.remaining!)} / {baht(b.budget!)}</>) : 'นอกงบ'}</span>
      </section>

      <section className="lgc-chart" aria-label="ยอด 6 รอบล่าสุด">
        <div className="h"><h2>6 รอบล่าสุด</h2>{pool && !sharedPool && <span className="lgk"><i />งบ</span>}</div>
        <div className="bars">
          {h.rows.map((r, i) => {
            const bud = pool && !sharedPool ? budgetAt(r.cycle) : 0;
            const last = i === h.rows.length - 1;
            return (
              <div key={r.cycle} className="col" aria-label={`${mon(r.cycle)} ${baht(r.total)}`}>
                <span className="v num">{r.total ? baht(r100(r.total)) : '–'}</span>
                <div className="area">
                  {bud > 0 && <span className="bud" style={{ bottom: `${(bud / max) * 100}%` }} />}
                  <span className={`bar${last ? ' now' : ''}${bud > 0 && r.total > bud ? ' over' : ''}`} style={{ height: `${Math.max((r.total / max) * 100, r.total ? 3 : 0)}%` }} />
                </div>
                <span className={`m${last ? ' now' : ''}`}>{mon(r.cycle)}</span>
              </div>
            );
          })}
        </div>
        {sharedPool && <span className="nt">หมวดนี้ใช้งบ{label ?? planLabelOf(id, data.items)}ร่วมกับหมวดอื่น จึงไม่แสดงเส้นงบ</span>}
      </section>

      <div className="lg-tiles">
        <div><span className="k">เฉลี่ยต่อรอบ</span><span className="v num">{baht(r100(h.avgPerCycle))}</span></div>
        <div><span className="k">จ่ายบ่อยแค่ไหน</span><span className="v num">{Math.round(h.perCycle * 10) / 10}</span><span className="s">ครั้งต่อรอบ</span></div>
        <div><span className="k">ครั้งละเฉลี่ย</span><span className="v num">{baht(r100(h.avgPerEntry))}</span></div>
      </div>

      <h2 className="lgc-hh">ประวัติทั้งหมด <span className="num">{all.length} รายการ</span></h2>
      {all.length === 0 ? <div className="lg-empty">ยังไม่มีรายการในหมวดนี้</div> : [...byCycle.entries()].map(([c, es]) => (
        <section key={c} className="lg-dayc lgc-cyc" aria-label={thaiMonthLong(c)}>
          <div className="h"><h2>{thaiMonthLong(c)}</h2><span className="num">{baht(es.reduce((a, e) => a + e.myShare, 0))}</span></div>
          <ul>
            {es.flatMap((e, i) => [
              ...(i === 0 || es[i - 1].date !== e.date ? [<li key={`d-${e.date}`} className="lgc-d num">{dayFull(weekday(e.date))} {dm(e.date)}</li>] : []),
              <EntryRow key={e.id} e={e} data={data} onOpen={() => setOpen(e)} />
            ])}
          </ul>
        </section>
      ))}
      {open && <EntrySheet entry={open} data={data} onClose={() => setOpen(null)} onEdit={() => nav(`/log/add?id=${open.id}`)} />}
    </main>
  );
}
