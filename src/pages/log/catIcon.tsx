// ไอคอนหมวดบันทึก (เส้นตามบอร์ด LogAdd / LogCats) + สีหมวดในโหมดมืด (บอร์ด LogCalendarDark)
import type { CSSProperties, ReactNode } from 'react';
import type { LogCategory } from '../../db/types';

const P: Record<string, ReactNode> = {
  food: <><path d="M4 11.5h16a8 8 0 0 1-16 0z" /><path d="M8.5 7.5c0-1.2 1.2-1.6 1.2-3M12 7.5c0-1.2 1.2-1.6 1.2-3M15.5 7.5c0-1.2 1.2-1.6 1.2-3" /></>,
  drink: <><path d="M5 9h11v4.5A5.5 5.5 0 0 1 10.5 19h0A5.5 5.5 0 0 1 5 13.5z" /><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M12 3.5v2.5" /></>,
  travel: <><rect x="5.5" y="3.5" width="13" height="14" rx="3" /><path d="M5.5 10.5h13M9 14.5h.01M15 14.5h.01M8.5 21l1.5-3.5M15.5 21 14 17.5" /></>,
  household: <><path d="M9.5 3.5h5v3h-5zM8.5 6.5h7l1.5 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19v-9z" /><path d="M10 13.5h4" /></>,
  shopping: <><path d="M5 8h14l-1 12.5H6z" /><path d="M9 10V6.5a3 3 0 0 1 6 0V10" /></>,
  health: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" /></>,
  fun: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m10.5 9.5 4 2.5-4 2.5z" /></>,
  other: <><circle cx="6.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="17.5" cy="12" r="1.3" /></>,
  bill: <><path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" /><path d="M9 8.5h6M9 12h6" /></>,
  edu: <path d="M4 5.5h6.5A1.5 1.5 0 0 1 12 7v12a1.5 1.5 0 0 0-1.5-1.5H4zM20 5.5h-6.5A1.5 1.5 0 0 0 12 7v12a1.5 1.5 0 0 1 1.5-1.5H20z" />,
  pet: <><circle cx="7" cy="10" r="1.6" /><circle cx="10.5" cy="6.5" r="1.6" /><circle cx="14" cy="6.5" r="1.6" /><circle cx="17.5" cy="10" r="1.6" /><path d="M12 11.5c-3 0-5 2.5-5 4.5 0 1.5 1.5 2 3 1.5 1-.3 1.5-.5 2-.5s1 .2 2 .5c1.5.5 3 0 3-1.5 0-2-2-4.5-5-4.5z" /></>,
  salary: <><path d="M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 7.5l11-3v3" /><path d="M16 13.5h.01" /></>,
  side: <path d="M12 3.5 14 9.5l6 .5-4.6 4 1.4 6L12 16.8 7.2 20l1.4-6L4 10l6-.5z" />,
  refund: <><path d="M9 8.5 5 12.5l4 4" /><path d="M5 12.5h9a5 5 0 0 0 0-10h-2" /></>,
  dividend: <><path d="M3.5 17 9.5 11l4 4 7-7.5" /><path d="M15 7.5h5.5V13" /></>,
  gift: <><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M3.5 9h17M12 9v11M12 9c-1.5-3-5-3.5-5-1.5S10 9 12 9zm0 0c1.5-3 5-3.5 5-1.5S14 9 12 9z" /></>,
  // ไอคอนหมวดที่ผู้ใช้เพิ่มเอง (บอร์ด LogCats)
  'n-clock': <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  'n-heart': <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />,
  'n-basket': <><path d="M4 7h16l-1.5 12h-13z" /><path d="M9 7V5h6v2" /></>,
  'n-house': <path d="M3 17h18M6 17V9l6-4 6 4v8" />,
  'n-bike': <><circle cx="7" cy="17" r="3" /><circle cx="17" cy="17" r="3" /><path d="M7 17 11 8h4l2 9M9 8h4" /></>,
  'n-up': <path d="M12 3v18M6 8l6-5 6 5" />
};
export const NEW_CAT_ICONS = ['n-clock', 'n-heart', 'n-basket', 'n-house', 'n-bike', 'n-up'];
export const NEW_CAT_BGS = ['#FCE9DF', '#E4EEF8', '#E6F2EA', '#F6E4EF', '#FFF1D6', '#ECE6F7', '#FBE3E3', '#E8F3E4'];

export function CatIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[icon] ?? P.other}
    </svg>
  );
}

// สีพื้น/เส้นของหมวดในโหมดมืด (คู่จากบอร์ด LogCalendarDark · สีที่ไม่มีในบอร์ดเทียบโทนเดียวกัน)
const DARK: Record<string, string> = {
  '#FCE9DF': '#432B1E', '#A6461F': '#EBA284', '#F3E6D8': '#41301D', '#7A4A22': '#E2B48D', '#E6F2EA': '#213F2B', '#2F6B47': '#8FCCA3',
  '#E4EEF8': '#1E3043', '#2A5F8F': '#8FBAE1', '#E3EFE6': '#233D29', '#ECE6F7': '#2B1E43', '#5B3FA0': '#AA97D8', '#EEF8C4': '#39401D',
  '#3D4A1E': '#C5D798', '#FBE3E3': '#431E1E', '#A63D3D': '#DA9595', '#F6E4EF': '#431E34', '#93306A': '#DE92BE', '#F1F1EC': '#1E3227',
  '#46534B': '#BAC4BB', '#FFF1D6': '#3D3019', '#8A5A00': '#E2B866', '#E3EEFA': '#1E3043', '#E8F3E4': '#22381E', '#3C6B2A': '#A9CF8F',
  '#16231C': '#F2F4EF'
};
/** สีหมวด: ใส่ทั้งสองโหมด ใช้คู่กับ class cat-ic */
export const catStyle = (c?: Pick<LogCategory, 'bg' | 'fg'> | null): CSSProperties => {
  const bg = c?.bg ?? '#F1F1EC', fg = c?.fg ?? '#46534B';
  return { '--cb': bg, '--cf': fg, '--cbd': DARK[bg.toUpperCase()] ?? '#1E3227', '--cfd': DARK[fg.toUpperCase()] ?? '#F2F4EF' } as CSSProperties;
};
