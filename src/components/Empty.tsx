import type { ReactNode } from 'react';
import { Icon, P } from './Icon';

export function Empty({ icon, title, text }: { icon: keyof typeof P; title: string; text: ReactNode }) {
  return (
    <div className="card empty">
      <span className="ic"><Icon name={icon} /></span>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
