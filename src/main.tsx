import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom';
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

function Shell() {
  const [upd, setUpd] = useState(hasPendingUpdate());
  useEffect(() => onPendingUpdate(() => setUpd(true)), []);
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/log" element={<Log />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
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
