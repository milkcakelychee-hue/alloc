// เริ่มใช้งาน: เริ่มใหม่ (ตั้งเงินเดือน) / กู้จากไฟล์สำรอง → พร้อมใช้
// ?preview=1 = ดูตัวอย่างจากตั้งค่า ไม่บันทึกอะไร (ชั่วคราว ช่วงสร้างแอป เอาออกเมื่อแอปจริงเสร็จ)
import { useRef, useState } from 'react';
import { MoneyInput } from '../components/MoneyInput';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { startFresh } from '../db/onboarding';
import { cycleOf, cycleRange, localToday, thaiDate, thaiMonth, type PayRule } from '../calc/dates';
import type { WeekendShift } from '../calc/payday';
import { PayRuleFields } from '../components/PayRuleFields';
import { parseBaht } from '../calc/money';
import { AppMark } from '../components/AppMark';
import { AppGuide } from '../components/AppGuide';
import { Icon } from '../components/Icon';
import { RestorePicker, type RestorePickerHandle } from '../components/RestorePicker';

type Step = 'start' | 'salary' | 'done';

export default function Welcome() {
  const nav = useNavigate();
  const preview = useSearchParams()[0].get('preview') === '1';
  const exit = () => nav(preview ? '/settings' : '/', { replace: true });
  const [step, setStep] = useState<Step>('start');
  const [restored, setRestored] = useState(false);
  const [salaryText, setSalaryText] = useState('');
  const [pay, setPay] = useState<PayRule>({ kind: 'day', day: 27 });
  const [shift, setShift] = useState<WeekendShift>('before');
  const [busy, setBusy] = useState(false);
  const picker = useRef<RestorePickerHandle>(null);

  const today = localToday();
  const salary = parseBaht(salaryText);
  const invalid = salaryText.trim() !== '' && (salary === null || salary <= 0);
  const cycle = cycleOf(today, pay);
  const range = cycleRange(cycle, pay);

  const save = async (withSalary: boolean) => {
    setBusy(true);
    try {
      if (!preview) await startFresh(db, { salary: withSalary ? salary : null, pay, weekendShift: shift, today });
      setStep('done');
    }
    finally { setBusy(false); }
  };

  if (step === 'salary') {
    return (
      <main className="page welcome">
        {preview && <PreviewBar onClose={exit} />}
        <div className="step-head">
          <button className="icon-btn" aria-label="ย้อนกลับ" onClick={() => setStep('start')}><Icon name="back" size={20} stroke={2} /></button>
          <h1>ตั้งเงินเดือน</h1>
        </div>

        <label className="field">
          <span className="label">เงินเดือนต่อเดือน (บาท)</span>
          <MoneyInput className="num"  autoComplete="off" placeholder="0.00" value={salaryText}
            onChange={(e) => setSalaryText(e.target.value)} aria-invalid={invalid} />
          {invalid
            ? <span className="err">ใส่ตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง</span>
            : <span className="hint">ใส่ยอดเงินสุทธิ<span className="nw">ที่เข้าบัญชี</span> ไม่รวม<span className="nw">ประกันสังคม</span> PVD ภาษี และ<span className="nw">รายการหักอื่น ๆ</span></span>}
        </label>

        <PayRuleFields rule={pay} shift={shift} from={cycle} onChange={(r, s) => { setPay(r); setShift(s); }} />

        <div className="note">
          <Icon name="info" size={16} stroke={2} />
          <span>
            เดือนในแอปนับตาม<span className="nw">รอบเงินเดือน</span> ตอนนี้<span className="nw">อยู่รอบ <b className="num">{thaiMonth(cycle)}</b></span>{' '}
            (<span className="num nw">{thaiDate(range.start)} – {thaiDate(range.end)}</span>) · <span className="nw">เงินเดือนนับตั้งแต่รอบนี้</span> · รอบงบยึด<span className="nw">วันที่ตั้งไว้</span> เงินที่เข้าก่อนหรือหลังกำหนดยังเป็น<span className="nw">รายรับของเดือนนั้น</span>
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
        {preview && <PreviewBar onClose={exit} />}
        <div className="done-head">
          <span className="done-mark"><Icon name="check" size={30} stroke={2.4} /></span>
          <h1>{restored ? 'กู้คืนเรียบร้อย' : 'พร้อมใช้แล้ว'}</h1>
          <span className="muted">{restored
            ? <>ข้อมูลจากไฟล์สำรอง<span className="nw">กลับมาครบแล้ว</span></>
            : <>มาดูกันว่า Alloc <span className="nw">ช่วยอะไรได้บ้าง</span></>}</span>
        </div>
        <AppGuide restored={restored} />
        <div className="sticky-cta">
          <button className="btn btn-pri" style={{ width: '100%' }} onClick={exit}>ไปหน้าหลัก</button>
        </div>
      </main>
    );
  }

  return (
    <main className="page welcome">
      {preview && <PreviewBar onClose={exit} />}
      <div className="hello">
        <AppMark size={76} />
        <h1>Alloc</h1>
        <span>เงินเดือนเข้าแล้ว แบ่งให้<span className="nw">ทุกบาทมีหน้าที่</span><br />วางแผน · จด · หารบิล <span className="nw">ในแอปเดียว</span></span>
      </div>
      <span className="sec">เริ่มต้นแบบไหนดี</span>
      <button className="option" onClick={() => setStep('salary')}>
        <span className="ic"><Icon name="plus" /></span>
        <span className="tx"><span className="t1">เริ่มใหม่</span><span className="t2">ตั้งเงินเดือนก่อน แล้วค่อยวางแผน<span className="nw">ทีละหมวด</span></span></span>
        <Icon name="chevron" size={18} stroke={2} />
      </button>
      <button className="option" onClick={() => (preview ? (setRestored(true), setStep('done')) : picker.current?.pick())}>
        <span className="ic"><Icon name="restore" /></span>
        <span className="tx"><span className="t1">กู้จากไฟล์สำรอง</span><span className="t2">ไฟล์ .alloc ที่สำรองไว้<span className="nw">จากเครื่องเดิม</span></span></span>
        <Icon name="chevron" size={18} stroke={2} />
      </button>
      <div className="note" style={{ marginTop: 'auto' }}>
        <Icon name="lock" size={16} stroke={2} />
        <span>ข้อมูลทั้งหมดเก็บใน<span className="nw">เครื่องคุณ</span>เท่านั้น <span className="nw">ไม่มีบัญชีผู้ใช้</span> <span className="nw">ไม่ส่งขึ้นเซิร์ฟเวอร์</span> · สำรองเองได้จาก<span className="nw">หน้าตั้งค่า</span></span>
      </div>
      <RestorePicker ref={picker} onRestored={() => { setRestored(true); setStep('done'); }} />
    </main>
  );
}

function PreviewBar({ onClose }: { onClose: () => void }) {
  return (
    <div className="note warn" role="status" style={{ alignItems: 'center', width: '100%', textAlign: 'left' }}>
      <span style={{ flex: 1 }}>ดูตัวอย่าง<span className="nw">หน้าเริ่มใช้งาน</span> · <span className="nw">ไม่บันทึกข้อมูล</span></span>
      <button className="pill-btn" onClick={onClose}>ปิด</button>
    </div>
  );
}
