// แผ่นเด้งจากด้านล่าง: radius บน 28 + ที่จับ 40×5 + พื้นหลังมืด · ปัดลงเพื่อปิด
import type { ReactNode } from 'react';
import { SheetFrame } from './SheetFrame';

type Props = { title: string; onClose: () => void; children: ReactNode; tone?: string };

export function Sheet({ title, onClose, children, tone }: Props) {
  return (
    <SheetFrame label={title} className={`sheet${tone ? ` tone-${tone} toned` : ''}`} onClose={onClose}>
      <h2>{title}</h2>
      {children}
    </SheetFrame>
  );
}
