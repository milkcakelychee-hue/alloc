// มุมมองปี (ต้นแบบ PlanYear): รายรับทั้งปี · เงินทั้งปีไปไหน · เทียบ 12 เดือน · รายละเอียดตามหมวด · จุดที่ควรรู้
import { useState } from 'react';
import type { GroupKind, Month } from '../../db/types';
import { thaiMonth } from '../../calc/dates';
import { formatBaht, pct1 } from '../../calc/money';
import type { AmountOf } from '../../calc/plan';
import { itemChanges, yearMonths, yearSummary } from '../../calc/planYear';
import { Icon } from '../../components/Icon';
import type { PlanData } from './usePlanData';
import { thaiMonthLong } from './planUi';

const money = (s: number) => (s % 100 === 0 ? formatBaht(s, { decimals: false }) : formatBaht(s));
const mon = (m: Month) => thaiMonth(m).split(' ')[0];
const GROUP_NAME: Record<GroupKind, string> = { income: 'รายรับ', fixed: 'รายจ่ายคงที่', variable: 'รายจ่ายผันแปร', goalSpend: 'รายจ่ายตามเป้าหมาย', saving: 'ออม', invest: 'ลงทุน' };
// สีหมวดในกราฟ: ลำดับตายตัวจากชุดสีกราฟในสเปก (ตรวจ CVD แล้ว)
const SLICE: Record<string, string> = { fixed: 'var(--c1)', variable: 'var(--c3)', goalSpend: 'var(--c4)', saving: 'var(--c2)', invest: 'var(--c5)', left: 'var(--c6)' };

export function PlanYearView({ data, year, current, amountOf, onPickMonth }: {
  data: PlanData; year: number; current: Month; amountOf: AmountOf; onPickMonth: (m: Month) => void;
}) {
  const { groups, items } = data;
  const y = yearSummary(groups, items, year, amountOf);
  const months = yearMonths(year);
  const [sel, setSel] = useState<Month | null>(null);
  if (y.activeMonths === 0) {
    return <div className="card empty"><strong>ยังไม่มีแผนปี <span className="num">{year + 543}</span></strong><span>เพิ่มรายรับใน<span className="nw">แผนรายเดือน</span>ก่อน</span></div>;
  }
  const picked = sel ?? (months.includes(current) ? current : y.minLeft!.month);
  const pm = y.months.find((x) => x.month === picked)!;
  const slices = [
    // เรียงตามลำดับสีในสเปก (c1–c6) ให้สีที่อยู่ติดกันแยกออกได้ทั้งคนตาบอดสี
    ...(['fixed', 'saving', 'variable', 'goalSpend', 'invest'] as const).map((k) => ({ key: k, label: GROUP_NAME[k], value: y[k] })),
    { key: 'left', label: 'เหลือ', value: Math.max(y.leftover, 0) }
  ].filter((s) => s.value > 0);
  const scale = Math.max(...y.months.map((x) => Math.max(x.t.income, x.expense + x.saveInvest)), 1);

  // จุดที่ควรรู้: สร้างจากตัวเลขในแผนเท่านั้น
  const changes = itemChanges(items, months, amountOf);
  const notes: { tone: string; title: React.ReactNode; sub: React.ReactNode }[] = [];
  if (y.negative.length) notes.push({ tone: 'danger', title: <>แผนติดลบ <span className="num">{y.negative.length}</span> เดือน</>,
    sub: y.negative.map((n) => `${mon(n.month)} −${money(-n.leftover)}`).join(' · ') });
  if (y.maxExpense) notes.push({ tone: 'warning', title: <><span className="nw">{mon(y.maxExpense.month)} รายจ่ายสูงสุด</span> <span className="num">{money(y.maxExpense.expense)}</span></>,
    sub: changes.filter((c) => c.month === y.maxExpense!.month && c.kind !== 'ended').slice(0, 2).map((c) => `${c.item.name} ${money(c.kind === 'changed' ? c.to : c.kind === 'started' ? c.to : 0)}`).join(' + ') || 'ดูรายละเอียดในแผนเดือนนั้น' });
  // รายการที่เริ่มพร้อมเดือนแรกของแผน ไม่ใช่ "การเปลี่ยน" จึงไม่นับเป็นจุดที่ควรรู้
  const firstActive = y.months.find((x) => x.t.income > 0)!.month;
  for (const c of changes.filter((c) => !(c.kind === 'started' && c.month <= firstActive)).sort((a, b) => {
    const size = (x: typeof a) => (x.kind === 'changed' ? Math.abs(x.to - x.from) : x.kind === 'started' ? x.to : x.from);
    return size(b) - size(a);
  }).slice(0, 3)) {
    if (c.kind === 'changed') notes.push({ tone: 'plain', title: <>{c.item.name}{c.to > c.from ? 'ขึ้น' : 'ลด'}เป็น <span className="num">{money(c.to)}</span> ตั้งแต่ <span className="nw">{mon(c.month)}</span></>, sub: <>จากเดิม <span className="num">{money(c.from)}</span></> });
    if (c.kind === 'started') notes.push({ tone: 'plain', title: <>{c.item.name} เริ่ม <span className="nw">{mon(c.month)}</span></>, sub: <>เดือนละ <span className="num">{money(c.to)}</span></> });
    if (c.kind === 'ended') notes.push({ tone: 'plain', title: <>{c.item.name} จบ <span className="nw">{mon(c.month)}</span></>, sub: <>ตั้งแต่เดือนถัดไป<span className="nw">ไม่มียอดนี้</span> (<span className="num">{money(c.from)}</span>/เดือน)</> });
  }

  return (
    <div className="year">
      <section className="card y-top">
        <div className="y-k"><span className="muted">รายรับทั้งปี · <span className="num">{y.activeMonths}</span> เดือน</span><b className="num">{money(y.income)}</b></div>
        <div className="y-k right"><span className="muted">Savings Rate</span><b className="num">{pct1(y.saving + y.invest, y.income)}%</b></div>
      </section>

      <section className="card y-where" aria-labelledby="y-where">
        <h3 id="y-where">เงินทั้งปีไปไหนบ้าง</h3>
        <div className="y-bar" role="img" aria-label={slices.map((s) => `${s.label} ${pct1(s.value, y.income)}%`).join(' · ')}>
          {slices.map((s) => <span key={s.key} style={{ flex: s.value, background: SLICE[s.key] }} />)}
        </div>
        {slices.map((s) => (
          <div key={s.key} className="y-leg"><i style={{ background: SLICE[s.key] }} /><span className="l">{s.label}</span>
            <span className="num v">{money(s.value)}</span><span className="num p">{pct1(s.value, y.income)}%</span></div>
        ))}
        {y.leftover < 0 && <div className="y-leg"><i style={{ background: 'var(--danger)' }} /><span className="l">ใช้เกินรายรับ</span><span className="num v neg">−{money(-y.leftover)}</span><span className="p" /></div>}
      </section>

      <section className="card y-chart" aria-labelledby="y-chart">
        <div className="y-ch-top"><h3 id="y-chart">เทียบ 12 เดือน</h3><span className="muted">แตะเดือนเพื่อดูตัวเลข</span></div>
        <div className="y-legend"><span><i style={{ background: 'var(--c1)' }} />รายจ่าย</span><span><i style={{ background: 'var(--c2)' }} />ออม+ลงทุน</span><span><i style={{ background: 'var(--c6)' }} />เหลือ</span><span><i className="inc" />รายรับ</span></div>
        <div className="y-bars" role="group" aria-label="แผน 12 เดือน">
          {y.months.map((x) => {
            const h = (v: number) => `${(Math.max(v, 0) / scale) * 100}%`;
            const active = x.t.income > 0;
            return (
              <button key={x.month} className={`y-col${x.month === picked ? ' on' : ''}${x.t.leftover < 0 ? ' minus' : ''}`} onClick={() => setSel(x.month)}
                aria-pressed={x.month === picked} aria-label={`${thaiMonthLong(x.month)} รายจ่าย ${money(x.expense)} ออมและลงทุน ${money(x.saveInvest)} เหลือ ${money(x.t.leftover)}`}>
                <span className="y-stack">
                  {active && <span className="inc" style={{ bottom: h(x.t.income) }} />}
                  {x.t.leftover > 0 && <span style={{ height: h(x.t.leftover), background: 'var(--c6)' }} />}
                  {x.saveInvest > 0 && <span style={{ height: h(x.saveInvest), background: 'var(--c2)' }} />}
                  {x.expense > 0 && <span style={{ height: h(x.expense), background: 'var(--c1)' }} />}
                  {!active && <span className="none" />}
                </span>
                <small>{mon(x.month).replace('.', '').replace('.', '')}</small>
              </button>
            );
          })}
        </div>
        <div className="y-detail">
          <div className="y-d-top"><b>{thaiMonthLong(pm.month)}</b><button className="link-btn" onClick={() => onPickMonth(pm.month)}>ดูแผนเดือนนี้ ›</button></div>
          <div className="y-d-row"><span>รายรับ</span><span className="num">{money(pm.t.income)}</span></div>
          <div className="y-d-row"><span><i style={{ background: 'var(--c1)' }} />รายจ่าย</span><span className="num">{money(pm.expense)} <small>{pct1(pm.expense, pm.t.income)}%</small></span></div>
          <div className="y-d-row"><span><i style={{ background: 'var(--c2)' }} />ออม+ลงทุน</span><span className="num">{money(pm.saveInvest)} <small>{pct1(pm.saveInvest, pm.t.income)}%</small></span></div>
          <div className="y-d-row b"><span><i style={{ background: 'var(--c6)' }} />เหลือ</span><span className={`num${pm.t.leftover < 0 ? ' neg' : ''}`}>{pm.t.leftover < 0 ? '−' : ''}{money(Math.abs(pm.t.leftover))}</span></div>
        </div>
      </section>

      <section aria-labelledby="y-groups" className="y-groups">
        <h3 id="y-groups">รายละเอียดตามหมวด</h3>
        {y.groups.filter((g) => g.total > 0).map((g) => (
          <div key={g.kind} className="card y-g">
            <div className="y-g-top"><i style={{ background: SLICE[g.kind] }} /><b>{GROUP_NAME[g.kind]}</b><span className="muted num">{g.items} รายการ</span><b className="num">{money(g.total)}</b></div>
            <span className="t2"><span className="num">{pct1(g.total, y.income)}%</span> ของรายรับ · <span className="nw">เฉลี่ย <span className="num">{money(g.avg)}</span>/เดือน</span>{g.max && g.max.amount > g.avg && <> · <span className="nw">สูงสุด {mon(g.max.month)} <span className="num">{money(g.max.amount)}</span></span></>}</span>
          </div>
        ))}
      </section>

      {notes.length > 0 && (
        <section aria-labelledby="y-notes" className="y-notes">
          <h3 id="y-notes">จุดที่ควรรู้ปีนี้</h3>
          {notes.map((n, i) => (
            <div key={i} className={`y-note ${n.tone}`}>
              <span className="ic"><Icon name={n.tone === 'danger' ? 'alert' : n.tone === 'warning' ? 'chart' : 'info'} size={18} stroke={2} /></span>
              <span className="tx"><span className="t1">{n.title}</span><span className="t2">{n.sub}</span></span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
