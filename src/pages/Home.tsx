// หน้าหลัก สรุป (บอร์ด HomeB / HomeBDark): สินทรัพย์รวม · Savings Rate · ต้องทำ
// ปุ่มเข้าแผนอยู่บนสุดแทนปุ่มสลับ สรุป/วางแผนรายจ่าย (เจ้าของตกลงแล้ว)
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { exportBackup } from '../db/backup';
import { cycleOf, localToday, thaiMonth } from '../calc/dates';
import { formatBaht } from '../calc/money';
import { planTotals } from '../calc/plan';
import { goalAwareAmountOf } from '../calc/goals';
import { assetsSummary, incomeSplit, planNextPrompt } from '../calc/home';
import { backupStatus } from '../calc/reminders';
import { Icon } from '../components/Icon';
import { dateWithDay } from '../components/PayRuleFields';
import { PlanMonth } from './plan/PlanMonth';
import { usePlanData } from './plan/usePlanData';
import { HomeCards } from './HomeCards';
import { PlanEntry } from './PlanEntry';

const todayLong = () =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date())
    .replace(/^(วัน\S+)\s/, '$1ที่ ');

const HIDDEN = '••••••';

export default function Home() {
  const [sp] = useSearchParams();
  // แท็บแผน: ไม่มีปุ่มสลับ มีปุ่มกลับหน้าสรุปด้านบนแทน
  if (sp.get('tab') === 'plan') return <PlanMonth />;
  return <Summary />;
}

function Summary() {
  const data = usePlanData();
  const [toast, setToast] = useState('');
  if (!data?.settings) return null;
  const { settings: s, groups, items, goals, adjustments } = data;
  const today = localToday();
  const cur = cycleOf(today, s.pay);
  const amountOf = goalAwareAmountOf(goals, items, adjustments, cur);
  const a = assetsSummary(goals, adjustments);
  const sp = incomeSplit(planTotals(groups, items, cur, amountOf));
  const hide = s.hideNumbers;
  const [int, dec] = formatBaht(a.total).split('.');
  const C = 88; // วงเล็ก r 14
  const segS = (a.savingPct / 100) * C;

  // ต้องทำ: วางแผนเดือนหน้า · สำรองข้อมูล
  const next = planNextPrompt({ pay: s.pay, shift: s.weekendShift, overrides: s.payOverrides, today, totalsOf: (m) => planTotals(groups, items, m, amountOf) });
  const bs = backupStatus(s.lastBackupAt);
  const extra = [];
  if (next) {
    extra.push(
      <Link key="plan" to={`/?tab=plan&m=${next.cycle}`} className="todo-card red">
        <span className="ic"><Icon name="alert" size={20} stroke={2} /></span>
        <span className="tx"><span className="t1">วางแผน <span className="nw">{thaiMonth(next.cycle).split(' ')[0]}</span> <span className="nw">ก่อนเงินเดือนเข้า <span className="num">{dateWithDay(next.payDate).replace(/^\S+ /, '').replace(/ \d\d$/, '')}</span></span></span>
          <span className="t2 num">{next.daysLeft === 0 ? 'วันนี้' : `อีก ${next.daysLeft} วัน`} · {next.empty ? 'ยังไม่มีแผน' : <>ตอนนี้แผนติดลบ <span className="nw">{formatBaht(-next.leftover)}</span></>}</span></span>
        <Icon name="chevron" size={16} stroke={2} />
      </Link>
    );
  }
  if (bs.due) {
    extra.push(
      <button key="backup" className="todo-card amb" onClick={async () => { const r = await exportBackup(db); if (r !== 'cancelled') { setToast('สำรองข้อมูลแล้ว'); setTimeout(() => setToast(''), 3000); } }}>
        <span className="ic"><Icon name="backup" size={20} stroke={1.9} /></span>
        <span className="tx"><span className="t1">{bs.never ? 'ยังไม่เคยสำรองข้อมูล' : <>ไม่ได้สำรองข้อมูล <span className="num">{bs.days}</span> วัน</>}</span><span className="t2">แตะเพื่อสำรองตอนนี้</span></span>
        <Icon name="chevron" size={16} stroke={2} />
      </button>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <span className="sub num">{todayLong()}</span>
        <h1>ภาพรวมการเงิน</h1>
      </div>
      <PlanEntry />

      <section className="hero assets" aria-label="สินทรัพย์รวม">
        <div className="as-top">
          <span>สินทรัพย์รวม</span>
          <button aria-label={hide ? 'แสดงตัวเลข' : 'ซ่อนตัวเลข'} aria-pressed={hide} onClick={() => db.settings.update('app', { hideNumbers: !hide, updatedAt: Date.now() })}>
            <Icon name={hide ? 'eyeOff' : 'eye'} size={20} stroke={1.8} />
          </button>
        </div>
        <div className="as-v num">{hide ? <span className="big">{HIDDEN}</span> : <><span className="big">{int}</span><span className="dec">.{dec}</span></>}<span className="u">บาท</span></div>
        <div className="as-split">
          <svg width="36" height="36" viewBox="0 0 36 36" role="img" aria-label={`สัดส่วน เงินเก็บ ${a.savingPct}% ลงทุน ${a.investPct}%`} style={{ flex: 'none' }}>
            {a.total === 0 && <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="6" />}
            {a.saving > 0 && <circle cx="18" cy="18" r="14" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeDasharray={`${Math.max(segS - (a.invest > 0 ? 1 : 0), 0).toFixed(1)} ${C}`} transform="rotate(-90 18 18)" />}
            {a.invest > 0 && <circle cx="18" cy="18" r="14" fill="none" stroke="#C6E43F" strokeWidth="6" strokeDasharray={`${Math.max(C - segS - (a.saving > 0 ? 1 : 0), 0).toFixed(1)} ${C}`} strokeDashoffset={-segS} transform="rotate(-90 18 18)" />}
          </svg>
          <div className="as-legend">
            <div><span className="sw" style={{ background: '#FFFFFF' }}><Icon name="coins" size={13} stroke={2.4} /></span>
              <span className="t"><span>เงินเก็บ <b className="num">{a.savingPct}%</b></span><span className="num">{hide ? HIDDEN : formatBaht(a.saving)}</span></span></div>
            <div><span className="sw" style={{ background: '#C6E43F' }}><Icon name="trend" size={13} stroke={2.4} /></span>
              <span className="t"><span>ลงทุน <b className="num">{a.investPct}%</b></span><span className="num">{hide ? HIDDEN : formatBaht(a.invest)}</span></span></div>
          </div>
        </div>
      </section>

      <section className="card sr" aria-label="Savings Rate">
        <div className="sr-top">
          <div style={{ flex: 1, minWidth: 0 }}><span className="k"><span className="nw">Savings Rate เดือนนี้</span> · <span className="nw">ตามแผน</span></span>
            <span className="v num"><b>{sp.ratePct.toFixed(1)}</b><small>%</small></span></div>
          <span className="k num" style={{ textAlign: 'right', flex: 'none' }}>จากรายรับ<br /><span className="nw">{hide ? HIDDEN : formatBaht(sp.income)}</span></span>
        </div>
        <div className="sr-bar" role="img" aria-label={`รายรับแบ่งเป็น ออม ${sp.savingPct}% ลงทุน ${sp.investPct}% รายจ่าย ${sp.expensePct}%`}>
          {sp.income > 0 ? <>
            <div style={{ width: `${sp.savingPct}%`, background: 'var(--sel)' }} />
            <div style={{ width: `${sp.investPct}%`, background: 'var(--inv)' }} />
            <div style={{ flex: 1, background: 'var(--exp)' }} />
          </> : <div style={{ flex: 1, background: 'var(--track)' }} />}
        </div>
        <div className="sr-tiles">
          {([['ออม', 'var(--sel)', sp.savingPct, sp.saving], ['ลงทุน', 'var(--inv)', sp.investPct, sp.invest], ['รายจ่าย', 'var(--exp)', sp.expensePct, sp.expense]] as const).map(([k, c, p, v]) => (
            <div key={k}><div className="h"><i style={{ background: c }} />{k}</div>
              <div className="b"><span className="num">{p.toFixed(1)}%</span><span className="num">{hide ? '•••' : formatBaht(Math.round(v / 100) * 100, { decimals: false })}</span></div></div>
          ))}
        </div>
      </section>

      <HomeCards extra={extra} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
