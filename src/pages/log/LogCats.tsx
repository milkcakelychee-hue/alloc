// จัดการหมวดบันทึก (บอร์ด LogCats): ลำดับ · ซ่อน · ผูกกับรายการในแผน · เพิ่มหมวดใหม่
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../db/db';
import type { LogCategory, LogType } from '../../db/types';
import { cycleOf, localToday } from '../../calc/dates';
import { planLabelOf } from '../../calc/logView';
import { addCategory, moveCategory, setCategoryLinks, toggleCategoryHidden } from '../../db/logActions';
import { Icon } from '../../components/Icon';
import { baht } from '../goals/goalUi';
import { CatIcon, NEW_CAT_BGS, NEW_CAT_ICONS, catStyle } from './catIcon';
import { useLogData, type LogData } from './useLogData';
import { LgSheet } from './EntrySheet';

export default function LogCats() {
  const data = useLogData();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [type, setType] = useState<LogType>(sp.get('type') === 'income' ? 'income' : 'expense');
  const [ed, setEd] = useState(false);
  const [name, setName] = useState('');
  const [ni, setNi] = useState(0);
  const [nc, setNc] = useState(0);
  const [newLinks, setNewLinks] = useState<string[]>([]);
  const [linking, setLinking] = useState<{ cat: LogCategory | null } | null>(null);
  if (!data?.settings) return null;
  const s = data.settings;
  const E = type === 'expense';
  const cur = cycleOf(localToday(), s.pay);
  const list = data.categories.filter((c) => c.type === type);
  const count = (id: string) => data.entries.filter((e) => e.categoryId === id && cycleOf(e.date, s.pay) === cur).length;
  const nExp = data.categories.filter((c) => c.type === 'expense').length, nInc = data.categories.filter((c) => c.type === 'income').length;
  const newLabel = newLinks.length ? data.items.filter((i) => newLinks.includes(i.id)).map((i) => i.name).join(', ') : null;

  return (
    <main className="page lgp lgp-sub">
      <div className="lg-head">
        <button className="lg-sq" aria-label="กลับ" onClick={() => nav(-1)}><Icon name="back" size={20} stroke={2} /></button>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}><span style={{ fontSize: 12, color: 'var(--ink3)' }}>บันทึก</span><b style={{ fontSize: 20, fontWeight: 700 }}>จัดการหมวด</b></span>
        <button className="gx-hbtn" aria-pressed={ed} onClick={() => setEd(!ed)} style={ed ? { background: 'var(--pri)', color: '#FFFFFF' } : undefined}>{ed ? 'เสร็จ' : 'จัดเรียง'}</button>
      </div>
      <div className="lga-tabs" role="tablist" aria-label="ประเภท" style={{ padding: 5, ['--ac' as string]: '#B8432A' }}>
        <button role="tab" className="e" aria-selected={E} onClick={() => setType('expense')} style={{ height: 40 }}>รายจ่าย <span className="num" style={{ fontWeight: 400, opacity: .8 }}>{nExp}</span></button>
        <button role="tab" className="i" aria-selected={!E} onClick={() => setType('income')} style={{ height: 40 }}>รายรับ <span className="num" style={{ fontWeight: 400, opacity: .8 }}>{nInc}</span></button>
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--ink3)', padding: '0 2px', lineHeight: 1.5 }}>
        {ed ? 'ลูกศรเลื่อนลำดับในตารางหน้าเพิ่มรายการ · ไอคอนตาซ่อนหมวดที่ไม่ได้ใช้ (รายการเก่ายังอยู่)'
          : <>ลำดับนี้คือลำดับในตารางหน้าเพิ่มรายการ · ตัวเลขด้านขวาคือจำนวนครั้งที่จดในรอบนี้{E && <> · <span className="nw">แตะหมวดเพื่อผูกกับรายการในแผน</span></>}</>}
      </span>

      <ul className="lgc-list" aria-label="รายการหมวด">
        {list.map((c, i) => {
          const lk = E ? planLabelOf(c.id, data.items) : null;
          const n = count(c.id);
          const body = <>
            <span className="cat-ic" style={catStyle(c)}><CatIcon icon={c.icon} /></span>
            <span className="t"><b>{c.name}{c.hidden ? ' (ซ่อน)' : ''}</b>
              <span className={lk ? 'lk' : ''}>{lk ? `นับเข้างบ ${lk}` : E ? 'ยังไม่ผูกแผน · นับเป็นนอกงบ' : 'รายรับนอกแผน'}</span></span>
          </>;
          return (
            <li key={c.id}>
              {ed ? (
                <div className={`lgc-row${c.hidden ? ' hid' : ''}`}>{body}
                  <span className="lgc-ed">
                    <button aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => moveCategory(db, c.id, -1)}><span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="chevDown" size={16} stroke={2.2} /></span></button>
                    <button aria-label="เลื่อนลง" disabled={i === list.length - 1} onClick={() => moveCategory(db, c.id, 1)}><Icon name="chevDown" size={16} stroke={2.2} /></button>
                    <button aria-label={c.hidden ? 'แสดงหมวด' : 'ซ่อนหมวด'} aria-pressed={c.hidden} onClick={() => toggleCategoryHidden(db, c.id)}><Icon name={c.hidden ? 'eyeOff' : 'eye'} size={16} stroke={2} /></button>
                  </span>
                </div>
              ) : E ? (
                <button className={`lgc-row${c.hidden ? ' hid' : ''}`} onClick={() => setLinking({ cat: c })}>{body}<span className="cnt num">{n ? `${n} ครั้ง` : '—'}</span></button>
              ) : (
                <div className={`lgc-row${c.hidden ? ' hid' : ''}`}>{body}<span className="cnt num">{n ? `${n} ครั้ง` : '—'}</span></div>
              )}
            </li>
          );
        })}
      </ul>

      <section className="lgc-new" aria-label="เพิ่มหมวดใหม่">
        <div className="hd">
          <span className="cat-ic" style={catStyle({ bg: NEW_CAT_BGS[nc], fg: '#16231C' })}><CatIcon icon={NEW_CAT_ICONS[ni]} size={22} /></span>
          <span className="t"><h2>เพิ่มหมวด{E ? 'รายจ่าย' : 'รายรับ'}</h2><span>จะต่อท้ายตารางหมวดในหน้าเพิ่มรายการ</span></span>
        </div>
        <input aria-label="ชื่อหมวด" placeholder="ชื่อหมวด เช่น ของขวัญ, ค่าหมอ" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        <div className="lgc-ics">{NEW_CAT_ICONS.map((ic, i) => <button key={ic} aria-label={`ไอคอน ${i + 1}`} aria-pressed={ni === i} onClick={() => setNi(i)}><CatIcon icon={ic} /></button>)}</div>
        <div className="lgc-cols">{NEW_CAT_BGS.map((bg, i) => <button key={bg} aria-label={`สีพื้น ${i + 1}`} aria-pressed={nc === i} onClick={() => setNc(i)} style={{ background: bg }} />)}</div>
        {E && (
          <div className="lgc-link"><span>นับเข้างบ</span>
            <button onClick={() => setLinking({ cat: null })}>{newLabel ?? 'ยังไม่ผูก · เลือกรายการในแผน'}<Icon name="chevron" size={14} stroke={2.2} /></button></div>
        )}
        <button className="lgc-add" disabled={!name.trim() || list.some((c) => c.name === name.trim())} onClick={async () => {
          const c = await addCategory(db, { type, name, icon: NEW_CAT_ICONS[ni], bg: NEW_CAT_BGS[nc], fg: '#16231C' });
          if (E && newLinks.length) await setCategoryLinks(db, c.id, newLinks);
          setName(''); setNewLinks([]);
        }}>เพิ่มหมวดนี้</button>
      </section>

      {linking && <LinkSheet data={data} cat={linking.cat} name={linking.cat?.name ?? (name.trim() || 'หมวดใหม่')} initial={linking.cat ? data.items.filter((i) => i.logCategoryIds.includes(linking.cat!.id)).map((i) => i.id) : newLinks}
        onSave={async (ids) => { if (linking.cat) await setCategoryLinks(db, linking.cat.id, ids); else setNewLinks(ids); setLinking(null); }} onClose={() => setLinking(null)} />}
    </main>
  );
}

/** ผูกหมวดกับรายการในแผนจากฝั่งหมวด (ดีไซน์ใหม่ · กลับด้านของบอร์ด LogCatPick) */
function LinkSheet({ data, cat, name, initial, onSave, onClose }: {
  data: LogData; cat: LogCategory | null; name: string; initial: string[]; onSave: (ids: string[]) => void; onClose: () => void;
}) {
  const [on, setOn] = useState<string[]>(initial);
  const kinds = new Map(data.groups.filter((g) => g.enabled).map((g) => [g.id, g]));
  const items = data.items.filter((i) => { const g = kinds.get(i.groupId); return g && g.kind !== 'income' && g.kind !== 'saving' && g.kind !== 'invest'; });
  const cur = cycleOf(localToday(), data.settings!.pay);
  return (
    <LgSheet label={`ผูก${name}กับรายการในแผน`} onClose={onClose}>
      <div className="lg-sh-h">
        {cat && <span className="cat-ic" style={catStyle(cat)}><CatIcon icon={cat.icon} size={24} /></span>}
        <span className="t"><span>หมวดบันทึก · {name}</span><h2>นับเข้างบรายการไหน</h2></span>
        <button className="lg-x" aria-label="ปิด" onClick={onClose}><Icon name="close" size={18} stroke={2.2} /></button>
      </div>
      <div className="gx-info"><Icon name="info" size={16} stroke={2} /><span>จดรายจ่ายในหมวดนี้แล้วนับเข้างบของรายการที่ติ๊ก · <span className="nw">ไม่ติ๊กเลย = นอกงบ</span></span></div>
      <div className="lgc-items" role="group" aria-label="รายการในแผน">
        {items.map((i) => {
          const y = on.includes(i.id);
          const others = i.logCategoryIds.filter((c) => c !== cat?.id).map((c) => data.categories.find((x) => x.id === c)?.name).filter(Boolean);
          return (
            <button key={i.id} role="checkbox" aria-checked={y} onClick={() => setOn(y ? on.filter((x) => x !== i.id) : [...on, i.id])}>
              <span className="t"><b>{i.name}</b><span className="num">{kinds.get(i.groupId)!.name} · {baht(i.monthOverrides[cur] ?? i.defaultAmount)}{others.length ? ` · ใช้กับ ${others.join(', ')}` : ''}</span></span>
              <span className="bx">{y && <Icon name="check" size={14} stroke={3} />}</span>
            </button>
          );
        })}
        {items.length === 0 && <span className="lg-empty">ยังไม่มีรายจ่ายในแผน</span>}
      </div>
      <button className="lgc-add" onClick={() => onSave(on)}>{on.length ? `นับเข้างบ ${on.length} รายการ` : 'ไม่ผูก (นับเป็นนอกงบ)'}</button>
    </LgSheet>
  );
}
