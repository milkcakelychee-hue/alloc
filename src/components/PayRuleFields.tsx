// เลือกกฎวันเงินเดือนเข้า + เลื่อนเมื่อตรงเสาร์อาทิตย์ + คาดการณ์วันเงินเข้า 4 เดือนข้างหน้า (ต้นแบบ B ที่เจ้าของอนุมัติ)
import { addMonths, thaiDate, thaiMonth, type PayRule } from '../calc/dates';
import { expectedPayDate, weekday, type WeekendShift } from '../calc/payday';
import type { Month } from '../db/types';

export const WD = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const WD_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const dateWithDay = (d: string) => `${WD[weekday(d)]} ${thaiDate(d)}`;

export function payRuleLabel(rule: PayRule, shift: WeekendShift) {
  const main = rule.kind === 'day' ? `ทุกวันที่ ${rule.day}` : rule.kind === 'endOfMonth' ? 'สิ้นเดือน' : 'วันทำการสุดท้ายของเดือน';
  const sub = rule.kind === 'lastBusinessDay' ? 'วันจันทร์–ศุกร์วันสุดท้าย'
    : shift === 'before' ? 'ตรงเสาร์อาทิตย์ เข้าก่อน' : shift === 'after' ? 'ตรงเสาร์อาทิตย์ เข้าหลัง' : 'ตรงเสาร์อาทิตย์ ไม่เลื่อน';
  return { main, sub };
}

const KINDS: [PayRule['kind'], string, string][] = [
  ['day', 'ทุกวันที่เดิม', 'เช่น ทุกวันที่ 25 หรือ 27'],
  ['endOfMonth', 'สิ้นเดือน', 'วันสุดท้ายของเดือน 28–31'],
  ['lastBusinessDay', 'วันทำการสุดท้ายของเดือน', 'วันจันทร์–ศุกร์วันสุดท้าย']
];

type Props = { rule: PayRule; shift: WeekendShift; from: Month; onChange: (rule: PayRule, shift: WeekendShift) => void };

export function PayRuleFields({ rule, shift, from, onChange }: Props) {
  const day = rule.kind === 'day' ? rule.day : 27;
  const months = Array.from({ length: 4 }, (_, i) => addMonths(from, i));
  return (
    <>
      <div className="field"><span className="label" id="pay-kind">เงินเดือนเข้า</span>
        <div className="list" role="radiogroup" aria-labelledby="pay-kind">
          {KINDS.map(([k, l, d]) => (
            <button key={k} type="button" className="row" role="radio" aria-checked={rule.kind === k}
              onClick={() => onChange(k === 'day' ? { kind: 'day', day } : { kind: k }, shift)}>
              <span className={`radio-dot${rule.kind === k ? ' on' : ''}`} aria-hidden="true" />
              <span className="tx"><span className="t1">{l}</span><span className="t2">{d}</span></span>
            </button>
          ))}
        </div>
      </div>
      {rule.kind === 'day' && (
        <label className="field"><span className="label">วันที่</span>
          <select className="num" value={day} onChange={(e) => onChange({ kind: 'day', day: Number(e.target.value) }, shift)}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {day > 28 && <span className="hint">เดือนที่มีไม่ถึง <span className="num">{day}</span> วัน ใช้วันสุดท้ายของเดือน</span>}
        </label>
      )}
      {rule.kind !== 'lastBusinessDay' && (
        <div className="field"><span className="label" id="pay-shift">ถ้าตรงเสาร์อาทิตย์ เงินจะเข้า</span>
          <div className="radio3" role="radiogroup" aria-labelledby="pay-shift">
            {([['before', 'ก่อนวันหยุด'], ['after', 'หลังวันหยุด'], ['none', 'ไม่เลื่อน']] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={shift === v} onClick={() => onChange(rule, v)}>{l}</button>
            ))}
          </div>
        </div>
      )}
      <div className="card pay-fc">
        <div className="h">คาดการณ์วันเงินเดือนเข้า 4 เดือนข้างหน้า</div>
        {months.map((m) => {
          const e = expectedPayDate(rule, shift, m);
          const [y, mo, d] = e.date.split('-').map(Number);
          return (
            <div key={m} className="pay-row">
              <span className="mo">{thaiMonth(`${y}-${String(mo).padStart(2, '0')}`)}</span>
              <span className="dd"><b className="num">{d}</b> <span>{WD_FULL[weekday(e.date)]}</span></span>
              {e.reason === 'weekend' && <span className="tag warn">เลื่อนจาก{WD_FULL[weekday(e.nominal)]} {Number(e.nominal.slice(8))}</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}
