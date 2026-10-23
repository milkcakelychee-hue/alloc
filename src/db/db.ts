import Dexie, { type Table } from 'dexie';
import type {
  Account, Bill, BillItem, Goal, GoalAdjustment, LogCategory, LogEntry, PaidCheck, Payment, PayReceipt, Person, PlanGroup, PlanItem, Settings
} from './types';
import { migrateV1toV2 } from './migrations';

// เลขเวอร์ชันโครงข้อมูล: เก็บใน settings และในไฟล์สำรอง · เพิ่มเมื่อเปลี่ยนโครงตาราง แล้วเขียน migration ใน migrations.ts
export const SCHEMA_VERSION = 2;

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
  payReceipts!: Table<PayReceipt, string>;

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
    // v2: กฎวันเงินเดือนเข้า + วันครบกำหนดของรายการ + ประวัติเงินเข้าจริง
    this.version(2).stores({ payReceipts: 'id' }).upgrade(async (tx) => {
      const settings = await tx.table('settings').toArray();
      const items = await tx.table('planItems').toArray();
      const out = migrateV1toV2({ settings, planItems: items });
      await tx.table('settings').bulkPut(out.settings);
      await tx.table('planItems').bulkPut(out.planItems);
    });
  }
}

export const TABLES = [
  'settings', 'accounts', 'planGroups', 'planItems', 'paidChecks', 'goals', 'goalAdjustments',
  'logCategories', 'logEntries', 'people', 'bills', 'billItems', 'payments', 'payReceipts'
] as const;
export type TableName = (typeof TABLES)[number];

export const db = new AllocDB();
