import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import { APP_VERSION, CHANGELOG } from '../lib/version';
import { db } from '../db/db';
import { exportBackup } from '../db/backup';
import { useSettings } from '../db/hooks';
import { backupStatus } from '../calc/reminders';
import { addMonths, appCycle, cycleOf, cycleRange, localToday, thaiDate, thaiMonth } from '../calc/dates';
import type { Account, Settings as SettingsT } from '../db/types';
import { exportCsv } from '../db/csvExport';
import { addAccount, clearAllData, deleteAccount, renameAccount, reorderAccounts } from '../db/settingsActions';
import { Grip, SortList } from '../components/SortList';
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
  const [accOpen, setAccOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []) ?? [];
  const catCount = useLiveQuery(() => db.logCategories.filter((c) => !c.hidden).count(), []) ?? 0;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const bs = backupStatus(settings?.lastBackupAt);
  const lastText = bs.never || !settings?.lastBackupAt
    ? 'ยังไม่เคยสำรอง'
    : `ล่าสุด ${thaiDate(localToday(new Date(settings.lastBackupAt)))} · ${bs.days === 0 ? 'วันนี้' : `${bs.days} วันที่แล้ว`}`;
  const backup = async () => {
    const r = await exportBackup(db);
    if (r !== 'cancelled') flash('สำรองข้อมูลแล้ว');
  };

  const cur = settings ? appCycle(localToday(), settings.pay, settings.startCycle) : null;
  const ex = cur && settings ? cycleRange(cur, settings.pay) : null;
  const noYear = (d: string) => thaiDate(d).replace(/ \d+$/, '');
  const csv = async () => {
    const r = await exportCsv(db);
    if (r !== 'cancelled') flash('ส่งออกแล้ว 2 ไฟล์');
  };
  const chev = <span style={{ color: 'var(--ink3)', display: 'flex' }}><Icon name="chevron" size={16} stroke={2} /></span>;

  return (
    <main className="page">
      <div className="page-head"><h1>ตั้งค่า</h1></div>

      <span className="sec">เงินเดือน</span>
      <div className="list">
        <button className="row" onClick={() => setPayOpen(true)} disabled={!settings}>
          <span className="ic tg"><Icon name="calendar" size={18} stroke={2} /></span>
          <span className="tx">
            <span className="t1">วันเงินเดือนเข้า</span>
            <span className="t2">{settings ? payRuleLabel(settings.pay, settings.weekendShift).sub : ''}</span>
          </span>
          <span className="val num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{settings ? payRuleLabel(settings.pay, settings.weekendShift).main : ''}</span>
          {chev}
        </button>
        <button className="row" onClick={() => setStartOpen(true)} disabled={!settings}>
          <span className="ic"><Icon name="flag" size={18} stroke={2} /></span>
          <span className="tx">
            <span className="t1">เริ่มใช้แอปตั้งแต่รอบ</span>
            <span className="t2">แผนและบันทึกเริ่มที่รอบนี้</span>
          </span>
          <span className="val num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{settings?.startCycle ? thaiMonth(settings.startCycle) : 'ไม่จำกัด'}</span>
          {chev}
        </button>
        {cur && ex && (
          <div className="row st-info">
            <span className="ic" style={{ color: 'var(--ink2)' }}><Icon name="info" size={18} stroke={2} /></span>
            <span className="tx"><span className="t2">เดือนในแอปนับตาม<span className="nw">รอบเงินเดือน</span> เช่น <span className="nw">เดือน {thaiMonth(cur).replace(/ \d+$/, '')}</span> = <span className="nw">เงินที่เข้า {noYear(ex.start)}</span> <span className="nw">ใช้ถึง {noYear(ex.end)}</span> เปลี่ยนวันแล้ว<span className="nw">แผนเดิมจะไม่ย้ายเดือน</span></span></span>
          </div>
        )}
      </div>
      {payOpen && settings && <PayRuleSheet settings={settings} onClose={() => setPayOpen(false)} />}
      {startOpen && settings && <StartCycleSheet settings={settings} onClose={() => setStartOpen(false)} />}

      <span className="sec">แผนและหมวด</span>
      <div className="list">
        <button className="row" onClick={() => setAccOpen(true)}>
          <span className="ic to"><Icon name="transfer" size={18} stroke={2} /></span>
          <span className="tx">
            <span className="t1">บัญชีปลายทาง <span className="nw">(แยกบัญชี)</span></span>
            <span className="t2">{accounts.length ? accPreview(accounts.map((a) => a.name)) : 'ยังไม่มีบัญชี เพิ่มได้ที่นี่'}</span>
          </span>
          <span className="val num">{accounts.length} บัญชี</span>
          {chev}
        </button>
        <Link className="row" to="/log/cats">
          <span className="ic tb"><Icon name="grid" size={18} stroke={2} /></span>
          <span className="tx">
            <span className="t1">หมวดบันทึก</span>
            <span className="t2">เพิ่ม ซ่อน เรียงลำดับ เลือกงบ</span>
          </span>
          <span className="val num">{catCount} หมวด</span>
          {chev}
        </Link>
      </div>
      {accOpen && <AccountsSheet onClose={() => setAccOpen(false)} />}

      <span className="sec">บิลแชร์</span>
      <div className="list">
        <button className="row" onClick={() => setRecvOpen(true)} disabled={!settings}>
          <span className="ic"><Icon name="wallet" size={18} stroke={2} /></span>
          <span className="tx">
            <span className="t1">ช่องทางรับเงิน</span>
            <span className="t2">{settings?.receiveInfo.trim() || 'แสดงท้ายใบสรุปบิล ยังไม่ได้ตั้ง'}</span>
          </span>
          {chev}
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
        <button className="row st-sw" role="switch" aria-checked={!!settings?.hideOnOpen} disabled={!settings}
          onClick={() => db.settings.update('app', { hideOnOpen: !settings?.hideOnOpen, updatedAt: Date.now() })}>
          <span className="ic"><Icon name="eyeOff" size={18} stroke={2} /></span>
          <span className="tx"><span className="t1">ซ่อนตัวเลขตอนเปิดแอป</span><span className="t2">แตะรูปตาในการ์ด<span className="nw">สินทรัพย์เพื่อดู</span></span></span>
          <span className="sw" aria-hidden="true" />
        </button>
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
          {chev}
        </button>
        <button className="row" onClick={csv}>
          <span className="ic tg"><Icon name="export" size={18} stroke={2} /></span>
          <span className="tx"><span className="t1">ส่งออกเป็น CSV</span><span className="t2">2 ไฟล์: <span className="nw">รายการบันทึก</span> และ<span className="nw">แผนรายเดือน</span></span></span>
          {chev}
        </button>
      </div>
      <div className="note">
        <Icon name="info" size={16} stroke={2} />
        <span>ข้อมูลอยู่ใน<span className="nw">เครื่องนี้</span>เท่านั้น iPhone อาจล้าง<span className="nw">ข้อมูลเว็บ</span>เองถ้าไม่ได้เปิดแอปนาน ๆ ควรสำรองเก็บไว้ใน<span className="nw">แอปไฟล์</span>หรือ <span className="nw">iCloud Drive</span></span>
      </div>
      <RestorePicker ref={picker} onRestored={() => { setTheme(getThemePref()); flash('กู้คืนเรียบร้อย'); }} />

      <div className="list">
        <button className="row st-danger" onClick={() => setWipeOpen(true)}>ล้างข้อมูลทั้งหมด</button>
      </div>
      {wipeOpen && <WipeSheet onBackup={backup} onClose={() => setWipeOpen(false)} onDone={() => setTheme('system')} />}

      <span className="sec">เกี่ยวกับ</span>
      <div className="list">
        <button className="row" onClick={() => setNews(true)}>
          <span className="ic"><Icon name="info" size={18} stroke={2} /></span>
          <span className="tx"><span className="t1">มีอะไรใหม่</span></span>
          <span className="val num">{APP_VERSION}</span>
          {chev}
        </button>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}

      <span className="muted" style={{ textAlign: 'center', fontSize: 12, paddingTop: 4 }}>
        Alloc <span className="num">{APP_VERSION}</span> · ข้อมูลเก็บในเครื่องนี้เท่านั้น
      </span>

      {news && (
        <Sheet title="มีอะไรใหม่" onClose={() => setNews(false)}>
          {CHANGELOG.map((c) => (
            <div key={c.version} className="card st-news" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <b className="num" style={{ fontSize: 16 }}>{c.version}</b><span className="muted" style={{ fontSize: 12 }}>{c.date}</span>
              </div>
              {c.sections.map((sec) => (
                <div key={sec.title} style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)', marginBottom: 2 }}>{sec.title}</div>
                  <ul>{sec.items.map((it) => <li key={it}>{phrases(it)}</li>)}</ul>
                </div>
              ))}
            </div>
          ))}
          <button className="btn btn-pri" style={{ width: '100%' }} onClick={() => setNews(false)}>ปิด</button>
        </Sheet>
      )}
    </main>
  );
}

/** ตัดบรรทัดเฉพาะที่ช่องว่าง (วลีไทยไม่ขาดกลาง) */
const phrases = (t: string) => t.split(' ').map((w, i) => <span key={i}>{i > 0 && ' '}<span className="nw">{w}</span></span>);

/** "บัญชีบ้าน, บัญชีออม, บัญชีลงทุน และอื่น ๆ" */
const accPreview = (names: string[]) => names.length > 3 ? `${names.slice(0, 3).join(', ')} และอื่น ๆ` : names.join(', ');

/** จัดการบัญชีปลายทาง: เพิ่ม · แตะเพื่อเปลี่ยนชื่อหรือลบ · ลากเรียง */
function AccountsSheet({ onClose }: { onClose: () => void }) {
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []) ?? [];
  const items = useLiveQuery(() => db.planItems.toArray(), []) ?? [];
  const [edit, setEdit] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [newName, setNewName] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const used = (id: string) => items.filter((i) => i.accountId === id).length;

  if (edit) {
    const n = used(edit.id);
    return (
      <Sheet title="แก้บัญชี" onClose={onClose}>
        <label className="field" style={{ marginBottom: 12 }}><span className="label">ชื่อบัญชี</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: 16, fontWeight: 500 }} />
          <span className="hint">ใส่แค่ชื่อเรียก <span className="nw">ห้ามใส่เลขบัญชี</span></span>
        </label>
        {confirmDel ? (
          <div className="note warn" style={{ marginBottom: 12 }}><Icon name="alert" size={16} stroke={2} />
            <span>{n ? <>{n} รายการในแผนที่โอนเข้าบัญชีนี้ <span className="nw">จะกลับไปอยู่ในบัญชีเงินเดือน</span> <span className="nw">ยอดแผนไม่เปลี่ยน</span></> : 'ยังไม่มีรายการในแผนที่ใช้บัญชีนี้'}</span></div>
        ) : n > 0 && <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>ใช้ใน {n} รายการของแผน</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          {confirmDel
            ? <button className="btn st-del" style={{ flex: 1 }} onClick={async () => { await deleteAccount(db, edit.id); setEdit(null); setConfirmDel(false); }}>ยืนยันลบบัญชี</button>
            : <button className="btn" style={{ flex: 1 }} onClick={() => setConfirmDel(true)}>ลบบัญชี</button>}
          <button className="btn btn-pri" style={{ flex: 1 }} disabled={!name.trim()} onClick={async () => { await renameAccount(db, edit.id, name); setEdit(null); setConfirmDel(false); }}>บันทึก</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="บัญชีปลายทาง" onClose={onClose}>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5 }}>บัญชีที่จะโอนเงินแยกไว้<span className="nw">ทันทีที่เงินเดือนออก</span> เลือกให้แต่ละรายการได้ใน<span className="nw">แผ่นแก้รายการ</span></p>
      {accounts.length > 0 && (
        <ul className="list st-acc" aria-label="รายการบัญชี" style={{ marginBottom: 12 }}>
          <SortList ids={accounts.map((a) => a.id)} onCommit={(ids) => reorderAccounts(db, ids)}>{(id, dragItem, dragHandle) => {
            const a = accounts.find((x) => x.id === id)!;
            const n = used(a.id);
            return (
              <li key={a.id} {...dragItem} className="row">
                <Grip label={`ลากเพื่อย้าย ${a.name}`} {...dragHandle} />
                <button className="st-acc-b" onClick={() => { setEdit(a); setName(a.name); }}>
                  <span className="tx"><span className="t1">{a.name}</span><span className="t2">{n ? `ใช้ใน ${n} รายการ` : 'ยังไม่มีรายการ'}</span></span>
                  <span style={{ color: 'var(--ink3)', display: 'flex' }}><Icon name="edit" size={16} stroke={2} /></span>
                </button>
              </li>
            );
          }}</SortList>
        </ul>
      )}
      <label className="field" style={{ marginBottom: 12 }}><span className="label">เพิ่มบัญชีใหม่</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น บัญชีออม" style={{ fontSize: 16, fontWeight: 500 }} />
          <button className="btn btn-pri" disabled={!newName.trim()} onClick={async () => { await addAccount(db, newName); setNewName(''); }}>เพิ่ม</button>
        </span>
        <span className="hint">ใส่แค่ชื่อเรียก <span className="nw">ห้ามใส่เลขบัญชี</span></span>
      </label>
      <button className="btn" style={{ width: '100%' }} onClick={onClose}>เสร็จ</button>
    </Sheet>
  );
}

/** ล้างข้อมูลทั้งหมด: แนะนำให้สำรองก่อน · พิมพ์คำว่า ล้าง จึงกดได้ */
function WipeSheet({ onBackup, onClose, onDone }: { onBackup: () => Promise<void>; onClose: () => void; onDone: () => void }) {
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = word.trim() === 'ล้าง';
  return (
    <Sheet title="ล้างข้อมูลทั้งหมด" onClose={onClose}>
      <div className="note warn" style={{ marginBottom: 12 }}><Icon name="alert" size={16} stroke={2} />
        <span>แผน เป้าหมาย บันทึก บิลแชร์ และการตั้งค่า<span className="nw">ในเครื่องนี้</span>จะหายทั้งหมด <span className="nw">กู้คืนไม่ได้</span> ถ้าไม่มี<span className="nw">ไฟล์สำรอง</span></span></div>
      <button className="btn" style={{ width: '100%', marginBottom: 12 }} onClick={onBackup}><Icon name="backup" size={18} stroke={2} />สำรองข้อมูลก่อน</button>
      <label className="field" style={{ marginBottom: 12 }}><span className="label">พิมพ์คำว่า ล้าง เพื่อยืนยัน</span>
        <input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" placeholder="ล้าง" style={{ fontSize: 16, fontWeight: 500 }} />
      </label>
      <button className="btn st-del-solid" style={{ width: '100%' }} disabled={!ok || busy}
        onClick={async () => { setBusy(true); await clearAllData(db); await setThemePref('system'); onDone(); }}>ล้างข้อมูลทั้งหมด</button>
    </Sheet>
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
