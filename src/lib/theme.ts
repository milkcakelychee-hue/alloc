// ธีม สว่าง / มืด / ตามเครื่อง
// ขั้นที่ 1 เก็บใน localStorage ชั่วคราว · ขั้นที่ 2 ย้ายเข้า settings ใน IndexedDB
export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'alloc.theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* โหมดส่วนตัว */ }
  return 'system';
}

export function setThemePref(p: ThemePref) {
  try { localStorage.setItem(KEY, p); } catch { /* โหมดส่วนตัว */ }
  applyTheme(p);
}

export function applyTheme(p: ThemePref = getThemePref()) {
  const dark = p === 'dark' || (p === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0D1611' : '#FAFAF7');
}

media.addEventListener('change', () => applyTheme());
