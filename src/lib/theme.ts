// ธีม สว่าง / มืด / ตามเครื่อง
// ตัวจริงเก็บใน settings (IndexedDB) · localStorage เป็นสำเนาให้ใส่ธีมได้ทันทีตอนเปิดแอป ไม่กะพริบ
import { db } from '../db/db';
import type { ThemePref } from '../db/types';
export type { ThemePref };

const KEY = 'alloc.theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');
const valid = (v: unknown): v is ThemePref => v === 'light' || v === 'dark' || v === 'system';

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (valid(v)) return v;
  } catch { /* โหมดส่วนตัว */ }
  return 'system';
}

const cache = (p: ThemePref) => { try { localStorage.setItem(KEY, p); } catch { /* โหมดส่วนตัว */ } };

export async function setThemePref(p: ThemePref) {
  cache(p);
  applyTheme(p);
  await db.settings.update('app', { theme: p, updatedAt: Date.now() });
}

/** ดึงธีมจาก settings มาทับสำเนา (เช่น หลังกู้คืนไฟล์สำรอง) */
export async function syncThemeFromDb() {
  const t = (await db.settings.get('app'))?.theme;
  if (valid(t) && t !== getThemePref()) { cache(t); applyTheme(t); }
}

export function applyTheme(p: ThemePref = getThemePref()) {
  const dark = p === 'dark' || (p === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0D1611' : '#FAFAF7');
}

media.addEventListener('change', () => applyTheme());
