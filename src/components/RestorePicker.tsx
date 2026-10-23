// เลือกไฟล์สำรอง → แสดงสรุปและยืนยัน → กู้คืน (ใช้ทั้งหน้า Welcome และตั้งค่า)
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { db } from '../db/db';
import { parseBackup, restoreBackup, summarize, type BackupFile } from '../db/backup';
import { ensureDefaults } from '../db/defaults';
import { syncThemeFromDb } from '../lib/theme';
import { thaiDate } from '../calc/dates';
import { Sheet } from './Sheet';

export interface RestorePickerHandle { pick: () => void }

const exportedLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ไม่ทราบวันที่';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${thaiDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const RestorePicker = forwardRef<RestorePickerHandle, { onRestored: () => void }>(function RestorePicker({ onRestored }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<BackupFile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useImperativeHandle(ref, () => ({ pick: () => input.current?.click() }));

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    try { setFile(parseBackup(await f.text())); }
    catch (e) { setError((e as Error).message); }
  };

  const confirm = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await restoreBackup(db, file);
      await ensureDefaults(db); // ไฟล์ที่ขาดบางตารางยังได้ "ฉัน" และหมวดตั้งต้น
      await db.settings.update('app', { onboardedAt: Date.now() });
      await syncThemeFromDb();
      setFile(null);
      onRestored();
    } catch (e) {
      setError(`กู้คืนไม่สำเร็จ ข้อมูลเดิมยังอยู่ · ${(e as Error).message}`);
      setFile(null);
    } finally { setBusy(false); }
  };

  const s = file && summarize(file);
  return (
    <>
      {/* ไม่ใส่ accept: iPhone จะทำไฟล์ .alloc เป็นสีเทาเลือกไม่ได้ */}
      <input ref={input} type="file" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      {error && (
        <Sheet title="อ่านไฟล์ไม่ได้" onClose={() => setError('')}>
          <p style={{ margin: '0 0 16px', color: 'var(--ink2)' }}>{error}</p>
          <button className="btn btn-pri" style={{ width: '100%' }} onClick={() => setError('')}>ตกลง</button>
        </Sheet>
      )}
      {s && (
        <Sheet title="กู้คืนจากไฟล์สำรอง" onClose={() => !busy && setFile(null)}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            <span className="muted" style={{ fontSize: 13 }}>สำรองเมื่อ <span className="num">{exportedLabel(s.exportedAt)}</span></span>
            <span className="num" style={{ fontSize: 14 }}>
              รายการในแผน {s.planItems} · เป้าหมาย {s.goals} · บันทึก {s.logEntries} · บิล {s.bills}
            </span>
          </div>
          <div className="note warn" style={{ marginBottom: 14 }}>ข้อมูลทั้งหมดในเครื่องนี้จะถูกแทนที่ด้วยข้อมูลในไฟล์ และย้อนกลับไม่ได้</div>
          <button className="btn btn-pri" style={{ width: '100%' }} disabled={busy} onClick={confirm}>{busy ? 'กำลังกู้คืน…' : 'กู้คืน'}</button>
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} disabled={busy} onClick={() => setFile(null)}>ยกเลิก</button>
        </Sheet>
      )}
    </>
  );
});
