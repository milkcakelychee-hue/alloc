// แผ่นแก้/เพิ่มรายการในแผน (ต้นแบบ PlanSheet + PlanPeriod + LogCatPick)
// ทุกการเปลี่ยนเงินในแผนต้องกดยืนยัน: แสดงผลกระทบต่อเงินเหลือก่อนกดบันทึก
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { entryCycle } from '../../calc/log';
import { MoneyInput } from '../../components/MoneyInput';
import { db } from '../../db/db';
import { ICON_DEFAULT_CATEGORIES } from '../../db/defaults';
import type { Month, PlanItem, PlanPeriod } from '../../db/types';
import { addMonths, localToday, monthDiff, thaiMonth } from '../../calc/dates';
import { formatBaht, parseBaht } from '../../calc/money';
import { applyAmountChange, planTotals, rawAmount, stopFrom } from '../../calc/plan';
import { goalAwareAmountOf } from '../../calc/goals';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import type { PlanData } from './usePlanData';
import { ITEM_ICONS, QUICK_ICONS, TONE, catIconOf, iconOf, thaiMonthLong, type IconName } from './planUi';

type View = 'main' | 'icons' | 'group' | 'cats' | 'account' | 'period' | 'due' | 'delete';
type Props = { data: PlanData; month: Month; current: Month; item: PlanItem | null; groupId: string; onClose: () => void };

const shortM = (m: Month) => thaiMonth(m);
const bahtShort = (v: number) => formatBaht(v, { decimals: v % 100 !== 0 });

export function ItemSheet({ data, month, current, item, groupId, onClose }: Props) {
  const { groups, items, accounts, categories, goals, adjustments } = data;
  const isNew = !item;
  const [view, setView] = useState<View>('main');
  const [name, setName] = useState(item?.name ?? '');
  const [icon, setIcon] = useState<IconName>(iconOf(item?.icon ?? 'other'));
  const startAmt = item ? rawAmount(item, month) || item.defaultAmount : 0;
  const [amountText, setAmountText] = useState(item ? formatBaht(startAmt) : '');
  const [scope, setScope] = useState<'month' | 'from'>(item && month in item.monthOverrides ? 'month' : 'from');
  const [gid, setGid] = useState(item?.groupId ?? groupId);
  const [cats, setCats] = useState<string[]>(item?.logCategoryIds ?? []);
  const [catsTouched, setCatsTouched] = useState(!isNew);
  const [accountId, setAccountId] = useState<string | null>(item?.accountId ?? null);
  const [period, setPeriod] = useState<PlanPeriod>(item?.period ?? { start: month, endMode: 'none' });
  const [dueDay, setDueDay] = useState<number | null>(item?.dueDay ?? null);
  const [newAcc, setNewAcc] = useState('');
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState<'cats' | 'acc' | 'due' | null>(null);
  const logs = useLiveQuery(() => db.logEntries.toArray());

  const group = groups.find((g) => g.id === gid)!;
  const kind = group.kind;
  const amount = parseBaht(amountText);
  const amountBad = amountText.trim() !== '' && (amount === null || amount < 0);
  const expenseLike = kind === 'fixed' || kind === 'variable' || kind === 'goalSpend';
  const effCats = catsTouched ? cats : ICON_DEFAULT_CATEGORIES[icon] ?? [];

  // รายการหลังแก้ (ใช้คำนวณผลกระทบ และบันทึก)
  const build = (preview = false): PlanItem | null => {
    if (amount === null || amount < 0 || (!preview && !name.trim())) return null;
    const now = Date.now();
    const base: PlanItem = item
      ? { ...item }
      : { id: crypto.randomUUID(), createdAt: now, updatedAt: now, groupId: gid, name: '', icon: 'other', defaultAmount: amount, monthOverrides: {},
          period, accountId: null, goalId: null, logCategoryIds: [], order: Math.max(0, ...items.map((i) => i.order)) + 1, dueDay: null };
    let next: PlanItem = { ...base, name: name.trim(), icon, groupId: gid, logCategoryIds: expenseLike ? effCats : [], accountId: kind === 'income' ? null : accountId,
      period, dueDay: kind === 'income' ? null : dueDay, updatedAt: now };
    if (item) next = applyAmountChange(next, month, amount, scope);
    return next;
  };
  const next = build();
  const draft = build(true); // ใช้ดูผลต่อเงินเหลือทันทีที่กรอกยอด แม้ยังไม่ใส่ชื่อ
  const amountOfWith = (list: PlanItem[]) => goalAwareAmountOf(goals, list, adjustments, current);
  const before = planTotals(groups, items, month, amountOfWith(items)).leftover;
  const afterItems = next ? (item ? items.map((i) => (i.id === item.id ? next : i)) : [...items, next]) : items;
  const draftItems = draft ? (item ? items.map((i) => (i.id === item.id ? draft : i)) : [...items, draft]) : items;
  const after = planTotals(groups, draftItems, month, amountOfWith(draftItems)).leftover;

  const save = async () => {
    if (!next) return;
    setBusy(true);
    await db.planItems.put(next);
    onClose();
  };
  const stop = async () => { if (item) { await db.planItems.put({ ...stopFrom(item, month), updatedAt: Date.now() }); onClose(); } };
  const remove = async () => {
    if (!item) return;
    await db.transaction('rw', db.planItems, db.paidChecks, async () => {
      await db.planItems.delete(item.id);
      await db.paidChecks.filter((c) => c.planItemId === item.id).delete();
    });
    onClose();
  };
  const addAccount = async () => {
    const n = newAcc.trim();
    if (!n) return;
    const now = Date.now();
    const id = crypto.randomUUID();
    await db.accounts.add({ id, name: n, order: Math.max(0, ...accounts.map((a) => a.order)) + 1, createdAt: now, updatedAt: now });
    setAccountId(id); setNewAcc(''); setView('main');
  };

  const back = (
    <button className="icon-btn" aria-label="กลับไปแก้รายการ" onClick={() => setView('main')}><Icon name="back" size={20} stroke={2} /></button>
  );
  const sub = (title: string, body: React.ReactNode) => (
    <Sheet title={title} tone={TONE[kind]} onClose={() => setView('main')}>
      <div className="sheet-sub">{back}<span className="muted">{name || 'รายการใหม่'}</span></div>
      {body}
    </Sheet>
  );

  if (view === 'icons') return sub('เลือกไอคอน', (
    <div className="icon-grid" role="radiogroup" aria-label="เลือกไอคอน">
      {ITEM_ICONS.map((i) => (
        <button key={i.name} role="radio" aria-checked={icon === i.name} className={icon === i.name ? 'on' : ''} onClick={() => { setIcon(i.name); setView('main'); }}>
          <Icon name={i.name} size={22} /><span>{i.label}</span>
        </button>
      ))}
    </div>
  ));

  if (view === 'group') return sub('หมวด', (
    <div className="list" role="radiogroup" aria-label="หมวด">
      {groups.filter((g) => g.enabled).map((g) => (
        <button key={g.id} className="row" role="radio" aria-checked={gid === g.id} onClick={() => { setGid(g.id); setView('main'); }}>
          <span className={`radio-dot${gid === g.id ? ' on' : ''}`} aria-hidden="true" /><span className="tx"><span className="t1">{g.name}</span></span>
        </button>
      ))}
    </div>
  ));

  if (view === 'cats') {
    const usedBy = (cid: string) => items.filter((i) => i.id !== item?.id && i.logCategoryIds.includes(cid)).map((i) => i.name);
    return sub('งบนี้นับจากหมวดไหน', (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>ติ๊กหมวดที่ใช้จ่ายจากงบ <b style={{ color: 'var(--ink)' }}>"{name || 'รายการนี้'}"</b> · จดรายจ่ายใน<span className="nw">เมนู บันทึก</span>ด้วยหมวดเหล่านี้ <span className="nw">ยอดจะหักจากงบนี้</span> · <span className="nw">หมวดที่ไม่ได้ผูกกับงบไหน = นอกงบ</span>{kind === 'fixed' && <> · <span className="nw">หมวดแรกที่ติ๊ก</span>ใช้ตอนติ๊กจ่ายแล้ว<span className="nw">บันทึกให้อัตโนมัติ</span></>}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted num" style={{ fontSize: 13 }}>เลือกแล้ว {effCats.length} หมวด</span>
          <button className="link-btn" onClick={() => { setCats(ICON_DEFAULT_CATEGORIES[icon] ?? []); setCatsTouched(true); }}>ใช้ค่าเริ่มต้นตามไอคอน</button>
        </div>
        <div className="list">
          {categories.filter((c) => c.type === 'expense' && !c.hidden).map((c) => {
            const on = effCats.includes(c.id);
            const others = usedBy(c.id);
            return (
              <button key={c.id} className="row" role="checkbox" aria-checked={on}
                onClick={() => { setCats(on ? effCats.filter((x) => x !== c.id) : [...effCats, c.id]); setCatsTouched(true); }}>
                <span className="ic" style={{ background: c.bg, color: c.fg }}><Icon name={catIconOf(c.icon)} size={18} stroke={2} /></span>
                <span className="tx"><span className="t1">{c.name}</span>{others.length > 0 && <span className="t2">ใช้กับ {others[0]}{others.length > 1 ? ` +${others.length - 1}` : ''}</span>}</span>
                <span className={`cbox${on ? ' on' : ''}`} aria-hidden="true">{on && <Icon name="checkSq" size={14} stroke={3} />}</span>
              </button>
            );
          })}
        </div>
        <button className="btn btn-pri" onClick={() => setView('main')}>ใช้ {effCats.length} หมวดนี้</button>
      </div>
    ));
  }

  if (view === 'account') return sub('แยกบัญชี', (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>วางแผนว่าจะโอนเงินก้อนนี้ไปไว้ที่ไหน <span className="nw">ทันทีที่เงินเดือนออก</span></p>
      <div className="list" role="radiogroup" aria-label="บัญชีปลายทาง">
        <button className="row" role="radio" aria-checked={accountId === null} onClick={() => { setAccountId(null); setView('main'); }}>
          <span className={`radio-dot${accountId === null ? ' on' : ''}`} aria-hidden="true" /><span className="tx"><span className="t1">ไม่โอน</span><span className="t2">อยู่ในบัญชีเงินเดือน</span></span>
        </button>
        {accounts.map((a) => (
          <button key={a.id} className="row" role="radio" aria-checked={accountId === a.id} onClick={() => { setAccountId(a.id); setView('main'); }}>
            <span className={`radio-dot${accountId === a.id ? ' on' : ''}`} aria-hidden="true" /><span className="tx"><span className="t1">{a.name}</span></span>
          </button>
        ))}
      </div>
      <label className="field"><span className="label">เพิ่มบัญชีใหม่</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <input value={newAcc} onChange={(e) => setNewAcc(e.target.value)} placeholder="เช่น บัญชีออม" style={{ fontSize: 16, fontWeight: 500 }} />
          <button className="btn btn-pri" disabled={!newAcc.trim()} onClick={addAccount}>เพิ่ม</button>
        </span>
        <span className="hint">ใส่แค่ชื่อเรียก <span className="nw">ห้ามใส่เลขบัญชี</span></span>
      </label>
    </div>
  ));

  if (view === 'period') {
    const count = period.endMode === 'month' && period.endMonth ? monthDiff(period.start, period.endMonth) + 1 : null;
    const stepper = (value: Month, set: (m: Month) => void, label: string) => (
      <span className="mstep">
        <button className="icon-btn" aria-label={`${label}เดือนก่อน`} onClick={() => set(addMonths(value, -1))}><Icon name="back" size={18} stroke={2} /></button>
        <b className="num">{shortM(value)}</b>
        <button className="icon-btn" aria-label={`${label}เดือนถัดไป`} onClick={() => set(addMonths(value, 1))}><Icon name="chevron" size={18} stroke={2} /></button>
      </span>
    );
    const opt = (mode: PlanPeriod['endMode'], title: string, desc: string, extra?: React.ReactNode) => (
      <div className={`opt${period.endMode === mode ? ' on' : ''}`}>
        <button className="opt-main" role="radio" aria-checked={period.endMode === mode}
          onClick={() => setPeriod({ ...period, endMode: mode, endMonth: mode === 'month' ? period.endMonth ?? addMonths(period.start, 2) : undefined })}>
          <span className={`radio-dot${period.endMode === mode ? ' on' : ''}`} aria-hidden="true" />
          <span className="tx"><span className="t1">{title}</span><span className="t2">{desc}</span></span>
        </button>
        {period.endMode === mode && extra}
      </div>
    );
    return sub('ช่วงเวลา', (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="opt-row"><span>เริ่ม</span>{stepper(period.start, (s) => setPeriod({ ...period, start: s }), 'เริ่ม')}</div>
        <div role="radiogroup" aria-label="สิ้นสุด" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)' }}>สิ้นสุด</span>
          {item?.goalId && opt('goal', 'จนถึงเป้า', 'ครบเป้าแล้วหยุดเอง เดือนสุดท้ายใส่เท่าที่ขาด')}
          {opt('month', 'ถึงเดือน…', 'เลือกเดือนสุดท้ายเอง',
            period.endMonth && <div className="opt-row inner"><span>เดือนสุดท้าย</span>{stepper(period.endMonth, (e) => setPeriod({ ...period, endMonth: monthDiff(period.start, e) < 0 ? period.start : e }), 'สิ้นสุด')}</div>)}
          {opt('none', 'ไม่กำหนด', 'ใช้ทุกเดือนไปเรื่อย ๆ')}
        </div>
        <div className="note"><Icon name="calendar" size={16} stroke={2} />
          <span>{count ? <>รวม <b className="num">{count}</b> เดือน · <span className="nw num">{shortM(period.start)} – {shortM(period.endMonth!)}</span></> : <>เริ่ม <span className="num">{shortM(period.start)}</span> · <span className="nw">ไม่กำหนดวันจบ</span></>}</span>
        </div>
        <button className="btn btn-pri" onClick={() => setView('main')}>ใช้ช่วงเวลานี้</button>
      </div>
    ));
  }

  if (view === 'due') return sub('ครบกำหนดวันที่', <DuePicker month={month} value={dueDay} onPick={(d) => { setDueDay(d); setView('main'); }} />);

  if (view === 'delete' && item) return sub('ลบหรือหยุดรายการ', (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button className="option" onClick={stop}>
        <span className="ic"><Icon name="calendar" /></span>
        <span className="tx"><span className="t1">หยุดตั้งแต่ <span className="num">{shortM(month)}</span></span><span className="t2">เดือนก่อนหน้ายังอยู่ใน<span className="nw">ประวัติแผน</span></span></span>
      </button>
      <button className="option danger" onClick={remove}>
        <span className="ic"><Icon name="close" /></span>
        <span className="tx"><span className="t1">ลบทุกเดือน</span><span className="t2">ลบรายการนี้ออกจากแผนทั้งหมด <span className="nw">ย้อนกลับไม่ได้</span></span></span>
      </button>
      <button className="btn btn-ghost" onClick={() => setView('main')}>ยกเลิก</button>
    </div>
  ));

  const catChips = effCats.map((c) => categories.find((x) => x.id === c)).filter(Boolean);
  // งบนี้ใช้ไปเท่าไหร่ในเดือนที่แก้: รายจ่ายในหมวดที่ผูก (หมวดที่ใช้ร่วมกับรายการอื่น นับรวมงบของรายการนั้นด้วย)
  const shared = items.filter((i) => i.id !== item?.id && i.logCategoryIds.some((c) => effCats.includes(c)));
  const use = amount !== null && logs && data.settings ? (() => {
    const cats = new Set([...effCats, ...shared.flatMap((i) => i.logCategoryIds)]);
    const spent = logs.filter((e) => e.type === 'expense' && cats.has(e.categoryId) && entryCycle(e, data.settings!.pay) === month).reduce((a, e) => a + e.myShare, 0);
    const budget = amount + shared.reduce((a, i) => a + amountOfWith(afterItems)(i, month), 0);
    return { spent, budget, left: budget - spent };
  })() : null;
  const diff = after - before;
  return (
    <Sheet title={isNew ? 'เพิ่มรายการ' : 'แก้รายการ'} tone={TONE[kind]} onClose={onClose}>
      <div className={`item-form tone-${TONE[kind]}`}>
        <div className="field"><label className="label" htmlFor="it-name">ชื่อและไอคอน</label>
          <span style={{ display: 'flex', gap: 8 }}>
            <span className="iic big"><Icon name={icon} size={22} /></span>
            <input id="it-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ค่าเน็ตบ้าน" style={{ fontSize: 16, fontWeight: 500 }} />
          </span>
          <span className="icon-quick" role="radiogroup" aria-label="เลือกไอคอน">
            {QUICK_ICONS.map((n) => (
              <button key={n} role="radio" aria-checked={icon === n} aria-label={ITEM_ICONS.find((i) => i.name === n)?.label} className={icon === n ? 'on' : ''} onClick={() => setIcon(n)}><Icon name={n} size={20} /></button>
            ))}
            <button aria-label="ไอคอนทั้งหมด" className="more" onClick={() => setView('icons')}><Icon name="more" size={20} /></button>
          </span>
        </div>

        <label className="field"><span className="label">ยอดในแผน (บาท)</span>
          <MoneyInput className="num amt"  autoComplete="off" placeholder="0.00" value={amountText} aria-invalid={amountBad}
            onChange={(e) => setAmountText(e.target.value)} onBlur={() => amount !== null && setAmountText(formatBaht(amount))} />
          {amountBad && <span className="err">ใส่ตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง</span>}
          {draft && amountText.trim() !== '' && (
            <span className={`amt-impact num${after < 0 ? ' isneg' : ''}`} aria-live="polite">
              {after < 0 && <Icon name="alert" size={15} stroke={2} />}
              <span className="nw">{isNew ? 'ถ้าเพิ่มแผนนี้' : 'ถ้าแก้ยอดนี้'} เงินเหลือ {shortM(month)}</span>
              <span className="nw">{diff !== 0 && <><span>{formatBaht(before)}</span> <span className="ar">→</span> </>}<b className="af">{formatBaht(after)}</b></span>
            </span>
          )}
        </label>

        {item && (
          <div className="field"><span className="label" id="apply">ยอดนี้ใช้กับเดือนไหน</span>
            <div className="list" role="radiogroup" aria-labelledby="apply">
              <button className="row" role="radio" aria-checked={scope === 'month'} onClick={() => setScope('month')}>
                <span className={`radio-dot${scope === 'month' ? ' on' : ''}`} aria-hidden="true" />
                <span className="tx"><span className="t1">เฉพาะ <span className="num">{shortM(month)}</span></span>
                  <span className="t2">เดือนอื่น<span className="nw">ยังเป็นยอดปกติ</span> <span className="num nw">{formatBaht(item.defaultAmount)}</span></span></span>
              </button>
              <button className="row" role="radio" aria-checked={scope === 'from'} onClick={() => setScope('from')}>
                <span className={`radio-dot${scope === 'from' ? ' on' : ''}`} aria-hidden="true" />
                <span className="tx"><span className="t1">ทุกเดือน ตั้งแต่ <span className="num">{shortM(month)}</span></span>
                  <span className="t2">เปลี่ยน<span className="nw">ยอดปกติ</span> · <span className="nw">เดือนก่อนหน้ายังเป็นยอดเดิม</span></span></span>
              </button>
            </div>
          </div>
        )}

        <div className="field"><span className="label">รายการนี้อยู่ในแผนช่วงไหน</span>
          <div className="list form-rows">
            <button className="row" onClick={() => setView('period')}>
              <span className="ic"><Icon name="calendar" size={18} stroke={2} /></span>
              <span className="tx"><span className="t1 num">{shortM(period.start)} – {period.endMode === 'month' && period.endMonth ? shortM(period.endMonth) : period.endMode === 'goal' ? 'ถึงเป้า' : 'ไม่กำหนด'}</span>
                <span className="t2">เดือนนอกช่วงนี้<span className="nw">ไม่มีรายการนี้</span> (ยอด 0)</span></span>
              <Icon name="chevron" size={16} stroke={2} />
            </button>
          </div>
        </div>

        {next && <MonthStrip item={next} before={item} month={month} amountOf={amountOfWith(afterItems)} />}

        {expenseLike && (
          <button className="pl-link" onClick={() => setView('cats')} aria-label="เลือกหมวดที่นับเข้างบนี้">
            <span className="h"><span className="t">งบนี้นับจากหมวดไหน</span><Icon name="chevron" size={16} stroke={2} /></span>
            <span className="flow">
              {catChips.length ? catChips.map((c) => <span key={c!.id} className="chip" style={{ background: c!.bg, color: c!.fg }}>{c!.name}</span>) : <span className="chip none">ยังไม่ผูกหมวด</span>}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ar"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              <span className="chip goal num">งบ{name.trim() || 'รายการนี้'} {amount !== null ? bahtShort(amount) : ''}</span>
            </span>
            <span className="d">{catChips.length ? <>จดรายจ่ายในหมวดเหล่านี้ <span className="nw">ยอดจะหักจากงบนี้</span>{shared.length > 0 && <> · <span className="nw">ใช้งบร่วมกับ {shared.map((i) => i.name).join(', ')}</span></>}</> : <>จดรายจ่ายหมวดไหนก็ไม่หักงบนี้ <span className="nw">แตะเพื่อเลือกหมวด</span></>}</span>
            {use && catChips.length > 0 && <>
              <span className="bar" aria-hidden="true"><span className={use.left < 0 ? 'over' : ''} style={{ width: `${Math.min(100, use.budget ? (use.spent / use.budget) * 100 : 0)}%` }} /></span>
              <span className="d num">{shortM(month)} ใช้ไป {bahtShort(use.spent)} · {use.left < 0 ? `เกิน ${bahtShort(-use.left)}` : `เหลือ ${bahtShort(use.left)}`}</span>
            </>}
            {kind === 'fixed' && <span className="auto"><Icon name="checkSq" size={14} stroke={2.4} /><span>ติ๊กจ่ายแล้ว บันทึกรายจ่ายให้ในหมวด <b>{catChips[0]?.name ?? 'อื่น ๆ'}</b></span></span>}
          </button>
        )}

        <div className="list form-rows">
          <button className="row hr-plain" onClick={() => setView('group')}><span className="help-space" aria-hidden="true" /><span className="tx"><span className="t1 lab">หมวด</span></span><span className="val">{group.name}</span><Icon name="chevron" size={16} stroke={2} /></button>
          {kind !== 'income' && (
            <HelpRow id="h-acc" open={help === 'acc'} onHelp={() => setHelp(help === 'acc' ? null : 'acc')} onOpen={() => setView('account')}
              label="แยกบัญชี" sub="โอนเงินก้อนนี้ไปไว้ที่ไหน"
              value={<span className="val">{accounts.find((a) => a.id === accountId)?.name ?? 'ไม่โอน'}</span>}
              help={<>โอนเงินแยกเข้าบัญชีตามหน้าที่<span className="nw">ทันทีที่เงินเดือนออก</span> ให้รู้ว่า<span className="nw">เงินก้อนไหนใช้ทำอะไร</span> เช่น เงินออมโอนไปบัญชีออม ค่ากินโอนไปบัญชีใช้จ่าย · ยอดรวมของแต่ละบัญชีดูได้ที่<span className="nw">"แยกบัญชี" ท้ายหน้าแผน</span></>} />
          )}
          {kind !== 'income' && (
            <HelpRow id="h-due" open={help === 'due'} onHelp={() => setHelp(help === 'due' ? null : 'due')} onOpen={() => setView('due')}
              label="ครบกำหนดวันที่" sub="ใส่หรือไม่ใส่ก็ได้"
              value={<span className="val num">{dueDay ? `ทุกวันที่ ${dueDay}` : 'ไม่กำหนด'}</span>}
              help={<>เมื่อถึงวันจะมี<span className="nw">การ์ด "จ่ายหรือยัง"</span> ในหน้าหลัก ติ๊กจ่ายแล้ว แอป<span className="nw">บันทึกรายจ่ายในเมนู บันทึก</span>ให้เอง ด้วยยอดในแผนและหมวดแรกที่ผูกไว้</>} />
          )}
        </div>

        <button className="btn btn-pri" disabled={!next || busy} onClick={save}>{isNew ? 'เพิ่มในแผน' : 'บันทึก'}</button>
        {!isNew && <button className="btn text-danger" onClick={() => setView('delete')}>ลบหรือหยุดรายการนี้</button>}
      </div>
    </Sheet>
  );
}

/** แถวที่มีปุ่ม ? อธิบายเพิ่ม (กดแถว = เปิดตัวเลือก · กด ? = เปิด/ปิดคำอธิบาย) */
function HelpRow({ id, label, sub, value, help, open, onHelp, onOpen }: {
  id: string; label: string; sub: React.ReactNode; value: React.ReactNode; help: React.ReactNode; open: boolean; onHelp: () => void; onOpen: () => void;
}) {
  return (
    <div className="help-row">
      <div className="hr-line">
        <button className="help-q" aria-label={`${label}คืออะไร`} aria-expanded={open} aria-controls={id} onClick={onHelp}><span>?</span></button>
        <button className="hr-main" onClick={onOpen}><span className="tx"><span className="t1 lab">{label}</span><span className="t2">{sub}</span></span></button>
        <button className="hr-val" onClick={onOpen} aria-label={`เลือก${label}`}>{value}<Icon name="chevron" size={16} stroke={2} /></button>
      </div>
      {open && <div id={id} className="note hr-help"><span>{help}</span></div>}
    </div>
  );
}

/** ยอดของรายการ 6 เดือน (ก่อน 2 เดือน ถึงหลัง 3 เดือน) หลังบันทึก ให้เห็นว่ายอดกับช่วงเวลาทำงานร่วมกันยังไง */
function MonthStrip({ item, before, month, amountOf }: { item: PlanItem; before: PlanItem | null; month: Month; amountOf: (i: PlanItem, m: Month) => number }) {
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 2));
  const short = (s: number) => (s % 100 === 0 ? formatBaht(s, { decimals: false }) : formatBaht(s));
  return (
    <div className="mstrip" aria-label="ยอดแต่ละเดือนหลังบันทึก">
      <span className="label">ยอดแต่ละเดือนหลังบันทึก</span>
      <div className="mstrip-row">
        {months.map((m) => {
          const a = amountOf(item, m);
          // เดือนก่อนหน้าที่ถูกเก็บยอดเดิมไว้ตอนเลือก "ทุกเดือน" ไม่ใช่ยอดเฉพาะเดือนที่ผู้ใช้ตั้ง
          const special = m in item.monthOverrides && item.monthOverrides[m] !== item.defaultAmount && (m >= month || (!!before && m in before.monthOverrides));
          return (
            <span key={m} className={`ms${m === month ? ' cur' : ''}${a === 0 ? ' off' : ''}${special ? ' special' : ''}`}>
              <small>{thaiMonth(m).split(' ')[0]}</small>
              <b className="num">{a === 0 ? '–' : short(a)}</b>
            </span>
          );
        })}
      </div>
      <span className="ms-legend"><i className="lg cur" />เดือนที่แก้ <i className="lg special" />ยอดเฉพาะเดือน <i className="lg off" />นอกช่วง</span>
    </div>
  );
}

const WD_HEAD = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

/** เลือกวันครบกำหนด: พิมพ์ "ทุกวันที่" ได้ หรือแตะในปฏิทินของเดือนนั้น */
function DuePicker({ month, value, onPick }: { month: Month; value: number | null; onPick: (d: number | null) => void }) {
  const [text, setText] = useState(value ? String(value) : '');
  const n = Number(text);
  const day = /^\d{1,2}$/.test(text) && n >= 1 && n <= 31 ? n : null;
  const [y, mo] = month.split('-').map(Number);
  const first = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7; // จันทร์ = 0
  const len = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const today = localToday();
  return (
    <div className="due-pick">
      <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>ใส่หรือไม่ใส่ก็ได้ · ถ้าใส่ เมื่อถึงวันจะมี<span className="nw">การ์ด "จ่ายหรือยัง"</span>ในหน้าหลัก ติ๊กแล้วแอป<span className="nw">บันทึกรายจ่ายให้เอง</span></p>
      <label className="due-in">
        <span>ทุกวันที่</span>
        <input className="num" inputMode="numeric" maxLength={2} value={text} placeholder="–" onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 2))} aria-invalid={text !== '' && !day} />
        <span>ของเดือน</span>
      </label>
      <div className="due-cal" aria-label={`ปฏิทิน ${thaiMonthLong(month)}`}>
        <div className="h">{thaiMonthLong(month)}</div>
        <div className="wd">{WD_HEAD.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="days" role="radiogroup" aria-label="วันที่">
          {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
            const date = `${month}-${String(d).padStart(2, '0')}`;
            return (
              <button key={d} role="radio" aria-checked={day === d} className={`num${d > len ? ' over' : ''}${date === today ? ' today' : ''}`} onClick={() => setText(String(d))}>{d}</button>
            );
          })}
        </div>
      </div>
      {day && day > 28 && <span className="hint muted" style={{ fontSize: 12.5 }}>เดือนที่มีไม่ถึง <span className="num">{day}</span> วัน ใช้วันสุดท้ายของเดือน</span>}
      <button className="btn btn-pri" disabled={!day} onClick={() => onPick(day)}>{day ? `ครบกำหนดทุกวันที่ ${day}` : 'เลือกวันที่'}</button>
      <button className="btn btn-ghost" onClick={() => onPick(null)}>ไม่กำหนดวันครบกำหนด</button>
    </div>
  );
}
