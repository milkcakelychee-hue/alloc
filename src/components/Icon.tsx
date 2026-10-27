// ไอคอนเส้น (stroke 1.8–2) ตามต้นแบบ · ห้ามใช้อิโมจิ
import type { ReactNode } from 'react';

export const P: Record<string, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  goal: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  log: <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  settings: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  theme: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  plan: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  bill: <><path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" /><path d="M9 8.5h6M9 12h6" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  back: <path d="m15 5-7 7 7 7" />,
  check: <path d="m5 12 5 5 9-10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  restore: <><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4h4M12 8v4l3 2" /></>,
  backup: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4.5 17v2.5h15V17" /></>,
  upload: <><path d="M12 20V9M7.5 13.5 12 9l4.5 4.5" /><path d="M4.5 7V4.5h15V7" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></>,
  bag: <><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  share: <><path d="M12 3.5v11M8 7.5l4-4 4 4" /><path d="M6.5 11H5v9.5h14V11h-1.5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  wallet: <><path d="M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M4 7.5 15 4v3.5M16 13.5h.01" /></>,
  history: <><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4h4M12 8v4l3 2" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  // ไอคอนรายการในแผน (ต้นแบบ PlanSheet)
  food: <><path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z" /><path d="M9 7c0-1.5 1-1.5 1-3M14 7c0-1.5 1-1.5 1-3" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M4 4l16 16M10.6 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6M6.6 7.5A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  shield: <path d="M12 3.5 19 6v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
  box: <path d="M4 8.5h16v11H4zM3 5h18v3.5H3zM10 12h4" />,
  flag: <path d="M5 21V4M5 4h11l-2 3.5 2 3.5H5" />,
  bank: <path d="M12 3.5 20 8H4zM5.5 10.5v7M10 10.5v7M14 10.5v7M18.5 10.5v7M3.5 20.5h17" />,
  coins: <><ellipse cx="12" cy="6.5" rx="7.5" ry="2.5" /><path d="M4.5 6.5v5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-5M4.5 11.5v5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-5" /></>,
  upRight: <path d="M7 17 17 7M9 7h8v8" />,
  arrowR: <path d="M5 12h14M13 6l6 6-6 6" />,
  plane: <path d="M10.5 20 12 15l-6-1-2 2-1.5-.5L4 12 2.5 8.5 4 8l2 2 6-1-1.5-5L12 3.5 16 9l4-.5a1.5 1.5 0 0 1 0 3L16 12l-4 5.5z" />,
  car: <><path d="M4 16v-4l2-5h12l2 5v4z" /><path d="M4 16v2.5M20 16v2.5M7.5 13h.01M16.5 13h.01" /></>,
  heart: <path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.5 4.2 4.2 0 0 1 19.5 10C19.5 15.5 12 20 12 20z" />,
  ring: <><circle cx="12" cy="14.5" r="6" /><path d="m9 4 3 4.5L15 4z" /></>,
  laptop: <><rect x="5" y="5" width="14" height="10" rx="1.5" /><path d="M3 19h18" /></>,
  travel: <><rect x="5" y="3.5" width="14" height="14" rx="3" /><path d="M5 11h14M8 20.5v-3M16 20.5v-3" /></>,
  shop: <><path d="M5 8h14l-1 12H6z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h3" /></>,
  sub: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3z" /></>,
  salary: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6.5 9.5v5M17.5 9.5v5" /></>,
  piggy: <><path d="M5 11a6 5 0 0 1 11.5-2H19v3l-1.5 1v3h-2.5l-.5 2h-3l-.5-1.5h-2L8.5 18h-3l-.5-3A5 5 0 0 1 5 11z" /><path d="M10 7.5h3" /></>,
  trend: <><path d="M3.5 17 9.5 11l4 4 7-7.5" /><path d="M15 7.5h5.5V13" /></>,
  gift: <><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M3 9h18M12 9v11M12 9c-2-4-6-3.5-5-1s5 1 5 1zM12 9c2-4 6-3.5 5-1s-5 1-5 1z" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 17.5h2" /></>,
  health: <path d="M12 20s-7.5-4.5-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 3c0 5.5-7.5 10-7.5 10z" />,
  edu: <><path d="M3 9.5 12 5l9 4.5-9 4.5z" /><path d="M7 11.5V16c2.5 2 7.5 2 10 0v-4.5" /></>,
  pet: <><circle cx="8" cy="8" r="1.8" /><circle cx="16" cy="8" r="1.8" /><circle cx="5" cy="12.5" r="1.6" /><circle cx="19" cy="12.5" r="1.6" /><path d="M12 12c3 0 5 3.5 4 5.5-1 1.5-2.5 1-4 1s-3 .5-4-1c-1-2 1-5.5 4-5.5z" /></>,
  other: <><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  more: <><circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" /></>,
  sort: <path d="M8 20V4M4.5 7.5 8 4l3.5 3.5M16 4v16M12.5 16.5 16 20l3.5-3.5" />,
  chevDown: <path d="m6 9 6 6 6-6" />,
  checkSq: <path d="m6 12.5 4 4 8-9" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>
};

type Props = { name: keyof typeof P; size?: number; stroke?: number; fill?: boolean };

export function Icon({ name, size = 22, stroke = 1.8, fill = false }: Props) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
