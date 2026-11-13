// หัวข้อซ้ายของตั้งค่าบนคอม: กดแล้วเลื่อนไปส่วนนั้น · ไฮไลต์หัวข้อตามส่วนที่เลื่อนมาถึง
import { useCallback, useEffect, useRef, useState } from 'react';

export type DeskNav = [string, string][];

export function useDeskNav(secs: DeskNav) {
  const [on, setOn] = useState(secs[0][0]);
  const els = useRef<Record<string, HTMLElement | null>>({});
  const box = useRef<HTMLElement | null>(null);
  const lock = useRef(0);
  const pick = useCallback(() => {
    const b = box.current;
    if (!b || Date.now() < lock.current) return;
    const top = b.getBoundingClientRect().top + 40;
    let cur = secs[0][0];
    for (const [id] of secs) { const e = els.current[id]; if (e && e.getBoundingClientRect().top <= top) cur = id; }
    // เลื่อนสุดล่างแล้ว = หัวข้อสุดท้าย
    if (b.scrollTop + b.clientHeight >= b.scrollHeight - 2) cur = secs[secs.length - 1][0];
    setOn(cur);
  }, [secs]);
  const scroller = useCallback((el: HTMLElement | null) => {
    box.current?.removeEventListener('scroll', pick);
    box.current = el;
    el?.addEventListener('scroll', pick, { passive: true });
  }, [pick]);
  useEffect(() => () => box.current?.removeEventListener('scroll', pick), [pick]);
  const reg = (id: string) => (el: HTMLElement | null) => { els.current[id] = el; };
  const go = (id: string) => {
    const b = box.current, e = els.current[id];
    if (!b || !e) return;
    setOn(id);
    lock.current = Date.now() + 600; // ระหว่างเลื่อนไม่ให้ไฮไลต์กระโดด
    b.scrollTo({ top: e.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 24, behavior: 'smooth' });
  };
  return { on, reg, go, scroller };
}
