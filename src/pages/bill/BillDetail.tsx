// หน้าบิล (บอร์ด BillDetail): คนในบิล · รายการ (แตะวงกลมเลือกคนหาร) · หมายเหตุ · ยอดของแต่ละคน · บันทึกว่าชำระ
// แก้ในหน้านี้เป็นฉบับร่าง กด "บันทึก" แล้วค่อยเขียนลงเครื่อง (ส่วนของฉันลงบันทึก 1 รายการต่อบิล)
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { ME_ID, type DateStr, type LogCategory, type Payment, type Person } from '../../db/types';
import { billDateLabel, billSummary, splitItem, type PayStatus } from '../../calc/bills';
import { localToday, thaiDate } from '../../calc/dates';
import { formatBaht, parseBaht } from '../../calc/money';
import { deleteBill, deletePayment, saveBill } from '../../db/billActions';
import { FALLBACK_CAT } from '../../db/logActions';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { Grip, SortList } from '../../components/SortList';
import { baht } from '../goals/goalUi';
import { LgSheet } from '../log/EntrySheet';
import { CatIcon, catStyle } from '../log/catIcon';
import { planLabelOf } from '../../calc/logView';
import { Avatar, PERSON_COLORS, StatusPill, STATUS_LABEL, initial, itemsOf, paymentsOf, useBillData } from './billUi';
import { PaySheet } from './PaySheet';
import { BillIcon } from './BillList';

type Row = { key: string; id?: string; name: string; price: string; peopleIds: string[] };
type Draft = { title: string; date: DateStr; endDate: DateStr | null; categoryId: string; note: string; peopleIds: string[]; items: Row[] };

const key = () => crypto.randomUUID();
const priceText = (s: number) => (s % 100 === 0 ? formatBaht(s, { decimals: false }) : formatBaht(s));

/** เปลี่ยนบิล (เช่น จากบิลหนึ่งไปบิลใหม่) = เริ่มร่างใหม่ */
export function BillDetail() {
  const { id = 'new' } = useParams();
  return <BillEditor key={id} id={id} />;
}

function BillEditor({ id }: { id: string }) {
  const isNew = id === 'new';
  const nav = useNavigate();
  const data = useBillData();
  const cats = useLiveQuery(() => db.logCategories.where('type').equals('expense').sortBy('order'));
  const planItems = useLiveQuery(() => db.planItems.toArray());
  const [d, setD] = useState<Draft | null>(null);
  const [base, setBase] = useState('');
  const [ed, setEd] = useState(isNew);
  const [sheet, setSheet] = useState<'people' | 'cat' | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  const [ask, setAsk] = useState<'leave' | 'delete' | null>(null);
  const [nm, setNm] = useState('');
  const [pr, setPr] = useState('');
  const [err, setErr] = useState('');
  const bill = data?.bills.find((b) => b.id === id);

  // โหลดร่างจากบิล (ครั้งแรก หรือหลังบันทึก)
  useEffect(() => {
    if (!data || d) return;
    let next: Draft;
    if (isNew) next = { title: '', date: localToday(), endDate: null, categoryId: FALLBACK_CAT.expense, note: '', peopleIds: [ME_ID], items: [] };
    else if (bill) {
      next = { title: bill.title, date: bill.date ?? localToday(), endDate: bill.endDate ?? null, categoryId: bill.categoryId ?? FALLBACK_CAT.expense, note: bill.note, peopleIds: bill.peopleIds,
        items: itemsOf(data, bill.id).map((i) => ({ key: i.id, id: i.id, name: i.name, price: priceText(i.price), peopleIds: i.peopleIds })) };
    } else return;
    setD(next); setBase(JSON.stringify(next));
  }, [data, bill, d, isNew]);

  if (!data || !d) {
    if (data && !isNew && !bill) return <main className="page lgp lgp-sub"><div className="bl-empty">ไม่พบบิลนี้ · <Link to="/log?tab=bill">กลับไปบิลแชร์</Link></div></main>;
    return null;
  }
  const dirty = JSON.stringify(d) !== base;
  const set = (p: Partial<Draft>) => setD({ ...d, ...p });
  const setRow = (k: string, p: Partial<Row>) => set({ items: d.items.map((r) => (r.key === k ? { ...r, ...p } : r)) });
  const person = (pid: string) => data.people.find((p) => p.id === pid);
  const ppl = d.peopleIds.map(person).filter(Boolean) as Person[];
  const parsed = d.items.map((r) => ({ ...r, p: parseBaht(r.price) }));
  const valid = parsed.filter((r) => r.p !== null && r.p > 0).map((r) => ({ id: r.key, name: r.name, price: r.p!, peopleIds: r.peopleIds.filter((x) => d.peopleIds.includes(x)) }));
  const pays = bill ? paymentsOf(data, bill.id) : [];
  const sum = billSummary(valid, pays);
  const total = valid.reduce((a, r) => a + r.price, 0);
  const savedStatus: PayStatus | null = bill ? billSummary(itemsOf(data, bill.id), pays).status : null;
  const cat = cats?.find((c) => c.id === d.categoryId);
  const budgetOf = planItems ? planLabelOf(d.categoryId, planItems) : null;
  const badRow = parsed.find((r) => !r.name.trim() || r.p === null || r.p <= 0);

  const back = () => (dirty ? setAsk('leave') : nav('/log?tab=bill'));
  const addRow = () => {
    const p = parseBaht(pr);
    if (!nm.trim() || p === null || p <= 0) { setErr('ใส่ชื่อรายการและราคา'); return; }
    set({ items: [...d.items, { key: key(), name: nm.trim(), price: priceText(p), peopleIds: [...d.peopleIds] }] });
    setNm(''); setPr(''); setErr('');
  };
  const togglePerson = (pid: string) => {
    if (d.peopleIds.includes(pid)) set({ peopleIds: d.peopleIds.filter((x) => x !== pid), items: d.items.map((r) => ({ ...r, peopleIds: r.peopleIds.filter((x) => x !== pid) })) });
    else set({ peopleIds: [...d.peopleIds, pid], items: d.items.map((r) => ({ ...r, peopleIds: r.peopleIds.includes(pid) ? r.peopleIds : [...r.peopleIds, pid] })) }); // เพิ่มคนเข้าบิล = ติ๊กทุกรายการ
  };
  const save = async () => {
    if (!d.title.trim()) { setErr('ใส่ชื่อบิล'); setEd(true); return; }
    if (badRow) { setErr(`รายการ "${badRow.name || 'ไม่มีชื่อ'}" ยังไม่มีชื่อหรือราคา`); setEd(true); return; }
    if (dirty || isNew) await saveBill(db, { id: isNew ? undefined : id, title: d.title, date: d.date, endDate: null, categoryId: d.categoryId, note: d.note, peopleIds: d.peopleIds,
      items: parsed.map((r) => ({ id: r.id, name: r.name, price: r.p!, peopleIds: r.peopleIds })) });
    nav('/log?tab=bill', { replace: true });
  };
  const removedPaid = bill ? bill.peopleIds.filter((p) => !d.peopleIds.includes(p) && pays.some((x) => x.personId === p)) : [];

  return (
    <main className="page lgp lgp-sub bl-detail">
      <div className="lg-head">
        <button className="lg-sq" aria-label="กลับไปบิลแชร์" onClick={back}><Icon name="back" size={20} stroke={2} /></button>
        <span className="bl-dh"><h1>{d.title.trim() || (isNew ? 'บิลใหม่' : 'บิล')}</h1>
          <span className="num">กำหนดจ่าย {billDateLabel(d.date)}{savedStatus ? ` · ${STATUS_LABEL[savedStatus]}` : ''}</span></span>
        <button className={`gx-hbtn${ed ? ' on' : ''}`} aria-pressed={ed} onClick={() => setEd(!ed)}>{ed ? 'เสร็จ' : 'แก้ไข'}</button>
      </div>

      {ask === 'leave' && (
        <div className="lg-delbox" role="alertdialog" aria-label="ยังไม่ได้บันทึก">
          <span className="t">ยังไม่ได้บันทึกบิลนี้</span>
          <span className="b">ออกตอนนี้ สิ่งที่แก้จะหายไป</span>
          <div className="lg-2"><button className="no" onClick={() => setAsk(null)}>อยู่ต่อ</button><button className="yes" onClick={() => nav('/log?tab=bill')}>ออกโดยไม่บันทึก</button></div>
        </div>
      )}

      {ed && (
        <section aria-label="ข้อมูลบิล" className="bl-box">
          <h2>ข้อมูลบิล</h2>
          <label className="bl-fld"><span>ชื่อบิล</span><input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="เช่น ของใช้ในบ้าน ต.ค." /></label>
          <label className="bl-fld"><span>วันที่กำหนดจ่าย</span>
            <input type="date" className="num" value={d.date} onChange={(e) => set({ date: e.target.value || localToday() })} /></label>
          <button className="bl-catrow" onClick={() => setSheet('cat')}>
            <span className="cat-ic" style={catStyle(cat)}><CatIcon icon={cat?.icon ?? 'other'} size={18} /></span>
            <span className="tx"><span className="t1">ลงบันทึกในหมวด {cat?.name ?? 'อื่น ๆ'}</span><span className="t2">ส่วนของฉันนับเป็น<span className="nw">รายจ่าย 1 รายการ</span> · {budgetOf ? <span className="nw">หักจากงบ{budgetOf}</span> : <span className="nw">นอกงบ</span>}</span></span>
            <Icon name="chevron" size={16} stroke={2} />
          </button>
        </section>
      )}

      <section aria-label="คนในบิล" className="bl-box">
        <div className="bl-bh"><h2>คนในบิล</h2><span>แบ่งแบบหารเท่า</span></div>
        <div className="bl-pchips">
          {ppl.map((p) => (
            <span key={p.id} className="pc"><Avatar person={p} size={26} />{p.name}
              {ed && p.id !== ME_ID && <button aria-label={`เอา${p.name}ออกจากบิล`} onClick={() => togglePerson(p.id)}><Icon name="close" size={14} stroke={2.4} /></button>}</span>
          ))}
          <button className="add" onClick={() => setSheet('people')}>+ เพิ่มคน</button>
        </div>
        {removedPaid.length > 0 && <span className="bl-warn">{removedPaid.map((p) => person(p)?.name).join(', ')} มีประวัติรับเงินในบิลนี้ · <span className="nw">บันทึกแล้วประวัตินั้นจะถูกลบ</span></span>}
        <span className="bl-hint">รายชื่อมาจาก "จัดการคน" ใช้ซ้ำได้ทุกบิล · <span className="nw">แตะวงกลมใต้รายการ</span><span className="nw">เพื่อเลือกว่าใครหารรายการนั้น</span></span>
      </section>

      <section aria-label="รายการในบิล" className="bl-box bl-items">
        <div className="bl-bh"><h2>รายการ <span className="num c">{d.items.length}</span></h2><span className="num">รวม <b>{baht(total)}</b></span></div>
        <ul>
          <SortList ids={d.items.map((r) => r.key)} onCommit={(ks) => set({ items: ks.map((k) => d.items.find((r) => r.key === k)!) })}>{(k, dragItem, dragHandle) => {
            const r = d.items.find((x) => x.key === k)!;
            const on = r.peopleIds.filter((x) => d.peopleIds.includes(x));
            const p = parseBaht(r.price);
            const each = p && on.length ? splitItem(p, on).get(on.find((x) => x !== ME_ID) ?? on[0]) ?? 0 : 0;
            return (
              <li key={k} {...dragItem}>
                <div className="r1">
                  {ed && <Grip label={`ลากเพื่อย้าย ${r.name}`} {...dragHandle} />}
                  {ed ? <>
                    <input className="nm" aria-label="ชื่อรายการ" value={r.name} onChange={(e) => setRow(k, { name: e.target.value })} />
                    <MoneyInput className="num pr" aria-label={`ราคา ${r.name}`} value={r.price} onChange={(e) => setRow(k, { price: e.target.value })} />
                    <span className="ops">
                      <button aria-label="ลบรายการ" className="del" onClick={() => set({ items: d.items.filter((x) => x.key !== k) })}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" /></svg></button>
                    </span>
                  </> : <><span className="nm">{r.name}</span><span className="num pr">{p !== null ? baht(p) : r.price}</span></>}
                </div>
                <div className="r2">
                  {ppl.map((pp) => {
                    const y = r.peopleIds.includes(pp.id);
                    return <button key={pp.id} aria-label={`${pp.name}หารรายการนี้`} aria-pressed={y} className={`tg${y ? ' on' : ''}${pp.id === ME_ID ? ' me' : ''}`}
                      style={y && pp.id !== ME_ID ? { background: PERSON_BG(pp) } : undefined} onClick={() => setRow(k, { peopleIds: y ? r.peopleIds.filter((x) => x !== pp.id) : [...r.peopleIds, pp.id] })}>{initialOf(pp)}</button>;
                  })}
                  <span className={`num rs${on.length ? '' : ' bad'}`}>{on.length ? `หาร ${on.length} · คนละ ${baht(each)}` : 'ยังไม่ได้เลือกคน'}</span>
                </div>
              </li>
            );
          }}</SortList>
        </ul>
        <div className="bl-addrow">
          <input aria-label="ชื่อรายการใหม่" placeholder="ชื่อรายการ" value={nm} onChange={(e) => setNm(e.target.value)} />
          <MoneyInput aria-label="ราคา" className="num" placeholder="ราคา" value={pr} onChange={(e) => setPr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRow()} />
          <button aria-label="เพิ่มรายการ" onClick={addRow}><Icon name="plus" size={20} stroke={2.4} /></button>
        </div>
        <span className="bl-hint sm">รายการใหม่หารทุกคนในบิลเป็นค่าเริ่มต้น</span>
      </section>

      <section aria-label="หมายเหตุ" className="bl-box">
        <div className="bl-bh"><label htmlFor="bnote"><h2>หมายเหตุ</h2></label><span>แสดงในใบสรุปบิล</span></div>
        <textarea id="bnote" rows={2} className="bl-note" placeholder="เช่น โอนพร้อมเพย์ได้เลย ภายในสิ้นเดือน" value={d.note} onChange={(e) => set({ note: e.target.value })} />
      </section>

      <section aria-label="ยอดของแต่ละคน" className="bl-box bl-shares">
        <div className="bl-bh"><h2>ยอดของแต่ละคน</h2>{sum.outstanding > 0 ? <span className="owe num">ค้างรับ <b>{baht(sum.outstanding)}</b></span> : total > 0 && sum.people.length > 0 ? <span className="owe done">รับครบแล้ว</span> : null}</div>
        <div className="me"><Avatar person={person(ME_ID)} size={34} />
          <span className="tx"><span className="n">ฉัน <span className="num c">· {valid.filter((r) => r.peopleIds.includes(ME_ID)).length} รายการ</span></span><span className="s">นับเป็นรายจ่ายในบันทึก</span></span>
          <b className="num">{baht(sum.myShare)}</b></div>
        {sum.people.map((x) => {
          const p = person(x.personId)!;
          const hist = pays.filter((y) => y.personId === x.personId).sort((a, b) => a.date.localeCompare(b.date));
          return (
            <div key={x.personId} className={`pr ${x.status}`}>
              <Avatar person={p} size={34} />
              <span className="tx"><span className="n">{p.name} <span className="num c">· {valid.filter((r) => r.peopleIds.includes(p.id)).length} รายการ</span></span>
                <span className="s"><StatusPill s={x.status} small />{x.paid > 0 && x.owed > 0 && <span className="num"> ค้าง {baht(x.owed)}</span>}</span></span>
              <b className="num">{baht(x.share)}</b>
              {hist.length > 0 && <PayHistory list={hist} />}
              {x.owed > 0 && (bill && !dirty
                ? <button className="paybtn" onClick={() => setPay(p.id)}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 2" /><path d="M4.8 8.2l2.2 2.2 4.2-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>บันทึกว่าชำระ</button>
                : <span className="paybtn off">บันทึกบิลก่อน แล้วค่อยบันทึกว่าชำระ</span>)}
            </div>
          );
        })}
        {sum.people.length === 0 && <span className="bl-hint">เพิ่มคนเข้าบิลเพื่อหาร · <span className="nw">ถ้ามีแค่ฉัน</span> <span className="nw">ยอดทั้งหมดเป็นรายจ่ายของฉัน</span></span>}
      </section>

      {err && <div className="lg-info bad" role="alert"><Icon name="alert" size={15} stroke={2} /><span>{err}</span></div>}
      <div className="bl-acts">
        {bill && !isNew ? <Link to={`/log/bill-summary?b=${bill.id}`} className="out"><BillIcon size={18} />สรุปบิลนี้</Link> : null}
        <button className="pri" onClick={save}>บันทึก</button>
      </div>
      {!isNew && (ask !== 'delete' ? <button className="lg-del" onClick={() => setAsk('delete')}>ลบบิลนี้</button> : (
        <div className="lg-delbox" role="alertdialog" aria-label="ยืนยันลบบิล">
          <span className="t">ลบบิล "{d.title}" ?</span>
          <span className="b">รายการทั้งหมด ประวัติรับเงิน <span className="nw">และรายจ่ายของบิลนี้ในบันทึก</span>จะหายไป <span className="nw">ย้อนกลับไม่ได้</span></span>
          <div className="lg-2"><button className="no" onClick={() => setAsk(null)}>ยกเลิก</button>
            <button className="yes" onClick={async () => { await deleteBill(db, id); nav('/log?tab=bill', { replace: true }); }}>ลบบิล</button></div>
        </div>
      ))}

      {sheet === 'people' && <PeoplePick people={data.people} selected={d.peopleIds} onToggle={togglePerson} onClose={() => setSheet(null)} />}
      {sheet === 'cat' && cats && <CatPick cats={cats} value={d.categoryId} onPick={(c) => { set({ categoryId: c }); setSheet(null); }} onClose={() => setSheet(null)} />}
      {pay && bill && <PaySheet bill={bill} person={person(pay)!} share={sum.people.find((x) => x.personId === pay)!} onClose={() => setPay(null)} />}
    </main>
  );
}

const PERSON_BG = (p: Person) => PERSON_COLORS[p.colorIndex] ?? PERSON_COLORS[0];
const initialOf = (p: Person) => initial(p.name);

function PayHistory({ list }: { list: Payment[] }) {
  const [ask, setAsk] = useState<string | null>(null);
  return (
    <ul className="hist" aria-label="ประวัติรับเงิน">
      {list.map((p) => (
        <li key={p.id}>
          <span className="num">รับ {baht(p.amount)} · {thaiDate(p.date).split(' ').slice(0, 2).join(' ')}</span>
          {ask === p.id
            ? <span className="cf"><button onClick={() => setAsk(null)}>ไม่ลบ</button><button className="yes" onClick={() => deletePayment(db, p.id)}>ลบครั้งนี้</button></span>
            : <button aria-label={`ลบการรับเงิน ${baht(p.amount)}`} onClick={() => setAsk(p.id)}><Icon name="close" size={14} stroke={2.2} /></button>}
        </li>
      ))}
    </ul>
  );
}

function PeoplePick({ people, selected, onToggle, onClose }: { people: Person[]; selected: string[]; onToggle: (id: string) => void; onClose: () => void }) {
  const others = people.filter((p) => p.id !== ME_ID);
  return (
    <LgSheet label="เลือกคนในบิล" onClose={onClose}>
      <div className="lg-sh-h"><span className="t"><h2>คนในบิล</h2><span>ติ๊กคนที่หารบิลนี้ · เพิ่มคนแล้วจะหาร<span className="nw">ทุกรายการ</span></span></span>
        <button className="lg-x" aria-label="ปิด" onClick={onClose}><Icon name="close" size={18} stroke={2.2} /></button></div>
      <div className="list">
        {others.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button key={p.id} className="row" role="checkbox" aria-checked={on} onClick={() => onToggle(p.id)}>
              <Avatar person={p} size={32} /><span className="tx"><span className="t1">{p.name}</span>{p.note && <span className="t2">{p.note}</span>}</span>
              <span className={`cbox${on ? ' on' : ''}`} aria-hidden="true">{on && <Icon name="checkSq" size={14} stroke={3} />}</span>
            </button>
          );
        })}
        {others.length === 0 && <div className="row muted"><span className="tx"><span className="t2">ยังไม่มีรายชื่อ · เพิ่มคนที่หน้า "จัดการคน"</span></span></div>}
      </div>
      <Link to="/log/people" className="btn btn-ghost" style={{ textDecoration: 'none' }}>เพิ่ม/จัดการคน</Link>
      <button className="btn btn-pri" onClick={onClose}>เสร็จ</button>
    </LgSheet>
  );
}

function CatPick({ cats, value, onPick, onClose }: { cats: LogCategory[]; value: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <LgSheet label="หมวดในบันทึก" onClose={onClose}>
      <div className="lg-sh-h"><span className="t"><h2>ลงบันทึกในหมวด</h2><span>ส่วนของฉันในบิลนี้<span className="nw">นับเป็นรายจ่ายหมวดนี้</span></span></span>
        <button className="lg-x" aria-label="ปิด" onClick={onClose}><Icon name="close" size={18} stroke={2.2} /></button></div>
      <div className="list" role="radiogroup" aria-label="หมวด">
        {cats.filter((c) => !c.hidden || c.id === value).map((c) => (
          <button key={c.id} className="row" role="radio" aria-checked={c.id === value} onClick={() => onPick(c.id)}>
            <span className="cat-ic" style={catStyle(c)}><CatIcon icon={c.icon} size={18} /></span><span className="tx"><span className="t1">{c.name}</span></span>
            <span className={`radio-dot${c.id === value ? ' on' : ''}`} aria-hidden="true" />
          </button>
        ))}
      </div>
    </LgSheet>
  );
}
