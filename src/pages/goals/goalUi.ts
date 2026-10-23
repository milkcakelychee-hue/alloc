// ค่าแสดงผลร่วมของแท็บเป้าหมาย (ตามบอร์ด Goals / GoalSavings / GoalInvest / GoalPVD / GoalSpend)
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Goal, GoalType } from '../../db/types';
import type { IconName } from '../plan/planUi';
import { formatBaht } from '../../calc/money';

/** สีของเป้า: วง / พื้นวง / ลายคาดการณ์ / ตัวเลข % (สีจากบอร์ด + เพิ่มให้ครบ 8) */
export const GOAL_COLORS: { id: string; label: string; ring: string; track: string; hatch: string; text: string }[] = [
  { id: 'green', label: 'เขียว', ring: '#3E7D5A', track: '#E3EFE6', hatch: '#9DBFA6', text: '#3E7D5A' },
  { id: 'gold', label: 'ทอง', ring: '#9A7B3C', track: '#F3EEDF', hatch: '#D2BE8E', text: '#7E6430' },
  { id: 'blue', label: 'น้ำเงิน', ring: '#2A5F8F', track: '#E4EEF8', hatch: '#A9C6E2', text: '#2A5F8F' },
  { id: 'amber', label: 'เหลือง', ring: '#DBAA34', track: '#F7EBCB', hatch: '#E8CB7E', text: '#8A6212' },
  { id: 'brown', label: 'ส้มอิฐ', ring: '#C7752E', track: '#FAEBDD', hatch: '#E0B48A', text: '#8A4B14' },
  { id: 'teal', label: 'เขียวน้ำทะเล', ring: '#2C7F7B', track: '#DDF0EE', hatch: '#97CBC7', text: '#226663' },
  { id: 'rose', label: 'ชมพู', ring: '#B5506A', track: '#F7E4E9', hatch: '#E0A9B7', text: '#9A3F57' },
  { id: 'purple', label: 'ม่วง', ring: '#6A55B5', track: '#ECE8F8', hatch: '#B9AEE2', text: '#5543A0' }
];
export const colorOf = (id: string) => GOAL_COLORS.find((c) => c.id === id) ?? GOAL_COLORS[0];

export const GOAL_ICONS: IconName[] = ['shield', 'box', 'coins', 'piggy', 'trend', 'plane', 'home', 'car', 'laptop', 'edu', 'card', 'heart', 'ring', 'gift', 'pet', 'flag'];

/** แอปเลือกให้ตามหมวด: สีแรกที่ยังไม่มีเป้าในหมวดนั้นใช้ */
const DEFAULT_ORDER: Record<GoalType, string[]> = {
  saving: ['green', 'gold', 'teal', 'rose', 'purple', 'blue', 'amber', 'brown'],
  invest: ['blue', 'amber', 'purple', 'teal', 'green', 'gold', 'rose', 'brown'],
  goalSpend: ['brown', 'rose', 'teal', 'purple', 'amber', 'gold', 'blue', 'green'],
  pvd: ['green']
};
const DEFAULT_ICON: Record<GoalType, IconName> = { saving: 'shield', invest: 'trend', goalSpend: 'plane', pvd: 'bank' };
export function pickStyle(type: GoalType, goals: Goal[]) {
  const used = new Set(goals.filter((g) => g.type === type).map((g) => g.color));
  const color = DEFAULT_ORDER[type].find((c) => !used.has(c)) ?? DEFAULT_ORDER[type][0];
  const usedIcons = new Set(goals.filter((g) => g.type === type).map((g) => g.icon));
  const icon = usedIcons.has(DEFAULT_ICON[type]) && type === 'saving' ? (['box', 'coins', 'piggy'] as IconName[]).find((i) => !usedIcons.has(i)) ?? 'piggy' : DEFAULT_ICON[type];
  return { color, icon };
}

export const CAT: Record<GoalType, { name: string; icon: IconName; path: string }> = {
  saving: { name: 'เงินออม', icon: 'coins', path: 'saving' },
  invest: { name: 'ลงทุน', icon: 'trend', path: 'invest' },
  goalSpend: { name: 'รายจ่ายตามเป้าหมาย', icon: 'flag', path: 'spend' },
  pvd: { name: 'PVD', icon: 'bank', path: 'pvd' }
};
export const typeOfPath = (p: string | undefined): GoalType | null =>
  (Object.keys(CAT) as GoalType[]).find((t) => CAT[t].path === p) ?? null;

/** ตัวเลขในหน้าเป้า: เต็มบาทไม่มีทศนิยม มีเศษแสดง 2 ตำแหน่ง */
export const baht = (s: number) => (s % 100 === 0 ? formatBaht(s, { decimals: false }) : formatBaht(s));
export const pctText = (p: number) => `${Math.floor(Math.max(p, 0) * 100)}%`;
export const barW = (p: number) => `${Math.min(Math.max(p, 0), 1) * 100}%`;

export function useGoalsData() {
  return useLiveQuery(async () => {
    const [settings, goals, adjustments, items, groups, receipts] = await Promise.all([
      db.settings.get('app'), db.goals.toArray(), db.goalAdjustments.toArray(), db.planItems.toArray(),
      db.planGroups.orderBy('order').toArray(), db.payReceipts.toArray()
    ]);
    goals.sort((a, b) => a.createdAt - b.createdAt);
    adjustments.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
    items.sort((a, b) => a.order - b.order);
    return { settings, goals, adjustments, items, groups, receipts };
  }, []);
}
export type GoalsData = NonNullable<ReturnType<typeof useGoalsData>>;
