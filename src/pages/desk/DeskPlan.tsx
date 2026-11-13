// ตาราง 12 เดือนบนคอม (บอร์ด Desk-Plan-Paid / -Edit / -Scope / -After / -Undo / Desk-Plan12-1280 / -Folded / -Empty)
// แก้ในช่องแล้วบันทึกทันที (ต่างจากมือถือ) · ย้อนกลับได้หลายขั้นในรอบที่เปิดหน้า · ติ๊กจ่ายแล้วได้เฉพาะเดือนของแผนปัจจุบัน
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Month, PaidCheck, PlanItem, Satang } from '../../db/types';
import { thaiDate, thaiMonth } from '../../calc/dates';
import { formatBaht } from '../../calc/money';
import { goalAwareAmountOf } from '../../calc/goals';
import { planTotals } from '../../calc/plan';
import { clampYear, kindTone, planGrid, yearBounds, type GridCell } from '../../calc/planGrid';
import { canTick, tickable as tickList, emptyHistory, parseCell, push, redo, replaceLast, undo, type History, type Op } from '../../calc/planEdit';
import { amountOp, tickOp, writeOps } from '../../db/planOps';
import { Icon } from '../../components/Icon';
import { DeskBar, useDeskSlots } from '../../components/DeskShell';
import { DeskItemPanel } from './DeskItemPanel';
import { usePlanData, type PlanData } from '../plan/usePlanData';
import { usePlanMonth } from '../plan/usePlanMonth';
import { DeskYear } from './DeskYear';
import { iconOf } from '../plan/planUi';

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
const mon = (m: Month) => thaiMonth(m).split(' ')[0];
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

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
  const pm = usePlanMonth(data);
  if (!data?.settings || !pm) return null;
  return <DeskTable data={data} cycle={pm.cycle} planCur={pm.planCur} />;
}

type Pos = { itemId: string; mi: number };
type Edit = Pos & { text: string; bad: boolean };
type Scope = Pos & { item: PlanItem; amount: Satang; scope: 'month' | 'from' };
type Toast = { text: string; key: number };
type Flash = { itemId: string; groupId: string; months: Set<number>; key: number };

function DeskTable({ data, cycle, planCur: planNow }: { data: PlanData; cycle: Month; planCur: Month }) {
  // ติ๊กครบแล้วแผนไปเดือนถัดไป · กด "ดูรอบ …" เพื่อกลับไปดูหรือแก้ติ๊กของรอบที่แล้ว
  const [look, setLook] = useState(false);
  const planCur = look && planNow !== cycle ? cycle : planNow;
  const [sp, setSp] = useSearchParams();
  const box = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<Tier>('w');
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Pos | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [hist, setHist] = useState<History>(emptyHistory);
  const [histOpen, setHistOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [tickMode, setTickMode] = useState(false); // โหมดติ๊ก: คลิกช่องเดือนนี้ได้หลายรายการ
  const [panelId, setPanelId] = useState<string | null>(null); // แผงรายละเอียดรายการ
  const [adding, setAdding] = useState<{ groupId: string; text: string } | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; groupId: string; over: string | null } | null>(null);
  const draft = useRef<PlanItem | null>(null); // ร่างที่ยังไม่บันทึกในแผงรายละเอียด
  const [ask, setAsk] = useState<{ next: string | null } | null>(null); // ถามก่อนปิดแผงที่ยังไม่บันทึก
  const pending = useRef<PlanItem | null>(null); // รายการที่เพิ่งเพิ่ม (ก่อนข้อมูลสดมาถึง)
  const slots = useDeskSlots();
  useEffect(() => { slots?.setSideOpen(!!panelId); return () => slots?.setSideOpen(false); }, [panelId, slots]);
  useEffect(() => { slots?.setPlanMonth(planCur); return () => slots?.setPlanMonth(null); }, [planCur, slots]);
  useEffect(() => { if (planNow === cycle) setLook(false); }, [planNow, cycle]);
  const checks = useLiveQuery(() => db.paidChecks.where('cycleMonth').equals(planCur).toArray(), [planCur]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width; setTier(w >= 1150 ? 'w' : w >= 990 ? 'm' : 's'); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 2000); return () => clearTimeout(t); }, [flash]);


  const curYear = Number(planCur.slice(0, 4));
  const bounds = yearBounds(data.items, Number(cycle.slice(0, 4)));
  const year = clampYear(Number(sp.get('y')) || curYear, bounds);
  const setYear = (y: number) => { setSel(null); setEdit(null); setScope(null); setSp((p) => { p.set('tab', 'plan'); p.set('y', String(y)); return p; }); };
  const amountOfFor = (items: PlanItem[]) => goalAwareAmountOf(data.goals, items, data.adjustments, cycle);
  const amountOf = amountOfFor(data.items);


  const yearView = sp.get('view') === 'year';
  const g = planGrid(data.groups, data.items, year, amountOf);
  const checkMap = new Map<string, PaidCheck>((checks ?? []).filter((c) => c.checked).map((c) => [c.planItemId, c]));
  const allFolded = g.groups.length > 0 && g.groups.every((x) => folded.has(x.group.id));
  const toggle = (id: string) => setFolded((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const empty = data.items.length === 0;
  const incomeGroup = data.groups.find((x) => x.enabled && x.kind === 'income');
  const toTick = tickList(data.groups, data.items, planCur, amountOf);
  const nTicked = toTick.filter((i) => checkMap.has(i.id)).length;

  // แถวที่เห็น (ใช้เลื่อนช่องด้วยคีย์)
  const rows = g.groups.filter((gg) => !folded.has(gg.group.id)).flatMap((gg) => gg.rows.map((r) => ({ ...r, kind: gg.group.kind, groupId: gg.group.id })));
  const rowOf = (id: string) => rows.find((r) => r.item.id === id);
  const live = (id: string) => data.items.find((i) => i.id === id);

  const leftoverAt = (items: PlanItem[], m: Month) => planTotals(data.groups, items, m, amountOfFor(items)).leftover;

  const apply = useCallback(async (label: string, ops: Op[], replace = false) => {
    await writeOps(db, ops);
    setHist((h) => (replace ? replaceLast(h, { label, ops }) : push(h, { label, ops })));
  }, []);

  /** บันทึกค่าที่พิมพ์ · คืน false ถ้าค่าผิด */
  const commit = async (e: Edit): Promise<boolean> => {
    const v = parseCell(e.text);
    if (v === null) { setEdit({ ...e, bad: true }); return false; }
    setEdit(null);
    const item = live(e.itemId) ?? (pending.current?.id === e.itemId ? pending.current : undefined);
    if (!item) return true;
    const m = g.months[e.mi];
    if (v === amountOf(item, m)) return true;
    // ยอดแรกของรายการใหม่ (ยังไม่มียอด ใส่ที่เดือนเริ่ม) = ยอดปกติทุกเดือนจนกว่าจะแก้
    const first = item.defaultAmount === 0 && Object.keys(item.monthOverrides).length === 0 && m === item.period.start;
    const sc = first ? 'from' : 'month';
    const op = amountOp(item, m, v, sc);
    const lab = first ? `ตั้งแต่ ${mon(m)}` : `เฉพาะ ${mon(m)}`;
    const others = data.items.filter((i) => i.id !== item.id);
    const before = leftoverAt([...others, item], m);
    const after = leftoverAt([...others, op.after as PlanItem], m);
    await apply(`${item.name} · ${lab}`, [op]);
    if (!first) setScope({ itemId: item.id, mi: e.mi, item, amount: v, scope: 'month' });
    say(`บันทึกแล้ว · ${item.name} ${lab} · เงินเหลือ ${mon(m)} ${full(before)} → ${full(after)}`);
    const changed = new Set<number>(first ? g.months.map((_, i) => i).filter((i) => i >= e.mi) : [e.mi]);
    setFlash({ itemId: item.id, groupId: item.groupId, months: changed, key: Date.now() });
    return true;
  };

  const say = (text: string) => setToast({ text, key: Date.now() });

  const chooseScope = async (sc: 'month' | 'from') => {
    if (!scope || scope.scope === sc) { setScope(null); return; }
    const m = g.months[scope.mi];
    const op = amountOp(scope.item, m, scope.amount, sc);
    const before = leftoverAt(data.items.map((i) => (i.id === scope.item.id ? scope.item : i)), m);
    const after = leftoverAt(data.items.map((i) => (i.id === scope.item.id ? (op.after as PlanItem) : i)), m);
    const lab = sc === 'from' ? `ตั้งแต่ ${mon(m)}` : `เฉพาะ ${mon(m)}`;
    await apply(`${scope.item.name} · ${lab}`, [op], true);
    const months = new Set<number>(sc === 'from' ? g.months.map((_, i) => i).filter((i) => i >= scope.mi) : [scope.mi]);
    setFlash({ itemId: scope.item.id, groupId: scope.item.groupId, months, key: Date.now() });
    say(`บันทึกแล้ว · ${scope.item.name} ${lab} · เงินเหลือ ${mon(m)} ${full(before)} → ${full(after)}`);
    setScope(null);
  };

  const doUndo = async (n = 1) => {
    if (!hist.done.length) return;
    const labels = hist.done.slice(-n).map((x) => x.label);
    const r = undo(hist, n);
    await writeOps(db, r.writes);
    setHist(r.history); setScope(null); setHistOpen(false);
    say(n > 1 ? `ย้อนกลับ ${n} ขั้นแล้ว` : `ย้อนกลับแล้ว · ${labels[0]}`);
  };
  const doRedo = async () => {
    const s0 = hist.undone[hist.undone.length - 1];
    if (!s0) return;
    const r = redo(hist);
    await writeOps(db, r.writes);
    setHist(r.history);
    say(`ทำซ้ำแล้ว · ${s0.label}`);
  };

  const tick = async (itemId: string) => {
    const item = live(itemId);
    if (!item) return;
    const existing = checkMap.get(itemId);
    await apply(existing ? `เอาติ๊กออก ${item.name}` : `ติ๊กจ่ายแล้ว ${item.name}`, [tickOp(existing, planCur, itemId)]);
  };

  const savePanel = (next: PlanItem) => {
    const b = live(next.id);
    draft.current = null;
    if (!b) return;
    apply(`แก้ข้อมูล “${b.name}”`, [{ table: 'planItems', id: next.id, before: b, after: { ...next, updatedAt: Date.now() } }]);
    say(`บันทึกแล้ว · ${next.name}`);
  };
  /** เปิด/ปิด/สลับแผง · ถ้ามีร่างค้าง ถามก่อน */
  const openPanel = (next: string | null) => {
    if (panelId && draft.current && next !== panelId) { setAsk({ next }); return; }
    draft.current = null;
    setPanelId(next);
  };
  const finishAsk = (save: boolean) => {
    if (!ask) return;
    if (save && draft.current) savePanel(draft.current);
    draft.current = null;
    setPanelId(ask.next);
    setAsk(null);
  };

  /** เพิ่มรายการ: เริ่มเดือนนี้ถ้าดูปีปัจจุบัน ไม่งั้นเริ่ม ม.ค. ของปีที่ดู · then = 'amount' ไปใส่ยอดเดือนแรก, 'next' เปิดแถวใหม่ */
  const doAdd = async (then: 'amount' | 'next') => {
    if (!adding) return;
    const name = adding.text.trim();
    if (!name) { setAdding(null); return; }
    const start: Month = year === curYear ? planCur : `${year}-01`;
    const now = Date.now();
    const inGroup = data.items.filter((i) => i.groupId === adding.groupId);
    const it: PlanItem = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, groupId: adding.groupId, name, icon: 'other', defaultAmount: 0, monthOverrides: {},
      period: { start, endMode: 'none' }, accountId: null, goalId: null, logCategoryIds: [], order: Math.max(-1, ...inGroup.map((i) => i.order)) + 1, dueDay: null };
    pending.current = it;
    await apply(`เพิ่ม “${name}”`, [{ table: 'planItems', id: it.id, before: null, after: it }]);
    if (then === 'next') setAdding({ groupId: adding.groupId, text: '' });
    else { setAdding(null); const mi = g.months.indexOf(start); setSel({ itemId: it.id, mi }); setEdit({ itemId: it.id, mi, text: '', bad: false }); }
  };

  const doDelete = async (id: string) => {
    const item = live(id);
    setDelId(null);
    if (!item) return;
    const checks0 = await db.paidChecks.filter((c) => c.planItemId === id).toArray();
    const ops: Op[] = [{ table: 'planItems', id, before: item, after: null }, ...checks0.map((c) => ({ table: 'paidChecks' as const, id: c.id, before: c, after: null }))];
    await apply(`ลบ “${item.name}”`, ops);
    if (panelId === id) { draft.current = null; setPanelId(null); }
    if (sel?.itemId === id) setSel(null);
    say(`ลบ “${item.name}” แล้ว`);
  };

  /** ลากเรียงในหมวดเดียวกัน */
  const doDrop = async (targetId: string) => {
    if (!drag || drag.id === targetId) { setDrag(null); return; }
    const list = data.items.filter((i) => i.groupId === drag.groupId).sort((a, b) => a.order - b.order);
    const from = list.findIndex((i) => i.id === drag.id);
    const to = list.findIndex((i) => i.id === targetId);
    setDrag(null);
    if (from < 0 || to < 0) return;
    const next = [...list];
    const [m0] = next.splice(from, 1);
    next.splice(to, 0, m0);
    const now = Date.now();
    const ops: Op[] = next.flatMap((it, i) => (it.order === i ? [] : [{ table: 'planItems' as const, id: it.id, before: it, after: { ...it, order: i, updatedAt: now } }]));
    if (ops.length) await apply(`ย้าย “${m0.name}”`, ops);
  };

  const move = (p: Pos, dr: number, dc: number): Pos => {
    const i = rows.findIndex((r) => r.item.id === p.itemId);
    const ni = Math.min(Math.max(i + dr, 0), rows.length - 1);
    const mi = Math.min(Math.max(p.mi + dc, 0), 11);
    return { itemId: rows[ni]?.item.id ?? p.itemId, mi };
  };
  const editable = (p: Pos) => { const r = rowOf(p.itemId); return !!r && r.cells[p.mi].amount !== null; };
  const startEdit = (p: Pos, text?: string) => {
    const r = rowOf(p.itemId);
    if (!r || !editable(p)) return;
    setScope(null);
    setEdit({ ...p, text: text ?? String((r.cells[p.mi].amount ?? 0) / 100), bad: false });
  };

  // คีย์ลัดของตาราง (ไม่ทำงานตอนมีแผงหรือกล่องเปิด)
  useEffect(() => {
    const on = (ev: KeyboardEvent) => {
      if (yearView || delId || document.querySelector('.scrim')) return;
      const t = ev.target as HTMLElement;
      const inCell = t.classList?.contains('dp-in');
      if (!inCell && t.closest?.('input, textarea, select, [contenteditable]')) return;
      const mod = isMac ? ev.metaKey : ev.ctrlKey;
      if (mod && ev.key.toLowerCase() === 'z' && !inCell) { ev.preventDefault(); if (ev.shiftKey) doRedo(); else doUndo(); return; }
      if (mod && ev.key.toLowerCase() === 'y' && !inCell) { ev.preventDefault(); doRedo(); return; }
      if (inCell || !sel || mod || ev.altKey) return;
      const r = rowOf(sel.itemId);
      if (scope && (ev.key === '1' || ev.key === '2')) { ev.preventDefault(); chooseScope(ev.key === '1' ? 'month' : 'from'); return; }
      if (ev.key === 'Escape' && tickMode) { setTickMode(false); return; }
      if (ev.key === ' ') {
        if (tickMode && r && canTick(r.kind, g.months[sel.mi], planCur, r.cells[sel.mi].amount)) { ev.preventDefault(); tick(sel.itemId); }
        return;
      }
      const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (arrows[ev.key]) { ev.preventDefault(); setScope(null); setSel(move(sel, ...arrows[ev.key])); return; }
      if (ev.key === 'Tab') { ev.preventDefault(); setScope(null); setSel(move(sel, 0, ev.shiftKey ? -1 : 1)); return; }
      if (tickMode) return; // โหมดติ๊ก: ไม่แก้ยอด
      if (ev.key === 'Enter' || ev.key === 'F2') { ev.preventDefault(); startEdit(sel); return; }
      if (ev.key === 'Escape') { setScope(null); setSel(null); return; }
      if (/^[0-9.,]$/.test(ev.key)) { ev.preventDefault(); startEdit(sel, ev.key === ',' ? '' : ev.key); }
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  });

  const onInputKey = async (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (!edit) return;
    if (ev.key === 'Escape') { ev.preventDefault(); setEdit(null); return; }
    if (ev.key === 'Enter' || ev.key === 'Tab') {
      ev.preventDefault();
      const ok = await commit(edit);
      if (ok) setSel(ev.key === 'Enter' ? move(edit, ev.shiftKey ? -1 : 1, 0) : move(edit, 0, ev.shiftKey ? -1 : 1));
    }
  };
  const onInputBlur = () => {
    if (!edit) return;
    if (parseCell(edit.text) === null) { setEdit(null); return; } // ค่าผิดแล้วคลิกออก: ไม่บันทึก
    commit(edit);
  };

  const when = (m: Month) => (m < planCur ? 'past' : m === planCur ? 'cur' : 'fut');
  const cellCls = (m: Month) => `c num ${when(m)}`;
  const tri = (c: GridCell) => c.trend && <span className={`tri ${c.trend}`} aria-hidden="true">{c.trend === 'up' ? '▲' : '▼'}</span>;
  const cols = { gridTemplateColumns: COLS[tier] };
  const fl = (on: boolean) => (on && flash ? ' fl' : '');
  const flM = (mi: number) => !!flash && flash.months.has(mi);
  const flashKey = flash?.key ?? 0;

  if (yearView) return <DeskYear data={data} year={year} bounds={bounds} cur={planCur} amountOf={amountOf} />;

  return (
    <div className="dp">
      <DeskBar actions={
        <>
          <span className="dp-undo">
            <button className="ib l" disabled={!hist.done.length} onClick={() => doUndo()} title={`ย้อนกลับ (${isMac ? '⌘' : 'Ctrl'} Z)`}><Icon name="restore" size={16} stroke={2} />ย้อนกลับ</button>
            <button className="ib r" disabled={!hist.done.length} aria-label="ดูรายการที่แก้ล่าสุด" aria-expanded={histOpen} onClick={() => setHistOpen(!histOpen)}><Icon name="chevDown" size={14} stroke={2.2} /></button>
            {histOpen && hist.done.length > 0 && (
              <div className="dp-hist" role="menu">
                <span className="cap">กดรายการเพื่อย้อนกลับไปถึงขั้นนั้น</span>
                {[...hist.done].reverse().slice(0, 12).map((st, i) => (
                  <button key={i} role="menuitem" className="opt" onClick={() => doUndo(i + 1)}><span className="num k">{i + 1}</span><span className="tx">{st.label}</span></button>
                ))}
              </div>
            )}
          </span>
          <button className="ib sq" aria-label="ทำซ้ำ" disabled={!hist.undone.length} onClick={doRedo} title={`ทำซ้ำ (${isMac ? '⌘ Shift' : 'Ctrl Shift'} Z)`}><span style={{ display: 'flex', transform: 'scaleX(-1)' }}><Icon name="restore" size={16} stroke={2} /></span></button>
          <span className="dp-sep" />
          <YearPager year={year} min={bounds.min} max={bounds.max} onYear={setYear} />
          <button className="ib pri" onClick={() => setYear(curYear)}>เดือนนี้</button>
          {!empty && <button className="ib line" onClick={() => setSp({ tab: 'plan', y: String(year), view: 'year' })}><Icon name="chart" size={16} stroke={2} />สรุปทั้งปี {year + 543}</button>}
        </>
      } />
      <div className="dp-legend">
        <span><b>หนา</b><i className="tri up">▲</i>เพิ่มขึ้น<i className="tri down">▼</i>ลดลง จากเดือนก่อน</span>
        <span><i className="sw hatch" />นอกช่วงที่มีผล</span>
        <span><i className="sw curbg" />เดือนนี้</span>
        <span>จ่ายแล้วและเดือนที่ผ่านแล้ว ตัวเลขสีจาง</span>
        <span className="sp" />
        {planNow !== cycle && year === Number(cycle.slice(0, 4)) && (
          <button className="lnk" onClick={() => { setLook(!look); setTickMode(false); }}>{look ? `กลับไปรอบ ${thaiMonth(planNow)}` : `ดูรอบ ${thaiMonth(cycle)} ที่ติ๊กครบแล้ว`}</button>
        )}
        {toTick.length > 0 && year === curYear && (
          <button className={`dp-tickbtn${tickMode ? ' on' : ''}`} aria-pressed={tickMode} onClick={() => { setTickMode(!tickMode); setEdit(null); setScope(null); }}>
            <Icon name="check" size={15} stroke={2.4} />
            {tickMode ? <>เสร็จ · <span className="num">ติ๊กแล้ว {nTicked} / {toTick.length}</span></> : <>ติ๊กว่าแบ่งเงินแล้ว · <span className="num">{nTicked} / {toTick.length}</span></>}
          </button>
        )}
        {!empty && <button className="lnk" onClick={() => setFolded(allFolded ? new Set() : new Set(g.groups.map((x) => x.group.id)))}>{allFolded ? 'กางทุกหมวด' : 'พับทุกหมวด'}</button>}
      </div>
      <div className="dp-main">
      <div className="dp-card" ref={box} role="grid" aria-label={`แผนปี ${year + 543}`}>
        <div className="dp-row dp-head" style={cols} role="row">
          <span className="nm" role="columnheader">รายการ</span>
          {g.months.map((m, i) => (
            <span key={m} className={`c num ${when(m)}`} role="columnheader">{m === planCur ? <span className="pill">{MON[i]}</span> : MON[i]}</span>
          ))}
          <span className="c tot" role="columnheader">รวมทั้งปี</span>
        </div>
        <div className="dp-body">
          {g.groups.map((gg) => {
            const open = !folded.has(gg.group.id);
            const gFl = flash?.groupId === gg.group.id;
            return (
              <div key={gg.group.id} role="rowgroup">
                <div className={`dp-row dp-grp t-${kindTone(gg.group.kind)}`} style={cols} role="row">
                  <button className="nm" aria-expanded={open} onClick={() => toggle(gg.group.id)}>
                    <span className="chev" style={open ? undefined : { transform: 'rotate(-90deg)' }}><Icon name="chevDown" size={14} stroke={2.2} /></span>
                    <span className="nw">{gg.group.name}</span><span className="num cnt">{gg.rows.length}</span>
                  </button>
                  {gg.totals.map((v, i) => <span key={`${i}-${gFl && flM(i) ? flashKey : 0}`} className={`${cellCls(g.months[i])}${fl(gFl && flM(i))}`} title={full(v)}>{fmtTot(tier, v)}</span>)}
                  <span key={`t-${gFl ? flashKey : 0}`} className={`c num tot${fl(gFl)}`} title={full(gg.total)}>{fmtTot(tier, gg.total)}</span>
                </div>
                {open && gg.rows.map((r) => {
                  const paid = checkMap.get(r.item.id);
                  const iFl = flash?.itemId === r.item.id;
                  return (
                    <div key={r.item.id} className={`dp-row dp-item${panelId === r.item.id ? ' picked' : ''}${drag && drag.over === r.item.id ? ' dropto' : ''}${drag?.id === r.item.id ? ' dragging' : ''}`} style={cols} role="row"
                      onDragOver={(ev) => { if (drag && drag.groupId === gg.group.id) { ev.preventDefault(); if (drag.over !== r.item.id) setDrag({ ...drag, over: r.item.id }); } }}
                      onDrop={(ev) => { ev.preventDefault(); doDrop(r.item.id); }}>
                      {(
                        <span className={`nm dp-nm${panelId === r.item.id ? ' on' : ''}`}>
                          {gg.rows.length > 1 && <span className="grip" draggable aria-label={`ลากเพื่อย้าย ${r.item.name}`} title="ลากเพื่อเรียง"
                            onDragStart={(ev) => { ev.dataTransfer.effectAllowed = 'move'; setDrag({ id: r.item.id, groupId: gg.group.id, over: null }); }} onDragEnd={() => setDrag(null)}>
                            <Icon name="grip" size={14} stroke={2} /></span>}
                          <span className="ic" style={{ color: `var(--t-${kindTone(gg.group.kind)})` }} aria-hidden="true"><Icon name={iconOf(r.item.icon)} size={14} stroke={2} /></span>
                          <button className="lbl" title={`${r.item.name} · คลิกเพื่อดูและแก้รายละเอียด`} onClick={() => openPanel(panelId === r.item.id ? null : r.item.id)}>{r.item.name}</button>
                          <button className="del" aria-label={`ลบ ${r.item.name}`} onClick={() => setDelId(r.item.id)}><Icon name="trash" size={14} stroke={2} /></button>
                        </span>
                      )}
                      {r.cells.map((c, mi) => {
                        const isSel = sel?.itemId === r.item.id && sel.mi === mi;
                        const isEdit = edit?.itemId === r.item.id && edit.mi === mi;
                        const faded = c.month === planCur && !!paid;
                        const canT = tickMode && canTick(gg.group.kind, c.month, planCur, c.amount);
                        const sc = scope && scope.itemId === r.item.id && scope.mi === mi && !isEdit;
                        const cls = `${cellCls(c.month)}${c.amount === null ? ' out' : ''}${c.trend ? ' chg' : ''}${faded ? ' paid' : ''}${isSel && !tickMode ? ' sel' : ''}${canT ? ' tk' : ''}${isEdit ? ' editing' : ''}${fl(iFl && flM(mi))}`;
                        return (
                          <span key={`${c.month}-${iFl && flM(mi) ? flashKey : 0}`} className={cls} role="gridcell" aria-selected={isSel} aria-checked={canT ? !!paid : undefined}
                            aria-label={c.amount === null ? 'นอกช่วงที่มีผล' : undefined} title={c.amount === null ? undefined : full(c.amount)}
                            onMouseDown={(ev) => { if (isEdit) return; ev.preventDefault(); if (tickMode) { setSel({ itemId: r.item.id, mi }); if (canT) tick(r.item.id); return; } if (edit) onInputBlur(); setHistOpen(false); if (isSel && c.amount !== null) startEdit({ itemId: r.item.id, mi }); else { setSel({ itemId: r.item.id, mi }); if (!(scope && scope.itemId === r.item.id && scope.mi === mi)) setScope(null); } }}>
                            {isEdit ? (
                              <>
                                <input className="dp-in num" autoFocus inputMode="decimal" aria-label={`ยอด ${r.item.name} ${MON[mi]}`} aria-invalid={edit!.bad}
                                  value={edit!.text} onChange={(ev) => setEdit({ ...edit!, text: ev.target.value, bad: false })} onKeyDown={onInputKey} onBlur={onInputBlur}
                                  onFocus={(ev) => { const el = ev.currentTarget; const n = el.value.length; el.setSelectionRange(n, n); }} />
                                {edit!.bad && <span className="dp-pop err" role="alert">ใส่ตัวเลขเท่านั้น</span>}
                              </>
                            ) : c.amount === null ? null : <>{canT && <span className={`dp-cb${paid ? ' on' : ''}`} aria-hidden="true">{paid && <Icon name="check" size={11} stroke={3} />}</span>}{tri(c)}{(canT && tier !== 'w') || (panelId && tier === 's') ? whole(c.amount) : fmtItem(tier, c.amount)}</>}
                            {sc && (
                              <span className="dp-pop up" role="dialog" aria-label="ขอบเขตของยอด" onMouseDown={(ev) => ev.stopPropagation()}>
                                <span className="cap">ใช้ยอด <b className="num">{full(scope!.amount)}</b> กับ</span>
                                <button className={`opt${scope!.scope === 'month' ? ' on' : ''}`} onClick={() => chooseScope('month')}>เฉพาะ {MON[mi]}<span className="kbd">1</span></button>
                                <button className={`opt${scope!.scope === 'from' ? ' on' : ''}`} onClick={() => chooseScope('from')}>ตั้งแต่ {MON[mi]} เป็นต้นไป<span className="kbd">2</span></button>
                              </span>
                            )}
                          </span>
                        );
                      })}
                      <span key={`t-${iFl ? flashKey : 0}`} className={`c num tot${fl(iFl)}`} title={full(r.total)}>{fmtTot(tier, r.total)}</span>
                    </div>
                  );
                })}
                {open && gg.rows.length === 0 && !adding && <div className="dp-none">ยังไม่มีรายการในหมวดนี้</div>}
                {open && (adding?.groupId === gg.group.id ? (
                  <div className="dp-add on">
                    <input className="dp-name" autoFocus aria-label="ชื่อรายการใหม่" placeholder="ชื่อรายการ" value={adding.text}
                      onChange={(ev) => setAdding({ groupId: gg.group.id, text: ev.target.value })}
                      onKeyDown={(ev) => { if (ev.key === 'Tab') { ev.preventDefault(); doAdd('amount'); } else if (ev.key === 'Enter') { ev.preventDefault(); doAdd('next'); } else if (ev.key === 'Escape') setAdding(null); }}
                      onBlur={() => { if (!adding.text.trim()) setAdding(null); }} />
                    <span className="hint"><span className="kbd">Tab</span> ไปใส่ยอดเดือนแรก <span className="kbd">Enter</span> เพิ่มแล้วขึ้นแถวใหม่ <span className="kbd">Esc</span> ยกเลิก</span>
                  </div>
                ) : (
                  !tickMode && <button className="dp-add" onClick={() => { setEdit(null); setAdding({ groupId: gg.group.id, text: '' }); }}><Icon name="plus" size={14} stroke={2.2} />เพิ่มรายการ</button>
                ))}
              </div>
            );
          })}
          {empty && (
            <div className="dp-empty">
              <strong>ยังไม่มีรายการในแผน</strong>
              <span>เริ่มจากใส่รายรับ แล้วเพิ่มรายจ่าย ออม และลงทุนทีละหมวด</span>
              {incomeGroup && <button className="ib pri" onClick={() => { setEdit(null); setAdding({ groupId: incomeGroup.id, text: '' }); }}><Icon name="plus" size={14} stroke={2.2} />เพิ่มรายรับรายการแรก</button>}
            </div>
          )}
        </div>
        <div className="dp-foot" role="rowgroup">
          {([
            ['รวมรายรับ', 'inc', g.summary.income, g.yearTotal.income],
            ['รวมรายจ่าย', 'exp', g.summary.expense, g.yearTotal.expense],
            ['ออม + ลงทุน', 'sav', g.summary.saveInvest, g.yearTotal.saveInvest],
            ['เงินเหลือ', 'left', g.summary.leftover, g.yearTotal.leftover]
          ] as const).map(([label, tone, vs, yt]) => {
            const sFl = !!flash && (tone === 'left' || tone === kindTone(data.groups.find((x) => x.id === flash.groupId)?.kind ?? 'income') || (tone === 'exp' && kindTone(data.groups.find((x) => x.id === flash.groupId)?.kind ?? 'income') === 'goal'));
            return (
              <div key={label} className={`dp-row dp-sum s-${tone}`} style={cols} role="row">
                <span className="nm">{label}</span>
                {vs.map((v, i) => <span key={`${i}-${sFl && flM(i) ? flashKey : 0}`} className={`${cellCls(g.months[i])}${tone === 'left' && v < 0 ? ' neg' : ''}${fl(sFl && flM(i))}`} title={full(v)}>{fmtTot(tier, v)}</span>)}
                <span key={`t-${sFl ? flashKey : 0}`} className={`c num tot${tone === 'left' && yt < 0 ? ' neg' : ''}${fl(sFl)}`} title={full(yt)}>{fmtTot(tier, yt)}</span>
              </div>
            );
          })}
        </div>
      </div>
      {panelId && live(panelId) && (
        <DeskItemPanel data={data} item={live(panelId)!} planCur={planCur} year={year} amountOf={amountOf}
          onDraft={(d) => { draft.current = d; }}
          onSave={(next) => { savePanel(next); setPanelId(null); }}
          onDelete={() => setDelId(panelId)} onClose={() => openPanel(null)} />
      )}
      </div>
      {delId && live(delId) && (() => {
        const it = live(delId)!;
        const row = g.groups.flatMap((x) => x.rows).find((r) => r.item.id === delId);
        const ms = row ? row.cells.filter((c) => c.amount !== null).map((c) => c.month) : [];
        return (
          <div className="dp-scrim" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setDelId(null); }}>
            <div className="dp-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dp-del-t">
              <h2 id="dp-del-t">ลบ “{it.name}” ออกจากแผน?</h2>
              <p>ยอดของรายการนี้จะหายจากทุกเดือน{ms.length > 0 && row ? <> (<span className="num nw">{mon(ms[0])} – {mon(ms[ms.length - 1])} {year + 543}</span> รวม <span className="num nw">{full(row.total)} บาท</span>)</> : null}</p>
              <p className="muted">ลบแล้วยังกดย้อนกลับได้จนกว่าจะปิดหน้านี้</p>
              <div className="acts">
                <button className="ib" autoFocus onClick={() => setDelId(null)}>ยกเลิก</button>
                <button className="ib danger" onClick={() => doDelete(it.id)}>ลบรายการ</button>
              </div>
            </div>
          </div>
        );
      })()}
      {ask && panelId && live(panelId) && (
        <div className="dp-scrim" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setAsk(null); }}>
          <div className="dp-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dp-ask-t">
            <h2 id="dp-ask-t">บันทึกการเปลี่ยนแปลงของ “{live(panelId)!.name}” ไหม</h2>
            <p>ยังไม่ได้บันทึกสิ่งที่แก้ในแผงรายละเอียด</p>
            <div className="acts">
              <button className="ib" onClick={() => setAsk(null)}>แก้ต่อ</button>
              <button className="ib" onClick={() => finishAsk(false)}>ไม่บันทึก</button>
              <button className="ib pri" autoFocus onClick={() => finishAsk(true)}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="dp-toast" role="status" key={toast.key}>
          <Icon name="check" size={16} stroke={2.2} />
          <span className="num">{toast.text}</span>
          {hist.done.length > 0 && <button onClick={() => doUndo()}>ย้อนกลับ <span className="kbd">{isMac ? '⌘' : 'Ctrl'} Z</span></button>}
          <button className="x" aria-label="ปิด" onClick={() => setToast(null)}><Icon name="close" size={14} stroke={2.2} /></button>
        </div>
      )}
    </div>
  );
}


