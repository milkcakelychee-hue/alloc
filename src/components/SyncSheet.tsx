// แผ่นซิงก์ข้ามเครื่อง: เข้าสู่ระบบ / เลือกชุดข้อมูล / สถานะบัญชี
import { useState, type FormEvent } from 'react';
import { db } from '../db/db';
import { chooseData, downloadConflictCopy, dropConflictCopy, signIn, signOut, syncLabel, syncNow, useSync } from '../lib/sync';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

type Props = { onClose: () => void; welcome?: boolean; onPulled?: () => void };

export function SyncSheet({ onClose, welcome, onPulled }: Props) {
  const s = useSync();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async (signup: boolean) => {
    setBusy(true); setError('');
    const err = await signIn(email, password, signup);
    setBusy(false);
    if (err) { setError(err); return; }
    setPassword('');
    // หน้าเริ่มใช้งาน: ถ้าดึงข้อมูลลงมาได้แล้ว ไปขั้น "พร้อมใช้" เลย
    if (welcome && (await db.settings.get('app'))?.onboardedAt) onPulled?.();
  };
  const submit = (e: FormEvent) => { e.preventDefault(); if (!busy) go(false); };
  const choose = async (use: 'cloud' | 'local') => { setBusy(true); await chooseData(use); setBusy(false); };

  if (!s.email) {
    const ready = /\S+@\S+/.test(email) && password.length >= 6;
    return (
      <Sheet title="เข้าสู่ระบบเพื่อซิงก์" onClose={() => !busy && onClose()}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="field"><span className="label">อีเมล</span>
            <input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field"><span className="label">รหัสผ่าน</span>
            <input type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error ? <span className="err">{error}</span> : <span className="hint">อย่างน้อย 6 ตัว · ใช้บัญชีเดียวกัน<span className="nw">ทุกเครื่อง</span></span>}
          </label>
          <button className="btn btn-pri" disabled={busy || !ready}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
          <button type="button" className="btn btn-lime" disabled={busy || !ready} onClick={() => go(true)}>ใช้ครั้งแรก · สร้างบัญชี</button>
        </form>
        <div className="note" style={{ marginTop: 12 }}>
          <Icon name="cloud" size={16} stroke={2} />
          <span>เข้าสู่ระบบแล้ว ข้อมูลในแอปจะ<span className="nw">ถูกส่งขึ้นคลาวด์</span> (Supabase) และ<span className="nw">ตรงกันทุกเครื่อง</span>ที่ใช้<span className="nw">บัญชีเดียวกัน</span> เห็นได้เฉพาะ<span className="nw">เจ้าของบัญชี</span></span>
        </div>
      </Sheet>
    );
  }

  if (s.status === 'ask') {
    return (
      <Sheet title="ใช้ข้อมูลชุดไหน" onClose={() => !busy && onClose()}>
        <div className="note warn" style={{ marginBottom: 12 }}><Icon name="alert" size={16} stroke={2} />
          <span>เครื่องนี้มีข้อมูลอยู่แล้ว และ<span className="nw">บนคลาวด์</span>ก็มีข้อมูลของ<span className="nw">บัญชีนี้</span> เลือกชุดที่จะใช้ต่อ <span className="nw">อีกชุดจะถูกแทนที่</span></span></div>
        {s.error && <p className="err" style={{ margin: '0 0 12px', color: 'var(--danger)', fontSize: 13 }}>{s.error}</p>}
        <button className="btn btn-pri" style={{ width: '100%' }} disabled={busy} onClick={() => choose('cloud')}>ใช้ข้อมูลบนคลาวด์</button>
        <span className="muted" style={{ display: 'block', fontSize: 12.5, margin: '6px 0 12px', textAlign: 'center' }}>ข้อมูลในเครื่องนี้จะ<span className="nw">เก็บเป็นสำเนา</span>ไว้ให้ดาวน์โหลดได้</span>
        <button className="btn btn-ghost" style={{ width: '100%' }} disabled={busy} onClick={() => choose('local')}>ใช้ข้อมูลเครื่องนี้ แทนที่บนคลาวด์</button>
        <button className="btn text-danger" style={{ width: '100%', marginTop: 4 }} disabled={busy} onClick={() => signOut()}>ยังไม่เลือก · ออกจากระบบ</button>
      </Sheet>
    );
  }

  return (
    <Sheet title="ซิงก์ข้ามเครื่อง" onClose={onClose}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere' }}>{s.email}</span>
        <span className="muted" style={{ fontSize: 13, color: s.status === 'error' ? 'var(--danger)' : undefined }}>
          {s.status === 'ok' || s.status === 'off' ? (welcome ? 'เข้าสู่ระบบแล้ว' : 'ซิงก์แล้ว') : syncLabel(s)}
        </span>
      </div>
      {welcome && s.status !== 'error' && s.status !== 'syncing' && (
        <div className="note warn" style={{ marginBottom: 12 }}><Icon name="alert" size={16} stroke={2} />
          <span>ยังไม่มีข้อมูลบนคลาวด์ของ<span className="nw">บัญชีนี้</span> เปิดแอปใน<span className="nw">เครื่องที่มีข้อมูล</span> เข้าสู่ระบบด้วย<span className="nw">อีเมลเดียวกัน</span>ให้ขึ้นว่า<span className="nw">ซิงก์แล้ว</span> แล้วกลับมากด<span className="nw">ซิงก์ตอนนี้</span></span></div>
      )}
      <button className="btn btn-pri" style={{ width: '100%' }} disabled={s.status === 'syncing'} onClick={() => syncNow()}>ซิงก์ตอนนี้</button>
      {s.hasConflictCopy && (
        <div className="note" style={{ marginTop: 12, flexDirection: 'column', gap: 10 }}>
          <span>มีสำเนา<span className="nw">ข้อมูลเครื่องนี้</span>ที่เก็บไว้ก่อน<span className="nw">ถูกแทนที่</span>ด้วยข้อมูลจากคลาวด์ ดาวน์โหลดเป็น<span className="nw">ไฟล์สำรอง</span>ได้</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="pill-btn" onClick={downloadConflictCopy}>ดาวน์โหลดสำเนา</button>
            <button className="pill-btn" style={{ background: 'transparent', color: 'var(--ink2)' }} onClick={dropConflictCopy}>ลบสำเนา</button>
          </span>
        </div>
      )}
      <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => signOut()}>ออกจากระบบ</button>
      <span className="muted" style={{ display: 'block', fontSize: 12.5, marginTop: 8, textAlign: 'center' }}>ออกแล้วข้อมูลใน<span className="nw">เครื่องนี้ยังอยู่</span> แต่<span className="nw">ไม่ซิงก์ต่อ</span></span>
    </Sheet>
  );
}
