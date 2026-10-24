// ลากจุด 6 จุดเพื่อเรียงลำดับ: ใช้ได้ทั้งรายการแนวตั้งและตาราง
// ก้อนที่ลากตามนิ้ว · ก้อนอื่นเลื่อนหลบแบบนุ่ม (FLIP) · ปล่อยแล้วค่อยบันทึกลำดับ
import { useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';

type Drag = { id: string; pid: number; x0: number; y0: number; base: DOMRect; px: number; py: number };

export function useDragSort(ids: string[], onCommit: (ids: string[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const natural = useRef(new Map<string, DOMRect>());
  const before = useRef(new Map<string, DOMRect>());
  const st = useRef<Drag | null>(null);
  const list = order ?? ids;

  const measure = () => {
    natural.current.clear();
    els.current.forEach((el, id) => {
      const t = el.style.transform;
      el.style.transform = '';
      natural.current.set(id, el.getBoundingClientRect());
      el.style.transform = t;
    });
  };
  const place = () => {
    const s = st.current;
    if (!s) return;
    const el = els.current.get(s.id);
    const r = natural.current.get(s.id);
    if (!el || !r) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${s.base.left + (s.px - s.x0) - r.left}px, ${s.base.top + (s.py - s.y0) - r.top}px)`;
  };

  // หลังลำดับเปลี่ยน: ก้อนอื่นเลื่อนจากที่เดิมไปที่ใหม่แบบนุ่ม
  useLayoutEffect(() => {
    if (!st.current) return;
    measure();
    els.current.forEach((el, id) => {
      if (id === st.current!.id) return;
      const prev = before.current.get(id), now = natural.current.get(id);
      if (!prev || !now) return;
      const dx = prev.left - now.left, dy = prev.top - now.top;
      if (!dx && !dy) return;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => { el.style.transition = 'transform .18s ease'; el.style.transform = ''; });
    });
    place();
  }, [order]);

  const onMove = (e: RPointerEvent) => {
    const s = st.current;
    if (!s || e.pointerId !== s.pid) return;
    s.px = e.clientX; s.py = e.clientY;
    place();
    const cur = order ?? ids;
    // ใช้จุดกึ่งกลางของก้อนที่ลาก (ไม่ใช่ปลายนิ้ว) ก้อนสูงไม่สลับไปมา
    const cx = s.base.left + s.base.width / 2 + (s.px - s.x0), cy = s.base.top + s.base.height / 2 + (s.py - s.y0);
    let target: string | null = null;
    natural.current.forEach((r, id) => {
      if (id !== s.id && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) target = id;
    });
    if (!target) return;
    const next = cur.filter((x) => x !== s.id);
    next.splice(cur.indexOf(target), 0, s.id);
    if (next.join() === cur.join()) return;
    before.current.clear();
    els.current.forEach((el, id) => before.current.set(id, el.getBoundingClientRect()));
    setOrder(next);
  };
  const end = (e: RPointerEvent) => {
    const s = st.current;
    if (!s || e.pointerId !== s.pid) return;
    st.current = null;
    const final = order ?? ids;
    els.current.forEach((el) => { el.style.transition = 'transform .15s ease'; el.style.transform = ''; });
    setDragId(null);
    setOrder(null);
    if (final.join() !== ids.join()) onCommit(final);
  };

  return {
    list,
    dragging: dragId,
    /** ใส่ที่ก้อนที่จะเรียง */
    item: (id: string) => ({
      ref: (el: HTMLElement | null) => { if (el) els.current.set(id, el); else els.current.delete(id); },
      'data-dragging': dragId === id ? '' : undefined
    }),
    /** ใส่ที่จุด 6 จุด */
    handle: (id: string) => ({
      onPointerDown: (e: RPointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ไม่มี pointer จริง */ }
        measure();
        const base = natural.current.get(id);
        if (!base) return;
        st.current = { id, pid: e.pointerId, x0: e.clientX, y0: e.clientY, base, px: e.clientX, py: e.clientY };
        setDragId(id);
      },
      onPointerMove: onMove,
      onPointerUp: end,
      onPointerCancel: end,
      onClick: (e: React.MouseEvent) => e.stopPropagation()
    })
  };
}
