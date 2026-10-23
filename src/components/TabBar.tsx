import { NavLink } from 'react-router-dom';
import { Icon, P } from './Icon';

const TABS: { to: string; name: string; icon: keyof typeof P; end?: boolean }[] = [
  { to: '/', name: 'หน้าหลัก', icon: 'home', end: true },
  { to: '/goals', name: 'เป้าหมาย', icon: 'goal' },
  { to: '/log', name: 'บันทึก', icon: 'log' },
  { to: '/settings', name: 'ตั้งค่า', icon: 'settings' }
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="เมนูหลัก">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              {/* แท็บที่เลือก: หน้าหลักเป็นไอคอนทึบ ที่เหลือเส้นหนาขึ้น ตามต้นแบบ */}
              <Icon name={t.icon} fill={isActive && t.icon === 'home'} stroke={isActive ? 2.2 : 1.8} />
              {t.name}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
