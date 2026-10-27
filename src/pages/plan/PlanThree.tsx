// มุมมอง 3 เดือน (ตามบอร์ด PlanMonthsB): ตาราง รายการ × 3 เดือน เริ่มจากเดือนที่เลือก
// ยอดที่เปลี่ยนจากเดือนก่อนตัวหนา + ▲▼ · ออม + ลงทุนรวมเป็นกลุ่มเดียว · แตะตัวเลขเพื่อแก้ยอดเดือนนั้น
import type { GroupKind, Month, PlanItem } from '../../db/types';
import { addMonths, thaiMonth } from '../../calc/dates';
import { formatBaht, formatWhole } from '../../calc/money';
import { planTotals, type AmountOf } from '../../calc/plan';
import type { PlanData } from './usePlanData';

const money = (s: number) => (s === 0 ? '–' : formatWhole(s)); // ช่องแคบ: บาทเต็ม
const signed = (s: number) => (s === 0 ? '0' : `${s > 0 ? '+' : '−'}${money(Math.abs(s))}`);

type Row = { key: string; name: string; kinds: GroupKind[]; tone: string; up: string; down: string };
// สีหัวกลุ่มและลูกศรตามบอร์ด: รายจ่ายขึ้น = แดง ลง = เขียว · รายรับ/ออมขึ้น = น้ำเงิน ลง = น้ำตาล
const ROWS: Row[] = [
  { key: 'income', name: 'รายรับ', kinds: ['income'], tone: 'inc', up: 'good', down: 'warn' },
  { key: 'fixed', name: 'รายจ่ายคงที่', kinds: ['fixed'], tone: 'fix', up: 'bad', down: 'ok' },
  { key: 'variable', name: 'รายจ่ายผันแปร', kinds: ['variable'], tone: 'var', up: 'bad', down: 'ok' },
  { key: 'goalSpend', name: 'รายจ่ายตามเป้า', kinds: ['goalSpend'], tone: 'var', up: 'bad', down: 'ok' },
  { key: 'save', name: 'ออม + ลงทุน', kinds: ['saving', 'invest'], tone: 'sav', up: 'good', down: 'warn' }
];

export function PlanThree({ data, month, current, amountOf, onEdit }: {
  data: PlanData; month: Month; current: Month; amountOf: AmountOf; onEdit: (item: PlanItem, m: Month) => void;
}) {
  const { groups, items } = data;
  const months = [month, addMonths(month, 1), addMonths(month, 2)];
  const totals = months.map((m) => planTotals(groups, items, m, amountOf));
  const enabled = groups.filter((g) => g.enabled);
  const now = (m: Month) => (m === current ? ' now' : '');

  return (
    <section className="tri" aria-label={`ตารางเทียบ ${thaiMonth(months[0])} ถึง ${thaiMonth(months[2])}`}>
      <div className="tri-row tri-head">
        <span className="n">รายการ · เงินเหลือ</span>
        {months.map((m, i) => (
          <span key={m} className={`c${now(m)}`}>
            {m === current && <span className="pill">เดือนนี้</span>}
            <b>{thaiMonth(m).split(' ')[0]}</b>
            <span className={`num lft ${totals[i].leftover < 0 ? 'neg' : 'pos'}`}>{signed(totals[i].leftover)}</span>
          </span>
        ))}
      </div>
      {ROWS.map((r) => {
        const ids = new Set(enabled.filter((g) => r.kinds.includes(g.kind)).map((g) => g.id));
        const list = items.filter((it) => ids.has(it.groupId) && months.some((m) => amountOf(it, m) > 0));
        if (ids.size === 0 || list.length === 0) return null;
        const sum = (i: number) => r.kinds.reduce((s, k) => s + totals[i][k], 0);
        return (
          <div key={r.key} className={`tri-group t-${r.tone}`}>
            <div className="tri-row tri-gh"><span className="n">{r.name}</span>
              {months.map((m, i) => <span key={m} className="c num">{money(sum(i))}</span>)}</div>
            {list.map((it) => (
              <div key={it.id} className="tri-row tri-item">
                <span className="n">{it.name}</span>
                {months.map((m) => {
                  const cur = amountOf(it, m), prev = amountOf(it, addMonths(m, -1));
                  const changed = cur !== prev;
                  return (
                    <button key={m} className={`c num${now(m)}${changed ? ' chg' : ''}`} onClick={() => onEdit(it, m)}
                      aria-label={`${it.name} ${thaiMonth(m)} ${money(cur)}`}>
                      {changed && <i className={cur > prev ? r.up : r.down} aria-hidden="true">{cur > prev ? '▲' : '▼'}</i>}{money(cur)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
      <div className="tri-row tri-left"><span className="n">เงินเหลือ</span>
        {totals.map((t, i) => <span key={months[i]} className={`c num ${t.leftover < 0 ? 'neg' : 'pos'}`}>{t.leftover < 0 ? '−' : ''}{money(Math.abs(t.leftover)) === '–' ? '0' : money(Math.abs(t.leftover))}</span>)}
      </div>
    </section>
  );
}

export function TriLegend() {
  return (
    <p className="tri-legend"><span><i className="bad">▲</i>/<i className="ok">▼</i> เปลี่ยนจากเดือนก่อน</span><span><b>ตัวหนา</b> = ยอดไม่เท่าเดือนก่อน</span><span>แตะตัวเลขเพื่อแก้</span></p>
  );
}
