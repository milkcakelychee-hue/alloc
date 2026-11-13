// แผงรายละเอียดรายการข้างตาราง (บอร์ด Desk-Plan-Panel / -Panel-Goal / -Panel-Income) · กว้าง 380 ไม่มีพื้นหรี่
// แก้เป็นร่าง กดบันทึกถึงเขียนจริง (ย้อนกลับด้วยปุ่มเดิมของตาราง) · ชื่อและไอคอนแก้ที่หัวแผง · ยอดในแผนแก้ในตาราง
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Month, PlanItem, PlanPeriod } from '../../db/types';
import { addMonths, monthDiff, thaiMonth, toRule } from '../../calc/dates';
import { formatBaht } from '../../calc/money';
import { goalBalance } from '../../calc/goals';
import { yearMonths } from '../../calc/planYear';
import { inPeriod, type AmountOf } from '../../calc/plan';
import { Icon } from '../../components/Icon';
import { db } from '../../db/db';
import type { PlanData } from '../plan/usePlanData';
import { ITEM_ICONS, iconOf } from '../plan/planUi';
import { kindTone } from '../../calc/planGrid';

const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function DeskItemPanel({ data, item: saved, planCur, year, amountOf, onSave, onDelete, onClose, onDraft }: {
  data: PlanData; item: PlanItem; planCur: Month; year: number; amountOf: AmountOf;
  onSave: (next: PlanItem) => void; onDelete: () => void; onClose: () => void; onDraft: (d: PlanItem | null) => void;
}) {
  const [icons, setIcons] = useState(false);
  const [newAcc, setNewAcc] = useState<string | null>(null); // null = ไม่ได้เพิ่มบัญชี
  // แก้ในแผงเป็นร่างก่อน กด "บันทึก" ถึงเขียนจริง (เจ้าของขอ 11 พ.ย. 69)
  const [item, setDraft] = useState<PlanItem>(saved);
  useEffect(() => { setDraft(saved); }, [saved.id, saved.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify({ ...item, updatedAt: 0 }) !== JSON.stringify({ ...saved, updatedAt: 0 }) && item.name.trim() !== '';
  useEffect(() => { onDraft(dirty ? { ...item, name: item.name.trim() } : null); }); // eslint-disable-line react-hooks/exhaustive-deps
  const addAccount = async () => {
    const n = (newAcc ?? '').trim();
    if (!n) return;
    const now = Date.now();
    const id = crypto.randomUUID();
    await db.accounts.add({ id, name: n, order: Math.max(0, ...data.accounts.map((a) => a.order)) + 1, createdAt: now, updatedAt: now });
    setDraft((d) => ({ ...d, accountId: id }));
    setNewAcc(null);
  };
  const group = data.groups.find((g) => g.id === item.groupId)!;
  const income = group.kind === 'income';
  const expenseLike = group.kind === 'fixed' || group.kind === 'variable' || group.kind === 'goalSpend';
  const goal = item.goalId ? data.goals.find((g) => g.id === item.goalId) : undefined;
  const set = (_label: string, patch: Partial<PlanItem>) => setDraft((d) => ({ ...d, ...patch }));
  const setPeriod = (p: PlanPeriod) => set('ช่วงที่มีผล', { period: p });

  // เดือนที่เลือกได้: ปีก่อนหน้าถึงปีหน้าของปีที่ดูอยู่
  const span = [...yearMonths(year - 1), ...yearMonths(year), ...yearMonths(year + 1)];
  const monthSel = (value: Month, on: (m: Month) => void, label: string, min?: Month) => (
    <select className="dk-sel num" aria-label={label} value={value} onChange={(e) => on(e.target.value)}>
      {(span.includes(value) ? span : [value, ...span]).filter((m) => !min || monthDiff(min, m) >= 0).map((m) => <option key={m} value={m}>{thaiMonth(m)}</option>)}
    </select>
  );
  const p = item.period;
  const endOpt = (mode: PlanPeriod['endMode'], title: string, desc: string) => (
    <button className={`rad${p.endMode === mode ? ' on' : ''}`} role="radio" aria-checked={p.endMode === mode}
      onClick={() => p.endMode !== mode && setPeriod({ ...p, endMode: mode, endMonth: mode === 'month' ? p.endMonth ?? addMonths(p.start, 2) : undefined })}>
      <span className={`radio-dot${p.endMode === mode ? ' on' : ''}`} aria-hidden="true" />
      <span className="tx"><span className="t1">{title}</span><span className="t2">{desc}</span></span>
    </button>
  );
  const pay = data.settings ? toRule(data.settings.pay) : null;
  const payText = !pay ? '' : pay.kind === 'day' ? `วันที่ ${pay.day} ของเดือน` : pay.kind === 'endOfMonth' ? 'สิ้นเดือน' : 'วันทำการสุดท้ายของเดือน';
  const now = amountOf(item, planCur);
  const bal = goal ? goalBalance(goal, data.adjustments) : 0;
  const pct = goal && goal.target > 0 ? Math.min(100, Math.round((bal / goal.target) * 100)) : 0;
  const expCats = data.categories.filter((c) => c.type === 'expense' && !c.hidden);

  return (
    <aside className="dk-panel" aria-label={`รายละเอียด ${item.name}`}>
      <div className="dk-head">
        <button className="ic36 pick" aria-label="เปลี่ยนไอคอน" aria-expanded={icons} title="เปลี่ยนไอคอน" onClick={() => setIcons(!icons)}
          style={{ background: `var(--g-${kindTone(group.kind)})`, color: `var(--t-${kindTone(group.kind)})` }}><Icon name={iconOf(item.icon)} size={20} stroke={1.9} /></button>
        <span className="tx">
          <input className="dk-name" aria-label="ชื่อรายการ" value={item.name} onChange={(e) => set('ชื่อ', { name: e.target.value })} />
          <span>{group.name}{goal ? ' · ผูกกับเป้าหมาย' : ''}</span>
        </span>
        <button className="icb" aria-label="ปิดแผง" onClick={onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      {icons && (
        <div className="dk-icons top" role="radiogroup" aria-label="ไอคอน">
          {ITEM_ICONS.map((ic) => (
            <button key={ic.name} role="radio" aria-checked={iconOf(item.icon) === ic.name} aria-label={ic.label} className={iconOf(item.icon) === ic.name ? 'on' : ''}
              onClick={() => { set('ไอคอน', { icon: ic.name }); setIcons(false); }}><Icon name={ic.name} size={18} stroke={1.9} /></button>
          ))}
        </div>
      )}
      <div className="dk-body">
        {goal && (
          <section className="dk-sec">
            <span className="st">เป้าหมายที่ผูก</span>
            <div className="dk-goal">
              <div className="r1"><b>{goal.name}</b><Link to={`/goals/g/${goal.id}`} className="lnk">ดูเป้า</Link></div>
              <div className="r2 num"><b>{formatBaht(bal)}</b> / {formatBaht(goal.target)} บาท <span className="p">{pct}%</span></div>
              <span className="bar"><span style={{ width: `${pct}%` }} /></span>
            </div>
          </section>
        )}
        <section className="dk-sec">
          <span className="st">เดือนนี้ · <span className="num">{thaiMonth(planCur)}</span></span>
          <div className="grp">
            <div className="fr"><span className="k">ยอดในแผน<small>แก้ยอดได้ในตาราง</small></span><span className="v num">{formatBaht(now)} บาท</span></div>
            {income ? (
              <div className="fr"><span className="k">วันที่เงินเข้า<small>ตามตั้งค่าเงินเดือน</small></span><Link className="v lnk" to="/settings">{payText}</Link></div>
            ) : (
              <label className="fr col"><span className="k">ครบกำหนดจ่าย</span>
                <select className="dk-sel" value={item.dueDay ?? ''} onChange={(e) => set('ครบกำหนดจ่าย', { dueDay: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">ไม่กำหนด</option>
                  {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>วันที่ {i + 1} ของเดือน</option>)}
                </select>
              </label>
            )}
          </div>
        </section>
        <section className="dk-sec">
          <span className="st">ช่วงที่มีผล</span>
          <div className="grp">
            <div className="fr"><span className="k">เริ่ม</span>{monthSel(p.start, (m) => setPeriod({ ...p, start: m, endMonth: p.endMonth && monthDiff(m, p.endMonth) < 0 ? m : p.endMonth }), 'เดือนเริ่ม')}</div>
            {p.endMode === 'month' && p.endMonth && <div className="fr"><span className="k">เดือนสุดท้าย</span>{monthSel(p.endMonth, (m) => setPeriod({ ...p, endMonth: m }), 'เดือนสุดท้าย', p.start)}</div>}
          </div>
          <span className="st">สิ้นสุด</span>
          <div className="dk-rads" role="radiogroup" aria-label="สิ้นสุด">
            {item.goalId && endOpt('goal', 'จนถึงเป้า', 'ครบเป้าแล้วหยุดเอง')}
            {endOpt('month', 'ถึงเดือน…', 'เลือกเดือนสุดท้ายเอง')}
            {endOpt('none', 'ไม่กำหนด', 'ใช้ทุกเดือนไปเรื่อย ๆ')}
          </div>
          <div className="dk-strip" aria-label={`ช่วงที่มีผลในปี ${year + 543}`}>
            {yearMonths(year).map((m, i) => <span key={m} className={inPeriod(item, m) ? 'on' : ''}><i /><small>{MON[i]}</small></span>)}
          </div>
        </section>
        {!goal && !income && (
          <section className="dk-sec">
            <span className="st">เป้าหมายที่ผูก</span>
            <div className="dk-muted">ยังไม่ได้ผูกกับเป้าหมาย</div>
          </section>
        )}
        {!income && (
          <section className="dk-sec">
            <span className="st">บัญชีปลายทาง</span>
            <div className="grp">
              <label className="fr col"><span className="k">บัญชี<small>โอนเงินก้อนนี้ไปไว้ที่นี่เมื่อเงินเดือนออก</small></span>
                <select className="dk-sel" value={newAcc !== null ? '+new' : item.accountId ?? ''} onChange={(e) => { if (e.target.value === '+new') { setNewAcc(''); return; } setNewAcc(null); set('บัญชีปลายทาง', { accountId: e.target.value || null }); }}>
                  <option value="">อยู่ในบัญชีเงินเดือน</option>
                  {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  <option value="+new">+ เพิ่มบัญชีใหม่</option>
                </select>
              </label>
              {newAcc !== null && (
                <div className="dk-newacc">
                  <input className="dk-sel" autoFocus aria-label="ชื่อบัญชีใหม่" placeholder="ชื่อบัญชี" value={newAcc}
                    onChange={(e) => setNewAcc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addAccount(); if (e.key === 'Escape') setNewAcc(null); }} />
                  <button className="ib" onClick={() => setNewAcc(null)}>ยกเลิก</button>
                  <button className="ib pri" disabled={!newAcc.trim()} onClick={addAccount}>เพิ่ม</button>
                </div>
              )}
            </div>
          </section>
        )}
        <section className="dk-sec">
          {!income && (
            <>
              <span className="st">หมวด</span>
              <select className="dk-sel wide" aria-label="หมวด" value={item.groupId} onChange={(e) => set('หมวด', { groupId: e.target.value })}>
                {data.groups.filter((g) => g.enabled && g.kind !== 'income').map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </>
          )}
          {expenseLike && expCats.length > 0 && (
            <>
              <span className="st">ผูกกับหมวดในบันทึก</span>
              <div className="dk-cats">
                {expCats.map((c) => {
                  const on = item.logCategoryIds.includes(c.id);
                  return (
                    <label key={c.id} className={on ? 'on' : ''}>
                      <input type="checkbox" checked={on} onChange={() => set('หมวดในบันทึก', { logCategoryIds: on ? item.logCategoryIds.filter((x) => x !== c.id) : [...item.logCategoryIds, c.id] })} />
                      {c.name}
                    </label>
                  );
                })}
              </div>
            </>
          )}
          <button className="dk-del" onClick={onDelete}><Icon name="trash" size={14} stroke={2} />ลบรายการนี้</button>
        </section>
      </div>
      <div className="dk-foot">
        {dirty ? <span className="t">ยังไม่ได้บันทึก</span> : <span className="t">บันทึกแล้ว · กดย้อนกลับได้</span>}
        <button className="ib" disabled={!dirty} onClick={() => setDraft(saved)}>ยกเลิก</button>
        <button className="ib pri" disabled={!dirty} onClick={() => onSave({ ...item, updatedAt: Date.now() })}>บันทึก</button>
      </div>
    </aside>
  );
}
