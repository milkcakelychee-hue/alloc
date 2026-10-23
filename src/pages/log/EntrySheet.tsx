// แผ่นรายการที่บันทึก (บอร์ด LogEdit): ยอด · วันที่ · ตัดงบ · โน้ต · แก้ไข / จดซ้ำวันนี้ / ลบ
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../db/db';
import type { LogEntry } from '../../db/types';
import { cycleOf, localToday, thaiDate } from '../../calc/dates';
import { weekday } from '../../calc/payday';
import { expensesIn } from '../../calc/log';
import { entryBudget } from '../../calc/logView';
import { goalAwareAmountOf } from '../../calc/goals';
import { deleteLogEntry } from '../../db/actions';
import { repeatEntry } from '../../db/logActions';
import { Icon } from '../../components/Icon';
import { baht } from '../goals/goalUi';
import { CatIcon, catStyle } from './catIcon';
import { dayFull, type LogData } from './useLogData';

export function LgSheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div className="scrim" onClick={onClose}>
      <section className="sheet lg-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <span className="grab" aria-hidden="true" />
        {children}
      </section>
    </div>,
    document.body
  );
}

export function EntrySheet({ entry: e0, data, onClose, onEdit }: { entry: LogEntry; data: LogData; onClose: () => void; onEdit: () => void }) {
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState('');
  const s = data.settings!;
  const e = data.entries.find((x) => x.id === e0.id) ?? e0;
  const cat = data.categories.find((c) => c.id === e.categoryId);
  const inc = e.type === 'income';
  const split = !inc && e.myShare !== e.amountPaid;
  const cycle = cycleOf(e.date, s.pay);
  const cur = cycleOf(localToday(), s.pay);
  const b = inc ? null : entryBudget(e, data.items, expensesIn(data.entries, cycle, s.pay), cycle, goalAwareAmountOf(data.goals, data.items, data.adjustments, cur));
  const plan = e.planItemId ? data.items.find((i) => i.id === e.planItemId) : null;
  const time = new Date(e.createdAt);
  const hhmm = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
  const title = e.note || cat?.name || 'อื่น ๆ';

  return (
    <LgSheet label={`รายการ ${title}`} onClose={onClose}>
      <div className="lg-sh-h">
        <span className="cat-ic" style={catStyle(cat)}><CatIcon icon={cat?.icon ?? 'other'} size={24} /></span>
        <span className="t"><h2>{title}</h2><span>{inc ? 'รายรับ' : 'รายจ่าย'} · {cat?.name ?? 'อื่น ๆ'}</span></span>
        <button className="lg-x" aria-label="ปิด" onClick={onClose}><Icon name="close" size={18} stroke={2.2} /></button>
      </div>
      <div className={`lg-amtbox${inc ? ' inc' : ''}`}>
        <span className="l"><span>{inc ? 'รายรับ (ไม่เปลี่ยนตัวเลขในแผน)' : split ? 'ส่วนของฉัน (นับเป็นรายจ่าย)' : 'รายจ่าย'}</span>
          <b className="num">{inc ? '+' : ''}{baht(inc ? e.amountPaid : e.myShare)}</b></span>
        {split && <span className="r num">จ่ายจริง {baht(e.amountPaid)}</span>}
      </div>
      <div className="lg-fields">
        <div><span className="k"><Icon name="calendar" size={16} stroke={2} />วันที่</span><span className="v num">{dayFull(weekday(e.date))} {thaiDate(e.date)} · {hhmm}</span></div>
        {!inc && <div><span className="k"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5V12h8.5" /></svg>ตัดงบ</span>
          <span className="v num">{b ? <>{b.label} · {b.remaining < 0 ? `เกิน ${baht(-b.remaining)}` : `เหลือ ${baht(b.remaining)}`} / {baht(b.budget)}</> : 'นอกงบ'}</span></div>}
        {plan && <div><span className="k"><Icon name="checkSq" size={16} stroke={2} />จากแผน</span><span className="v">{plan.name} · ติ๊กจ่ายแล้ว</span></div>}
        <div><span className="k"><Icon name="edit" size={16} stroke={2} />โน้ต</span><span className="v">{e.note || '–'}</span></div>
      </div>
      {plan && <div className="lg-info"><Icon name="info" size={15} stroke={2} /><span>บันทึกให้อัตโนมัติจากการ์ด "จ่ายหรือยัง" · ลบรายการนี้แล้ว "{plan.name}" จะกลับเป็นยังไม่จ่าย</span></div>}
      {done && <div className="lg-info" role="status" style={{ color: 'var(--gx-ok)' }}><Icon name="check" size={15} stroke={2.4} /><span>{done}</span></div>}
      <div className="lg-2">
        <button className="pri" onClick={onEdit}><Icon name="edit" size={18} stroke={2} />แก้ไข</button>
        <button className="out" onClick={async () => { await repeatEntry(db, e.id, localToday()); setDone(`จด "${title}" ซ้ำในวันนี้แล้ว`); }}><Icon name="copy" size={18} stroke={2} />จดซ้ำวันนี้</button>
      </div>
      {!ask ? <button className="lg-del" onClick={() => setAsk(true)}>ลบรายการนี้</button> : (
        <div className="lg-delbox" role="alertdialog" aria-label="ยืนยันลบ">
          <span className="t">ลบ "{title}" ?</span>
          <span className="b">รายการนี้จะหายจากบันทึก{plan ? <> และ "{plan.name}" ในแผนจะกลับเป็นยังไม่จ่าย</> : null}</span>
          <div className="lg-2"><button className="no" onClick={() => setAsk(false)}>ยกเลิก</button>
            <button className="yes" onClick={async () => { await deleteLogEntry(db, e.id); onClose(); }}>ลบ</button></div>
        </div>
      )}
    </LgSheet>
  );
}
