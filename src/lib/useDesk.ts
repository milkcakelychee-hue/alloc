// จอคอม (ALLOC_DESKTOP_SPEC ข้อ 1): ต่ำกว่า 1024 = มือถือเดิม · 1024–1279 = แถบไอคอน · 1280 ขึ้นไป = เมนูเต็ม (ย่อได้)
import { useEffect, useState } from 'react';

export const DESK_MIN = 1024;
export const WIDE_MIN = 1280;
const KEY = 'alloc-menu-collapsed'; // จำไว้ในเครื่องนี้เท่านั้น ไม่ซิงก์

export type DeskMode = 'mobile' | 'rail' | 'full';

/** แบบของเมนูจากความกว้างจอและค่าที่ผู้ใช้กดย่อไว้ */
export function deskMode(width: number, collapsed: boolean): DeskMode {
  if (width < DESK_MIN) return 'mobile';
  if (width < WIDE_MIN) return 'rail';
  return collapsed ? 'rail' : 'full';
}

export function readCollapsed(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function writeCollapsed(v: boolean) {
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* โหมดส่วนตัว: ไม่จำก็ได้ */ }
}

export function useWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

export function useDesk() {
  const w = useWidth();
  const [collapsed, setC] = useState(readCollapsed);
  const toggle = () => setC((c) => { writeCollapsed(!c); return !c; });
  return { mode: deskMode(w, collapsed), wide: w >= WIDE_MIN, toggle };
}
