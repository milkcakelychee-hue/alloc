import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import { APP_VERSION, CHANGELOG } from '../lib/version';

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'สว่าง' },
  { value: 'dark', label: 'มืด' },
  { value: 'system', label: 'ตามเครื่อง' }
];

export default function Settings() {
  const [theme, setTheme] = useState(getThemePref());
  const [news, setNews] = useState(false);
  const pick = (t: ThemePref) => { setTheme(t); setThemePref(t); };

  return (
    <main className="page">
      <div className="page-head"><h1>ตั้งค่า</h1></div>

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

      <span className="sec">เกี่ยวกับ</span>
      <div className="list">
        <button className="row" onClick={() => setNews(true)}>
          <span className="ic"><Icon name="info" size={18} stroke={2} /></span>
          <span className="tx"><span className="t1">มีอะไรใหม่</span></span>
          <span className="val num">{APP_VERSION}</span>
          <span style={{ color: 'var(--ink3)', display: 'flex' }}><Icon name="chevron" size={16} stroke={2} /></span>
        </button>
      </div>

      <span className="muted" style={{ textAlign: 'center', fontSize: 12, paddingTop: 4 }}>
        Alloc <span className="num">{APP_VERSION}</span> · ข้อมูลเก็บในเครื่องนี้เท่านั้น
      </span>

      {news && (
        <Sheet title="มีอะไรใหม่" onClose={() => setNews(false)}>
          {CHANGELOG.map((c) => (
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
