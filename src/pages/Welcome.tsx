// เริ่มใช้งาน: กู้จากไฟล์สำรอง / เริ่มใหม่ (ตั้งเงินเดือน) → พร้อมใช้
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { startFresh } from '../db/onboarding';
import { cycleOf, cycleRange, localToday, thaiDate, thaiMonth } from '../calc/dates';
import { parseBaht } from '../calc/money';
import { AppMark } from '../components/AppMark';
import { Icon } from '../components/Icon';
import { RestorePicker, type RestorePickerHandle } from '../components/RestorePicker';

type Step = 'start' | 'salary' | 'done';
const PAYDAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export default function Welcome() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('start');
  const [restored, setRestored] = useState(false);
  const [salaryText, setSalaryText] = useState('');
  const [payday, setPayday] = useState(27);
  const [busy, setBusy] = useState(false);
  const picker = useRef<RestorePickerHandle>(null);

  const today = localToday();
  const salary = parseBaht(salaryText);
  const invalid = salaryText.trim() !== '' && (salary === null || salary <= 0);
  const cycle = cycleOf(today, payday);
  const range = cycleRange(cycle, payday);

  const save = async (withSalary: boolean) => {
    setBusy(true);
    try { await startFresh(db, { salary: withSalary ? salary : null, payday, today }); setStep('done'); }
    finally { setBusy(false); }
  };

  if (step === 'salary') {
    return (
      <main className="page welcome">
        <div className="step-head">
          <button className="icon-btn" aria-label="ย้อนกลับ" onClick={() => setStep('start')}><Icon name="back" size={20} stroke={2} /></button>
          <span><span className="muted" style={{ fontSize: 12 }}>เริ่มใหม่</span><h1>ตั้งเงินเดือน</h1></span>
        </div>

        <label className="field">
          <span className="label">เงินเดือนต่อเดือน (บาท)</span>
          <input className="num" inputMode="decimal" autoComplete="off" placeholder="0.00" value={salaryText}
            onChange={(e) => setSalaryText(e.target.value)} aria-invalid={invalid} />
          {invalid && <span className="err">ใส่ตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง</span>}
        </label>

        <label className="field">
          <span className="label">เงินเดือนเข้าทุกวันที่</span>
          <select className="num" value={payday} onChange={(e) => setPayday(Number(e.target.value))}>
            {PAYDAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>

        <div className="note">
          <Icon name="info" size={16} stroke={2} />
          <span>
            เดือนในแอปนับตามรอบเงินเดือน ตอนนี้อยู่รอบ <b className="num">{thaiMonth(cycle)}</b>{' '}
            (<span className="num">{thaiDate(range.start)} – {thaiDate(range.end)}</span>) · เงินเดือนนับตั้งแต่รอบนี้
          </span>
        </div>

        <div className="actions">
          <button className="btn btn-pri" disabled={busy || invalid || salary === null || salary <= 0} onClick={() => save(true)}>บันทึกและเริ่มใช้</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => save(false)}>ข้ามไปก่อน ใส่ทีหลังในแผน</button>
        </div>
      </main>
    );
  }

  if (step === 'done') {
    return (
      <main className="page welcome done">
        <span className="done-mark"><Icon name="check" size={38} stroke={2.2} /></span>
        <h1>{restored ? 'กู้คืนเรียบร้อย' : 'พร้อมใช้แล้ว'}</h1>
        <span className="muted">{restored ? 'ข้อมูลจากไฟล์สำรองกลับมาครบแล้ว' : 'เริ่มวางแผนให้ทุกบาทมีหน้าที่ได้เลย'}</span>
        <ol className="tips">
          {!restored && <li>วางแผนรายจ่ายที่หน้าหลัก → วางแผนรายจ่าย</li>}
          <li>เพิ่มแอปไว้ที่หน้าจอโฮม (แชร์ → เพิ่มไปยังหน้าจอโฮม)</li>
          <li>สำรองข้อมูลจากหน้าตั้งค่าเป็นประจำ เพราะข้อมูลอยู่ในเครื่องนี้เท่านั้น</li>
        </ol>
        <button className="btn btn-pri" style={{ marginTop: 'auto', width: '100%' }} onClick={() => nav('/', { replace: true })}>ไปหน้าหลัก</button>
      </main>
    );
  }

  return (
    <main className="page welcome">
      <div className="hello">
        <AppMark size={76} />
        <h1>Alloc</h1>
        <span>เงินเดือนเข้าแล้ว แบ่งให้ทุกบาทมีหน้าที่<br />วางแผน · จด · หารบิล ในแอปเดียว</span>
      </div>
      <span className="sec">เริ่มต้นแบบไหนดี</span>
      <button className="option" onClick={() => picker.current?.pick()}>
        <span className="ic"><Icon name="restore" /></span>
        <span className="tx"><span className="t1">กู้จากไฟล์สำรอง</span><span className="t2">ไฟล์ .alloc ที่สำรองไว้จากเครื่องเดิม</span></span>
        <Icon name="chevron" size={18} stroke={2} />
      </button>
      <button className="option" onClick={() => setStep('salary')}>
        <span className="ic"><Icon name="plus" /></span>
        <span className="tx"><span className="t1">เริ่มใหม่</span><span className="t2">ตั้งเงินเดือนก่อน แล้วค่อยวางแผนทีละหมวด</span></span>
        <Icon name="chevron" size={18} stroke={2} />
      </button>
      <div className="note" style={{ marginTop: 'auto' }}>
        <Icon name="lock" size={16} stroke={2} />
        <span>ข้อมูลทั้งหมดเก็บในเครื่องคุณเท่านั้น ไม่มีบัญชีผู้ใช้ ไม่ส่งขึ้นเซิร์ฟเวอร์ · สำรองเองได้จากหน้าตั้งค่า</span>
      </div>
      <RestorePicker ref={picker} onRestored={() => { setRestored(true); setStep('done'); }} />
    </main>
  );
}
