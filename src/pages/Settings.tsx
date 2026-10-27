import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import { APP_VERSION, CHANGELOG } from '../lib/version';
import { db } from '../db/db';
import { exportBackup } from '../db/backup';
import { useSettings } from '../db/hooks';
import { backupStatus } from '../calc/reminders';
import { addMonths, cycleOf, cycleRange, localToday, thaiDate, thaiMonth } from '../calc/dates';
import type { Settings as SettingsT } from '../db/types';
import { RestorePicker, type RestorePickerHandle } from '../components/RestorePicker';
import { PayRuleSheet } from '../components/PayRuleSheet';
import { payRuleLabel } from '../components/PayRuleFields';

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'สว่าง' },
  { value: 'dark', label: 'มืด' },
  { value: 'system', label: 'ตามเครื่อง' }
];

export default function Settings() {
  const [theme, setTheme] = useState(getThemePref());
  const [news, setNews] = useState(false);
  const pick = (t: ThemePref) => { setTheme(t); setThemePref(t); };
  const settings = useSettings();
  const picker = useRef<RestorePickerHandle>(null);
  const [toast, setToast] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [recvOpen, setRecvOpen] = useState(false);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const bs = backupStatus(settings?.lastBackupAt);
  const lastText = bs.never || !settings?.lastBackupAt
    ? 'ยังไม่เคยสำรอง'
    : `ล่าสุด ${thaiDate(localToday(new Date(settings.lastBackupAt)))} · ${bs.days === 0 ? 'วันนี้' : `${bs.days} วันที่แล้ว`}`;
  const backup = async () => {
    const r = await exportBackup(db);
    if (r !== 'cancelled') flash('สำรองข้อมูลแล้ว');
  };

  return (
    <main className="page">
      <div className="page-head"><h1>ตั้งค่า</h1></div>

      <span className="sec">เกี่ยวกับ</span>
      <div className="list">
        <button className="row" onClick={() => setNews(true)}>
          <span className="ic"><Icon name="info" size={18} stroke={2} /></span>
          <span className="tx"><span className="t1">มีอะไรใหม่</span></span>
          <span className="val num">{APP_VERSION}</span>
          <span style={{ color: 'var(--ink3)', display: 'flex' }}><Icon name="chevron" size={16} stroke={2} /></span>
        </button>
        {/* ชั่วคราวช่วงสร้างแอป: ให้เจ้าของดูหน้าเริ่มใช้งานได้ · เอาออกเมื่อแอปจริงเสร็จ */}
        <Link className="row" to="/welcome?preview=1">
          <span className="ic"><Icon name="plus" size={18} stroke={2} /></span>
          <span className="tx"><span className="t1">ดูหน้าเริ่มใช้งาน</span><span className="t2">ตัวอย่าง <span className="nw">ไม่บันทึกข้อมูล</span> · <span className="nw">มีเฉพาะช่วงสร้างแอป</span></span></span>
          <span style={{ color: 'var(--ink3)', display: 'flex' }}><Icon name="chevron" size={16} stroke={2} /></span>
        </Link>
      </div>

      <span className="sec">เงินเดือน</span>
      <div className="list">
        <button className="row" onClick={() => setPayOpen(true)} disabled={!settings}>
          <span className="ic"><Icon name="calendar" size={18} stroke={2} /></span>
          <span className="tx">
            <span className="t1">วันเงินเดือนเข้า</span>
            <span className="t2">{settings ? payRuleLabel(settings.pay, settings.weekendShift).sub : ''}</span>
          </span>
          <span className="val num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{settings ? payRuleLabel(settings.pay, settings.weekendShift).main : ''}</span>
          <span style={{ color: 'var(--ink3)', display: 'flex' }}><Icon name="chevron" size={16} stroke={2} /></span>
        </button>
        <button className="row" onClick={() => setStartOpen(true)} disabled={!settings}>
          <span className="ic"><Icon name="flag" size={18} stroke={2} /></span>
          <span className="tx">
            <span className="t1">เริ่มใช้แอปตั้งแต่รอบ</span>
            <span className="t2">แผนและบันทึกเริ่มที่รอบนี้</span>
          </span>
          <span className="val num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{settings?.startCycle ? thaiMonth(settings.startCycle) : 'ไม่จำกัด'}</span>
          <span style={{ color: 'var(--ink3)', display: 'flex' }}><Icon name="chevron" size={16} stroke={2} /></span>
        </button>
      </div>
      {payOpen && settings && <PayRuleSheet settings={settings} onClose={() => setPayOpen(false)} />}
      {startOpen && settings && <StartCycleSheet settings={settings} onClose={() => setStartOpen(false)} />}

      <span className="sec">บิลแชร์</span>
      <div className="list">
        <button className="row" onClick={() => setRecvOpen(true)} disabled={!settings}>
          <span className="ic"><Icon name="wallet" size={18} stroke={2} /></span>
          <span className="tx">
            <span className="t1">ช่องทางรับเงิน</span>
            <span className="t2">{settings?.receiveInfo.trim() || 'แสดงท้ายใบสรุปบิล ยังไม่ได้ตั้ง'}</span>
          </span>
          <span style={{ color: 'var(--ink3)', display: 'flex' }}><Icon name="chevron" size={16} stroke={2} /></span>
        </button>
      </div>
      {recvOpen && settings && <ReceiveSheet settings={settings} onClose={() => setRecvOpen(false)} />}

      <span className="sec">การแสดงผล</span>
      <div className="list">
        <div className="block">
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="ic36"><Icon name="theme" size={18} stroke={2} /></span>
            <span id="st-theme" style={{ fontSize: 15, fontWeight: 500 }}>ธีม</span>
          </span>
          <div className="radio3" role="radiogroup" aria-labelledby="st-theme">
            {THEMES.map((t) => (
              <button key={t.value} role="radio" aria-checked={theme === t.value} onClick={() => pick(t.value)}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <span className="sec">ข้อมูล</span>
      <div className="list">
        <div className={`row${bs.due ? ' alert' : ''}`} style={{ paddingTop: 12, paddingBottom: 12 }}>
          <span className="ic"><Icon name="backup" size={18} stroke={2} /></span>
          <span className="tx"><span className="t1">สำรองข้อมูล</span><span className="t2 num">{lastText}</span></span>
          <button className="pill-btn" onClick={backup}>สำรองตอนนี้</button>
        </div>
        <button className="row" onClick={() => picker.current?.pick()}>
          <span className="ic"><Icon name="upload" size={18} stroke={2} /></span>
          <span className="tx"><span className="t1">กู้คืนจากไฟล์สำรอง</span><span className="t2">แทนที่ข้อมูลทั้งหมดในเครื่องนี้</span></span>
          <span style={{ color: 'var(--ink3)', display: 'flex' }}><Icon name="chevron" size={16} stroke={2} /></span>
        </button>
      </div>
      <div className="note">
        <Icon name="info" size={16} stroke={2} />
        <span>ข้อมูลอยู่ใน<span className="nw">เครื่องนี้</span>เท่านั้น iPhone อาจล้าง<span className="nw">ข้อมูลเว็บ</span>เองถ้าไม่ได้เปิดแอปนาน ๆ ควรสำรองเก็บไว้ใน<span className="nw">แอปไฟล์</span>หรือ <span className="nw">iCloud Drive</span></span>
      </div>
      <RestorePicker ref={picker} onRestored={() => { setTheme(getThemePref()); flash('กู้คืนเรียบร้อย'); }} />
      {toast && <div className="toast" role="status">{toast}</div>}

      <span className="muted" style={{ textAlign: 'center', fontSize: 12, paddingTop: 4 }}>
        Alloc <span className="num">{APP_VERSION}</span> · ข้อมูลเก็บในเครื่องนี้เท่านั้น
      </span>

      {news && (
        <Sheet title="มีอะไรใหม่" onClose={() => setNews(false)}>
          {CHANGELOG.length === 0 ? (
            <p className="muted" style={{ margin: '0 0 16px', lineHeight: 1.6 }}>
              ตอนนี้ Alloc ยังอยู่<span className="nw">ระหว่างสร้าง</span> รายการนี้จะเริ่มบอกเมื่อแอป<span className="nw">พร้อมใช้จริง</span> ว่าทำอะไรได้บ้าง และมีอะไรที่ปรับแก้หรือ<span className="nw">จะเพิ่มในอนาคต</span>
            </p>
          ) : CHANGELOG.map((c) => (
            <div key={c.version} className="card" style={{ marginBottom: 10 }}>
              <div className="num" style={{ fontWeight: 700, marginBottom: 6 }}>{c.version}</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink2)' }}>
                {c.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          ))}
          <button className="btn btn-pri" style={{ width: '100%' }} onClick={() => setNews(false)}>ปิด</button>
        </Sheet>
      )}
    </main>
  );
}

/** เลือกรอบที่เริ่มใช้แอป: รอบก่อนหน้าไม่แสดงในแผนและบันทึก (ข้อมูลไม่หาย) */
function StartCycleSheet({ settings, onClose }: { settings: SettingsT; onClose: () => void }) {
  const cur = cycleOf(localToday(), settings.pay);
  const opts = [addMonths(cur, -1), cur, addMonths(cur, 1)];
  const [v, setV] = useState<string | null>(settings.startCycle ?? null);
  return (
    <Sheet title="เริ่มใช้แอปตั้งแต่รอบ" onClose={onClose}>
      <div className="list" style={{ marginBottom: 12 }}>
        {opts.map((m) => {
          const r = cycleRange(m, settings.pay);
          return (
            <button key={m} className="row" role="radio" aria-checked={v === m} onClick={() => setV(m)}>
              <span className={`radio-dot${v === m ? ' on' : ''}`} aria-hidden="true" />
              <span className="tx"><span className="t1">{thaiMonth(m)}{m === cur ? ' · รอบนี้' : m > cur ? ' · รอบหน้า' : ''}</span>
                <span className="t2 num">{thaiDate(r.start)} – {thaiDate(r.end)}</span></span>
            </button>
          );
        })}
        <button className="row" role="radio" aria-checked={v === null} onClick={() => setV(null)}>
          <span className={`radio-dot${v === null ? ' on' : ''}`} aria-hidden="true" />
          <span className="tx"><span className="t1">ไม่จำกัด</span><span className="t2">ดูรอบก่อนหน้าได้ทั้งหมด</span></span>
        </button>
      </div>
      <div className="note" style={{ marginBottom: 12 }}><Icon name="info" size={16} stroke={2} />
        <span>รอบก่อนหน้าจะไม่แสดงในแผนและบันทึก · <span className="nw">ข้อมูลไม่หาย</span> · <span className="nw">บันทึกรายการได้เมื่อถึงวันแรกของรอบ</span></span></div>
      <button className="btn btn-pri" style={{ width: '100%' }} onClick={async () => { await db.settings.update('app', { startCycle: v, updatedAt: Date.now() }); onClose(); }}>บันทึก</button>
    </Sheet>
  );
}

function ReceiveSheet({ settings, onClose }: { settings: SettingsT; onClose: () => void }) {
  const [v, setV] = useState(settings.receiveInfo);
  return (
    <Sheet title="ช่องทางรับเงิน" onClose={onClose}>
      <label className="field" style={{ marginBottom: 12 }}><span className="label">ข้อความท้ายใบสรุปบิล</span>
        <textarea rows={2} value={v} maxLength={80} onChange={(e) => setV(e.target.value)} placeholder="เช่น พร้อมเพย์ของฉัน · ชื่อบัญชี ฉัน"
          style={{ resize: 'none', border: 0, borderRadius: 12, background: 'var(--card2)', padding: '10px 12px', font: 'inherit', fontSize: 16, color: 'var(--ink)' }} /></label>
      <div className="note" style={{ marginBottom: 12 }}><Icon name="alert" size={16} stroke={2} />
        <span>ข้อความนี้จะอยู่ในรูปและข้อความที่แชร์ · <span className="nw">ห้ามใส่เลขบัตร</span> <span className="nw">หรือรหัสใด ๆ</span></span></div>
      <button className="btn btn-pri" style={{ width: '100%' }} onClick={async () => { await db.settings.update('app', { receiveInfo: v.trim(), updatedAt: Date.now() }); onClose(); }}>บันทึก</button>
    </Sheet>
  );
}
