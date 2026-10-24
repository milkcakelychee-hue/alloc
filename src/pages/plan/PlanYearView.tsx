// มุมมองปี (ตามบอร์ด PlanYear): การ์ดรายรับทั้งปี + เงินทั้งปีไปไหน · เทียบ 12 เดือน + รายละเอียดเดือน
// · รายละเอียดตามหมวด (แตะดูรายการ) · จุดที่ควรรู้ (สร้างจากตัวเลขในแผน) · คัดลอกแผนไปปีถัดไป
import { useState } from 'react';
import { db } from '../../db/db';
import type { GroupKind, Month, PlanItem } from '../../db/types';
import { thaiMonth } from '../../calc/dates';
import { formatBaht, pct1 } from '../../calc/money';
import { planTotals, type AmountOf } from '../../calc/plan';
import { copyYearToNext, itemChanges, yearMonths, yearSummary } from '../../calc/planYear';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import type { PlanData } from './usePlanData';
import { thaiMonthLong, type IconName } from './planUi';

const money = (s: number) => (s % 100 === 0 ? formatBaht(s, { decimals: false }) : formatBaht(s));
const mon = (m: Month) => thaiMonth(m).split(' ')[0];
const tick = (m: Month) => mon(m).replace(/\./g, '');
const pctS = (a: number, b: number) => `${pct1(a, b)}%`;

// สีตามบอร์ด PlanYear
const C = { fixed: '#D9583F', variable: '#E88A76', goalSpend: '#F2B880', saving: '#6F95D6', invest: '#2E5FB8', left: '#8FD0A8', exp: '#D9583F', sav: '#2E5FB8' };
type Cat = { key: string; name: string; kinds: GroupKind[]; icon: IconName; tone: string; bar: string; barMax: string };
const CATS: Cat[] = [
  { key: 'fixed', name: 'รายจ่ายคงที่', kinds: ['fixed'], icon: 'home', tone: 'fix', bar: '#D9583F', barMax: '#E0482B' },
  { key: 'variable', name: 'รายจ่ายผันแปร', kinds: ['variable'], icon: 'shop', tone: 'var', bar: '#F8BA77', barMax: '#F08A1C' },
  { key: 'goalSpend', name: 'รายจ่ายตามเป้า', kinds: ['goalSpend'], icon: 'bag', tone: 'var', bar: '#F8BA77', barMax: '#F08A1C' },
  { key: 'save', name: 'ออม + ลงทุน', kinds: ['saving', 'invest'], icon: 'trend', tone: 'sav', bar: '#85B3F2', barMax: '#2E7BE6' }
];

export function PlanYearView({ data, year, current, amountOf, onPickMonth }: {
  data: PlanData; year: number; current: Month; amountOf: AmountOf; onPickMonth: (m: Month) => void;
}) {
  const { groups, items } = data;
  const y = yearSummary(groups, items, year, amountOf);
  const months = yearMonths(year);
  const [sel, setSel] = useState<Month | null>(null);
  const [whOpen, setWhOpen] = useState(true);
  const [catOpen, setCatOpen] = useState<Cat | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  if (y.activeMonths === 0) {
    return <div className="card empty"><strong>ยังไม่มีแผนปี <span className="num">{year + 543}</span></strong><span>เพิ่มรายรับใน<span className="nw">แผนรายเดือน</span>ก่อน</span></div>;
  }
  const active = y.months.filter((x) => x.t.income > 0);
  const picked = sel ?? (active.some((x) => x.month === current) ? current : y.minLeft!.month);
  const pm = y.months.find((x) => x.month === picked)!;
  const minLeftVal = y.minLeft!.leftover;
  const lowMonths = active.filter((x) => x.t.leftover === minLeftVal).map((x) => x.month);
  const lowLabel = lowMonths.length > 1 ? `${mon(lowMonths[0])}–${mon(lowMonths[lowMonths.length - 1])}` : mon(lowMonths[0]);
  const slices = ([
    { k: 'fixed', label: 'รายจ่ายคงที่', v: y.fixed }, { k: 'variable', label: 'รายจ่ายผันแปร', v: y.variable },
    { k: 'goalSpend', label: 'รายจ่ายตามเป้าหมาย', v: y.goalSpend }, { k: 'saving', label: 'ออม', v: y.saving },
    { k: 'invest', label: 'ลงทุน', v: y.invest }, { k: 'left', label: 'เหลือ', v: Math.max(y.leftover, 0) }
  ] as { k: keyof typeof C; label: string; v: number }[]).filter((s) => s.v > 0);

  // สเกลกราฟ: ปัดขึ้นเป็นหลักหมื่น เส้นแนว 10k / 20k / 30k ตามบอร์ด
  const top = Math.max(...y.months.map((x) => Math.max(x.t.income, x.expense + x.saveInvest)), 1);
  const step = top > 4_000_000 ? 2_000_000 : 1_000_000; // สตางค์: 1,000,000 = 10k บาท
  const scale = Math.ceil(top / step) * step;
  const H = 150;
  const px = (v: number) => (Math.max(v, 0) / scale) * H;
  const ticks = Array.from({ length: Math.round(scale / step) }, (_, i) => (i + 1) * step);

  // จุดที่ควรรู้: สร้างจากตัวเลขในแผนเท่านั้น
  const changes = itemChanges(items, months, amountOf);
  const firstActive = active[0].month;
  const kindOf = (it: PlanItem) => groups.find((g) => g.id === it.groupId)?.kind;
  const isExpKind = (k?: GroupKind) => k === 'fixed' || k === 'variable' || k === 'goalSpend';
  const totalsAt = (m: Month) => planTotals(groups, items, m, amountOf);
  const notes: { dot: string; title: React.ReactNode; sub: React.ReactNode }[] = [];
  if (y.negative.length) notes.push({ dot: 'bad', title: <>แผนติดลบ <span className="num">{y.negative.length}</span> เดือน</>, sub: y.negative.map((n) => `${mon(n.month)} −${money(-n.leftover)}`).join(' · ') });
  if (y.maxExpense) {
    const why = changes.filter((c) => c.month === y.maxExpense!.month && c.kind !== 'ended' && isExpKind(kindOf(c.item)) && (c.kind === 'started' || c.to > c.from));
    notes.push({ dot: 'bad', title: <>{mon(y.maxExpense.month)} รายจ่ายสูงสุด <span className="num">{money(y.maxExpense.expense)}</span></>,
      sub: why.length ? why.slice(0, 2).map((c) => `${c.item.name} ${money(c.kind === 'ended' ? 0 : c.to)}`).join(' + ')
        : <>เฉลี่ยทั้งปี <span className="num">{money(Math.round((y.fixed + y.variable + y.goalSpend) / y.activeMonths))}</span>/เดือน</> });
  }
  const size = (c: (typeof changes)[number]) => (c.kind === 'changed' ? Math.abs(c.to - c.from) : c.kind === 'started' ? c.to : c.from);
  for (const c of changes.filter((c) => !(c.kind === 'started' && c.month <= firstActive)).sort((a, b) => size(b) - size(a)).slice(0, 3)) {
    const k = kindOf(c.item);
    const exp = isExpKind(k);
    const idx = months.indexOf(c.month);
    if (c.kind === 'ended') {
      const next = months[Math.min(idx + 1, 11)];
      notes.push({ dot: exp ? 'good' : 'warn', title: <>{c.item.name} จบ {mon(c.month)}</>,
        sub: exp && k && next !== c.month ? <>ตั้งแต่ {mon(next)} {k === 'fixed' ? 'รายจ่ายคงที่' : 'รายจ่าย'}ลดจาก <span className="num">{money(totalsAt(c.month)[k])}</span> เหลือ <span className="num">{money(totalsAt(next)[k])}</span></>
          : <>เดือนละ <span className="num">{money(c.from)}</span></> });
    } else {
      const up = c.kind === 'started' || c.to > c.from;
      const sr = (m: Month) => { const t = totalsAt(m); return pct1(t.saving + t.invest, t.income); };
      notes.push({ dot: exp ? (up ? 'bad' : 'good') : up ? 'save' : 'warn',
        title: <>{mon(c.month)} {c.item.name}{c.kind === 'started' ? ' เริ่ม' : up ? 'เพิ่มเป็น' : 'ลดเป็น'} <span className="num">{money(c.to)}</span></>,
        sub: c.kind === 'changed'
          ? (exp ? <>จากเดิม <span className="num">{money(c.from)}</span></> : <>Savings Rate จาก <span className="num">{sr(months[Math.max(idx - 1, 0)])}%</span> เป็น <span className="num">{sr(c.month)}%</span></>)
          : <>เดือนละ <span className="num">{money(c.to)}</span></> });
    }
  }
  if (minLeftVal >= 0) notes.push({ dot: 'low', title: <>{lowLabel} เงินเหลือน้อยสุด <span className="num">{money(minLeftVal)}</span></>, sub: <>ลองดูแผน<span className="nw">เดือนนั้น</span>ก่อนเงินเดือนเข้า</> });

  const copied = copyYearToNext(items, year, amountOf);
  const nextLeftBefore = yearSummary(groups, items, year + 1, amountOf).leftover;
  const afterItems = items.map((i) => copied.find((c) => c.id === i.id) ?? i);
  const nextLeftAfter = yearSummary(groups, afterItems, year + 1, amountOf).leftover;
  const doCopy = async () => { await db.planItems.bulkPut(copied.map((c) => ({ ...c, updatedAt: Date.now() }))); setCopyOpen(false); };
  const noteChanges = changes.filter((c): c is Exclude<(typeof changes)[number], { kind: 'ended' }> => c.month === pm.month && c.kind !== 'ended');

  return (
    <div className="yr">
      <section className="hero yr-hero" aria-label={`ภาพรวมปี ${year + 543}`}>
        <div className="yr-h-top">
          <span className="l"><span>รายรับทั้งปี · <span className="num">{y.activeMonths}</span> เดือน</span><b className="num">{money(y.income)}</b></span>
          <span className="r"><span>Savings Rate</span><b className="num">{pctS(y.saving + y.invest, y.income)}</b></span>
        </div>
        <button className="yr-wh" aria-expanded={whOpen} onClick={() => setWhOpen(!whOpen)}>
          <span className="t"><span>เงินทั้งปีไปไหนบ้าง</span><span className="sub">{whOpen ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}<span style={{ display: 'flex', transform: whOpen ? 'rotate(180deg)' : undefined }}><Icon name="chevDown" size={14} stroke={2.2} /></span></span></span>
          <span className="bar" role="img" aria-label={slices.map((s) => `${s.label} ${pctS(s.v, y.income)}`).join(' · ')}>
            {slices.map((s) => <span key={s.k} style={{ flex: s.v, background: C[s.k] }} />)}
          </span>
        </button>
        {whOpen && (
          <div className="yr-wh-list">
            {slices.map((s) => (
              <div key={s.k}><i style={{ background: C[s.k] }} /><span className="n">{s.label}</span><b className="num">{money(s.v)}</b><span className="num p">{pctS(s.v, y.income)}</span></div>
            ))}
            {y.leftover < 0 && <div><i style={{ background: '#F8B9A9' }} /><span className="n">ใช้เกินรายรับ</span><b className="num">−{money(-y.leftover)}</b><span className="p" /></div>}
          </div>
        )}
      </section>

      <section className="card yr-chart" aria-label="เทียบ 12 เดือน">
        <div className="yr-c-top"><span><h2>เทียบ 12 เดือน</h2><span className="chip-plan">แผน</span></span><span className="muted">แตะเดือนเพื่อดูตัวเลข</span></div>
        <p className="yr-sum">ออม+ลงทุนเฉลี่ย <b className="num">{Math.round(y.savingsRate * 100)}%</b> ของรายรับ · เดือนที่เงินเหลือน้อยสุดคือ <b>{lowLabel}</b> (<span className="num nw">{minLeftVal < 0 ? '−' : ''}{money(Math.abs(minLeftVal))} บาท</span>)</p>
        <div className="yr-leg">
          <span><i style={{ background: C.exp }} />รายจ่าย</span><span><i style={{ background: C.sav }} />ออม+ลงทุน</span><span><i style={{ background: C.left }} />เหลือ</span>
          <span><i className="dash" />รายรับ</span><span className="low"><small>▼</small>เหลือน้อยสุด</span>
        </div>
        <div className="yr-plot">
          <div className="yr-grid" aria-hidden="true">
            {ticks.map((v) => <span key={v} style={{ bottom: px(v) }}><small className="num">{v / 100_000}k</small></span>)}
          </div>
          <div className="yr-bars" role="group" aria-label={`แท่งรายเดือน ปี ${year + 543}`}>
            {y.months.map((x) => {
              if (x.t.income <= 0 && x.expense + x.saveInvest <= 0) return <span key={x.month} className="yr-none"><span /></span>;
              const neg = x.t.leftover < 0;
              return (
                <button key={x.month} className={`yr-col${x.month === picked ? ' on' : ''}`} onClick={() => setSel(x.month)} aria-pressed={x.month === picked}
                  aria-label={`${thaiMonth(x.month)} เหลือ ${neg ? '−' : ''}${money(Math.abs(x.t.leftover))}`}>
                  {lowMonths.includes(x.month) && <span className="low-mk" aria-hidden="true">▼</span>}
                  {x.t.income > 0 && <span className="inc" style={{ bottom: px(x.t.income) }} />}
                  {x.t.leftover > 0 && <span className="ybar" style={{ height: px(x.t.leftover), background: C.left }} />}
                  {x.saveInvest > 0 && <span className="ybar" style={{ height: px(x.saveInvest), background: C.sav, boxShadow: neg ? `0 0 0 1.5px ${C.exp}` : undefined }} />}
                  {x.expense > 0 && <span className="ybar" style={{ height: px(x.expense), background: C.exp }} />}
                </button>
              );
            })}
          </div>
          <div className="yr-ticks">{months.map((m) => <span key={m} className={m === picked ? 'on' : ''}>{tick(m)}</span>)}</div>
        </div>
        <div className="yr-detail" aria-live="polite">
          <div className="top"><b className="num">{thaiMonthLong(pm.month)}</b><button className="link-btn" onClick={() => onPickMonth(pm.month)}>ดูแผนเดือนนี้ ›</button></div>
          <div className="big"><span>เหลือ</span><b className={`num ${pm.t.leftover < 0 ? 'neg' : 'pos'}`}>{pm.t.leftover < 0 ? '−' : ''}{money(Math.abs(pm.t.leftover))}</b><span>บาท</span></div>
          <span className="sub num">ออม+ลงทุน {pctS(pm.saveInvest, pm.t.income)} ของรายรับ {money(pm.t.income)}</span>
          <span className="bar" role="img" aria-label="สัดส่วนรายรับเดือนนี้">
            <span style={{ width: `${Math.min(pm.expense / Math.max(pm.t.income, 1), 1) * 100}%`, background: C.exp }} />
            <span style={{ width: `${Math.min(pm.saveInvest / Math.max(pm.t.income, 1), 1) * 100}%`, background: C.sav }} />
            <span style={{ flex: 1, background: C.left }} />
          </span>
          <div className="rows num">
            <div><i style={{ background: C.exp }} /><span>รายจ่าย</span><b>{money(pm.expense)}</b><span className="p">{pctS(pm.expense, pm.t.income)}</span></div>
            <div><i style={{ background: C.sav }} /><span>ออม+ลงทุน</span><b>{money(pm.saveInvest)}</b><span className="p">{pctS(pm.saveInvest, pm.t.income)}</span></div>
            <div><i style={{ background: C.left }} /><span>เหลือ</span><b>{pm.t.leftover < 0 ? '−' : ''}{money(Math.abs(pm.t.leftover))}</b><span className="p">{pctS(Math.max(pm.t.leftover, 0), pm.t.income)}</span></div>
          </div>
          {noteChanges.length > 0 && <span className="note-line">เดือนนี้{noteChanges.slice(0, 2).map((c) => ` ${c.item.name}${c.kind === 'started' ? ' เริ่ม' : c.to > c.from ? 'ขึ้นเป็น' : 'ลดเป็น'} ${money(c.to)}`).join(' ·')}</span>}
        </div>
      </section>

      <section className="card yr-cats" aria-label={`รายละเอียดตามหมวด ${year + 543}`}>
        <div className="head"><h2>รายละเอียดตามหมวด</h2><span className="muted">แตะเพื่อดูแต่ละรายการ</span></div>
        {CATS.map((c) => {
          const per = y.months.map((x) => c.kinds.reduce((s, k) => s + x.t[k], 0));
          const total = per.reduce((a, b) => a + b, 0);
          if (total <= 0) return null;
          const max = Math.max(...per);
          const maxM = y.months[per.indexOf(max)].month;
          const ids = new Set(groups.filter((g) => g.enabled && c.kinds.includes(g.kind)).map((g) => g.id));
          const count = items.filter((i) => ids.has(i.groupId) && months.some((m) => amountOf(i, m) > 0)).length;
          const avg = Math.round(total / y.activeMonths);
          const varied = per.some((x) => x > 0 && x < max);
          return (
            <button key={c.key} className={`cat t-${c.tone}`} onClick={() => setCatOpen(c)} aria-haspopup="dialog">
              <span className="r1">
                <span className="ic"><Icon name={c.icon} size={20} stroke={2} /></span>
                <span className="n"><b>{c.name}</b><small className="num">{count} รายการ</small></span>
                <span className="v"><b className="num">{money(total)}</b><small className="num">{pctS(total, y.income)} ของรายรับ</small></span>
                <Icon name="chevron" size={16} stroke={2} />
              </span>
              <span className="r2">
                <span className="spark" aria-hidden="true">
                  {per.map((v, i) => v > 0
                    ? <span key={i} style={{ height: `${Math.max((v / max) * 26, 3)}px`, background: v === max && varied ? c.barMax : c.bar }} />
                    : <span key={i} className="nil" />)}
                </span>
                <small className="num">เฉลี่ย {money(avg)}/เดือน{varied ? ` · สูงสุด ${mon(maxM)} ${money(max)}` : ''}</small>
              </span>
            </button>
          );
        })}
      </section>

      {notes.length > 0 && (
        <section className="card yr-notes" aria-label={`จุดที่ควรรู้ปี ${year + 543}`}>
          <h2>จุดที่ควรรู้ปีนี้</h2>
          {notes.map((n, i) => (
            <div key={i} className="note-row"><i className={n.dot} /><span><b>{n.title}</b><small className="num">{n.sub}</small></span></div>
          ))}
        </section>
      )}

      <button className="btn btn-ghost yr-copy" onClick={() => setCopyOpen(true)} disabled={copied.length === 0}>
        <Icon name="copy" size={18} stroke={2} />คัดลอกแผน <span className="num">{year + 543}</span> ไปปี <span className="num">{year + 544}</span>
      </button>

      {catOpen && <CatSheet cat={catOpen} data={data} year={year} amountOf={amountOf} income={y.income} activeN={y.activeMonths} onClose={() => setCatOpen(null)} onPlan={(m) => { setCatOpen(null); onPickMonth(m); }} />}
      {copyOpen && (
        <Sheet title={`คัดลอกแผน ${year + 543} ไปปี ${year + 544}`} onClose={() => setCopyOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>ยอดแต่ละเดือนของปี <span className="num">{year + 543}</span> จะไปเป็น<span className="nw">ยอดของเดือนเดียวกัน</span>ในปี <span className="num">{year + 544}</span> · <span className="nw">รายการที่จบในปีนี้ไม่ถูกคัดลอก</span> · ยอดที่ตั้งไว้ในปีหน้าแล้ว<span className="nw">จะถูกแทนที่</span></p>
            <div className="note"><Icon name="info" size={16} stroke={2} /><span>เปลี่ยน <b className="num">{copied.length}</b> รายการ · เงินเหลือทั้งปี <span className="num nw">{year + 544}</span> จาก <b className="num">{money(nextLeftBefore)}</b> เป็น <b className="num">{money(nextLeftAfter)}</b></span></div>
            <button className="btn btn-pri" onClick={doCopy}>คัดลอก</button>
            <button className="btn btn-ghost" onClick={() => setCopyOpen(false)}>ยกเลิก</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** แผ่นรายการในหมวด (ตามบอร์ด PlanYear: รวมทั้งปี / เฉลี่ย / ของรายรับ + กราฟ 12 เดือน + รายการ) */
function CatSheet({ cat, data, year, amountOf, income, activeN, onClose, onPlan }: {
  cat: Cat; data: PlanData; year: number; amountOf: AmountOf; income: number; activeN: number; onClose: () => void; onPlan: (m: Month) => void;
}) {
  const months = yearMonths(year);
  const ids = new Set(data.groups.filter((g) => g.enabled && cat.kinds.includes(g.kind)).map((g) => g.id));
  const list = data.items.filter((i) => ids.has(i.groupId) && months.some((m) => amountOf(i, m) > 0));
  const per = months.map((m) => list.reduce((s, i) => s + amountOf(i, m), 0));
  const sum = per.reduce((a, b) => a + b, 0);
  const max = Math.max(...per, 1);
  const desc = (it: PlanItem) => {
    const a = months.map((m) => amountOf(it, m));
    const on = a.filter((x) => x > 0);
    if (on.every((x) => x === on[0]) && on.length === activeN) return `${money(on[0])} ทุกเดือน`;
    const hi = Math.max(...on), lo = Math.min(...on);
    const gap = Math.max(activeN - on.length, 0);
    return [`สูงสุด ${mon(months[a.indexOf(hi)])} ${money(hi)}`, lo !== hi ? `ต่ำสุด ${mon(months[a.indexOf(lo)])} ${money(lo)}` : '', gap > 0 ? `ว่าง ${gap} เดือน` : ''].filter(Boolean).join(' · ');
  };
  return (
    <Sheet title={cat.name} onClose={onClose}>
      <div className={`cat-sheet t-${cat.tone}`}>
        <span className="muted" style={{ fontSize: 13, marginTop: -8 }}>ปี <span className="num">{year + 543}</span> · <span className="num">{list.length}</span> รายการ</span>
        <div className="kpis num">
          <div className="k1"><small>รวมทั้งปี</small><b>{money(sum)}</b></div>
          <div><small>เฉลี่ย/เดือน</small><b>{money(Math.round(sum / activeN))}</b></div>
          <div><small>ของรายรับ</small><b>{pctS(sum, income)}</b></div>
        </div>
        <div className="mbars" role="img" aria-label={`ยอด${cat.name}รายเดือน`}>
          {per.map((v, i) => (
            <span key={i}>
              {v === max && v > 0 && <small className="num">{(v / 100_000).toFixed(1)}k</small>}
              <span className="b" style={{ height: v > 0 ? `${(v / max) * 100}px` : '3px', background: v > 0 ? cat.bar : 'var(--line)' }} />
              <em>{tick(months[i])}</em>
            </span>
          ))}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)' }}>รายการในหมวดนี้</span>
        <div className="list">
          {list.map((it) => (
            <div key={it.id} className="row">
              <span className="tx"><span className="t1">{it.name}</span><span className="t2 num">{desc(it)}</span></span>
              <span className="val num" style={{ fontWeight: 700, color: 'var(--ink)' }}>{money(months.reduce((s, m) => s + amountOf(it, m), 0))}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={() => onPlan(months.find((_, i) => per[i] > 0) ?? months[0])}>แก้ในแผนรายเดือน</button>
      </div>
    </Sheet>
  );
}
