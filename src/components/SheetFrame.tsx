// โครงแผ่นเด้งร่วม: ปัดลงเพื่อปิด (จากที่จับ หรือทั้งแผ่นเมื่อเลื่อนอยู่บนสุด) · แตะพื้นหลังไม่ปิด กันข้อมูลที่กรอกหาย
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const CLOSE_AT = 90; // ปัดลงเกินกี่ px ถึงปิด
const FLICK = 0.6; // หรือปัดเร็วกว่ากี่ px/ms

export function SheetFrame({ label, className, onClose, children }: { label: string; className: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const el = ref.current!;
    let d: { y0: number; t0: number; dy: number; on: boolean; grab: boolean } | null = null;
    const set = (dy: number, anim = false) => {
      el.style.transition = anim ? 'transform .22s cubic-bezier(.2,.8,.2,1)' : 'none';
      el.style.transform = dy ? `translateY(${dy}px)` : '';
    };
    const start = (y: number, t: EventTarget | null) => {
      const tg = t as HTMLElement;
      if (tg.closest('input, textarea, select, [data-nodrag]')) return;
      const grab = !!tg.closest('.grab');
      if (!grab && el.scrollTop > 0) return;
      // เริ่มในรายการที่เลื่อนได้และยังไม่อยู่บนสุด → ให้เลื่อนรายการ
      for (let n: HTMLElement | null = tg; n && n !== el; n = n.parentElement) if (n.scrollHeight > n.clientHeight + 2 && n.scrollTop > 0) return;
      d = { y0: y, t0: performance.now(), dy: 0, on: grab, grab };
    };
    const move = (y: number, ev: Event) => {
      if (!d) return;
      const dy = y - d.y0;
      if (!d.on) {
        if (dy < -6) { d = null; return; } // เลื่อนขึ้น = เลื่อนเนื้อหา
        if (dy < 8) return;
        d.on = true;
      }
      if (ev.cancelable) ev.preventDefault();
      d.dy = Math.max(dy, 0);
      set(d.dy);
    };
    const end = () => {
      if (!d) return;
      const x = d; d = null;
      if (!x.on) return;
      const v = x.dy / Math.max(performance.now() - x.t0, 1);
      if (x.dy > CLOSE_AT || v > FLICK) { set(window.innerHeight, true); setTimeout(() => close.current(), 180); }
      else set(0, true);
    };
    const ts = (e: TouchEvent) => start(e.touches[0].clientY, e.target);
    const tm = (e: TouchEvent) => move(e.touches[0].clientY, e);
    const md = (e: MouseEvent) => { start(e.clientY, e.target); };
    const mm = (e: MouseEvent) => move(e.clientY, e);
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    el.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', end);
    return () => {
      el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm);
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end);
      el.removeEventListener('mousedown', md); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', end);
    };
  }, []);

  return createPortal(
    <div className="scrim">
      <section ref={ref} className={className} role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" aria-hidden="true" />
        {children}
      </section>
    </div>,
    document.body
  );
}
