// หน้าเป้าหมายบนคอม (ALLOC_DESKTOP_SPEC ข้อ 8 · บอร์ด Desk-GoalList / -Goal-Spend / -PVD / -Adjust / -Create / -Empty)
// ซ้าย 340: ยอดรวม + เป้าแยก 4 กลุ่ม · ขวา: รายละเอียดเป้าที่เลือก เรียงลงคอลัมน์เดียว · ซ้ายและขวาเลื่อนแยกกัน
// แผ่นเด้งเดิมของมือถือ (ปรับยอด แก้เป้า เงินสมทบ) บนคอมเป็นแผงขวา 440 อยู่แล้ว จึงใช้ร่วมกัน
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Goal, GoalAdjustment, GoalType, PlanItem } from '../../db/types';
import { db } from '../../db/db';
import { appCycle, cycleOf, localToday, monthDiff, thaiDate, thaiMonth } from '../../calc/dates';
import { rawAmount } from '../../calc/plan';
import { goalBalance, goalOutlook, nextDepositCycle, planOf, pvdContribution } from '../../calc/goals';
import { goalChart, goalHistory, goalSort, reorderGoals, type ChartBar } from '../../calc/deskGoals';
import { deleteGoal, goalCats, setGoalOrder, spendGoal, type AdjustMode } from '../../db/goalActions';
import { Icon } from '../../components/Icon';
import { SheetFrame } from '../../components/SheetFrame';
import { DeskBar } from '../../components/DeskShell';
import type { IconName } from '../plan/planUi';
import { CAT, baht, barW, colorOf, pctText, useGoalsData, type GoalsData } from '../goals/goalUi';
import { AdjustSheet, EditGoalSheet, PvdSheet, bpText } from '../goals/GoalSheets';
import GoalCreate from '../goals/GoalCreate';

const TYPES: GoalType[] = ['saving', 'invest', 'goalSpend', 'pvd'];
const TONE: Record<GoalType, string> = { saving: 'sav', invest: 'sav', goalSpend: 'goal', pvd: 'inc' };
const EMPTY_HINT: Record<GoalType, string> = { saving: 'เงินสำรอง เก็บเงินก้อน', invest: 'นับเฉพาะเงินต้น', goalSpend: 'ทริป ของชิ้นใหญ่', pvd: 'กองทุนสำรองเลี้ยงชีพ' };
const dayMonthYear = (d: string) => thaiDate(d);
const short = (m: string) => thaiMonth(m);
const monLabel = (m: string, prev?: string) => { const [mm, yy] = thaiMonth(m).split(' '); return !prev || prev.slice(0, 4) !== m.slice(0, 4) ? `${mm} ${yy}` : mm; };
const whole = (s: number) => baht(Math.round(s / 100) * 100);

export function DeskGoals() {
  const data = useGoalsData();
  const [sp, setSp] = useSearchParams();
  const [sheet, setSheet] = useState<{ k: 'adjust'; mode: AdjustMode } | { k: 'edit' } | { k: 'pvd' } | { k: 'create'; type: GoalType | null } | null>(null);
  const [ask, setAsk] = useState<'spend' | 'delete' | null>(null);
  const [drag, setDrag] = useState<{ id: string; type: GoalType; over: string | null } | null>(null);
  if (!data?.settings) return null;
  const s = data.settings;
  const cur = appCycle(localToday(), s.pay, s.startCycle);
  const open = data.goals.filter((g) => !g.closed);
  const order = goalCats(s).order;
  const byType = (t: GoalType) => open.filter((g) => g.type === t).sort(goalSort);
  const list = order.flatMap(byType);
  // ไม่ได้เลือกเป้า = ภาพรวม 4 หมวดแบบมือถือก่อน (เจ้าของขอ 13 พ.ย. 69)
  const sel = list.find((g) => g.id === sp.get('g')) ?? null;
  const pick = (id: string | null) => setSp((p) => { if (id) p.set('g', id); else p.delete('g'); return p; });
  const hasPvd = data.goals.some((g) => g.type === 'pvd');

  const sum = (t: GoalType) => {
    const gs = byType(t);
    const bal = gs.reduce((x, g) => x + goalBalance(g, data.adjustments), 0);
    const tgt = gs.reduce((x, g) => x + g.target, 0);
    return { gs, bal, tgt, plan: gs.reduce((x, g) => x + planOf(g, data.items)(cur), 0), pct: tgt ? bal / tgt : 0 };
  };
  const sv = sum('saving'), iv = sum('invest');
  const total = sv.bal + iv.bal, totalT = sv.tgt + iv.tgt;

  const drop = async (t: GoalType, beforeId: string | null) => {
    if (!drag || drag.type !== t) return;
    const orders = reorderGoals(byType(t), drag.id, beforeId);
    setDrag(null);
    await setGoalOrder(db, orders);
  };

  return (
    <div className={`dg${sel || !list.length ? '' : ' ov'}`}>
      <DeskBar actions={<button className="ib pri" onClick={() => setSheet({ k: 'create', type: null })}><Icon name="plus" size={16} stroke={2.2} />สร้างเป้าหมายใหม่</button>} />
      {(sel || !list.length) && <aside className="dg-left" aria-label="รายการเป้าหมาย">
        <button className="dg-total gx-mini-hero" onClick={() => pick(null)} aria-current={!sel} aria-label="ภาพรวมเป้าหมาย">
          <span className="k">เงินในเป้าหมายรวม</span>
          <b className="num v">{baht(total)}</b>
          <span className="bar"><span style={{ width: barW(totalT ? total / totalT : 0) }} /></span>
          <span className="ft num"><span>{totalT ? `จาก ${baht(totalT)} · ` : ''}ไม่รวม PVD</span>{sv.plan + iv.plan > 0 && <b>+{baht(sv.plan + iv.plan)} เดือนนี้</b>}</span>
        </button>
        {order.map((t) => {
          const c = sum(t);
          const addOff = t === 'pvd' && hasPvd;
          return (
            <section key={t} className={`dg-grp ${TILE[t]}`} aria-label={CAT[t].name}
              onDragOver={(e) => { if (drag?.type === t) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); drop(t, null); }}>
              <div className="dg-gh">
                <span className="gic ic"><Icon name={CAT[t].icon} size={16} stroke={2} /></span>
                <span className="gt"><span className="nm">{CAT[t].name}</span>
                  {c.gs.length > 0 && <span className="num s sub"><b>{whole(c.bal)}</b> / {whole(c.tgt)} · {pctText(c.pct)}</span>}</span>
                <button className="icb" aria-label={addOff ? 'มี PVD แล้ว' : `เพิ่มเป้าในหมวด${CAT[t].name}`} disabled={addOff} onClick={() => setSheet({ k: 'create', type: t })}><Icon name="plus" size={16} stroke={2.2} /></button>
              </div>
              {c.gs.length === 0 && <div className="dg-none">ยังไม่มีเป้าในหมวดนี้</div>}
              {c.gs.map((g) => {
                const o = goalOutlook(g, data.items, data.adjustments, cur);
                const col = colorOf(g.color);
                const when = g.dueMonth ?? o.reachMonth;
                return (
                  <div key={g.id} className={`dg-row${sel?.id === g.id ? ' on' : ''}${drag?.over === g.id ? ' dropto' : ''}${drag?.id === g.id ? ' dragging' : ''}`}
                    onDragOver={(e) => { if (drag?.type === t) { e.preventDefault(); e.stopPropagation(); if (drag.over !== g.id) setDrag({ ...drag, over: g.id }); } }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(t, g.id); }}>
                    {c.gs.length > 1 && <span className="grip" draggable aria-label={`ลากเพื่อย้าย ${g.name}`} title="ลากเพื่อเรียง"
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ id: g.id, type: t, over: null }); }} onDragEnd={() => setDrag(null)}><Icon name="grip" size={14} stroke={2} /></span>}
                    <button className="dg-pick" onClick={() => pick(g.id)} aria-current={sel?.id === g.id}>
                      <span className="ic" style={{ background: `color-mix(in srgb, ${col.ring} 16%, var(--card))`, color: col.ring }}><Icon name={g.icon as IconName} size={18} stroke={2} /></span>
                      <span className="tx">
                        <span className="r1"><b>{g.name}</b><span className="num p" style={{ color: col.text }}>{pctText(o.pct)}</span></span>
                        <span className="bar"><span style={{ width: barW(o.pct), background: col.ring }} /></span>
                        <span className="r3 num"><span><b>{whole(o.balance)}</b> / {whole(g.target)}</span><span>{when ? `ครบ ${short(when)}` : 'ไม่กำหนดวันครบ'}</span></span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </section>
          );
        })}
      </aside>}

      <div className="dg-right">
        {sel ? <Detail key={sel.id} g={sel} data={data} cur={cur} onSheet={setSheet} onAsk={setAsk} />
          : list.length > 0 ? <Overview data={data} cur={cur} order={order} onGoal={pick} onPick={(t) => { const g = byType(t)[0]; if (g) pick(g.id); else setSheet({ k: 'create', type: t }); }} />
          : (
            <section className="dg-card dg-empty">
              <span className="eic"><Icon name="goal" size={22} stroke={2} /></span>
              <h2>ยังไม่มีเป้าหมาย</h2>
              <p>เลือกแบบของเป้าก่อน แล้วตั้งยอดและเวลา<br />เลือกเพิ่มลงแผนรายเดือนได้ตอนสร้าง</p>
              <div className="opts">
                {TYPES.filter((t) => order.includes(t) || !hasPvd).map((t) => (
                  <button key={t} className={`k-${TONE[t]}`} onClick={() => setSheet({ k: 'create', type: t })}>
                    <span className="ic"><Icon name={CAT[t].icon} size={18} stroke={2} /></span>
                    <span className="tx"><b>{CAT[t].name}</b><span>{EMPTY_HINT[t]}</span></span>
                  </button>
                ))}
              </div>
            </section>
          )}
      </div>

      {sel && sheet?.k === 'adjust' && <AdjustSheet goal={sel} balance={goalBalance(sel, data.adjustments)} initial={sheet.mode} modes={sel.type === 'pvd' ? ['set'] : undefined} onClose={() => setSheet(null)} />}
      {sel && sheet?.k === 'edit' && <EditGoalSheet goal={sel} onDelete={() => { setSheet(null); setAsk('delete'); }} onClose={() => setSheet(null)} />}
      {sel && sheet?.k === 'pvd' && <PvdSheet goal={sel} current={cur} onClose={() => setSheet(null)} />}
      {sheet?.k === 'create' && (
        <SheetFrame label="เป้าหมายใหม่" className="sheet gx-sheet dg-create" onClose={() => setSheet(null)}>
          <GoalCreate embed={{ type: sheet.type, onClose: () => setSheet(null), onDone: (id) => { setSheet(null); pick(id); } }} />
        </SheetFrame>
      )}
      {sel && ask && <AskDialog kind={ask} g={sel} data={data} cur={cur} onClose={() => setAsk(null)} onDone={() => { setAsk(null); setSp((p) => { p.delete('g'); return p; }, { replace: true }); }} />}
    </div>
  );
}

function Detail({ g, data, cur, onSheet, onAsk }: {
  g: Goal; data: GoalsData; cur: string;
  onSheet: (s: { k: 'adjust'; mode: AdjustMode } | { k: 'edit' } | { k: 'pvd' }) => void; onAsk: (a: 'spend' | 'delete') => void;
}) {
  const pay = data.settings!.pay;
  const o = goalOutlook(g, data.items, data.adjustments, cur);
  const col = colorOf(g.color);
  const pvd = g.type === 'pvd', spend = g.type === 'goalSpend';
  const linked = data.items.filter((i) => i.goalId === g.id);
  const group = (i: PlanItem) => data.groups.find((x) => x.id === i.groupId)?.name ?? '';
  const left = (m: string) => Math.max(monthDiff(cur, m), 0);
  const c = pvd ? pvdContribution(g, cur) : null;
  const cyc = (a: GoalAdjustment) => a.cycleMonth ?? cycleOf(a.date, pay);
  const created = cycleOf(localToday(new Date(g.createdAt)), pay);
  const bars = goalChart(g, data.items, data.adjustments, cur, created, cyc);
  const rows = goalHistory(g, data.adjustments);
  const period = (i: PlanItem) => `${short(i.period.start)} – ${i.period.endMode === 'month' && i.period.endMonth ? short(i.period.endMonth) : i.period.endMode === 'goal' ? 'ถึงเป้า' : 'ไม่กำหนด'}`;
  // รายจ่ายตามเป้าหมาย: เดือนที่กันแล้ว / ทั้งหมด (เดือนแรกในแผนถึงเดือนก่อนใช้เงิน)
  const start = g.depositFrom ?? linked.reduce<string | null>((m, i) => (!m || i.period.start < m ? i.period.start : m), null);
  const span = start && g.dueMonth ? Math.max(monthDiff(start, g.dueMonth), 0) : 0;
  const doneUntil = nextDepositCycle(g, data.adjustments, cur);
  const filled = start && span ? Math.min(Math.max(monthDiff(start, doneUntil), 0), span) : 0;

  const stats: [string, React.ReactNode, string?][] = pvd ? [
    ['เหลืออีก', baht(o.remaining)],
    ['เงินสมทบต่อเดือน', <span className="pos">+{baht(c ? c.mine + c.employer : 0)}</span>],
    ['เดือนครบกำหนด', 'ไม่กำหนด'],
    ['คาดการณ์ตามเงินสมทบ', o.done ? 'ครบเป้าแล้ว' : o.reachMonth ? `ครบ ${short(o.reachMonth)}` : '–', o.reachMonth && !o.done ? `อีก ${left(o.reachMonth)} เดือน` : undefined]
  ] : spend ? [
    ['เหลืออีก', baht(o.remaining)],
    ['กันเงินรายเดือน', span ? `${filled} / ${span} เดือน` : '–', o.planNow ? `เดือนละ ${baht(o.planNow)}` : undefined],
    ['เดือนครบกำหนด', g.dueMonth ? short(g.dueMonth) : 'ไม่กำหนด', g.dueMonth ? 'ใช้เงินเดือนนี้' : undefined],
    ['สถานะ', o.done ? <span className="pos">ครบเป้าแล้ว</span> : 'กำลังกันเงิน']
  ] : [
    ['เหลืออีก', baht(o.remaining)],
    ['แผนเดือนนี้', <span className="pos">+{baht(o.planNow)}</span>],
    ['เดือนครบกำหนด', g.dueMonth ? short(g.dueMonth) : 'ไม่กำหนด', g.dueMonth ? 'ตั้งไว้เอง' : undefined],
    ['คาดการณ์ตามแผน', o.done ? 'ครบเป้าแล้ว' : o.reachMonth ? `ครบ ${short(o.reachMonth)}` : '–', o.reachMonth && !o.done ? `อีก ${left(o.reachMonth)} เดือน` : undefined]
  ];
  const fix = <button className="act" onClick={() => onSheet({ k: 'adjust', mode: 'set' })}><Icon name="edit" size={16} stroke={2} />แก้ยอดคงเหลือ</button>;

  return (
    <>
      <section className="dg-card dg-head" style={{ ['--gr' as string]: col.ring, ['--gt' as string]: col.track }}>
        <div className="r1">
          <span className="ic"><Icon name={g.icon as IconName} size={22} stroke={2} /></span>
          <span className="tx"><h2>{g.name}</h2><span className="ty" style={{ color: col.text }}>{CAT[g.type].name}</span></span>
          <button className="ib" onClick={() => onSheet({ k: 'edit' })}><Icon name="edit" size={15} stroke={2} />แก้ข้อมูลเป้า</button>
        </div>
        <span className="k">ยอดตอนนี้</span>
        <div className="now num"><b>{baht(o.balance)}</b><span className="of">/ ยอดเป้า {baht(g.target)} บาท</span><span className="p" style={{ color: col.text }}>{pctText(o.pct)}</span></div>
        <span className="bar"><span style={{ width: barW(o.pct) }} /></span>
        <div className="stats">
          {stats.map(([k, v, sub]) => <div key={k}><span className="k">{k}</span><b className="num">{v}</b>{sub && <span className="s num">{sub}</span>}</div>)}
        </div>
        {g.note && <div className="gnote"><span className="k">โน้ต</span><span>{g.note}</span></div>}
        {spend && (
          <div className="dg-info">
            <Icon name="check" size={16} stroke={2.2} />
            <span>กด "ใช้เงินก้อนนี้แล้ว" ยอดที่กันไว้ <b className="num">{baht(o.balance)} บาท</b> จะบันทึกเป็นรายจ่ายเดือนนี้ แล้วปิดเป้านี้{linked.length > 0 && ' · แผนเดือนถัดไปจะหยุดกันเงินก้อนนี้'}</span>
          </div>
        )}
        <div className="acts">
          {pvd ? fix : (
            <>
              <button className="act" onClick={() => onSheet({ k: 'adjust', mode: 'add' })}><Icon name="plus" size={16} stroke={2.2} />เพิ่มเงิน</button>
              <button className="act" onClick={() => onSheet({ k: 'adjust', mode: 'out' })}><Icon name="wallet" size={16} stroke={2} />ถอนออก</button>
              {fix}
            </>
          )}
          {spend && <><span className="sp" /><button className="act pri" onClick={() => onAsk('spend')}><Icon name="check" size={16} stroke={2.2} />ใช้เงินก้อนนี้แล้ว</button></>}
        </div>
      </section>

      {pvd ? (
        <section className="dg-card dg-sec">
          <h3>เงินสมทบต่อเดือน</h3>
          <div className="dg-two">
            <div><span className="k">ส่วนของคุณ</span><b className="num">{baht(c?.mine ?? 0)}</b><span className="s">{c?.mineBp !== undefined ? `${bpText(c.mineBp)}% ของเงินเดือน` : 'หักจากเงินเดือน'}</span></div>
            <div><span className="k">นายจ้างสมทบ</span><b className="num">{baht(c?.employer ?? 0)}</b><span className="s">{c?.employerBp !== undefined ? `${bpText(c.employerBp)}% ของเงินเดือน` : 'ตามเงินสมทบ'}</span></div>
          </div>
          {c?.gross ? <p className="muted num">คิดจากเงินเดือนก่อนหัก {baht(c.gross)} · มีผลตั้งแต่ {short(c.from)} · บวกเข้า PVD ให้เองทุกครั้งที่เงินเดือนเข้า</p> : <p className="muted">บวกเข้า PVD ให้เองทุกครั้งที่เงินเดือนเข้า</p>}
          <button className="act soft" onClick={() => onSheet({ k: 'pvd' })}>แก้เงินสมทบ<Icon name="chevron" size={14} stroke={2.2} /></button>
        </section>
      ) : (
        <section className="dg-card dg-sec">
          <h3>รายการในแผนที่ส่งเงินเข้าเป้านี้</h3>
          {linked.length === 0 && <p className="muted">ยังไม่อยู่ในแผนรายเดือน</p>}
          {linked.map((i) => (
            <div key={i.id} className="dg-item"><span className="tx"><b>{i.name}</b><span>{group(i)} · {period(i)}</span></span><b className="num">{baht(rawAmount(i, cur))} / เดือน</b></div>
          ))}
          <Link className="act soft" to={`/?tab=plan&y=${cur.slice(0, 4)}`}>{linked.length ? 'แก้ในตารางแผน' : 'เพิ่มในตารางแผน'}<Icon name="chevron" size={14} stroke={2.2} /></Link>
        </section>
      )}

      <section className="dg-card dg-sec">
        <h3>ยอดจริงและคาดการณ์</h3>
        <Chart bars={bars} target={g.target} cur={cur} ring={col.ring} />
      </section>

      <section className="dg-card dg-sec dg-hist">
        <div className="hh"><h3>ประวัติยอด</h3><span className="muted num">ใหม่ไปเก่า · {rows.length} รายการ</span></div>
        <div className="hr th"><span>วันที่</span><span>รายการ</span><span className="r">จำนวน</span><span className="r">ยอดหลังรายการ</span></div>
        {rows.map((r) => {
          const t = rowText(r.adj, g, linked[0]?.name ?? g.name, cyc);
          return (
            <div key={r.id} className="hr">
              <span className="num">{dayMonthYear(r.date)}</span>
              <span className="tx"><span>{t.t}</span>{t.s && <small>{t.s}</small>}</span>
              <b className={`r num ${r.adj ? (r.delta < 0 ? 'neg' : r.delta > 0 ? 'pos' : '') : ''}`}>{r.adj ? `${r.delta > 0 ? '+' : r.delta < 0 ? '−' : ''}${baht(Math.abs(r.delta))}` : baht(r.delta)}</b>
              <span className="r num">{baht(r.after)}</span>
            </div>
          );
        })}
      </section>
    </>
  );
}

function rowText(a: GoalAdjustment | null, g: Goal, itemName: string, cyc: (a: GoalAdjustment) => string): { t: string; s: string } {
  if (!a) return { t: 'ยอดยกมา', s: 'ตอนสร้างเป้า' };
  const note = [a.reason, a.note].filter(Boolean).join(' · ');
  switch (a.kind) {
    case 'planDeposit': return g.type === 'pvd' ? { t: 'ส่วนของคุณ', s: `หักจากเงินเดือน · รอบ ${short(cyc(a))}` } : { t: 'บวกตามแผน', s: `รายการ "${itemName}" · รอบ ${short(cyc(a))}` };
    case 'employer': return { t: 'นายจ้างสมทบ', s: `รอบ ${short(cyc(a))}` };
    case 'deposit': return { t: 'เพิ่มเงิน', s: note };
    case 'withdraw': return { t: 'ถอนออก', s: note };
    case 'spent': return { t: 'ใช้เงินก้อนนี้แล้ว', s: 'บันทึกเป็นรายจ่าย' };
    default: return { t: 'แก้ยอดคงเหลือ', s: note };
  }
}

/** กราฟแท่งรายเดือน: ทึบ = ยอดจริง · จาง = คาดการณ์ · เส้นประ = ยอดเป้า · ตัวเลขบนแท่ง */
/** ลายขีดเฉียงแบบช่องนอกช่วงในตารางแผน แต่เป็นสีของเป้า */
const stripes = (c: string) => `repeating-linear-gradient(135deg, color-mix(in srgb, ${c} 55%, transparent) 0 2px, color-mix(in srgb, ${c} 14%, transparent) 2px 6px)`;
function Chart({ bars, target, cur, ring }: { bars: ChartBar[]; target: number; cur: string; ring: string }) {
  const top = Math.max(target, ...bars.map((b) => b.value), 1);
  const H = 150;
  const h = (v: number) => Math.max(Math.round((Math.max(v, 0) / top) * H), 3);
  return (
    <div className="dg-chart" role="img" aria-label={`กราฟยอดรายเดือน ${bars.map((b) => `${thaiMonth(b.month)} ${whole(b.value)}${b.actual ? '' : ' คาดการณ์'}`).join(', ')}`}>
      <div className="plot" style={{ height: H + 24 }}>
        <div className="tgt" style={{ bottom: Math.round((target / top) * H) }}><span className="num">เป้า {whole(target)}</span></div>
        <div className="cols" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
          {bars.map((b) => (
            <div key={b.month} className="col" title={`${thaiMonth(b.month)} · ${baht(b.value)} บาท${b.actual ? '' : ' (คาดการณ์)'}`}>
              <span className={`lb num${b.month === cur ? ' now' : ''}`}>{whole(b.value)}</span>
              <span className="b" style={{ height: h(b.value), background: b.actual ? ring : stripes(ring) }} />
            </div>
          ))}
        </div>
      </div>
      <div className="xl" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
        {bars.map((b, i) => <span key={b.month} className={b.month === cur ? 'now' : ''}>{monLabel(b.month, bars[i - 1]?.month)}</span>)}
      </div>
      <div className="lgd"><span><i style={{ background: ring }} />ยอดจริงในแอป</span>{bars.some((b) => !b.actual) && <span><i style={{ background: stripes(ring) }} />คาดการณ์ตามแผน</span>}</div>
    </div>
  );
}

function AskDialog({ kind, g, data, cur, onClose, onDone }: { kind: 'spend' | 'delete'; g: Goal; data: GoalsData; cur: string; onClose: () => void; onDone: () => void }) {
  const bal = goalBalance(g, data.adjustments);
  const linked = data.items.filter((i) => i.goalId === g.id);
  const planNow = planOf(g, data.items)(cur);
  return (
    <div className="dp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dp-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dg-ask-t">
        {kind === 'spend' ? (
          <>
            <h2 id="dg-ask-t">ปิดเป้า{g.name}?</h2>
            <p>ยอดที่กันไว้ <b className="num nw">{baht(bal)} บาท</b> จะบันทึกเป็นรายจ่ายเดือนนี้{linked.length > 0 && <> และแผนเดือนถัดไปจะหยุดกันเงินก้อนนี้ <b className="num nw">{baht(planNow)}</b>/เดือน</>}</p>
            <div className="acts">
              <button className="ib" autoFocus onClick={onClose}>ยกเลิก</button>
              <button className="ib pri" onClick={async () => { await spendGoal(db, { goal: g, balance: bal, currentCycle: cur, today: localToday() }); onDone(); }}>ปิดเป้า</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="dg-ask-t">ลบเป้า "{g.name}" ?</h2>
            <p>ยอด <span className="num nw">{baht(bal)} บาท</span> ประวัติยอด{linked.length ? ` และรายการในแผน ${linked.length} รายการ` : ''} จะถูกลบด้วย</p>
            <p className="muted">เงินในบัญชีจริงไม่ได้หายไป แค่ลบข้อมูลออกจากแอป</p>
            <div className="acts">
              <button className="ib" autoFocus onClick={onClose}>ยกเลิก</button>
              <button className="ib danger" onClick={async () => { await deleteGoal(db, g.id); onDone(); }}>ลบเป้า</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const TILE: Record<GoalType, string> = { saving: 't-sav', invest: 't-inv', goalSpend: 't-spend', pvd: 't-pvd' };
const EMPTY_EX: Record<GoalType, string> = { saving: 'เช่น เงินสำรอง · เก็บเงินก้อน', invest: 'เช่น กองทุนรวม · นับเฉพาะเงินต้น', goalSpend: 'เช่น ทริปเที่ยว · นับเป็นรายจ่าย', pvd: 'กองทุนสำรองเลี้ยงชีพ · แยกจากงบ' };

/** ภาพรวม: ก้อนรวม + หมวดใหญ่ 4 ก้อน (หน้าตาเดียวกับมือถือ) · คลิกหมวดแล้วเปิดเป้าแรกของหมวด */
function Overview({ data, cur, order, onPick, onGoal }: { data: GoalsData; cur: string; order: GoalType[]; onPick: (t: GoalType) => void; onGoal: (id: string) => void }) {
  const sum = (t: GoalType) => {
    const gs = data.goals.filter((g) => g.type === t && !g.closed).sort(goalSort);
    const bal = gs.reduce((x, g) => x + goalBalance(g, data.adjustments), 0);
    const tgt = gs.reduce((x, g) => x + g.target, 0);
    return { gs, bal, tgt, plan: gs.reduce((x, g) => x + planOf(g, data.items)(cur), 0), pct: tgt ? bal / tgt : 0 };
  };
  const S = Object.fromEntries(TYPES.map((t) => [t, sum(t)])) as Record<GoalType, ReturnType<typeof sum>>;
  const total = S.saving.bal + S.invest.bal, target = S.saving.tgt + S.invest.tgt;
  const pct = target ? total / target : 0;
  const C = 251.3;
  const segS = target ? Math.min(S.saving.bal / target, 1) * C : 0;
  const segI = target ? Math.min(S.invest.bal / target, 1) * C : 0;
  const gap = segS > 0 && segI > 0 ? 2 : 0;
  return (
    <div className="gx dg-ov">
      <section className="gx-hero" aria-label="เป้าหมายรวม">
        <div className="gx-hero-top">
          <span className="gx-ring" style={{ width: 104, height: 104 }}>
            <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
              <circle cx="52" cy="52" r="40" fill="none" stroke="rgba(22,35,28,.12)" strokeWidth="12" />
              {segS > 0 && <circle cx="52" cy="52" r="40" fill="none" stroke="#1E3B2C" strokeWidth="12" strokeDasharray={`${segS.toFixed(1)} ${C}`} transform="rotate(-90 52 52)" />}
              {segI > 0 && <circle cx="52" cy="52" r="40" fill="none" stroke="#FFFFFF" strokeWidth="12" strokeDasharray={`${Math.max(segI - gap, 0).toFixed(1)} ${C}`} strokeDashoffset={-(segS + gap)} transform="rotate(-90 52 52)" />}
            </svg>
            <span className="gx-ring-c"><span className="num" style={{ fontSize: 24, fontWeight: 700 }}>{pctText(pct)}</span><span style={{ fontSize: 11, color: '#2F4214' }}>ของเป้า</span></span>
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="k">เงินในเป้าหมายรวม</span>
            <span className="v num"><b>{baht(total)}</b></span>
            <span className="s num">จาก {baht(target)} · ไม่รวม PVD</span>
            {S.saving.plan + S.invest.plan > 0 && <span className="pill num">+{baht(S.saving.plan + S.invest.plan)} เดือนนี้</span>}
          </span>
        </div>
        <div className="gx-stats3">
          <div><span className="gx-mini" style={{ background: '#1E3B2C', color: '#D9F06A' }}><Icon name="coins" size={16} stroke={2} /></span><span className="t"><span>เงินออม</span><b className="num">{baht(S.saving.bal)}</b></span></div>
          <div><span className="gx-mini" style={{ background: '#FFFFFF', color: '#1E3B2C' }}><Icon name="trend" size={16} stroke={2.1} /></span><span className="t"><span>ลงทุน</span><b className="num">{baht(S.invest.bal)}</b></span></div>
          <div><span className="gx-mini" style={{ border: '1.5px dashed rgba(22,35,28,.45)', color: '#2F4214' }}><Icon name="flag" size={16} stroke={2} /></span><span className="t"><span>ตามเป้า</span><b className="num">{baht(S.goalSpend.bal)}</b></span></div>
        </div>
      </section>
      <div className="gx-grid dg-ovgrid">
        {order.map((t) => {
          const c = S[t];
          const empty = c.gs.length === 0;
          return (
            <div key={t} role="button" tabIndex={0} className={`gx-tile ${empty ? 't-empty' : TILE[t]}`} onClick={() => onPick(t)} onKeyDown={(e) => { if (e.key === 'Enter') onPick(t); }}
              aria-label={empty ? `${CAT[t].name} ยังไม่มีเป้า ตั้งเป้าใหม่` : `${CAT[t].name} ${baht(c.bal)} จาก ${baht(c.tgt)} ดูรายละเอียด`}>
              {empty ? (
                <>
                  <span className="ic"><Icon name={CAT[t].icon} size={20} stroke={1.9} /></span>
                  <span className="nm">{CAT[t].name}</span>
                  <span className="ex">{EMPTY_EX[t]}</span>
                  <span className="cta"><Icon name="plus" size={16} stroke={2.4} />{t === 'pvd' ? 'ตั้งค่า PVD' : 'ตั้งเป้า'}</span>
                </>
              ) : (
                <>
                  <span className="top"><span className="ic"><Icon name={CAT[t].icon} size={20} stroke={1.9} /></span><span className="sub"><Icon name="upRight" size={20} stroke={2} /></span></span>
                  <span className="nm">{CAT[t].name}{t === 'invest' && <small className="sub"> · เงินต้น</small>}{t === 'pvd' && <small className="sub"> · แยกจากงบ</small>}</span>
                  <span className="amt num"><b>{whole(c.bal)}</b> <span className="sub nw">/ {whole(c.tgt)}</span></span>
                  <span className="gx-bar"><span style={{ width: barW(c.pct) }} /></span>
                  <span className="ft sub">{t === 'pvd' ? <span className="num">+{baht(c.plan)} / เดือน</span> : <span>{c.gs.length} เป้า</span>}<b className="num">{pctText(c.pct)}</b></span>
                  <span className="dg-ovgoals">
                    {c.gs.map((g) => {
                      const b = goalBalance(g, data.adjustments), p = g.target ? b / g.target : 0, col = colorOf(g.color);
                      return (
                        <button key={g.id} className="og" onClick={(e) => { e.stopPropagation(); onGoal(g.id); }} aria-label={`${g.name} ${pctText(p)} ดูรายละเอียด`}>
                          <span className="ic" style={{ background: `color-mix(in srgb, ${col.ring} 16%, var(--card))`, color: col.ring }}><Icon name={g.icon as IconName} size={14} stroke={2} /></span>
                          <span className="tx"><span className="r1"><b>{g.name}</b><span className="num">{pctText(p)}</span></span>
                            <span className="bar"><span style={{ width: barW(p), background: col.ring }} /></span>
                            <span className="r3 num"><b>{whole(b)}</b> / {whole(g.target)}</span></span>
                        </button>
                      );
                    })}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
