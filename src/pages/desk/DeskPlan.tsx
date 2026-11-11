// ตาราง 12 เดือนบนคอม (บอร์ด Desk-Plan-Paid / Desk-Plan12-1280 / -Folded / -Empty) · ขั้นที่ 2: ดูอย่างเดียว
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Month, Satang } from '../../db/types';
import { appCycle, localToday } from '../../calc/dates';
import { formatBaht } from '../../calc/money';
import { goalAwareAmountOf } from '../../calc/goals';
import { clampYear, kindTone, planGrid, yearBounds, type GridCell } from '../../calc/planGrid';
import { Icon } from '../../components/Icon';
import { DeskBar } from '../../components/DeskShell';
import { usePlanData } from '../plan/usePlanData';
import { DeskYear } from './DeskYear';

const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
type Tier = 'w' | 'm' | 's';
const COLS: Record<Tier, string> = {
  w: '160px repeat(12, minmax(0, 1fr)) 92px',
  m: '176px repeat(12, minmax(0, 1fr)) 84px',
  s: '150px repeat(12, minmax(0, 1fr)) 78px'
};

const signed = (s: Satang, f: (n: Satang) => string) => (s < 0 ? `−${f(-s)}` : f(s));
const full = (s: Satang) => signed(s, (n) => formatBaht(n));
const whole = (s: Satang) => signed(s, (n) => formatBaht(Math.round(n / 100) * 100, { decimals: false }));
/** รายการ: ช่องแคบแสดงสตางค์เฉพาะที่มีเศษ · แถวรวม: บาทถ้วน · กว้าง: ทศนิยม 2 ตำแหน่งทุกช่อง */
const fmtItem = (t: Tier, s: Satang) => (t === 'w' || s % 100 !== 0 ? full(s) : whole(s));
const fmtTot = (t: Tier, s: Satang) => (t === 'w' ? full(s) : whole(s));

export function YearPager({ year, min, max, onYear }: { year: number; min: number; max: number; onYear: (y: number) => void }) {
  return (
    <span className="dp-pager">
      <button className="ib sq" aria-label="ปีก่อน" disabled={year <= min} onClick={() => onYear(year - 1)}><Icon name="back" size={16} stroke={2} /></button>
      <span className="num yr">{year + 543}</span>
      <button className="ib sq" aria-label={`ปีถัดไป ${year + 544}`} disabled={year >= max} onClick={() => onYear(year + 1)}><Icon name="chevron" size={16} stroke={2} /></button>
    </span>
  );
}

export function DeskPlan() {
  const data = usePlanData();
  const [sp, setSp] = useSearchParams();
  const box = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<Tier>('w');
  const [folded, setFolded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width; setTier(w >= 1150 ? 'w' : w >= 990 ? 'm' : 's'); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [data?.settings]);

  if (!data?.settings) return null;
  const s = data.settings;
  const cur = appCycle(localToday(), s.pay, s.startCycle);
  const curYear = Number(cur.slice(0, 4));
  const bounds = yearBounds(data.items, curYear);
  const year = clampYear(Number(sp.get('y')) || curYear, bounds);
  const setYear = (y: number) => setSp((p) => { p.set('tab', 'plan'); p.set('y', String(y)); return p; });
  const amountOf = goalAwareAmountOf(data.goals, data.items, data.adjustments, cur);

  if (sp.get('view') === 'year') return <DeskYear data={data} year={year} bounds={bounds} cur={cur} amountOf={amountOf} />;

  const g = planGrid(data.groups, data.items, year, amountOf);
  const allFolded = g.groups.length > 0 && g.groups.every((x) => folded.has(x.group.id));
  const toggle = (id: string) => setFolded((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const empty = data.items.length === 0;

  const when = (m: Month) => (m < cur ? 'past' : m === cur ? 'cur' : 'fut');
  const cellCls = (m: Month) => `c num ${when(m)}`;
  const tri = (c: GridCell) => c.trend && <span className={`tri ${c.trend}`} aria-hidden="true">{c.trend === 'up' ? '▲' : '▼'}</span>;
  const cols = { gridTemplateColumns: COLS[tier] };

  return (
    <div className="dp">
      <DeskBar actions={
        <>
          <YearPager year={year} min={bounds.min} max={bounds.max} onYear={setYear} />
          <button className="ib pri" onClick={() => setYear(curYear)}>เดือนนี้</button>
          {!empty && <button className="ib line" onClick={() => setSp({ tab: 'plan', y: String(year), view: 'year' })}><Icon name="chart" size={16} stroke={2} />สรุปทั้งปี {year + 543}</button>}
        </>
      } />
      <div className="dp-legend">
        <span><b>หนา</b><i className="tri up">▲</i>เพิ่มขึ้น<i className="tri down">▼</i>ลดลง จากเดือนก่อน</span>
        <span><i className="sw hatch" />นอกช่วงที่มีผล</span>
        <span><i className="sw curbg" />เดือนนี้</span>
        <span>เดือนที่ผ่านแล้วสีจาง</span>
        <span className="sp" />
        {!empty && <button className="lnk" onClick={() => setFolded(allFolded ? new Set() : new Set(g.groups.map((x) => x.group.id)))}>{allFolded ? 'กางทุกหมวด' : 'พับทุกหมวด'}</button>}
      </div>
      <div className="dp-card" ref={box} role="table" aria-label={`แผนปี ${year + 543}`}>
        <div className="dp-row dp-head" style={cols} role="row">
          <span className="nm" role="columnheader">รายการ</span>
          {g.months.map((m, i) => (
            <span key={m} className={`c num ${when(m)}`} role="columnheader">{m === cur ? <span className="pill">{MON[i]}</span> : MON[i]}</span>
          ))}
          <span className="c tot" role="columnheader">รวมทั้งปี</span>
        </div>
        <div className="dp-body">
          {g.groups.map((gg) => {
            const open = !folded.has(gg.group.id);
            return (
              <div key={gg.group.id} role="rowgroup">
                <div className={`dp-row dp-grp t-${kindTone(gg.group.kind)}`} style={cols} role="row">
                  <button className="nm" aria-expanded={open} onClick={() => toggle(gg.group.id)}>
                    <span className="chev" style={open ? undefined : { transform: 'rotate(-90deg)' }}><Icon name="chevDown" size={14} stroke={2.2} /></span>
                    <span className="nw">{gg.group.name}</span><span className="num cnt">{gg.rows.length}</span>
                  </button>
                  {gg.totals.map((v, i) => <span key={i} className={cellCls(g.months[i])} title={full(v)}>{fmtTot(tier, v)}</span>)}
                  <span className="c num tot" title={full(gg.total)}>{fmtTot(tier, gg.total)}</span>
                </div>
                {open && gg.rows.map((r) => (
                  <div key={r.item.id} className="dp-row dp-item" style={cols} role="row">
                    <span className="nm" title={r.item.name}>{r.item.name}</span>
                    {r.cells.map((c) => c.amount === null
                      ? <span key={c.month} className={`${cellCls(c.month)} out`} aria-label="นอกช่วงที่มีผล" />
                      : <span key={c.month} className={`${cellCls(c.month)}${c.trend ? ' chg' : ''}`} title={full(c.amount)}>{tri(c)}{fmtItem(tier, c.amount)}</span>)}
                    <span className="c num tot" title={full(r.total)}>{fmtTot(tier, r.total)}</span>
                  </div>
                ))}
                {open && gg.rows.length === 0 && <div className="dp-none">ยังไม่มีรายการในหมวดนี้</div>}
              </div>
            );
          })}
          {empty && (
            <div className="dp-empty">
              <strong>ยังไม่มีรายการในแผน</strong>
              <span>เริ่มจากใส่รายรับ แล้วเพิ่มรายจ่าย ออม และลงทุนทีละหมวด</span>
            </div>
          )}
        </div>
        <div className="dp-foot" role="rowgroup">
          {([
            ['รวมรายรับ', 'inc', g.summary.income, g.yearTotal.income],
            ['รวมรายจ่าย', 'exp', g.summary.expense, g.yearTotal.expense],
            ['ออม + ลงทุน', 'sav', g.summary.saveInvest, g.yearTotal.saveInvest],
            ['เงินเหลือ', 'left', g.summary.leftover, g.yearTotal.leftover]
          ] as const).map(([label, tone, vs, yt]) => (
            <div key={label} className={`dp-row dp-sum s-${tone}`} style={cols} role="row">
              <span className="nm">{label}</span>
              {vs.map((v, i) => <span key={i} className={`${cellCls(g.months[i])}${tone === 'left' && v < 0 ? ' neg' : ''}`} title={full(v)}>{fmtTot(tier, v)}</span>)}
              <span className={`c num tot${tone === 'left' && yt < 0 ? ' neg' : ''}`} title={full(yt)}>{fmtTot(tier, yt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
