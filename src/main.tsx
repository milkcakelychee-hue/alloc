import { BillDetail } from './pages/bill/BillDetail';
import { People } from './pages/bill/People';
import { BillSummary } from './pages/bill/BillSummary';
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import './styles/goals.css';
import './styles/log.css';
import './styles/bill.css';
import { applyTheme, syncThemeFromDb } from './lib/theme';
import { db } from './db/db';
import { ensureDefaults } from './db/defaults';
import { applyHideOnOpen } from './db/settingsActions';
import { applyUpdate, hasPendingUpdate, onPendingUpdate } from './lib/update';
import { TabBar } from './components/TabBar';
import Home from './pages/Home';
import Goals from './pages/Goals';
import GoalCategory from './pages/goals/GoalCategory';
import GoalCreate from './pages/goals/GoalCreate';
import GoalHistory from './pages/goals/GoalHistory';
import LogAdd from './pages/log/LogAdd';
import LogCats from './pages/log/LogCats';
import LogSpend from './pages/log/LogSpend';
import Log from './pages/Log';
import Settings from './pages/Settings';
import Welcome from './pages/Welcome';
import { useSettings } from './db/hooks';
import { syncDeposits } from './db/goalActions';
import { localToday } from './calc/dates';

function Shell() {
  const [upd, setUpd] = useState(hasPendingUpdate());
  useEffect(() => onPendingUpdate(() => setUpd(true)), []);
  const live = useSettings();
  // ระหว่างกู้คืน ตาราง settings ถูกล้างชั่วครู่ ใช้ค่าล่าสุดไว้ก่อน ไม่ให้หน้า Welcome หลุดขั้น
  const last = useRef(live);
  if (live) last.current = live;
  const settings = last.current;
  const loc = useLocation();
  // บวกยอดเป้าตามแผนของรอบที่เงินเดือนเข้าแล้ว (เลยวันเงินเข้า 7 วันโดยไม่กดยืนยัน = ถือว่าเข้า)
  const ready = !!settings?.onboardedAt;
  useEffect(() => {
    if (!ready) return;
    const run = () => { if (document.visibilityState === 'visible') syncDeposits(db, localToday()).catch(() => {}); };
    run();
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
  }, [ready]);
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
        <Route path="/goals/new" element={<GoalCreate />} />
        <Route path="/goals/g/:id" element={<GoalHistory />} />
        <Route path="/goals/:cat" element={<GoalCategory />} />
        <Route path="/log" element={<Log />} />
        <Route path="/log/add" element={<LogAdd />} />
        <Route path="/log/cats" element={<LogCats />} />
        <Route path="/log/spend" element={<LogSpend />} />
        <Route path="/log/bill/:id" element={<BillDetail />} />
        <Route path="/log/people" element={<People />} />
        <Route path="/log/bill-summary" element={<BillSummary />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!onWelcome && loc.pathname !== '/goals/new' && loc.pathname !== '/log/add' && <TabBar />}
      {upd && <button className="toast" onClick={() => applyUpdate()}>มีอัปเดตใหม่ · แตะเพื่อรีเฟรช</button>}
    </>
  );
}

applyTheme();
ensureDefaults(db).then(() => Promise.all([syncThemeFromDb(), applyHideOnOpen(db)]));
// ขอให้เบราว์เซอร์ไม่ลบข้อมูลเอง (iOS ไม่รับประกัน จึงยังต้องสำรองไฟล์)
navigator.storage?.persist?.().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Shell />
    </HashRouter>
  </React.StrictMode>
);

// iOS Safari ไม่สนใจ user-scalable=no: กันถ่างนิ้วซูมด้วย gesture event (Safari เท่านั้น)
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
