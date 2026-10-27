// บิลแชร์ · จัดการคน (บอร์ด People): รายชื่อใช้ซ้ำทุกบิล · แก้ชื่อ ไอคอน สี ข้อมูลช่วยจำ
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { ME_ID, type Person } from '../../db/types';
import { shareOf } from '../../calc/bills';
import { removePerson, savePerson, type PersonInput } from '../../db/billActions';
import { Icon } from '../../components/Icon';
import { baht } from '../goals/goalUi';
import { Avatar, PERSON_COLORS, PERSON_ICONS, initial, itemsOf, paymentsOf, useBillData } from './billUi';

type Draft = PersonInput & { id: string | null; key: string };

export function People() {
  const nav = useNavigate();
  const data = useBillData();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [sel, setSel] = useState<string>(ME_ID);
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!data || drafts) return;
    setDrafts(data.people.map((p) => ({ id: p.id, key: p.id, name: p.name, icon: p.icon, colorIndex: p.colorIndex, note: p.note })));
    setSel(data.people.find((p) => p.id !== ME_ID)?.id ?? ME_ID);
  }, [data, drafts]);
  if (!data || !drafts) return null;

  const e = drafts.find((x) => x.key === sel) ?? drafts[0];
  const set = (patch: Partial<Draft>) => setDrafts(drafts.map((x) => (x.key === e.key ? { ...x, ...patch } : x)));
  const billsOf = (id: string | null) => (id ? data.bills.filter((b) => b.peopleIds.includes(id)) : []);
  const owedOf = (id: string) => billsOf(id).reduce((a, b) => a + shareOf(itemsOf(data, b.id), paymentsOf(data, b.id), id).owed, 0);
  const addNew = () => {
    const k = crypto.randomUUID();
    const used = new Set(drafts.map((x) => x.colorIndex));
    const c = PERSON_COLORS.findIndex((_, i) => i > 0 && !used.has(i));
    setDrafts([...drafts, { id: null, key: k, name: '', icon: 'letter', colorIndex: c > 0 ? c : drafts.length % PERSON_COLORS.length, note: '' }]);
    setSel(k); setAsk(false);
  };
  const save = async () => {
    const bad = drafts.find((x) => !x.name.trim());
    if (bad) { setSel(bad.key); setErr('ใส่ชื่อที่แสดงในบิล'); return; }
    for (const x of drafts) {
      const orig = data.people.find((p) => p.id === x.id);
      if (!orig || orig.name !== x.name.trim() || orig.icon !== x.icon || orig.colorIndex !== x.colorIndex || orig.note !== x.note.trim()) await savePerson(db, x.id, x);
    }
    nav(-1);
  };
  const del = async () => {
    if (e.id) await removePerson(db, e.id);
    const rest = drafts.filter((x) => x.key !== e.key);
    setDrafts(rest); setSel(rest[0]?.key ?? ME_ID); setAsk(false);
  };
  const eb = billsOf(e.id).length;
  const asPerson = (x: Draft): Pick<Person, 'id' | 'name' | 'icon' | 'colorIndex'> => ({ id: x.id ?? x.key, name: x.name || 'คนใหม่', icon: x.icon, colorIndex: x.colorIndex });

  return (
    <main className="page lgp lgp-sub bl-people">
      <div className="lg-head">
        <button className="lg-sq" aria-label="กลับไปบิลแชร์" onClick={() => nav(-1)}><Icon name="back" size={20} stroke={2} /></button>
        <span className="bl-dh"><span className="s">บิลแชร์</span><h1>จัดการคน</h1></span>
        <button className="bl-pribtn" onClick={addNew}><Icon name="plus" size={18} stroke={2.4} />เพิ่มคน</button>
      </div>
      <div className="bl-tip"><Icon name="info" size={16} stroke={2} /><span>รายชื่อนี้ใช้ซ้ำได้ทุกบิล <span className="nw">ไม่ต้องมีบัญชีของอีกฝ่าย</span> · <span className="nw">เก็บไว้ในเครื่องคุณเท่านั้น</span></span></div>

      <section aria-label="รายชื่อ" className="bl-plist">
        {drafts.map((x) => {
          const n = billsOf(x.id).length;
          const o = x.id && x.id !== ME_ID ? owedOf(x.id) : 0;
          return (
            <button key={x.key} aria-pressed={sel === x.key} className={sel === x.key ? 'on' : ''} onClick={() => { setSel(x.key); setAsk(false); setErr(''); }}>
              <Avatar person={asPerson(x)} size={40} />
              <span className="tx"><span className="n">{x.name || 'คนใหม่'}{x.id === ME_ID && <span className="you"> · คุณ</span>}</span>
                <span className="s">{x.note ? `${x.note} · ` : ''}{n ? `${n} บิล` : 'ยังไม่อยู่ในบิล'}</span></span>
              {x.id !== ME_ID && <span className={`num r${o > 0 ? ' neg' : ''}`}>{!n ? 'ยังไม่มีบิล' : o > 0 ? `ค้าง ${baht(o)}` : 'ครบแล้ว'}</span>}
            </button>
          );
        })}
      </section>

      <section aria-label="แก้ไขคน" className="bl-box bl-pedit">
        <div className="who"><Avatar person={asPerson(e)} size={56} /><span className="tx"><span className="s">กำลังแก้</span><span className="n">{e.name || 'คนใหม่'}</span></span></div>
        <label className="bl-fld"><span>ชื่อที่แสดงในบิล</span>
          <input value={e.name} placeholder="เช่น ก้อย" aria-invalid={!!err && !e.name.trim()} onChange={(ev) => { set({ name: ev.target.value }); setErr(''); }} /></label>
        {err && <span className="bl-warn">{err}</span>}
        {e.id !== ME_ID && <>
          <div className="bl-fld"><span>ไอคอน</span>
            <div role="radiogroup" aria-label="เลือกไอคอน" className="icons">
              {PERSON_ICONS.map((ic) => (
                <button key={ic.id} role="radio" aria-label={ic.label} aria-checked={e.icon === ic.id} className={e.icon === ic.id ? 'on' : ''} onClick={() => set({ icon: ic.id })}>
                  {ic.d ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ic.d}</svg> : initial(e.name || 'ค')}
                </button>
              ))}
            </div>
          </div>
          <div className="bl-fld"><span>สีประจำตัว</span>
            <div role="radiogroup" aria-label="เลือกสี" className="colors">
              {PERSON_COLORS.map((c, i) => (
                <button key={c} role="radio" aria-label={`สี ${i + 1}`} aria-checked={e.colorIndex === i} className={e.colorIndex === i ? 'on' : ''} style={{ background: c }} onClick={() => set({ colorIndex: i })}>
                  {e.colorIndex === i && <Icon name="check" size={16} stroke={2.6} />}
                </button>
              ))}
            </div>
          </div>
        </>}
        <label className="bl-fld"><span>ข้อมูลช่วยจำ <span className="bl-opt">(ไม่บังคับ)</span></span>
          <input value={e.note} placeholder="เช่น เพื่อนร่วมห้อง · ห้อง 302" onChange={(ev) => set({ note: ev.target.value })} />
          <small>แสดงใต้ชื่อ ใช้แยกคนชื่อซ้ำกัน</small></label>
        {e.id !== ME_ID && (
          <div className="foot">
            <span>อยู่ใน <b className="num">{eb}</b> บิล</span>
            {!ask ? <button className="danger" onClick={() => setAsk(true)}>ลบคนนี้</button> : null}
          </div>
        )}
        {ask && (eb > 0
          ? <div className="lg-delbox" role="alert"><span className="t">ยังลบ "{e.name}" ไม่ได้</span><span className="b">อยู่ใน <span className="num">{eb}</span> บิล · <span className="nw">เอาออกจากบิลก่อน</span> <span className="nw">ยอดของคนอื่นจะได้ไม่เปลี่ยนเอง</span></span>
              <div className="lg-2"><button className="no" onClick={() => setAsk(false)}>เข้าใจแล้ว</button></div></div>
          : <div className="lg-delbox" role="alertdialog" aria-label="ยืนยันลบคน"><span className="t">ลบ "{e.name || 'คนใหม่'}" ?</span><span className="b">เอาออกจากรายชื่อ</span>
              <div className="lg-2"><button className="no" onClick={() => setAsk(false)}>ยกเลิก</button><button className="yes" onClick={del}>ลบ</button></div></div>)}
      </section>
      <button className="bl-save" onClick={save}>บันทึก</button>
    </main>
  );
}
