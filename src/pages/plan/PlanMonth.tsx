// แท็บ วางแผนรายจ่าย · มุมมองเดือน (ต้นแบบ Plan1)
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { GroupKind, Month, PlanGroup, PlanItem } from '../../db/types';
import { appCycle, addMonths, cycleRange, localToday, thaiDate, thaiMonth } from '../../calc/dates';
import { formatBaht, pct1 } from '../../calc/money';
import { accountTransfers, planTotals } from '../../calc/plan';
import { goalAwareAmountOf } from '../../calc/goals';
import { expectedPayDate } from '../../calc/payday';
import { Icon } from '../../components/Icon';
import { dateWithDay } from '../../components/PayRuleFields';
import { usePlanData } from './usePlanData';
import { TONE, groupAddLabel, iconOf, thaiMonthLong } from './planUi';
import { ItemSheet } from './ItemSheet';
import { Grip, SortList } from '../../components/SortList';
import { reorderPlanItems } from '../../db/actions';
import { PayDateSheet } from './PayDateSheet';
import { PlanThree, TriLegend } from './PlanThree';
import { payRuleLabel } from '../../components/PayRuleFields';
import { PlanYearView } from './PlanYearView';

type View = 'month' | '3m' | 'year';

type Editing = { item: PlanItem | null; groupId: string } | null;

export function PlanMonth() {
  const nav = useNavigate();
  const data = usePlanData();
  const today = localToday();
  const [sp0] = useSearchParams();
  const [month, setMonth] = useState<Month | null>(() => (/^\d{4}-\d{2}$/.test(sp0.get('m') ?? '') ? sp0.get('m') : null)); // ?m= มาจากหน้าเป้าหมาย
  const [editing, setEditing] = useState<Editing>(null);
  const [checkMode, setCheckMode] = useState(false);
  const [showZero, setShowZero] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [payEdit, setPayEdit] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editMonth, setEditMonth] = useState<Month | null>(null);
  const [sp, setSp] = useSearchParams();
  const view: View = sp.get('v') === '3m' ? '3m' : sp.get('v') === 'year' ? 'year' : 'month';
  const setView = (v: View) => setSp(v === 'month' ? { tab: 'plan' } : { tab: 'plan', v }, { replace: true }); // ตัด ?m= ออก ใช้เดือนใน state แทน

  const s = data?.settings;
  const current = s ? appCycle(today, s.pay, s.startCycle) : null;
  const m = month ?? current;
  const checks = useLiveQuery(() => (m ? db.paidChecks.where('cycleMonth').equals(m).toArray() : []), [m]);
  if (!data || !s || !m || !current) return null;

  const { groups, items, accounts, goals, adjustments } = data;
  const baseAmount = goalAwareAmountOf(goals, items, adjustments, current);
  // เดือนก่อนรอบที่เริ่มใช้แอปไม่นับในแผน (มุมมอง 3 เดือน / ปีจะว่าง)
  const st = s.startCycle;
  const amountOf: typeof baseAmount = st ? (it, mm) => (mm < st ? 0 : baseAmount(it, mm)) : baseAmount;
  const t = planTotals(groups, items, m, amountOf);
  const range = cycleRange(m, s.pay);
  // หัวมุมมอง 3 เดือน: "ต.ค. – ธ.ค. 69" (ข้ามปี: "พ.ย. 69 – ม.ค. 70") · มุมมองปี: จำนวนเดือนที่มีแผน
  const m3 = addMonths(m, 2);
  const triTitle = m.slice(0, 4) === m3.slice(0, 4) ? `${thaiMonth(m).split(' ')[0]} – ${thaiMonth(m3)}` : `${thaiMonth(m)} – ${thaiMonth(m3)}`;
  const yearN = Array.from({ length: 12 }, (_, i) => `${m.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`).filter((x) => planTotals(groups, items, x, amountOf).income > 0).length;
  const yearSpan = yearN === 12 ? 'มีแผนครบ 12 เดือน' : yearN ? `มีแผน ${yearN} เดือน` : 'ยังไม่มีแผน';
  const payMonth = addMonths(m, -1); // เงินเดือนที่ใช้ในรอบ m เข้าเดือนก่อน
  const pay = expectedPayDate(s.pay, s.weekendShift, payMonth, s.payOverrides);
  const enabled = groups.filter((g) => g.enabled);
  const checked = new Set((checks ?? []).filter((c) => c.checked).map((c) => c.planItemId));
  const checkable = items.filter((i) => enabled.some((g) => g.id === i.groupId && g.kind !== 'income') && amountOf(i, m) > 0);
  const checkedAmt = checkable.filter((i) => checked.has(i.id)).reduce((a, i) => a + amountOf(i, m), 0);
  const zeroCount = items.filter((i) => enabled.some((g) => g.id === i.groupId) && amountOf(i, m) === 0 && i.period.start <= m).length;
  const { byAccount, salaryLeft } = accountTransfers(groups, items, m, amountOf);
  const accName = (id: string | null) => accounts.find((a) => a.id === id)?.name;

  const toggleCheck = async (it: PlanItem) => {
    const id = `${m}|${it.id}`;
    const now = Date.now();
    if (checked.has(it.id)) await db.paidChecks.delete(id);
    else await db.paidChecks.put({ id, cycleMonth: m, planItemId: it.id, checked: true, createdAt: now, updatedAt: now });
  };

  // โหมดเช็กจ่ายแล้ว: บรรทัดย่อยเหลือแค่บัญชี ไม่ให้แถวยาวเกิน
  const subtitle = (it: PlanItem) => {
    const parts: string[] = [];
    const acc = accName(it.accountId);
    if (acc) parts.push(acc);
    if (checkMode) return acc ?? 'อยู่ในบัญชีเงินเดือน';
    if (m in it.monthOverrides && it.monthOverrides[m] !== it.defaultAmount) parts.push(`เฉพาะ ${thaiMonth(m).split(' ')[0]}`, `ปกติ ${formatBaht(it.defaultAmount)}`);
    else if (it.dueDay) parts.push(`ครบกำหนดวันที่ ${it.dueDay}`);
    else if (it.period.endMode === 'month' && it.period.endMonth) parts.push(`ถึง ${thaiMonth(it.period.endMonth)}`);
    else parts.push('ทุกเดือน');
    return parts.map((p, i) => <span key={i}>{i ? ' · ' : ''}<span className="nw">{p}</span></span>);
  };

  const groupCard = (g: PlanGroup) => {
    const tone = TONE[g.kind as GroupKind];
    const list = items.filter((i) => i.groupId === g.id && i.period.start <= m && (showZero || amountOf(i, m) > 0));
    const total = t[g.kind];
    const open = !collapsed[g.id];
    return (
      <section key={g.id} className={`gcard tone-${tone}`} aria-labelledby={`g-${g.id}`}>
        <div className="ghead">
          <h3 id={`g-${g.id}`}>{g.name} <span className="cnt">· <span className="num">{list.length}</span></span></h3>
          <span className="num gtotal">{formatBaht(total)}</span>
          <button className="gbtn add" aria-label={groupAddLabel[g.kind]} onClick={() => setEditing({ item: null, groupId: g.id })}><Icon name="plus" size={20} stroke={2.2} /></button>
          <button className="gbtn" aria-label={`ย่อหรือขยาย${g.name}`} aria-expanded={open} onClick={() => setCollapsed({ ...collapsed, [g.id]: open })}>
            <span style={{ display: 'flex', transform: open ? 'rotate(180deg)' : undefined }}><Icon name="chevDown" size={18} stroke={2} /></span>
          </button>
        </div>
        {open && (
          <div className="gbody">
            {list.length === 0 && <div className="gempty">ยังไม่มีรายการ · กด <span className="nw">+ เพื่อเพิ่ม</span></div>}
            <SortList ids={list.map((x) => x.id)} onCommit={(ids) => reorderPlanItems(db, g.id, ids)}>{(id, dragItem, dragHandle) => {
              const it = list.find((x) => x.id === id)!;
              const on = checked.has(it.id);
              const canCheck = checkMode && g.kind !== 'income' && amountOf(it, m) > 0;
              return (
                <div key={it.id} className="irow" {...dragItem}>
                  {!checkMode && list.length > 1 && <Grip label={`ลากเพื่อย้าย ${it.name}`} {...dragHandle} />}
                  {canCheck && (
                    <button className="icheck" role="checkbox" aria-checked={on} aria-label={`จ่ายแล้ว ${it.name}`} onClick={() => toggleCheck(it)}>
                      <span className={on ? 'on' : ''}>{on && <Icon name="checkSq" size={14} stroke={3} />}</span>
                    </button>
                  )}
                  <button className="ibtn" style={{ opacity: canCheck && on ? 0.55 : 1 }} onClick={() => setEditing({ item: it, groupId: g.id })}>
                    <span className="iic"><Icon name={iconOf(it.icon)} size={20} /></span>
                    <span className="tx"><span className="t1">{it.name}</span><span className="t2">{subtitle(it)}</span></span>
                    <span className="num iamt">{formatBaht(amountOf(it, m))}</span>
                    <Icon name="chevron" size={16} stroke={2} />
                  </button>
                </div>
              );
            }}</SortList>
          </div>
        )}
      </section>
    );
  };

  return (
    <main className="page">
      <button className="back-link" onClick={() => nav('/', { replace: true })}><Icon name="back" size={16} stroke={2.2} />กลับหน้าสรุป</button>
      <div className="plan-head">
        <span className="tx">
          {view === 'year' ? (
            <><h1>ปี <span className="num">{Number(m.slice(0, 4)) + 543}</span></h1><span className="sub">{yearSpan}</span></>
          ) : view === '3m' ? (
            <><h1 className="num">{triTitle}</h1><span className="sub">เทียบ 3 เดือน · เงินเดือนเข้า{payRuleLabel(s.pay, s.weekendShift).main}</span></>
          ) : (
            <><h1>{thaiMonthLong(m)}</h1>
              <span className="sub num">รอบ <span className="nw">{thaiDate(range.start)} – {thaiDate(range.end)}</span> (<span className="nw">{range.days} วัน</span>)</span></>
          )}
        </span>
        <button className="icon-btn" aria-label={view === 'year' ? 'ปีก่อน' : 'เดือนก่อน'} disabled={!!s.startCycle && (view === 'year' ? m.slice(0, 4) <= s.startCycle.slice(0, 4) : m <= s.startCycle)} onClick={() => setMonth(addMonths(m, view === 'year' ? -12 : -1))}><Icon name="back" size={20} stroke={2} /></button>
        <button className="icon-btn" aria-label={view === 'year' ? 'ปีถัดไป' : 'เดือนถัดไป'} onClick={() => setMonth(addMonths(m, view === 'year' ? 12 : 1))}><Icon name="chevron" size={20} stroke={2} /></button>
      </div>
      <div className="view-tabs" role="tablist" aria-label="มุมมองแผน">
        {([['month', 'เดือน'], ['3m', '3 เดือน'], ['year', 'ปี']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>{l}</button>
        ))}
      </div>
      {view === 'month' && (
        <div className="plan-meta">
          <button className="pay-edit" onClick={() => setPayEdit(true)}>
            <Icon name="wallet" size={16} stroke={2} />
            <span>เงินเข้า <span className="num">{dateWithDay(pay.date)}</span></span>
            <Icon name="edit" size={14} stroke={2} />
          </button>
          {pay.reason !== 'onTime' && <span className="tag warn">{pay.reason === 'override' ? 'แก้เฉพาะเดือนนี้' : `เลื่อนจาก ${thaiDate(pay.nominal).split(' ').slice(0, 2).join(' ')}`}</span>}
          {m !== current && <button className="link-btn" onClick={() => setMonth(null)}>กลับเดือนนี้</button>}
        </div>
      )}
      {view !== 'month' && m !== current && <div className="plan-meta"><button className="link-btn" onClick={() => setMonth(null)}>กลับ{view === 'year' ? 'ปี' : 'เดือน'}นี้</button></div>}


      {view === '3m' && <><PlanThree data={data} month={m} current={current} amountOf={amountOf} onEdit={(item, em) => { setEditMonth(em); setEditing({ item, groupId: item.groupId }); }} /><TriLegend /></>}
      {view === 'year' && <PlanYearView data={data} year={Number(m.slice(0, 4))} current={current} amountOf={amountOf} onPickMonth={(x) => { setMonth(x); setView('month'); }} />}
      {view === 'month' && <>
      <section className="card plan-sum" aria-label="สรุปแผนเดือนนี้">
        <div className="sum-top"><span className="t">สรุปแผน{m === current ? 'เดือนนี้' : ` ${thaiMonth(m)}`}</span>
          <span className="muted">Savings Rate <b className="num" style={{ color: 'var(--ink)' }}>{pct1(t.saving + t.invest, t.income)}%</b></span></div>
        <div className="sum-row inc"><span><Icon name="salary" size={18} />รายรับ</span><b className="num">{formatBaht(t.income)}</b></div>
        <div className="sum-row sav"><span><Icon name="piggy" size={18} />ออม + ลงทุน</span><b className="num">{t.saving + t.invest ? '−' : ''}{formatBaht(t.saving + t.invest)}</b></div>
        <div className="sum-row exp"><span><Icon name="card" size={18} />รายจ่ายทั้งหมด</span><b className="num">{t.fixed + t.variable + t.goalSpend ? '−' : ''}{formatBaht(t.fixed + t.variable + t.goalSpend)}</b></div>
        <div className="sum-left"><span>เงินเหลือตามแผน</span><b className={`num${t.leftover < 0 ? ' neg' : ''}`}>{formatBaht(t.leftover)}</b></div>
      </section>

      <div className="plan-h2"><h2>วางแผนรายหมวด</h2><p>แตะรายการเพื่อแก้ยอด หรือกด + เพื่อเพิ่มรายการในหมวด</p></div>

      {!checkMode ? (
        <button className="check-entry" onClick={() => setCheckMode(true)}>
          <span className="ic"><Icon name="checkSq" size={18} stroke={2.4} /></span>
          <span className="tx"><span className="t1">เช็กว่าจ่าย / โอนแล้ว</span><span className="t2 num">ติ๊กไปแล้ว {checkable.filter((i) => checked.has(i.id)).length} จาก {checkable.length} รายการ</span></span>
          <Icon name="chevron" size={16} stroke={2} />
        </button>
      ) : (
        <section className="check-mode" aria-label="โหมดเช็กจ่ายแล้ว">
          <div className="cm-top"><span className="t"><Icon name="checkSq" size={18} stroke={2.4} />เช็กว่าจ่าย / โอนแล้ว</span>
            <button className="pill-btn" onClick={() => setCheckMode(false)}>เสร็จ</button></div>
          <span className="bar"><span style={{ width: `${checkable.length ? (checkable.filter((i) => checked.has(i.id)).length / checkable.length) * 100 : 0}%` }} /></span>
          <span className="t2 num">ติ๊กแล้ว {checkable.filter((i) => checked.has(i.id)).length} / {checkable.length} · โอนแล้ว {formatBaht(checkedAmt)} · <span className="nw">แตะช่องหน้ารายการ</span> · <span className="nw">ไม่เปลี่ยนตัวเลขในแผน</span></span>
        </section>
      )}

      {enabled.map(groupCard)}

      {zeroCount > 0 && (
        <div className="zero-note">{showZero ? 'แสดงรายการที่เดือนนี้เป็น 0 แล้ว · ' : <>ซ่อน <span className="num">{zeroCount}</span> รายการที่เดือนนี้เป็น 0 · </>}
          <button className="link-btn" onClick={() => setShowZero(!showZero)}>{showZero ? 'ซ่อน' : 'แสดง'}</button></div>
      )}

      <section className="acc-split" aria-labelledby="acc-h">
        <div className="acc-top">
          <Icon name="wallet" size={20} stroke={2} />
          <h3 id="acc-h">แยกบัญชี
            <button className="help-q" aria-label="แยกบัญชีคืออะไร" aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}><span>?</span></button>
          </h3>
          <span className="muted" style={{ fontSize: 12 }}>คำนวณจากแผน</span>
        </div>
        <p>วางแผนว่าจะโอนเงินแต่ละก้อนไปไว้ที่ไหน <span className="nw">โอนแยกเข้าบัญชี</span>ตามเป้าหมายทันทีที่เงินเดือนออก ให้รู้ว่า<span className="nw">เงินก้อนไหนมีหน้าที่อะไร</span></p>
        {helpOpen && <div className="note"><span>ตั้งบัญชีปลายทางให้แต่ละรายการได้ในแผ่นแก้รายการ · รายการที่ไม่ได้เลือกบัญชี <span className="nw">นับว่าอยู่ในบัญชีเงินเดือน</span></span></div>}
        {accounts.filter((a) => (byAccount.get(a.id) ?? 0) !== 0).map((a) => (
          <div key={a.id} className="acc-row"><span>{a.name}</span><span className="num">{formatBaht(byAccount.get(a.id) ?? 0)}</span></div>
        ))}
        {byAccount.size === 0 && <div className="acc-row muted"><span>ยังไม่ได้เลือก<span className="nw">บัญชีปลายทาง</span>ให้รายการไหน</span></div>}
        <div className="acc-left"><span>เหลือในบัญชีเงินเดือน</span><span className={`num${salaryLeft < 0 ? ' neg' : ''}`}>{formatBaht(salaryLeft)}</span></div>
      </section>

      </>}

      {editing && <ItemSheet data={data} month={editMonth ?? m} current={current} item={editing.item} groupId={editing.groupId} onClose={() => { setEditing(null); setEditMonth(null); }} />}
      {payEdit && <PayDateSheet settings={s} cycle={m} onClose={() => setPayEdit(false)} />}
    </main>
  );
}
