// ค่าแสดงผลร่วมของหน้าแผน
import type { GroupKind, Month } from '../../db/types';
import type { P } from '../../components/Icon';

export type IconName = keyof typeof P;

// โทนสีหมวดใหญ่: หัวการ์ด + ไอคอน (โหมดมืดใช้โทนเกือบดำของหมวดนั้น ผ่าน token --g-*)
export const TONE: Record<GroupKind, string> = {
  income: 'income', fixed: 'expense', variable: 'expense', goalSpend: 'goal', saving: 'save', invest: 'save'
};

export const ITEM_ICONS: { name: IconName; label: string }[] = [
  { name: 'food', label: 'อาหาร' }, { name: 'home', label: 'บ้าน' }, { name: 'travel', label: 'เดินทาง' },
  { name: 'shop', label: 'ซื้อของ' }, { name: 'card', label: 'บัตร' }, { name: 'sub', label: 'สมาชิก' },
  { name: 'salary', label: 'เงินเดือน' }, { name: 'piggy', label: 'ออม' }, { name: 'trend', label: 'ลงทุน' },
  { name: 'phone', label: 'โทรศัพท์' }, { name: 'health', label: 'สุขภาพ' }, { name: 'edu', label: 'การศึกษา' },
  { name: 'pet', label: 'สัตว์เลี้ยง' }, { name: 'gift', label: 'ของขวัญ' }, { name: 'other', label: 'อื่น ๆ' }
];
export const QUICK_ICONS: IconName[] = ['food', 'home', 'travel', 'shop', 'card', 'sub'];
const CAT_ICON: Record<string, IconName> = {
  food: 'food', drink: 'food', travel: 'travel', household: 'home', shopping: 'shop', health: 'health',
  fun: 'sub', other: 'other', bill: 'bill', edu: 'edu', pet: 'pet'
};
export const catIconOf = (name: string): IconName => CAT_ICON[name] ?? 'other';
export const iconOf = (name: string): IconName => (ITEM_ICONS.some((i) => i.name === name) ? (name as IconName) : 'other');

const TH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** '2026-10' → 'ตุลาคม 2569' */
export const thaiMonthLong = (m: Month) => {
  const [y, mo] = m.split('-').map(Number);
  return `${TH_FULL[mo - 1]} ${y + 543}`;
};

export const groupAddLabel: Record<GroupKind, string> = {
  income: 'เพิ่มรายรับ', fixed: 'เพิ่มรายจ่ายคงที่', variable: 'เพิ่มรายจ่ายผันแปร',
  goalSpend: 'เพิ่มรายจ่ายตามเป้าหมาย', saving: 'เพิ่มรายการออม', invest: 'เพิ่มรายการลงทุน'
};
