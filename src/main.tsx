import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import { applyTheme, syncThemeFromDb } from './lib/theme';
import { db } from './db/db';
import { ensureDefaults } from './db/defaults';
import { applyUpdate, hasPendingUpdate, onPendingUpdate } from './lib/update';
import { TabBar } from './components/TabBar';
import Home from './pages/Home';
import Goals from './pages/Goals';
import Log from './pages/Log';
import Settings from './pages/Settings';
import Welcome from './pages/Welcome';
import { useSettings } from './db/hooks';
import PaydayMock from './design/PaydayMock'; // ต้นแบบ ไม่ขึ้นเว็บ

function Shell() {
  const [upd, setUpd] = useState(hasPendingUpdate());
  useEffect(() => onPendingUpdate(() => setUpd(true)), []);
  const live = useSettings();
  // ระหว่างกู้คืน ตาราง settings ถูกล้างชั่วครู่ ใช้ค่าล่าสุดไว้ก่อน ไม่ให้หน้า Welcome หลุดขั้น
  const last = useRef(live);
  if (live) last.current = live;
  const settings = last.current;
  const loc = useLocation();
  if (!settings) return null; // รอ ensureDefaults ครั้งแรก
  const onWelcome = loc.pathname === '/welcome';
  // ยังไม่ผ่านหน้าเริ่มใช้งาน → ไป Welcome ก่อน (หน้า Welcome เองจัดการขั้น "พร้อมใช้แล้ว")
  if (!settings.onboardedAt && !onWelcome) return <Navigate to="/welcome" replace />;
  return (
    <>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/" element={<Home />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/log" element={<Log />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/design/payday" element={<PaydayMock />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!onWelcome && !loc.pathname.startsWith('/design') && <TabBar />}
      {upd && <button className="toast" onClick={() => applyUpdate()}>มีอัปเดตใหม่ · แตะเพื่อรีเฟรช</button>}
    </>
  );
}

applyTheme();
ensureDefaults(db).then(syncThemeFromDb);
// ขอให้เบราว์เซอร์ไม่ลบข้อมูลเอง (iOS ไม่รับประกัน จึงยังต้องสำรองไฟล์)
navigator.storage?.persist?.().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Shell />
    </HashRouter>
  </React.StrictMode>
);
