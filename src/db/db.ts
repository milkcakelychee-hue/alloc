import Dexie, { type Table } from 'dexie';
import type {
  Account, Bill, BillItem, Goal, GoalAdjustment, LogCategory, LogEntry, PaidCheck, Payment, Person, PlanGroup, PlanItem, Settings
} from './types';

// เลขเวอร์ชันโครงข้อมูล: เก็บใน settings และในไฟล์สำรอง · เพิ่มเมื่อเปลี่ยนโครงตาราง แล้วเขียน migration ใน migrations.ts
export const SCHEMA_VERSION = 1;

export class AllocDB extends Dexie {
  settings!: Table<Settings, string>;
  accounts!: Table<Account, string>;
  planGroups!: Table<PlanGroup, string>;
  planItems!: Table<PlanItem, string>;
  paidChecks!: Table<PaidCheck, string>;
  goals!: Table<Goal, string>;
  goalAdjustments!: Table<GoalAdjustment, string>;
  logCategories!: Table<LogCategory, string>;
  logEntries!: Table<LogEntry, string>;
  people!: Table<Person, string>;
  bills!: Table<Bill, string>;
  billItems!: Table<BillItem, string>;
  payments!: Table<Payment, string>;

  constructor(name = 'alloc') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      accounts: 'id, order',
      planGroups: 'id, kind, order',
      planItems: 'id, groupId, accountId, goalId, *logCategoryIds',
      paidChecks: 'id, [cycleMonth+planItemId], cycleMonth',
      goals: 'id, type',
      goalAdjustments: 'id, goalId, date, [goalId+cycleMonth]',
      logCategories: 'id, type, order',
      logEntries: 'id, date, type, categoryId, billItemId',
      people: 'id',
      bills: 'id, cycleMonth',
      billItems: 'id, billId',
      payments: 'id, billId, personId'
    });
  }
}

export const TABLES = [
  'settings', 'accounts', 'planGroups', 'planItems', 'paidChecks', 'goals', 'goalAdjustments',
  'logCategories', 'logEntries', 'people', 'bills', 'billItems', 'payments'
] as const;
export type TableName = (typeof TABLES)[number];

export const db = new AllocDB();
