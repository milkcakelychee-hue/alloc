// การ์ดในหน้าหลัก (ต้องทำ): เงินเดือนเข้าแล้วหรือยัง · ก่อนเงินเข้า · จ่ายหรือยัง (ต้นแบบ B + docs/decisions.md)
import { useState, type ReactNode } from 'react';
import { MoneyInput } from '../components/MoneyInput';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { applyActualSalary, confirmPay, markDuePaid, salaryItemFor, snoozePay } from '../db/actions';
import { cycleOf, daysBetween, localToday, thaiMonth } from '../calc/dates';
import { formatBaht, parseBaht } from '../calc/money';
import { planTotals } from '../calc/plan';
import { goalAwareAmountOf } from '../calc/goals';
import { dueItems, payPrompts } from '../calc/reminders';
import { Icon } from '../components/Icon';
import { WD, dateWithDay } from '../components/PayRuleFields';
import { weekday } from '../calc/payday';
import { iconOf } from './plan/planUi';
import { usePlanData } from './plan/usePlanData';

/** extra: การ์ดต้องทำอื่นจากหน้าหลัก (วางแผนเดือนหน้า · สำรองข้อมูล) ต่อท้าย */
export function HomeCards({ extra = [] }: { extra?: ReactNode[] }) {
  const data = usePlanData();
  const checks = useLiveQuery(() => db.paidChecks.toArray(), []);
  const receipts = useLiveQuery(() => db.payReceipts.toArray(), []);
  const [diffMode, setDiffMode] = useState(false);
  const [actualText, setActualText] = useState('');
  const [toast, setToast] = useState('');
  const [earlyOpen, setEarlyOpen] = useState(false);
  if (!data?.settings || !checks || !receipts) return null;

  const { settings: s, groups, items, goals, adjustments } = data;
  const today = localToday();
  const current = cycleOf(today, s.pay);
  const amountOf = goalAwareAmountOf(goals, items, adjustments, current);
  const incomeIds = new Set(groups.filter((g) => g.kind === 'income').map((g) => g.id));
  const plannedIncome = (c: string) => planTotals(groups, items, c, amountOf).income;
  // รอบก่อนเริ่มใช้แอปไม่ถาม/ไม่เตือน
  const okC = (c: string) => !s.startCycle || c >= s.startCycle;
  const raw = payPrompts({ settings: s, receipts, today, plannedIncome, items });
  const pp = { ...raw, confirm: raw.confirm && okC(raw.confirm.cycle) ? raw.confirm : null, upcoming: raw.upcoming && okC(raw.upcoming.cycle) ? raw.upcoming : null };
  if (!pp.upcoming) pp.lateBills = [];
  const due = dueItems({ groups, items, checks, today, pay: s.pay, amountOf }).filter((d) => okC(d.cycle));
  const kindOf = (gid: string) => groups.find((g) => g.id === gid)!.kind;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const actual = parseBaht(actualText);
  // เงินเข้าก่อนกำหนด: แตะ "เงินเดือนเข้าแล้ว" บนการ์ดคาดว่าเงินเข้า → ใช้การ์ดยืนยันเดียวกัน
  const early = earlyOpen && raw.upcoming && okC(raw.upcoming.cycle)
    ? { cycle: raw.upcoming.cycle, expected: raw.upcoming.expected, nominal: raw.upcoming.nominal, planned: plannedIncome(raw.upcoming.cycle) } : null;
  const toConfirm = pp.confirm ?? early;
  const confirmCard = toConfirm && (() => {
    const c = toConfirm;
    const left = planTotals(groups, items, c.cycle, amountOf).leftover;
    const diff = actual !== null ? actual - c.planned : 0;
    const salary = salaryItemFor(items, incomeIds, c.cycle);
    return (
      <section className="confirm-card" aria-label="เงินเดือนเข้าแล้วหรือยัง">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="ic"><Icon name="wallet" size={20} stroke={2} /></span>
          <span className="tx"><span className="t1">เงินเดือนเข้าแล้วหรือยัง</span>
            <span className="t2">คาดว่าเข้า<span className="nw num">{c.expected === today ? 'วันนี้' : dateWithDay(c.expected)}</span> · ตามแผน <span className="num nw">{formatBaht(c.planned)}</span></span></span>
        </div>
        {!diffMode ? (
          <div className="confirm-actions">
            <button className="btn btn-pri" onClick={async () => { await confirmPay(db, { cycle: c.cycle, date: today, amount: c.planned }); flash('บันทึกเงินเดือนเข้าแล้ว'); }}>เข้าแล้ว ยอดเท่าเดิม</button>
            <button className="btn btn-ghost" onClick={() => { setDiffMode(true); setActualText(formatBaht(c.planned)); }}>เข้าแล้ว ยอดไม่เท่าเดิม</button>
            <button className="btn btn-ghost" onClick={async () => { await snoozePay(db, { cycle: c.cycle, today }); setEarlyOpen(false); flash('จะถามอีกครั้งพรุ่งนี้'); }}>ยังไม่เข้า เตือนพรุ่งนี้</button>
          </div>
        ) : (
          <div className="confirm-actions">
            <label className="field"><span className="label">ยอดที่เข้าจริง (บาท)</span>
              <MoneyInput className="num"  value={actualText} onChange={(e) => setActualText(e.target.value)} aria-invalid={actual === null} />
            </label>
            {actual !== null && diff !== 0 && (
              <div className="note warn"><span>{diff < 0 ? 'น้อยกว่า' : 'มากกว่า'}แผน <b className="num">{formatBaht(Math.abs(diff))}</b> · ถ้าใช้ยอดนี้ <span className="nw">เงินเหลือ {thaiMonth(c.cycle)}</span> จะเป็น <b className="num nw">{formatBaht(left + diff)}</b> จาก <span className="num nw">{formatBaht(left)}</span></span></div>
            )}
            <button className="btn btn-pri" disabled={actual === null || !salary} onClick={async () => {
              if (actual === null || !salary) return;
              const others = c.planned - (salary ? amountOf(salary, c.cycle) : 0);
              await applyActualSalary(db, { item: salary, cycle: c.cycle, actual: Math.max(actual - others, 0) });
              await confirmPay(db, { cycle: c.cycle, date: today, amount: actual });
              setDiffMode(false); flash('ใช้ยอดจริงในแผนเดือนนี้แล้ว');
            }}>ใช้ยอดนี้ในแผนเดือนนี้</button>
            <button className="btn btn-ghost" disabled={actual === null} onClick={async () => {
              if (actual === null) return;
              await confirmPay(db, { cycle: c.cycle, date: today, amount: actual });
              setDiffMode(false); flash('บันทึกยอดจริงแล้ว แผนไม่เปลี่ยน');
            }}>บันทึกยอดจริง ไม่แก้แผน</button>
            <button className="btn text-danger" style={{ color: 'var(--ink2)' }} onClick={() => setDiffMode(false)}>ย้อนกลับ</button>
          </div>
        )}
      </section>
    );
  })();

  const up = early ? null : pp.upcoming;
  const count = (pp.confirm ? 1 : 0) + due.length + (up ? 1 : 0) + extra.length;
  if (count === 0) return toast ? <div className="toast" role="status">{toast}</div> : null;

  return (
    <section className="todo" aria-labelledby="todo-h">
      <div className="todo-h"><h2 id="todo-h">ต้องทำ</h2><span className="num muted">{(pp.confirm ? 1 : 0) + due.length + extra.length}</span></div>
      {confirmCard}
      {up && (
        <div className={`pay-card${up.expected > up.nominal ? ' late' : ''}`}>
          <span className="ic"><Icon name="wallet" size={20} stroke={2} /></span>
          <span className="tx"><span className="t1">คาดว่าเงินเดือนเข้า <span className="num nw">{dateWithDay(up.expected).replace(/ \d\d$/, '')}</span></span>
            <span className="t2">{up.reason === 'weekend' ? <>ปกติวันที่ <span className="num">{Number(up.nominal.slice(8))}</span> แต่<span className="nw">ตรงวัน{WD[weekday(up.nominal)] === 'ส.' ? 'เสาร์' : 'อาทิตย์'}</span></>
              : up.reason === 'override' ? <span className="nw">แก้วันเฉพาะเดือนนี้</span> : <span className="nw">ตามกำหนด</span>}
              {up.daysLeft > 0 && <> · <span className="nw">อีก <span className="num">{up.daysLeft}</span> วัน</span></>}</span></span>
          <button className="pill-btn" onClick={() => setEarlyOpen(true)}>เข้าแล้ว</button>
        </div>
      )}
      {pp.lateBills.map((b) => (
        <div key={b.name} className="row alert due-warn">
          <span className="ic"><Icon name="alert" size={18} stroke={2} /></span>
          <span className="tx"><span className="t1">{b.name} <span className="num nw">{dateWithDay(b.date).replace(/ \d\d$/, '')}</span></span>
            <span className="t2">ครบกำหนด<span className="nw">ก่อนเงินเดือนเข้า</span> · <span className="num">{formatBaht(b.amount)}</span></span></span>
        </div>
      ))}
      {due.map((d) => {
        const kind = kindOf(d.item.groupId);
        const tone = kind === 'saving' || kind === 'invest' ? 'save' : kind === 'goalSpend' ? 'goal' : 'expense';
        const late = daysBetween(d.dueDate, today);
        return (
          <div key={d.item.id} className={`due-card tone-${tone}`}>
            <span className="iic"><Icon name={iconOf(d.item.icon)} size={20} /></span>
            <span className="tx"><span className="t1">{d.item.name} จ่ายหรือยัง</span>
              <span className="t2">ครบกำหนด <span className="num nw">{dateWithDay(d.dueDate).replace(/ \d\d$/, '')}</span>{late > 0 && <> · <span className="nw">เลยมา <span className="num">{late}</span> วัน</span></>} · <span className="num nw">{formatBaht(d.amount)}</span></span></span>
            <button className="pill-btn" onClick={async () => {
              await markDuePaid(db, { item: d.item, cycle: d.cycle });
              flash(`ติ๊ก ${d.item.name} จ่ายแล้ว`);
            }}>จ่ายแล้ว</button>
          </div>
        );
      })}
      {extra}
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}
