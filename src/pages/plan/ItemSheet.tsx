// แผ่นแก้/เพิ่มรายการในแผน (ต้นแบบ PlanSheet + PlanPeriod + LogCatPick)
// ทุกการเปลี่ยนเงินในแผนต้องกดยืนยัน: แสดงผลกระทบต่อเงินเหลือก่อนกดบันทึก
import { useState } from 'react';
import { db } from '../../db/db';
import { ICON_DEFAULT_CATEGORIES } from '../../db/defaults';
import type { Month, PlanItem, PlanPeriod } from '../../db/types';
import { addMonths, monthDiff, thaiMonth } from '../../calc/dates';
import { formatBaht, parseBaht } from '../../calc/money';
import { applyAmountChange, planTotals, rawAmount, stopFrom } from '../../calc/plan';
import { goalAwareAmountOf } from '../../calc/goals';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import type { PlanData } from './usePlanData';
import { ITEM_ICONS, QUICK_ICONS, TONE, catIconOf, iconOf, type IconName } from './planUi';

type View = 'main' | 'icons' | 'group' | 'cats' | 'account' | 'period' | 'due' | 'delete';
type Props = { data: PlanData; month: Month; current: Month; item: PlanItem | null; groupId: string; onClose: () => void };

const shortM = (m: Month) => thaiMonth(m);

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

  const group = groups.find((g) => g.id === gid)!;
  const kind = group.kind;
  const amount = parseBaht(amountText);
  const amountBad = amountText.trim() !== '' && (amount === null || amount < 0);
  const expenseLike = kind === 'fixed' || kind === 'variable' || kind === 'goalSpend';
  const effCats = catsTouched ? cats : ICON_DEFAULT_CATEGORIES[icon] ?? [];

  // รายการหลังแก้ (ใช้คำนวณผลกระทบ และบันทึก)
  const build = (): PlanItem | null => {
    if (amount === null || amount < 0 || !name.trim()) return null;
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
  const amountOfWith = (list: PlanItem[]) => goalAwareAmountOf(goals, list, adjustments, current);
  const before = planTotals(groups, items, month, amountOfWith(items)).leftover;
  const afterItems = next ? (item ? items.map((i) => (i.id === item.id ? next : i)) : [...items, next]) : items;
  const after = planTotals(groups, afterItems, month, amountOfWith(afterItems)).leftover;

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
    <Sheet title={title} onClose={onClose}>
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
    return sub('ผูกกับหมวดในบันทึก', (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>จดรายจ่ายในหมวดที่ติ๊ก แล้วนับเข้างบ <b style={{ color: 'var(--ink)' }}>"{name || 'รายการนี้'}"</b> · <span className="nw">หมวดเดียวใช้กับหลายรายการได้</span> งบรวมกัน · <span className="nw">ไม่ผูก = นอกงบ</span></p>
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

  if (view === 'due') return sub('ครบกำหนดวันที่', (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>ใส่หรือไม่ใส่ก็ได้ · ถ้าใส่ เมื่อถึงวันจะมี<span className="nw">การ์ด "จ่ายหรือยัง"</span>ในหน้าหลัก ติ๊กแล้วแอป<span className="nw">บันทึกรายจ่ายให้เอง</span></p>
      <div className="day-grid" role="radiogroup" aria-label="วันที่">
        <button role="radio" aria-checked={dueDay === null} className={`wide${dueDay === null ? ' on' : ''}`} onClick={() => { setDueDay(null); setView('main'); }}>ไม่กำหนด</button>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <button key={d} role="radio" aria-checked={dueDay === d} className={`num${dueDay === d ? ' on' : ''}`} onClick={() => { setDueDay(d); setView('main'); }}>{d}</button>
        ))}
      </div>
      {dueDay && dueDay > 28 && <span className="hint muted" style={{ fontSize: 12.5 }}>เดือนที่มีไม่ถึง <span className="num">{dueDay}</span> วัน ใช้วันสุดท้ายของเดือน</span>}
    </div>
  ));

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
  const diff = after - before;
  return (
    <Sheet title={isNew ? 'เพิ่มรายการ' : 'แก้รายการ'} onClose={onClose}>
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
          <input className="num amt" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amountText} aria-invalid={amountBad}
            onChange={(e) => setAmountText(e.target.value)} onBlur={() => amount !== null && setAmountText(formatBaht(amount))} />
          {amountBad ? <span className="err">ใส่ตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง</span>
            : item && month in item.monthOverrides && <span className="hint num">ปกติ {formatBaht(item.defaultAmount)} / เดือน</span>}
        </label>

        {item && (
          <div className="field"><span className="label" id="apply">ใช้ยอดนี้กับ</span>
            <div className="radio3 two" role="radiogroup" aria-labelledby="apply">
              <button role="radio" aria-checked={scope === 'month'} onClick={() => setScope('month')}>เฉพาะ <span className="num">{shortM(month)}</span></button>
              <button role="radio" aria-checked={scope === 'from'} onClick={() => setScope('from')}>ทุกเดือนตั้งแต่ <span className="num">{shortM(month).split(' ')[0]}</span></button>
            </div>
          </div>
        )}

        <div className="list form-rows">
          <button className="row" onClick={() => setView('group')}><span className="tx"><span className="t1 lab">หมวด</span></span><span className="val">{group.name}</span><Icon name="chevron" size={16} stroke={2} /></button>
          {expenseLike && (
            <button className="row" onClick={() => setView('cats')}>
              <span className="tx"><span className="t1 lab">ผูกกับหมวดในบันทึก</span><span className="t2">{catChips.length ? 'แตะเพื่อแก้' : 'ไม่ผูก = นอกงบ'}</span></span>
              <span className="chips">{catChips.slice(0, 2).map((c) => <span key={c!.id} className="chip" style={{ background: c!.bg, color: c!.fg }}>{c!.name}</span>)}{catChips.length > 2 && <span className="chip">+{catChips.length - 2}</span>}</span>
              <Icon name="chevron" size={16} stroke={2} />
            </button>
          )}
          {kind !== 'income' && (
            <button className="row" onClick={() => setView('account')}>
              <span className="tx"><span className="t1 lab">แยกบัญชี</span><span className="t2">โอนเงินก้อนนี้ไปไว้ที่ไหน</span></span>
              <span className="val">{accounts.find((a) => a.id === accountId)?.name ?? 'ไม่โอน'}</span><Icon name="chevron" size={16} stroke={2} />
            </button>
          )}
          {kind !== 'income' && (
            <button className="row" onClick={() => setView('due')}>
              <span className="tx"><span className="t1 lab">ครบกำหนดวันที่</span><span className="t2">มีการ์ดเตือนในหน้าหลัก</span></span>
              <span className="val num">{dueDay ?? 'ไม่กำหนด'}</span><Icon name="chevron" size={16} stroke={2} />
            </button>
          )}
          <button className="row" onClick={() => setView('period')}>
            <span className="tx"><span className="t1 lab">ช่วงเวลา</span></span>
            <span className="val num">{shortM(period.start)} – {period.endMode === 'month' && period.endMonth ? shortM(period.endMonth) : period.endMode === 'goal' ? 'ถึงเป้า' : 'ไม่กำหนด'}</span><Icon name="chevron" size={16} stroke={2} />
          </button>
        </div>

        {next && diff !== 0 && (
          <div className={`note${after < 0 ? ' warn' : ''}`}><Icon name="info" size={16} stroke={2} />
            <span>เงินเหลือ <span className="num nw">{shortM(month)}</span> จะเปลี่ยนจาก <b className="num">{formatBaht(before)}</b> เป็น <b className="num">{formatBaht(after)}</b></span>
          </div>
        )}
        <button className="btn btn-pri" disabled={!next || busy} onClick={save}>{isNew ? 'เพิ่มในแผน' : 'บันทึก'}</button>
        {!isNew && <button className="btn text-danger" onClick={() => setView('delete')}>ลบหรือหยุดรายการนี้</button>}
      </div>
    </Sheet>
  );
}
