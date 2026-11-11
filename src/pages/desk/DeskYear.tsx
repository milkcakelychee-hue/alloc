// สรุปทั้งปีบนคอม (บอร์ด Desk-Plan-Year) · หน้าแยก เปิดจากปุ่ม "สรุปทั้งปี" ในตารางแผน
import { useNavigate } from 'react-router-dom';
import type { Month, Satang } from '../../db/types';
import { formatBaht, pct1 } from '../../calc/money';
import type { AmountOf } from '../../calc/plan';
import { yearSummary } from '../../calc/planYear';
import { Icon } from '../../components/Icon';
import { DeskBar } from '../../components/DeskShell';
import { buildYearNotes } from '../plan/PlanYearView';
import type { PlanData } from '../plan/usePlanData';
import { YearPager } from './DeskPlan';

const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const money = (s: Satang) => (s < 0 ? `−${formatBaht(-s)}` : formatBaht(s));
const whole = (s: Satang) => { const v = Math.round(Math.abs(s) / 100); return `${s < 0 ? '−' : ''}${v.toLocaleString('en-US')}`; };
const DOT: Record<string, string> = { bad: 'var(--danger)', good: 'var(--t-inc)', warn: 'var(--t-goal)', save: 'var(--t-sav)', low: 'var(--t-goal)' };

export function DeskYear({ data, year, bounds, cur, amountOf }: {
  data: PlanData; year: number; bounds: { min: number; max: number }; cur: Month; amountOf: AmountOf;
}) {
  const nav = useNavigate();
  const y = yearSummary(data.groups, data.items, year, amountOf);
  const notes = buildYearNotes(data.groups, data.items, year, amountOf);
  const toTable = () => nav(`/?tab=plan&y=${year}`);
  const bar = (
    <DeskBar
      lead={<button className="ib tall" onClick={toTable}><Icon name="back" size={16} stroke={2} />ตารางแผน</button>}
      actions={<YearPager year={year} min={bounds.min} max={bounds.max} onYear={(v) => nav(`/?tab=plan&y=${v}&view=year`)} />}
    />
  );
  if (y.activeMonths === 0) {
    return <div className="dy">{bar}<div className="card empty"><strong>ยังไม่มีแผนปี <span className="num">{year + 543}</span></strong><span>เพิ่มรายรับในตารางแผนก่อน</span></div></div>;
  }
  const saveInv = y.saving + y.invest;
  const slices = [
    { label: 'รายจ่ายคงที่', v: y.fixed, c: 'var(--t-exp)', o: 1 },
    { label: 'รายจ่ายผันแปร', v: y.variable, c: 'var(--t-exp)', o: 0.5 },
    { label: 'รายจ่ายตามเป้าหมาย', v: y.goalSpend, c: 'var(--t-goal)', o: 1 },
    { label: 'ออม', v: y.saving, c: 'var(--t-sav)', o: 1 },
    { label: 'ลงทุน', v: y.invest, c: 'var(--t-sav)', o: 0.5 },
    { label: 'เงินเหลือ', v: y.leftover, c: 'var(--t-inc)', o: 1 }
  ];
  const left = y.months.map((m) => m.t.leftover);
  const maxPos = Math.max(...left, 1);
  const maxNeg = Math.max(...left.map((v) => -v), 1);
  const scale = Math.max(maxPos, maxNeg);
  const POS = 150, NEG = 55;

  return (
    <div className="dy">
      {bar}
      <div className="dy-in">
        <div className="dy-cards">
          <div className="card dy-k"><span className="l">รายรับทั้งปี</span><b className="num">{money(y.income)}</b><span className="num s">เฉลี่ยเดือนละ {money(Math.round(y.income / y.activeMonths))}</span></div>
          <div className="card dy-k"><span className="l">เงินเหลือทั้งปี</span><b className={`num${y.leftover < 0 ? ' neg' : ''}`}>{money(y.leftover)}</b><span className="num s">รายรับ ลบ ทุกหมวด</span></div>
          <div className="card dy-k"><span className="l">Savings Rate</span><b className="num sav">{pct1(saveInv, y.income).toFixed(1)}%</b><span className="num s">ออม + ลงทุน {money(saveInv)}</span></div>
        </div>
        <div className="dy-two">
          <div className="card dy-chart">
            <h2>เงินเหลือรายเดือน</h2>
            <div className="bars" role="img" aria-label={`กราฟแท่งเงินเหลือ 12 เดือน: ${y.months.map((m, i) => `${MON[i]} ${whole(m.t.leftover)}`).join(', ')}`}>
              {y.months.map((m, i) => {
                const v = m.t.leftover;
                const isCur = m.month === cur;
                return (
                  <span key={m.month} className="col">
                    <span className="pos">
                      {v > 0 && <span className="num v">{whole(v)}</span>}
                      <span className="b" style={{ height: v > 0 ? Math.max((v / scale) * POS, 2) : 0, background: isCur ? 'var(--sel)' : 'var(--t-inc)', opacity: isCur ? 1 : 0.5 }} />
                    </span>
                    <span className="axis" />
                    <span className="negz">
                      <span className="b" style={{ height: v < 0 ? Math.max((-v / scale) * NEG, 2) : 0 }} />
                      {v < 0 && <span className="num v neg">{whole(v)}</span>}
                    </span>
                    <span className={`num m${isCur ? ' on' : ''}`}>{MON[i]}</span>
                  </span>
                );
              })}
            </div>
          </div>
          <div className="card dy-where">
            <h2>เงินทั้งปีไปไหน</h2>
            <span className="strip" aria-hidden="true">
              {slices.filter((s) => s.v > 0).map((s) => <span key={s.label} style={{ flex: s.v, background: s.c, opacity: s.o }} />)}
            </span>
            <div>
              {slices.map((s) => (
                <div key={s.label} className="wr">
                  <i style={{ background: s.c, opacity: s.o }} /><span className="n">{s.label}</span>
                  <b className={`num${s.v < 0 ? ' neg' : ''}`}>{money(s.v)}</b><span className="num p">{pct1(s.v, y.income).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {notes.length > 0 && (
          <div className="card dy-notes">
            <h2>จุดที่ควรรู้</h2>
            <div>
              {notes.map((n, i) => (
                <div key={i} className="nt">
                  <i style={{ background: DOT[n.dot] ?? 'var(--ink3)' }} />
                  <span className="tx"><span className="t1">{n.title}</span><span className="t2 num">{n.sub}</span></span>
                  <button className="ib lnk" onClick={toTable}>ดูในตาราง<Icon name="chevron" size={14} stroke={2} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
