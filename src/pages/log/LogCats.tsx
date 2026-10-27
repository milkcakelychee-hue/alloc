// จัดการหมวดบันทึก (บอร์ด LogCats): ลำดับ · ซ่อน · แตะหมวดเพื่อแก้ (ชื่อ ไอคอน สี ใช้งบไหน ลบ) · ปุ่มเพิ่มหมวดด้านบน
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../db/db';
import type { LogCategory, LogType } from '../../db/types';
import { appCycle, cycleOf, localToday } from '../../calc/dates';
import { planLabelOf } from '../../calc/logView';
import { entryCycle } from '../../calc/log';
import { FALLBACK_CAT, addCategory, deleteCategory, reorderCategories, setCategoryBudgets, toggleCategoryHidden, updateCategory } from '../../db/logActions';
import { Grip, SortList } from '../../components/SortList';
import { Icon } from '../../components/Icon';
import { baht } from '../goals/goalUi';
import { CAT_ICONS, CatIcon, FG_OF, NEW_CAT_BGS, catStyle } from './catIcon';
import { useLogData, type LogData } from './useLogData';
import { LgSheet } from './EntrySheet';

type Form = { cat: LogCategory | null }; // null = เพิ่มหมวดใหม่

export default function LogCats() {
  const data = useLogData();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [type, setType] = useState<LogType>(sp.get('type') === 'income' ? 'income' : 'expense');
  const [ed, setEd] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  if (!data?.settings) return null;
  const s = data.settings;
  const E = type === 'expense';
  const cur = appCycle(localToday(), s.pay, s.startCycle);
  const list = data.categories.filter((c) => c.type === type);
  const count = (id: string) => data.entries.filter((e) => e.categoryId === id && entryCycle(e, s.pay) === cur).length;
  const nExp = data.categories.filter((c) => c.type === 'expense').length, nInc = data.categories.filter((c) => c.type === 'income').length;

  return (
    <main className="page lgp lgp-sub">
      <div className="lg-head">
        <button className="lg-sq" aria-label="กลับ" onClick={() => nav(-1)}><Icon name="back" size={20} stroke={2} /></button>
        <span style={{ flex: 1 }} />
        {!ed && <button className="lgc-addbtn" onClick={() => setForm({ cat: null })}><Icon name="plus" size={18} stroke={2.4} />เพิ่มหมวด</button>}
        <button className="gx-hbtn" aria-pressed={ed} onClick={() => setEd(!ed)} style={ed ? { background: 'var(--pri)', color: '#FFFFFF' } : undefined}>{ed ? 'เสร็จ' : 'จัดเรียง'}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, padding: '0 2px', marginTop: -2 }}><span style={{ fontSize: 12, color: 'var(--ink3)' }}>บันทึก</span><h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>จัดการหมวด</h1></div>
      <div className="lga-tabs" role="tablist" aria-label="ประเภท" style={{ padding: 5 }}>
        <button role="tab" className="e" aria-selected={E} onClick={() => setType('expense')} style={{ height: 40 }}>รายจ่าย <span className="num" style={{ fontWeight: 400, opacity: .8 }}>{nExp}</span></button>
        <button role="tab" className="i" aria-selected={!E} onClick={() => setType('income')} style={{ height: 40 }}>รายรับ <span className="num" style={{ fontWeight: 400, opacity: .8 }}>{nInc}</span></button>
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--ink3)', padding: '0 2px', lineHeight: 1.5 }}>
        {ed ? 'ลากจุด 6 จุดเพื่อเรียงลำดับในตารางหน้าเพิ่มรายการ · ไอคอนตาซ่อนหมวดที่ไม่ได้ใช้ (รายการเก่ายังอยู่)'
          : <>ลำดับนี้คือลำดับในตารางหน้าเพิ่มรายการ · ตัวเลขด้านขวาคือจำนวนครั้งที่จดในรอบนี้ · <span className="nw">แตะหมวดเพื่อแก้ชื่อ</span>{E ? <> <span className="nw">เลือกงบ</span></> : null} <span className="nw">หรือลบ</span></>}
      </span>

      <ul className="lgc-list" aria-label="รายการหมวด">
        <SortList ids={list.map((c) => c.id)} onCommit={(ids) => reorderCategories(db, ids)}>{(id, dragItem, dragHandle) => {
          const c = list.find((x) => x.id === id)!;
          const lk = E ? planLabelOf(c.id, data.items) : null;
          const n = count(c.id);
          const body = <>
            <span className="cat-ic" style={catStyle(c)}><CatIcon icon={c.icon} /></span>
            <span className="t"><b>{c.name}{c.hidden ? ' (ซ่อน)' : ''}</b>
              <span className={lk ? 'lk' : ''}>{lk ? `ใช้งบ${lk}` : E ? 'นอกงบ · ยังไม่เลือกงบ' : 'รายรับนอกแผน'}</span></span>
          </>;
          return (
            <li key={c.id} {...dragItem}>
              {ed ? (
                <div className={`lgc-row${c.hidden ? ' hid' : ''}`}>
                  <Grip label={`ลากเพื่อย้าย ${c.name}`} {...dragHandle} />
                  {body}
                  <span className="lgc-ed">
                    <button aria-label={c.hidden ? 'แสดงหมวด' : 'ซ่อนหมวด'} aria-pressed={c.hidden} onClick={() => toggleCategoryHidden(db, c.id)}><Icon name={c.hidden ? 'eyeOff' : 'eye'} size={16} stroke={2} /></button>
                  </span>
                </div>
              ) : (
                <button className={`lgc-row${c.hidden ? ' hid' : ''}`} onClick={() => setForm({ cat: c })}>{body}<span className="cnt num">{n ? `${n} ครั้ง` : '—'}</span><Icon name="chevron" size={14} stroke={2} /></button>
              )}
            </li>
          );
        }}</SortList>
      </ul>

      {form && <CatForm data={data} type={type} cat={form.cat} onClose={() => setForm(null)} />}
    </main>
  );
}

/** รายการในแผนที่หมวดรายจ่ายเลือกเป็นงบได้ (หลายงบได้): เฉพาะรายจ่ายผันแปร (บันทึกนับงบเฉพาะผันแปร · เจ้าของตกลง) */
const budgetChoices = (data: LogData) => {
  const variable = new Set(data.groups.filter((g) => g.enabled && g.kind === 'variable').map((g) => g.id));
  return data.items.filter((i) => variable.has(i.groupId)).sort((a, b) => a.order - b.order);
};

/** เพิ่ม/แก้หมวด (ป๊อปอัป) · ชื่อ ไอคอน สี · รายจ่าย: ใช้งบจากรายการไหนในแผน (เลือกได้หลายรายการ) · แก้: ลบหมวด */
export function CatForm({ data, type, cat, onClose, onAdded }: { data: LogData; type: LogType; cat: LogCategory | null; onClose: () => void; onAdded?: (c: LogCategory) => void }) {
  const E = type === 'expense';
  const icons = CAT_ICONS[type];
  const [name, setName] = useState(cat?.name ?? '');
  const [icon, setIcon] = useState(cat?.icon ?? icons[icons.length - 4]);
  const [bg, setBg] = useState(cat?.bg ?? NEW_CAT_BGS[0]);
  const [budgetIds, setBudgetIds] = useState<string[]>(cat ? data.items.filter((i) => i.logCategoryIds.includes(cat.id)).sort((a, b) => a.order - b.order).map((i) => i.id) : []);
  const [picking, setPicking] = useState(false);
  const [ask, setAsk] = useState(false);
  const iconList = icons.includes(icon) ? icons : [icon, ...icons];
  const bgList = NEW_CAT_BGS.includes(bg) ? NEW_CAT_BGS : [bg, ...NEW_CAT_BGS];
  const fg = FG_OF[bg] ?? cat?.fg ?? '#16231C';
  const dup = data.categories.some((c) => c.type === type && c.id !== cat?.id && c.name === name.trim());
  const ok = name.trim() !== '' && !dup;
  const chosen = budgetIds.map((id) => data.items.find((i) => i.id === id)).filter((i): i is NonNullable<typeof i> => !!i);
  const cur = cycleOf(localToday(), data.settings!.pay);
  const chosenAmt = chosen.reduce((a, i) => a + (i.monthOverrides[cur] ?? i.defaultAmount), 0);
  const fallback = cat?.id === FALLBACK_CAT[type];
  const used = cat ? data.entries.filter((e) => e.categoryId === cat.id).length : 0;
  const tName = E ? 'รายจ่าย' : 'รายรับ';

  const save = async () => {
    if (!ok) return;
    if (cat) {
      await updateCategory(db, cat.id, { name, icon, bg, fg });
      if (E) await setCategoryBudgets(db, cat.id, budgetIds);
    } else {
      const c = await addCategory(db, { type, name, icon, bg, fg });
      if (E && budgetIds.length) await setCategoryBudgets(db, c.id, budgetIds);
      onAdded?.(c);
    }
    onClose();
  };

  if (picking) return <BudgetSheet data={data} cat={cat} name={name.trim() || 'หมวดใหม่'} initial={budgetIds} onSave={(ids) => { setBudgetIds(ids); setPicking(false); }} onClose={() => setPicking(false)} />;
  return (
    <LgSheet label={cat ? `แก้หมวด${cat.name}` : `เพิ่มหมวด${tName}`} onClose={onClose}>
      <div className="lg-sh-h">
        <span className="cat-ic" style={catStyle({ bg, fg })}><CatIcon icon={icon} size={24} /></span>
        <span className="t"><span>{cat ? `หมวด${tName}` : 'ต่อท้ายตารางหมวดในหน้าเพิ่มรายการ'}</span><h2>{cat ? 'แก้หมวด' : `เพิ่มหมวด${tName}`}</h2></span>
        <button className="lg-x" aria-label="ปิด" onClick={onClose}><Icon name="close" size={18} stroke={2.2} /></button>
      </div>
      <label className="lgc-field"><span>ชื่อหมวด</span>
        <input value={name} placeholder={E ? 'เช่น ค่าหมอ, ของขวัญ' : 'เช่น ขายของ, ค่าเช่า'} maxLength={24} autoFocus={!cat} onChange={(e) => setName(e.target.value)} aria-invalid={dup} />
        {dup && <span className="gx-err">มีหมวดชื่อนี้แล้ว</span>}
      </label>
      {E && (
        <div className="lgc-field"><span>ใช้งบจาก</span>
          <button className={`lgc-bud${chosen.length ? '' : ' off'}`} onClick={() => setPicking(true)} aria-label={`ใช้งบจาก ${chosen.length ? chosen.map((i) => i.name).join(', ') : 'นอกงบ'} แตะเพื่อเปลี่ยน`}>
            <span className="t"><b>{chosen.length ? chosen.map((i) => `งบ${i.name}`).join(' + ') : 'นอกงบ'}</b>
              <span className="num">{chosen.length ? <>{chosen.length > 1 ? `รวม ${chosen.length} งบ · ` : 'รายจ่ายผันแปร · '}<span className="nw">{baht(chosenAmt)} ต่อเดือน</span></> : 'จดหมวดนี้แล้วไม่หักงบไหน'}</span></span>
            <span className="go">เปลี่ยน<Icon name="chevron" size={14} stroke={2.2} /></span>
          </button>
        </div>
      )}
      <div className="lgc-field"><span>ไอคอน</span>
        <div className="lgc-ics">{iconList.map((ic) => <button key={ic} aria-label={`ไอคอน ${ic}`} aria-pressed={icon === ic} onClick={() => setIcon(ic)}><CatIcon icon={ic} /></button>)}</div>
      </div>
      <div className="lgc-field"><span>สีพื้น</span>
        <div className="lgc-cols">{bgList.map((c, i) => <button key={c} aria-label={`สีพื้น ${i + 1}`} aria-pressed={bg === c} onClick={() => setBg(c)} style={{ background: c }} />)}</div>
      </div>
      <button className="lgc-add" disabled={!ok} onClick={save}>{cat ? 'บันทึก' : 'เพิ่มหมวดนี้'}</button>
      {cat && !fallback && (!ask ? <button className="lg-del" onClick={() => setAsk(true)}>ลบหมวดนี้</button> : (
        <div className="lg-delbox" role="alertdialog" aria-label="ยืนยันลบหมวด">
          <span className="t">ลบหมวด "{cat.name}" ?</span>
          <span className="b">{used ? <>รายการที่จดไว้ <span className="num">{used}</span> รายการจะย้ายไปหมวด "อื่น ๆ"</> : 'ยังไม่มีรายการในหมวดนี้'} · <span className="nw">ถ้าแค่ไม่อยากเห็น</span> <span className="nw">ใช้ "ซ่อน" ในจัดเรียงแทนได้</span></span>
          <div className="lg-2"><button className="no" onClick={() => setAsk(false)}>ยกเลิก</button>
            <button className="yes" onClick={async () => { await deleteCategory(db, cat.id); onClose(); }}>ลบหมวด</button></div>
        </div>
      ))}
      {fallback && <div className="lg-info"><Icon name="info" size={15} stroke={2} /><span>หมวด "อื่น ๆ" ลบไม่ได้ · ใช้รับรายการที่ไม่ได้เลือกหมวด และรายการจากหมวดที่ถูกลบ</span></div>}
    </LgSheet>
  );
}

/** เลือกงบของหมวด: รายจ่ายผันแปรในแผน เลือกได้หลายรายการ · ไม่เลือกเลย = นอกงบ */
function BudgetSheet({ data, cat, name, initial, onSave, onClose }: {
  data: LogData; cat: LogCategory | null; name: string; initial: string[]; onSave: (ids: string[]) => void; onClose: () => void;
}) {
  const [on, setOn] = useState<string[]>(initial);
  const items = budgetChoices(data);
  const cur = cycleOf(localToday(), data.settings!.pay);
  const othersOf = (id: string) => data.items.find((i) => i.id === id)!.logCategoryIds.filter((c) => c !== cat?.id).map((c) => data.categories.find((x) => x.id === c)?.name).filter(Boolean);
  return (
    <LgSheet label={`เลือกงบของหมวด${name}`} onClose={onClose}>
      <div className="lg-sh-h">
        <span className="t"><span>หมวดบันทึก · {name}</span><h2>ใช้งบจากรายการไหน</h2></span>
        <button className="lg-x" aria-label="กลับ" onClick={onClose}><Icon name="close" size={18} stroke={2.2} /></button>
      </div>
      <div className="gx-info"><Icon name="info" size={16} stroke={2} /><span>จดรายจ่ายหมวดนี้แล้ว<span className="nw">หักจากงบที่ติ๊ก</span> · <span className="nw">ติ๊กหลายงบ = รวมเป็นงบก้อนเดียว</span> · <span className="nw">ไม่ติ๊กเลย = นอกงบ</span> · <span className="nw">แสดงเฉพาะรายจ่ายผันแปร</span></span></div>
      <div className="lgc-items" role="group" aria-label="งบรายจ่ายผันแปร">
        {items.map((i) => {
          const y = on.includes(i.id);
          const others = othersOf(i.id);
          return (
            <button key={i.id} role="checkbox" aria-checked={y} onClick={() => setOn(y ? on.filter((x) => x !== i.id) : [...on, i.id])}>
              <span className="t"><b>งบ{i.name}</b><span className="num">{baht(i.monthOverrides[cur] ?? i.defaultAmount)}{others.length ? ` · ใช้ร่วมกับ ${others.join(', ')}` : ''}</span></span>
              <span className="bx">{y && <Icon name="check" size={14} stroke={3} />}</span>
            </button>
          );
        })}
        {items.length === 0 && <span className="lg-empty">ยังไม่มีรายจ่ายผันแปรในแผน</span>}
      </div>
      <button className="lgc-add" onClick={() => onSave(items.filter((i) => on.includes(i.id)).map((i) => i.id))}>{on.length ? `ใช้ ${on.length} งบนี้` : 'ใช้เป็นนอกงบ'}</button>
    </LgSheet>
  );
}
