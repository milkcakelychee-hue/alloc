// มุมมอง 3 เดือน (ต้นแบบ PlanMonthsB): ตาราง รายการ × 3 เดือน · ยอดที่เปลี่ยนจากเดือนก่อนตัวหนา + ▲▼
import type { GroupKind, Month, PlanItem } from '../../db/types';
import { addMonths, thaiMonth } from '../../calc/dates';
import { formatBaht } from '../../calc/money';
import { planTotals, type AmountOf } from '../../calc/plan';
import type { PlanData } from './usePlanData';
import { TONE } from './planUi';

const money = (s: number) => (s === 0 ? '–' : s % 100 === 0 ? formatBaht(s, { decimals: false }) : formatBaht(s));
const signed = (s: number) => `${s > 0 ? '+' : s < 0 ? '−' : ''}${money(Math.abs(s)) === '–' ? '0' : money(Math.abs(s))}`;

export function PlanThree({ data, month, current, amountOf, onEdit }: {
  data: PlanData; month: Month; current: Month; amountOf: AmountOf; onEdit: (item: PlanItem, m: Month) => void;
}) {
  const { groups, items } = data;
  const months = [addMonths(month, -1), month, addMonths(month, 1)];
  const totals = months.map((m) => planTotals(groups, items, m, amountOf));
  const enabled = groups.filter((g) => g.enabled);
  const cell = (prev: number, cur: number, key: string, bold = false) => {
    const up = cur > prev && prev > 0, down = cur < prev && cur > 0, start = prev === 0 && cur > 0;
    return (
      <span key={key} className={`c num${cur !== prev ? ' chg' : ''}${bold ? ' b' : ''}`}>
        {(up || start) && cur !== prev && <i className="up" aria-label="เพิ่มขึ้น">▲</i>}
        {(down || (prev > 0 && cur === 0)) && <i className="down" aria-label="ลดลง">▼</i>}
        {money(cur)}
      </span>
    );
  };
  return (
    <section className="three" aria-label="เทียบ 3 เดือน">
      <div className="t-row t-head">
        <span className="n">รายการ · <span className="nw">เงินเหลือ</span></span>
        {months.map((m, i) => (
          <span key={m} className={`c${m === current ? ' now' : ''}`}>
            <small>{m === current ? 'เดือนนี้' : ' '}</small>
            <b>{thaiMonth(m).split(' ')[0]}</b>
            <small className={`num${totals[i].leftover < 0 ? ' neg' : ''}`}>{signed(totals[i].leftover)}</small>
          </span>
        ))}
      </div>
      {enabled.map((g) => {
        const list = items.filter((it) => it.groupId === g.id && months.some((m) => amountOf(it, m) > 0));
        if (list.length === 0) return null;
        const prevMonth = addMonths(months[0], -1);
        return (
          <div key={g.id} className={`t-group tone-${TONE[g.kind as GroupKind]}`}>
            <div className="t-row t-gh">
              <span className="n">{g.name}</span>
              {months.map((m, i) => <span key={m} className="c num b">{money(totals[i][g.kind])}</span>)}
            </div>
            {list.map((it) => (
              <button key={it.id} className="t-row t-item" onClick={() => onEdit(it, month)}>
                <span className="n">{it.name}</span>
                {months.map((m, i) => cell(amountOf(it, i ? months[i - 1] : prevMonth), amountOf(it, m), m))}
              </button>
            ))}
          </div>
        );
      })}
      <div className="t-row t-left">
        <span className="n">เงินเหลือ</span>
        {totals.map((t, i) => <span key={months[i]} className={`c num b${t.leftover < 0 ? ' neg' : ''}`}>{money(t.leftover) === '–' ? '0' : (t.leftover < 0 ? '−' : '') + money(Math.abs(t.leftover))}</span>)}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '6px 2px 0' }}>ตัวหนา = <span className="nw">เปลี่ยนจากเดือนก่อน</span> · แตะรายการเพื่อแก้ยอดเดือน <span className="num nw">{thaiMonth(month)}</span></p>
    </section>
  );
}
