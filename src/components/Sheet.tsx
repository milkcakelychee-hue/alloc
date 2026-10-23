// แผ่นเด้งจากด้านล่าง: radius บน 28 + ที่จับ 40×5 + พื้นหลังมืด
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = { title: string; onClose: () => void; children: ReactNode };

export function Sheet({ title, onClose, children }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" aria-hidden="true" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>,
    document.body
  );
}
