// ข้อมูลตั้งต้นของแอป (ไม่ใช่ข้อมูลผู้ใช้): หมวดใหญ่ หมวดบันทึก และ "ฉัน"
// ใส่เฉพาะที่ยังไม่มี ไม่ทับสิ่งที่ผู้ใช้แก้แล้ว
import type { AllocDB } from './db';
import { SCHEMA_VERSION } from './db';
import { ME_ID, type GroupKind, type LogCategory, type PlanGroup, type Settings } from './types';

export const DEFAULT_GROUPS: { id: string; kind: GroupKind; name: string }[] = [
  { id: 'g-income', kind: 'income', name: 'รายรับ' },
  { id: 'g-fixed', kind: 'fixed', name: 'รายจ่ายคงที่' },
  { id: 'g-variable', kind: 'variable', name: 'รายจ่ายผันแปร' },
  { id: 'g-goalSpend', kind: 'goalSpend', name: 'รายจ่ายตามเป้าหมาย' },
  { id: 'g-saving', kind: 'saving', name: 'ออม' },
  { id: 'g-invest', kind: 'invest', name: 'ลงทุน' }
];

// สีหมวดบันทึก SPEC หัวข้อ 3 (พื้น / เส้น)
export const DEFAULT_EXPENSE_CATEGORIES: { id: string; name: string; icon: string; bg: string; fg: string }[] = [
  { id: 'c-food', name: 'อาหาร', icon: 'food', bg: '#FCE9DF', fg: '#A6461F' },
  { id: 'c-drink', name: 'เครื่องดื่ม', icon: 'drink', bg: '#F3E6D8', fg: '#7A4A22' },
  { id: 'c-travel', name: 'เดินทาง', icon: 'travel', bg: '#E4EEF8', fg: '#2A5F8F' },
  { id: 'c-household', name: 'ของใช้', icon: 'household', bg: '#E6F2EA', fg: '#2F6B47' },
  { id: 'c-shopping', name: 'ช้อปปิ้ง', icon: 'shopping', bg: '#F6E4EF', fg: '#93306A' },
  { id: 'c-health', name: 'สุขภาพ', icon: 'health', bg: '#FBE3E3', fg: '#A63D3D' },
  { id: 'c-fun', name: 'บันเทิง', icon: 'fun', bg: '#ECE6F7', fg: '#5B3FA0' },
  { id: 'c-other', name: 'อื่น ๆ', icon: 'other', bg: '#F1F1EC', fg: '#46534B' },
  { id: 'c-bill', name: 'บิล', icon: 'bill', bg: '#FFF1D6', fg: '#8A5A00' },
  { id: 'c-edu', name: 'การศึกษา', icon: 'edu', bg: '#E3EEFA', fg: '#2A5F8F' },
  { id: 'c-pet', name: 'สัตว์เลี้ยง', icon: 'pet', bg: '#E8F3E4', fg: '#3C6B2A' }
];

// ไอคอนของรายการในแผน → หมวดบันทึกเริ่มต้น (SPEC 6.4)
export const ICON_DEFAULT_CATEGORIES: Record<string, string[]> = {
  food: ['c-food', 'c-drink'],
  home: ['c-bill'],
  travel: ['c-travel'],
  shopping: ['c-household', 'c-shopping'],
  card: ['c-bill'],
  subscription: ['c-fun']
};

export const defaultSettings = (now: number): Settings => ({
  id: 'app', createdAt: now, updatedAt: now,
  payday: 27, theme: 'system', hideNumbers: false, lastBackupAt: null, schemaVersion: SCHEMA_VERSION, receiveInfo: '', onboardedAt: null
});

export async function ensureDefaults(db: AllocDB, now = Date.now()) {
  await db.transaction('rw', [db.settings, db.planGroups, db.logCategories, db.people], async () => {
    if (!(await db.settings.get('app'))) await db.settings.put(defaultSettings(now));
    if (!(await db.people.get(ME_ID))) {
      await db.people.put({ id: ME_ID, name: 'ฉัน', icon: 'letter', colorIndex: 0, note: '', createdAt: now, updatedAt: now });
    }
    if ((await db.planGroups.count()) === 0) {
      await db.planGroups.bulkPut(DEFAULT_GROUPS.map((g, i): PlanGroup => ({ ...g, order: i, enabled: true, createdAt: now, updatedAt: now })));
    }
    if ((await db.logCategories.count()) === 0) {
      await db.logCategories.bulkPut(DEFAULT_EXPENSE_CATEGORIES.map((c, i): LogCategory => ({
        ...c, type: 'expense', order: i, hidden: false, createdAt: now, updatedAt: now
      })));
    }
  });
}

// "ฉัน" ลบไม่ได้
export async function deletePerson(db: AllocDB, id: string) {
  if (id === ME_ID) throw new Error('ลบ "ฉัน" ไม่ได้');
  await db.people.delete(id);
}
