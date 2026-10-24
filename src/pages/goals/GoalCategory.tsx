// หน้าหมวดเป้า: เงินออม / ลงทุน (บอร์ด GoalSavings / GoalInvest) · รายจ่ายตามเป้าหมาย (บอร์ด GoalSpend)
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { db } from '../../db/db';
import type { Goal, GoalType, PlanItem } from '../../db/types';
import { appCycle, addMonths, localToday, monthDiff, thaiMonth } from '../../calc/dates';
import { goalBalance, goalOutlook, nextDepositCycle, planOf, suggestMonthly } from '../../calc/goals';
import { Icon } from '../../components/Icon';
import { deleteGoal, spendGoal } from '../../db/goalActions';
import { CAT, baht, barW, pctText, typeOfPath, useGoalsData, type GoalsData } from './goalUi';
import { BackHead, GoalRing, Stat, gstyle } from './parts';
import { AdjustSheet, EditGoalSheet } from './GoalSheets';
import GoalPvd from './GoalPvd';

const SUM_BG: Record<GoalType, string> = { saving: 't-sav', invest: 't-sav', goalSpend: 't-spend', pvd: 't-pvd' };
const planVerb: Record<GoalType, string> = { saving: 'ออมเข้าเดือนนี้ตามแผน', invest: 'ลงทุนเดือนนี้ตามแผน', goalSpend: 'กันไว้เดือนนี้', pvd: '' };

export default function GoalCategory() {
  const { cat } = useParams();
  const type = typeOfPath(cat);
  const data = useGoalsData();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [adjust, setAdjust] = useState<Goal | null>(null);
  const [editing, setEditing] = useState<{ goal: Goal; due?: boolean } | null>(null);
  const [del, setDel] = useState<Goal | null>(null);
  if (!type) return <Navigate to="/goals" replace />;
  if (type === 'pvd') return <GoalPvd />;
  if (!data?.settings) return null;
  const cur = appCycle(localToday(), data.settings.pay, data.settings.startCycle);
  const goals = data.goals.filter((g) => g.type === type && !g.closed);
  const balance = goals.reduce((s, g) => s + goalBalance(g, data.adjustments), 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  const plan = goals.reduce((s, g) => s + planOf(g, data.items)(cur), 0);
  const pct = target ? balance / target : 0;
  const spend = type === 'goalSpend';
  const isOpen = (g: Goal) => spend || !!open[g.id]; // ปิดไว้ก่อน แตะเพื่อดูรายละเอียด

  const delBody = (g: Goal) => {
    const items = data.items.filter((i) => i.goalId === g.id);
    return `ยอด ${baht(goalBalance(g, data.adjustments))} บาท ประวัติยอด${items.length ? ` และรายการในแผน ${items.length} รายการ` : ''} จะถูกลบด้วย`;
  };

  return (
    <main className="page gx">
      <BackHead to="/goals" label="กลับไปหน้าเป้าหมาย" title={CAT[type].name}>
        {!spend && <Link to={`/goals/new?type=${type}&from=${CAT[type].path}`} aria-label="เพิ่มเป้าในหมวดนี้" className="gx-add"><Icon name="plus" size={20} stroke={2.2} /></Link>}
      </BackHead>

      <section className={`gx-sum ${SUM_BG[type]}`} aria-label={`สรุปหมวด${CAT[type].name}`}>
        <div className="row1">
          <span className="ic"><Icon name={CAT[type].icon} size={22} stroke={1.9} /></span>
          <span className="mid">
            <span className="num"><b className="big">{baht(balance)}</b> <span className="of sub">/ {baht(target)}</span></span>
            <span className="s sub">{goals.length} เป้า · {planVerb[type]} <b className="num nw">+{baht(plan)}</b></span>
          </span>
          <span className="p num">{pctText(pct)}</span>
        </div>
        <span className="gx-bar"><span style={{ width: barW(pct) }} /></span>
      </section>

      {type === 'invest' && (
        <div className="gx-info"><Icon name="info" size={16} stroke={2} /><span>ยอดในหมวดนี้คือเงินต้นที่ลงไป บวกตามแผนทุกเดือน <span className="nw">ไม่ใช่มูลค่าตลาด</span> · <span className="nw">มูลค่าจริงดูในแอปพอร์ตของคุณ</span></span></div>
      )}
      {spend && (
        <div className="gx-info"><Icon name="info" size={16} stroke={2} /><span>กันเงินไว้จ่ายเรื่องที่รู้ล่วงหน้า<br />เงินก้อนนี้นับเป็น<b>รายจ่าย</b> ไม่ปนกับเงินเก็บ/ลงทุน<br />จ่ายจริงเมื่อไหร่ กด <span className="nw">"ใช้เงินก้อนนี้"</span> แล้วเป้าจะปิดเอง</span></div>
      )}

      {goals.map((g, i) => {
        const o = goalOutlook(g, data.items, data.adjustments, cur);
        const expanded = isOpen(g);
        return (
          <article key={g.id} className="gx-card gcol" style={gstyle(g.color)} aria-label={`เป้า${g.name}`}>
            <div className="hd">
              <GoalRing pct={o.pct} icon={g.icon} />
              <span className="nm">
                <span>{g.name}</span>
                <span className="n2 num"><span className="nw"><b>{baht(o.balance)}</b> / {baht(g.target)}</span> <span className="nw">· <b className="pc">{pctText(o.pct)}</b></span></span>
              </span>
              <button className="gx-editic" aria-label={`แก้เป้า ${g.name}`} onClick={() => setEditing({ goal: g })}><Icon name="edit" size={18} stroke={2} /></button>
              {spend
                ? g.dueMonth && <span className="gx-pill num">{thaiMonth(g.dueMonth)}</span>
                : <button className="gx-iconbtn" aria-label={`ดูเพิ่มเติม ${g.name}`} aria-expanded={expanded} onClick={() => setOpen({ ...open, [g.id]: !expanded })}><Icon name="chevDown" size={20} stroke={2} /></button>}
            </div>
            {expanded && (spend
              ? <SpendBody g={g} o={o} data={data} cur={cur} onAdjust={() => setAdjust(g)} />
              : <SaveBody g={g} o={o} type={type} items={data.items} onDue={() => setEditing({ goal: g, due: true })} onAdjust={() => setAdjust(g)} />)}
          </article>
        );
      })}

      <Link to={`/goals/new?type=${type}&from=${CAT[type].path}`} className={`gx-dashadd${spend ? ' spend' : ''}`}>
        <Icon name="plus" size={18} stroke={2.2} />{spend ? 'เพิ่มเป้า เช่น ทริปเที่ยวเพชรบุรี' : `เพิ่มเป้าในหมวด${CAT[type].name}`}
      </Link>

      {adjust && <AdjustSheet goal={adjust} balance={goalBalance(adjust, data.adjustments)} onClose={() => setAdjust(null)} />}
      {editing && <EditGoalSheet goal={editing.goal} onDelete={() => { setDel(editing.goal); setEditing(null); }} onClose={() => setEditing(null)} />}
      {del && (
        <div className="gx-alert-wrap" onClick={() => setDel(null)}>
          <div className="gx-alert" role="alertdialog" aria-labelledby="dg-title" onClick={(e) => e.stopPropagation()}>
            <span className="aic"><Icon name="alert" size={24} stroke={2} /></span>
            <h2 id="dg-title">ลบเป้า "{del.name}" ?</h2>
            <p>{delBody(del)}</p>
            <p className="small">เงินในบัญชีจริงไม่ได้หายไป แค่ลบข้อมูลออกจากแอป</p>
            <div className="gx-2btn">
              <button onClick={() => setDel(null)}>ยกเลิก</button>
              <button className="danger" onClick={async () => { await deleteGoal(db, del.id); setDel(null); }}>ลบเป้า</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

type O = ReturnType<typeof goalOutlook>;

function SaveBody({ g, o, type, items, onDue, onAdjust }: { g: Goal; o: O; type: GoalType; items: PlanItem[]; onDue: () => void; onAdjust: () => void }) {
  const reached = o.reachMonth && monthDiff(o.reachMonth, o.horizon) >= 0;
  const fill = o.done ? 1 : reached ? 1 : g.target ? o.atHorizon / g.target : 0;
  const planFor = planOf(g, items);
  const changeText = o.changes.slice(0, 2).map((c, i) => {
    const up = c.amount > planFor(addMonths(c.month, -1));
    return `${i ? ' และ' : 'แผน'}${up ? 'เพิ่ม' : 'ลด'}เป็น${i ? '' : 'เดือนละ'} ${baht(c.amount)} (${thaiMonth(c.month)})`;
  }).join('');
  return (
    <div className="gx-body">
      <div className="gx-tiles">
        <Stat k="เหลืออีก"><span className="v num">{baht(o.remaining)}</span></Stat>
        <Stat k="แผนเดือนนี้"><span className="v num">+{baht(o.planNow)}</span></Stat>
        <Stat k="กำหนดเวลา">{g.dueMonth ? <button className="v num" style={{ textAlign: 'left' }} onClick={onDue}>{thaiMonth(g.dueMonth)}</button> : <button className="lnk" onClick={onDue}>+ ตั้งวันที่</button>}</Stat>
      </div>
      <div className="gx-proj">
        <div className="l"><span>คาดการณ์ตามแผน</span>
          {o.done ? <span>ครบเป้าแล้ว</span>
            : reached ? <span className="num">ครบเป้าประมาณ <b>{thaiMonth(o.reachMonth!)}</b></span>
              : <span className="num">ถึง {thaiMonth(o.horizon)} · <b>{baht(o.atHorizon)} ({pctText(o.atHorizon / (g.target || 1))})</b></span>}
        </div>
        <div className="gx-pbar"><span className="f" style={{ width: barW(fill) }} /><span className="n" style={{ width: barW(o.pct) }} /></div>
      </div>
      {o.stopsAt && (
        <div className="gx-box warn">
          <Icon name="history" size={16} stroke={2} />
          <span>แผนปี {o.stopsAt.year + 543} ยังไม่มีรายการ{type === 'invest' ? 'ลงทุน' : 'ออม'}เป้านี้ <span className="nw">ยอดจะหยุดที่ <span className="num">{baht(o.stopsAt.balance)}</span></span></span>
          <Link to={`/?tab=plan&v=year&m=${o.stopsAt.year}-01`}>เพิ่มในแผน</Link>
        </div>
      )}
      {!o.stopsAt && o.changes.length > 0 && (
        <div className="gx-box inv">
          <Icon name="trend" size={16} stroke={2} />
          <span className="num">{changeText}</span>
          <Link to={`/?tab=plan&v=3m&m=${o.changes[0].month}`}>ดูแผน</Link>
        </div>
      )}
      {g.note && <div className="gx-note"><Icon name="log" size={16} stroke={2} /><span>{g.note}</span></div>}
      <div className="gx-btns">
        <button onClick={onAdjust}>ปรับยอด</button>
        <Link to={`/goals/g/${g.id}`}>ประวัติยอด</Link>
      </div>
    </div>
  );
}

function SpendBody({ g, o, data, cur, onAdjust }: { g: Goal; o: O; data: GoalsData; cur: string; onAdjust: () => void }) {
  const [ask, setAsk] = useState(false);
  const linked = data.items.filter((i) => i.goalId === g.id);
  const left = g.dueMonth ? Math.max(monthDiff(cur, g.dueMonth), 0) : null;
  const need = g.dueMonth ? suggestMonthly(o.remaining, cur, g.dueMonth).perMonth : o.planNow;
  const start = g.depositFrom ?? linked.reduce<string | null>((m, i) => (!m || i.period.start < m ? i.period.start : m), null);
  // แถบเดือนที่กันเงิน: ตั้งแต่เดือนแรกถึงเดือนก่อนใช้เงิน (ตามบอร์ด)
  const span = start && g.dueMonth ? monthDiff(start, g.dueMonth) : 0;
  const strip = start && span > 0 && span <= 24 ? Array.from({ length: span }, (_, i) => addMonths(start, i)) : [];
  const doneUntil = nextDepositCycle(g, data.adjustments, cur);
  const filled = strip.filter((m) => monthDiff(m, doneUntil) > 0).length;
  const lastPlan = o.reachMonth ?? linked.map((i) => i.period.endMonth).filter(Boolean).sort().at(-1) ?? null;
  return (
    <div className="gx-body" style={{ gap: 12 }}>
      <div className="gx-tiles">
        <Stat k="เหลืออีก"><span className="v num">{baht(o.remaining)}<small>บาท</small></span></Stat>
        <Stat k="ต้องกันต่อเดือน"><span className="v num">{baht(need)}<small>บาท</small></span></Stat>
        <Stat k="เหลือเวลา"><span className="v num">{left === null ? '–' : `${left} เดือน`}</span></Stat>
      </div>
      {strip.length > 0 && (
        <div className="gx-proj">
          <div className="l"><span>กันเงินรายเดือน</span><span className="num">{filled} / {strip.length} เดือน · ใช้เงิน {thaiMonth(g.dueMonth!)}</span></div>
          <div className="gx-strip num" style={{ gridTemplateColumns: `repeat(${Math.min(strip.length, 12)}, minmax(0, 1fr))` }}>
            {strip.map((m) => <span key={m} className={monthDiff(m, doneUntil) > 0 ? 'on' : ''} title={thaiMonth(m)}><i />{thaiMonth(m).split(' ')[0]}</span>)}
          </div>
        </div>
      )}
      <div className="gx-box spend">
        <Icon name="calendar" size={16} stroke={2} />
        {o.planNow > 0 || linked.length
          ? <span>อยู่ในแผนทุกเดือน <b className="num">{baht(o.planNow || planOf(g, data.items)(addMonths(cur, 1)))}</b>{lastPlan && <> ถึง <span className="num">{thaiMonth(lastPlan)}</span></>}<br /><span className="nw">หมวดรายจ่ายตามเป้าหมาย</span></span>
          : <span>ยังไม่อยู่ในแผนรายเดือน</span>}
        <Link to={`/?tab=plan&v=3m&m=${cur}`}>{linked.length ? 'ดูแผน' : 'เพิ่มในแผน'}</Link>
      </div>
      {g.note && <div className="gx-note"><Icon name="log" size={16} stroke={2} /><span>{g.note}</span></div>}
      <div className="gx-btns">
        <button onClick={onAdjust}>ปรับยอด</button>
        <Link to={`/goals/g/${g.id}`}>ประวัติยอด</Link>
      </div>
      <button className="gx-usebtn" onClick={() => setAsk(true)}><Icon name="check" size={18} stroke={2.2} />ใช้เงินก้อนนี้แล้ว</button>
      {ask && (
        <div className="gx-use" role="alertdialog" aria-label="ยืนยันใช้เงิน">
          <span className="t">ปิดเป้า{g.name}?</span>
          <span className="b">ยอดที่กันไว้ <b className="num">{baht(o.balance)}</b> จะบันทึกเป็นรายจ่ายเดือนนี้{linked.length > 0 && <> และแผนเดือนถัดไปจะหยุดกันเงินก้อนนี้ <b className="num">{baht(o.planNow)}</b>/เดือน</>}</span>
          <div className="gx-2btn">
            <button onClick={() => setAsk(false)}>ยกเลิก</button>
            <button className="brown" onClick={async () => { await spendGoal(db, { goal: g, balance: o.balance, currentCycle: cur, today: localToday() }); }}>ปิดเป้า</button>
          </div>
        </div>
      )}
    </div>
  );
}
