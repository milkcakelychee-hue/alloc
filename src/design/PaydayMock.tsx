// ต้นแบบหน้าจอ "กฎวันเงินเดือนเข้า" ให้เจ้าของดูก่อนทำจริง (ไม่ขึ้นเว็บ) · ข้อมูลสมมติ
// เปิดที่ #/design/payday?f=setup | soon | confirm | history | month
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { expectedPayDate, type PayRule, type WeekendShift } from '../calc/payday';
import { addMonths, thaiDate, thaiMonth } from '../calc/dates';
import { weekday } from '../calc/payday';

const WD = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const dateW = (d: string) => `${WD[weekday(d)]} ${thaiDate(d)}`;
const dayOf = (d: string) => Number(d.slice(8));

function Phone({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="page" style={{ paddingBottom: 40 }}>
      <div className="note warn"><span>ต้นแบบ · {title} · ข้อมูลสมมติ</span></div>
      {children}
    </main>
  );
}

function Setup() {
  const [kind, setKind] = useState<PayRule['kind']>('day');
  const [day, setDay] = useState(27);
  const [shift, setShift] = useState<WeekendShift>('before');
  const rule: PayRule = kind === 'day' ? { kind, day } : { kind };
  const months = Array.from({ length: 4 }, (_, i) => addMonths('2026-11', i));
  return (
    <Phone title="ตั้งเงินเดือน (เริ่มใหม่ และ ตั้งค่า)">
      <div className="step-head"><span className="icon-btn"><Icon name="back" size={20} stroke={2} /></span><h1>ตั้งเงินเดือน</h1></div>
      <label className="field"><span className="label">เงินเดือนต่อเดือน (บาท)</span><input className="num" defaultValue="31,000.00" readOnly />
        <span className="hint">ใส่ยอดเงินสุทธิ<span className="nw">ที่เข้าบัญชี</span> ไม่รวม<span className="nw">ประกันสังคม</span> PVD ภาษี และ<span className="nw">รายการหักอื่น ๆ</span></span></label>

      <div className="field"><span className="label" id="pay-kind">เงินเดือนเข้า</span>
        <div className="list" role="radiogroup" aria-labelledby="pay-kind">
          {([['day', 'ทุกวันที่เดิม', 'เช่น ทุกวันที่ 25 หรือ 27'], ['endOfMonth', 'สิ้นเดือน', 'วันสุดท้ายของเดือน 28–31'],
            ['lastBusinessDay', 'วันทำการสุดท้ายของเดือน', 'วันจันทร์–ศุกร์วันสุดท้าย']] as const).map(([v, l, d]) => (
            <button key={v} className="row" role="radio" aria-checked={kind === v} onClick={() => setKind(v)}>
              <span className={`radio-dot${kind === v ? ' on' : ''}`} aria-hidden="true" />
              <span className="tx"><span className="t1">{l}</span><span className="t2">{d}</span></span>
            </button>
          ))}
        </div>
      </div>
      {kind === 'day' && (
        <label className="field"><span className="label">วันที่</span>
          <select className="num" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {day > 28 && <span className="hint">เดือนที่มีไม่ถึง {day} วัน ใช้วันสุดท้ายของเดือน</span>}
        </label>
      )}
      {kind !== 'lastBusinessDay' && (
        <div className="field"><span className="label">ถ้าตรงเสาร์อาทิตย์ เงินจะเข้า</span>
          <div className="radio3" role="radiogroup">
            {([['before', 'ก่อนวันหยุด'], ['after', 'หลังวันหยุด'], ['none', 'ไม่เลื่อน']] as const).map(([v, l]) => (
              <button key={v} role="radio" aria-checked={shift === v} onClick={() => setShift(v)}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '12px 16px' }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>เงินเข้า 4 เดือนถัดไป</div>
        {months.map((m) => {
          const e = expectedPayDate(rule, shift, m);
          return (
            <div key={m} className="pay-row">
              <span className="num">{dateW(e.date)}</span>
              {e.reason === 'weekend' && <span className="tag warn">เลื่อนจาก {WD[weekday(e.nominal)]} {dayOf(e.nominal)}</span>}
            </div>
          );
        })}
      </div>
      <div className="note"><Icon name="info" size={16} stroke={2} />
        <span>รอบงบยึดวันที่ตั้งไว้เสมอ เงินที่เข้าก่อนหรือหลังกำหนดยังเป็น<span className="nw">รายรับของเดือนนั้น</span> กราฟรายเดือนจึงไม่เพี้ยน · วันหยุดนักขัตฤกษ์แก้เป็นรายเดือนได้</span></div>
    </Phone>
  );
}

function Soon() {
  return (
    <Phone title="ปฏิทิน/หน้าหลัก ก่อนเงินเข้า">
      <div className="page-head"><h1>บันทึก</h1></div>
      <div className="pay-card">
        <span className="ic"><Icon name="wallet" size={20} stroke={2} /></span>
        <span className="tx"><span className="t1">คาดว่าเงินเดือนเข้า <span className="num nw">ศ. 25 ธ.ค.</span></span>
          <span className="t2">ปกติวันที่ <span className="num">27</span> แต่<span className="nw">ตรงวันอาทิตย์</span> · <span className="nw">อีก 2 วัน</span></span></span>
      </div>
      <div className="muted" style={{ fontSize: 13, padding: '6px 2px 0' }}>ตัวอย่างกรณีเงินเข้าช้า (ตั้งไว้ "หลังวันหยุด")</div>
      <div className="pay-card late">
        <span className="ic"><Icon name="wallet" size={20} stroke={2} /></span>
        <span className="tx"><span className="t1">คาดว่าเงินเดือนเข้า <span className="num nw">จ. 28 ธ.ค.</span></span>
          <span className="t2">ปกติวันที่ <span className="num">27</span> แต่<span className="nw">ตรงวันอาทิตย์</span></span></span>
      </div>
      <div className="row alert" style={{ borderRadius: 18 }}>
        <span className="ic"><Icon name="alert" size={18} stroke={2} /></span>
        <span className="tx"><span className="t1">ค่าสมาชิกตัดบัตร <span className="num nw">อา. 27 ธ.ค.</span></span>
          <span className="t2">ครบกำหนด<span className="nw">ก่อนเงินเดือนเข้า 1 วัน</span> · <span className="num">299.00</span></span></span>
      </div>
    </Phone>
  );
}

function Confirm() {
  const [mode, setMode] = useState<'ask' | 'diff'>('ask');
  return (
    <Phone title="ยืนยันเงินเข้า (หน้าหลัก → ต้องทำ)">
      <div className="page-head"><span className="sub num">วันศุกร์ที่ 25 ธันวาคม 2569</span><h1>ภาพรวมการเงิน</h1></div>
      <div className="confirm-card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="ic"><Icon name="wallet" size={20} stroke={2} /></span>
          <span className="tx"><span className="t1">เงินเดือนเข้าแล้วหรือยัง</span>
            <span className="t2">คาดว่าเข้าวันนี้ · ตามแผน <span className="num">31,000.00</span></span></span>
        </div>
        {mode === 'ask' ? (
          <div className="confirm-actions">
            <button className="btn btn-pri">เข้าแล้ว ยอดเท่าเดิม</button>
            <button className="btn btn-ghost" onClick={() => setMode('diff')}>เข้าแล้ว ยอดไม่เท่าเดิม</button>
            <button className="btn btn-ghost">ยังไม่เข้า เตือนพรุ่งนี้</button>
          </div>
        ) : (
          <div className="confirm-actions">
            <label className="field"><span className="label">ยอดที่เข้าจริง (บาท)</span><input className="num" defaultValue="30,450.00" readOnly /></label>
            <div className="note warn"><span>น้อยกว่าแผน <b className="num">550.00</b> · ถ้าใช้ยอดนี้ <span className="nw">เงินเหลือเดือนนี้</span>จะเหลือ <b className="num">599.25</b> จาก <span className="num">1,149.25</span></span></div>
            <button className="btn btn-pri">ใช้ยอดนี้ในแผนเดือนนี้</button>
            <button className="btn btn-ghost">บันทึกยอดจริง ไม่แก้แผน</button>
          </div>
        )}
      </div>
      <div className="note"><Icon name="info" size={16} stroke={2} />
        <span>iPhone ส่งแจ้งเตือนจากเว็บแอปได้<span className="nw">เฉพาะเมื่อมีเซิร์ฟเวอร์</span> Alloc <span className="nw">ไม่มีเซิร์ฟเวอร์</span> จึงถามในแอป<span className="nw">ตอนเปิดแอป</span>แทน</span></div>
    </Phone>
  );
}

function History() {
  // ประวัติสมมติ 6 รอบ: วันที่เข้าจริงคำนวณจากกฎ ทุกวันที่ 27 เลื่อนก่อนวันหยุด
  const rows = Array.from({ length: 6 }, (_, i) => {
    const e = expectedPayDate({ kind: 'day', day: 27 }, 'before', addMonths('2026-07', i));
    const early = e.date < e.nominal ? `ก่อน ${dayOf(e.nominal) - dayOf(e.date)} วัน` : null;
    return { d: e.date, amt: i === 4 ? '30,450.00' : '31,000.00', tag: early, diff: i === 4 };
  });
  const earlyCount = rows.filter((r) => r.tag).length;
  return (
    <Phone title="ตั้งค่า → วันเงินเดือนเข้า">
      <div className="step-head"><span className="icon-btn"><Icon name="back" size={20} stroke={2} /></span><h1>วันเงินเดือนเข้า</h1></div>
      <div className="list">
        <div className="row"><span className="ic"><Icon name="calendar" size={18} stroke={2} /></span>
          <span className="tx"><span className="t1">ทุกวันที่ <span className="num">27</span></span><span className="t2">ตรงเสาร์อาทิตย์ เงินเข้าก่อนวันหยุด</span></span>
          <span style={{ color: 'var(--ink3)', display: 'flex' }}><Icon name="chevron" size={16} stroke={2} /></span></div>
      </div>
      <span className="sec">6 เดือนที่ผ่านมา เงินเข้าวันที่</span>
      <div className="day-strip">
        {rows.map((r) => <span key={r.d} className={r.tag ? 'early' : ''}><b className="num">{dayOf(r.d)}</b><small>{thaiMonth(r.d.slice(0, 7)).split(' ')[0]}</small></span>)}
      </div>
      <div className="list">
        {rows.slice().reverse().map((r) => (
          <div key={r.d} className="row">
            <span className="tx"><span className="t1 num">{dateW(r.d)}</span>
              {(r.tag || r.diff) && <span className="t2">{[r.tag && `เข้า${r.tag} · ตรงวันหยุด`, r.diff && 'ยอดไม่เท่าแผน'].filter(Boolean).join(' · ')}</span>}</span>
            <span className="val num">{r.amt}</span>
          </div>
        ))}
      </div>
      <div className="note"><Icon name="info" size={16} stroke={2} />
        <span>เงินเข้าก่อนกำหนด <span className="num">{earlyCount}</span> ครั้ง <span className="nw">ทุกครั้งตรงวันหยุด</span> <span className="nw">กฎตอนนี้ตรงแล้ว</span></span></div>
    </Phone>
  );
}

function MonthOverride() {
  return (
    <Phone title="แผนเดือน → แก้วันที่เงินเข้าเดือนนี้">
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ fontSize: 17 }}>แผน <span className="num">พ.ค. 70</span></h2>
          <span className="muted num" style={{ fontSize: 12.5 }}>27 เม.ย. – 26 พ.ค.</span>
        </div>
        <button className="pay-edit"><Icon name="wallet" size={16} stroke={2} /><span>เงินเข้า <span className="num">อ. 27 เม.ย.</span></span><Icon name="edit" size={14} stroke={2} /></button>
      </div>
      <div className="sheet" style={{ animation: 'none', borderRadius: 28, marginTop: 8 }}>
        <div className="grab" />
        <h2>แก้วันที่เงินเข้าเดือนนี้</h2>
        <label className="field"><span className="label">รอบ พ.ค. 70 เงินเข้าวันที่</span><input className="num" defaultValue="10 เม.ย. 70" readOnly /></label>
        <div className="note" style={{ margin: '10px 0 14px' }}><Icon name="info" size={16} stroke={2} />
          <span><span className="nw">ใช้กับเดือนนี้เท่านั้น</span> เช่น <span className="nw">บริษัทจ่ายก่อนสงกรานต์</span> · <span className="nw">กฎหลักยังเป็นทุกวันที่ <span className="num">27</span></span> · <span className="nw">รอบงบไม่เปลี่ยน</span></span></div>
        <button className="btn btn-pri" style={{ width: '100%' }}>บันทึก</button>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }}>กลับไปใช้ตามกฎ</button>
      </div>
    </Phone>
  );
}

export default function PaydayMock() {
  const f = useSearchParams()[0].get('f') ?? 'setup';
  return ({ setup: <Setup />, soon: <Soon />, confirm: <Confirm />, history: <History />, month: <MonthOverride /> } as Record<string, JSX.Element>)[f] ?? <Setup />;
}
