// โครงแอปบนคอม (บอร์ด Desk-Shell / Desk-Shell-1024 / Desk-Shell-Log) · ใช้เมื่อจอกว้างตั้งแต่ 1024
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { Icon, P } from './Icon';
import { AppMark } from './AppMark';
import { useSettings } from '../db/hooks';
import { appCycle, cycleRange, localToday, thaiDate, thaiMonth } from '../calc/dates';
import type { DeskMode } from '../lib/useDesk';

const NAV: { to: string; name: string; icon: keyof typeof P; end?: boolean }[] = [
  { to: '/', name: 'หน้าหลัก', icon: 'home', end: true },
  { to: '/goals', name: 'เป้าหมาย', icon: 'goal' },
  { to: '/log', name: 'บันทึก', icon: 'log' },
  { to: '/settings', name: 'ตั้งค่า', icon: 'settings' }
];

const PlanIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M9.5 9.5v10M15 9.5v10" />
  </svg>
);
const FoldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9 4.5v15M15.5 10 13 12l2.5 2" />
  </svg>
);

// หน้าในโครงคอมวางปุ่มของตัวเองที่แถบบนผ่านช่องนี้ (null = ไม่ได้อยู่บนจอคอม)
const DeskCtx = createContext<{ actions: HTMLElement | null; lead: HTMLElement | null; setSideOpen: (v: boolean) => void; setPlanMonth: (m: string | null) => void } | null>(null);
export const useDeskSlots = () => useContext(DeskCtx);
/** ปุ่มของหน้าที่แถบบน (ชิดขวา) และปุ่มหน้าชื่อหน้า (เช่น กลับตารางแผน) */
export function DeskBar({ lead, actions }: { lead?: ReactNode; actions?: ReactNode }) {
  const c = useDeskSlots();
  if (!c) return null;
  return <>{lead && c.lead && createPortal(lead, c.lead)}{actions && c.actions && createPortal(actions, c.actions)}</>;
}

function pageOf(path: string, planTab: boolean, view: string | null, year: string | null) {
  if (path === '/' && planTab && view === 'year') return { title: `สรุปทั้งปี ${year ? Number(year) + 543 : ''}`.trim(), cycle: false, full: true };
  if (path === '/' && planTab) return { title: 'วางแผนรายจ่าย', cycle: true, full: true };
  if (path === '/') return { title: 'หน้าหลัก', cycle: true, full: false };
  if (path.startsWith('/goals')) return { title: 'เป้าหมาย', cycle: false, full: true };
  if (path.startsWith('/log')) return { title: 'บันทึก', cycle: false, full: false };
  if (path.startsWith('/settings')) return { title: 'ตั้งค่า', cycle: false, full: false };
  return { title: '', cycle: false, full: false };
}

const today = () =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()).replace(/^วัน(\S+?)ที่ /, '$1 ');

export function DeskShell({ mode, wide, onToggle, children }: { mode: DeskMode; wide: boolean; onToggle: () => void; children: ReactNode }) {
  const loc = useLocation();
  const [sp] = useSearchParams();
  const s = useSettings();
  const planTab = loc.pathname === '/' && sp.get('tab') === 'plan';
  const pg = pageOf(loc.pathname, planTab, sp.get('view'), sp.get('y'));
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const [lead, setLead] = useState<HTMLElement | null>(null);
  const [sideOpen, setSideOpen] = useState(false); // แผงรายละเอียดเปิด → เมนูซ้ายย่อเป็นแถบไอคอนเอง
  const rail = mode === 'rail' || sideOpen;
  const [planM, setPlanMonth] = useState<string | null>(null); // หน้าแผนบอกเดือนที่แสดงเป็น "เดือนนี้" (ติ๊กครบแล้วไปเดือนถัดไป)
  const cyc = s ? appCycle(localToday(), s.pay, s.startCycle) : null;
  const cur = planTab && planM ? planM : cyc;
  const range = s && cur ? cycleRange(cur, s.pay) : null;
  const short = (d: string) => thaiDate(d).replace(/ \d+$/, '');
  const sub = !s || !cur ? '' : planTab && sp.get('view') === 'year' ? 'ม.ค. – ธ.ค. · ตามแผนในตาราง'
    : planTab && range ? `รอบ ${thaiMonth(cur)} · ${short(range.start)} – ${short(range.end)}`
    : pg.cycle ? `${today()} · รอบ ${thaiMonth(cur)}` : '';

  return (
    <div className={`desk${rail ? ' is-rail' : ''}`}>
      <aside className="desk-side">
        <div className="desk-logo"><AppMark size={36} />{!rail && <span>Alloc</span>}</div>
        <Link to="/?tab=plan" className={`desk-plan${planTab ? ' on' : ''}`} aria-current={planTab ? 'page' : undefined} aria-label={rail ? 'วางแผนรายจ่าย' : undefined}>
          <PlanIcon size={22} />
          {rail ? <span className="rl">แผน</span> : <span className="tx"><span className="t1">วางแผนรายจ่าย</span><span className="t2">ตาราง 12 เดือน</span></span>}
        </Link>
        {!rail && <span className="desk-cap">เมนู</span>}
        <nav aria-label="เมนูหลัก" className="desk-nav">
          {NAV.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive && !(t.end && planTab) ? 'on' : '')}>
              <Icon name={t.icon} size={20} stroke={1.9} />
              <span className="rl">{t.name}</span>
            </NavLink>
          ))}
        </nav>
        {wide && (
          <button className="desk-fold" onClick={onToggle} aria-label={rail ? 'ขยายเมนู' : 'ย่อเมนู'}>
            <span style={rail ? { transform: 'scaleX(-1)', display: 'flex' } : { display: 'flex' }}><FoldIcon /></span>
            {!rail && 'ย่อเมนู'}
          </button>
        )}
      </aside>
      <div className="desk-main">
        <header className="desk-top">
          <span ref={setLead} className="lead" />
          <span className="ttl"><h1>{pg.title}</h1>{sub && <span className="sub num">{sub}</span>}</span>
          <span ref={setActions} className="acts" />
        </header>
        <DeskCtx.Provider value={{ actions, lead, setSideOpen, setPlanMonth }}>
          {pg.full ? <div className="desk-full">{children}</div> : (
            <div className="desk-colwrap">
              <div className="desk-col">{children}</div>
            </div>
          )}
        </DeskCtx.Provider>
      </div>
    </div>
  );
}
