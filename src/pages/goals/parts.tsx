// ชิ้นส่วนร่วมของแท็บเป้าหมาย
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import type { IconName } from '../plan/planUi';
import { colorOf } from './goalUi';
import { thaiMonth } from '../../calc/dates';

/** ตัวแปรสีของเป้า ใช้คู่กับ class gcol */
export const gstyle = (color: string): CSSProperties => {
  const c = colorOf(color);
  return { '--gr': c.ring, '--gt': c.track, '--gh': c.hatch, '--gx': c.text } as CSSProperties;
};

/** วงความคืบหน้าของเป้า 56px (r 23 · เส้น 6 · ปลายมน) ไอคอนกลางวง */
export function GoalRing({ pct, icon }: { pct: number; icon: string }) {
  const C = 144.5;
  const len = Math.min(Math.max(pct, 0), 1) * C;
  return (
    <span className="gx-ring" style={{ width: 56, height: 56 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r="23" fill="none" stroke="var(--t)" strokeWidth="6" />
        {len > 0 && <circle cx="28" cy="28" r="23" fill="none" stroke="var(--gr)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${len.toFixed(1)} ${C}`} transform="rotate(-90 28 28)" />}
      </svg>
      <span className="gx-ring-c" style={{ color: 'var(--x)' }}><Icon name={icon as IconName} size={20} stroke={2.1} /></span>
    </span>
  );
}

export function BackHead({ to, label, title, children, sub = true }: { to: string; label: string; title: ReactNode; children?: ReactNode; sub?: boolean }) {
  return (
    <div className={`gx-head${sub ? ' sub' : ''}`}>
      <Link to={to} aria-label={label} className="gx-hbtn gx-sq"><Icon name="back" size={20} stroke={2} /></Link>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

export function Stat({ k, children }: { k: string; children: ReactNode }) {
  return <div className="gx-st"><span className="k">{k}</span>{children}</div>;
}

/** เลือกเดือน: แสดงเดือนไทย ทับด้วยช่องเดือนของเครื่องแบบโปร่งใส (แตะแล้วขึ้นตัวเลือกของ iPhone) */
export function MonthField({ value, onChange, min, label, className = 'gx-inrow', placeholder = 'เลือกเดือน' }: {
  value: string; onChange: (m: string) => void; min?: string; label: ReactNode; className?: string; placeholder?: string;
}) {
  return (
    <label className={`${className} gx-monthf`}>
      <span className="k">{label}</span>
      <span className="mv num">{value ? thaiMonth(value) : placeholder}</span>
      <Icon name="chevron" size={16} stroke={2} />
      <input type="month" value={value} min={min} onChange={(e) => onChange(e.target.value)} aria-label={typeof label === 'string' ? label : undefined} />
    </label>
  );
}
