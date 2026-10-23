// โครงข้อมูลตาม SPEC หัวข้อ 5 · เงินทุกช่องเป็นสตางค์ (จำนวนเต็ม) · วันที่ 'YYYY-MM-DD' ค.ศ. · เดือน 'YYYY-MM'
// เดือนในแอปคือ "รอบเงินเดือน" ตั้งชื่อตามเดือนที่รอบสิ้นสุด (ดู calc/dates.ts)

export type Satang = number;
export type Month = string; // 'YYYY-MM'
export type DateStr = string; // 'YYYY-MM-DD'

export interface Base { id: string; createdAt: number; updatedAt: number }

export type ThemePref = 'light' | 'dark' | 'system';

export interface Settings extends Base {
  id: 'app';
  payday: number;
  theme: ThemePref;
  hideNumbers: boolean;
  lastBackupAt: number | null;
  schemaVersion: number;
  receiveInfo: string; // ข้อความช่องทางรับเงินในใบสรุปบิล ห้ามเก็บเลขบัตร/รหัส
}

export interface Account extends Base { name: string; order: number }

export type GroupKind = 'income' | 'fixed' | 'variable' | 'goalSpend' | 'saving' | 'invest';
export interface PlanGroup extends Base { kind: GroupKind; name: string; order: number; enabled: boolean }

export interface PlanPeriod {
  start: Month;
  endMode: 'goal' | 'month' | 'none';
  endMonth?: Month; // endMode 'month' นับเดือนนี้ด้วย
}

export interface PlanItem extends Base {
  groupId: string;
  name: string;
  icon: string;
  defaultAmount: Satang;
  monthOverrides: Record<Month, Satang>;
  period: PlanPeriod;
  accountId: string | null;
  goalId: string | null;
  logCategoryIds: string[];
  order: number;
}

export interface PaidCheck extends Base { cycleMonth: Month; planItemId: string; checked: boolean }

export type GoalType = 'saving' | 'invest' | 'goalSpend' | 'pvd';

// ยอดสมทบ PVD ต่อเดือน มีผลตั้งแต่เดือน from จนกว่าจะมีรายการใหม่
export interface PvdContribution { from: Month; mine: Satang; employer: Satang }

export interface Goal extends Base {
  type: GoalType;
  name: string;
  icon: string;
  color: string;
  target: Satang;
  dueMonth: Month | null;
  note: string;
  openingBalance: Satang;
  closed: boolean; // รายจ่ายตามเป้าหมาย: กด "ใช้เงินเที่ยวนี้แล้ว"
  contributions?: PvdContribution[]; // เฉพาะ PVD
}

export type AdjustmentKind = 'opening' | 'planDeposit' | 'withdraw' | 'correction' | 'employer' | 'spent';
export interface GoalAdjustment extends Base {
  goalId: string;
  date: DateStr;
  delta: Satang;
  kind: AdjustmentKind;
  reason: string;
  cycleMonth?: Month; // planDeposit/employer: รอบที่ฝาก กันสร้างซ้ำ
}

export type LogType = 'expense' | 'income';
export interface LogCategory extends Base { type: LogType; name: string; icon: string; bg: string; fg: string; order: number; hidden: boolean }

export interface LogEntry extends Base {
  date: DateStr;
  type: LogType;
  amountPaid: Satang; // จ่ายจริงทั้งก้อน
  myShare: Satang; // ส่วนของฉัน (ไม่ได้หาร = amountPaid)
  categoryId: string;
  note: string;
  billItemId: string | null;
}

export interface Person extends Base { name: string; icon: string; colorIndex: number; note: string }

export interface Bill extends Base { title: string; cycleMonth: Month; dateLabel: string; note: string; peopleIds: string[] }
export interface BillItem extends Base { billId: string; name: string; price: Satang; order: number; peopleIds: string[]; logEntryId: string | null }
export interface Payment extends Base { billId: string; personId: string; amount: Satang; date: DateStr; channel: 'transfer' | 'cash' }

export const ME_ID = 'me';
