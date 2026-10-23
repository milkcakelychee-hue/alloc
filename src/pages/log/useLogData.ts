// ข้อมูลที่หน้าบันทึกใช้ (อัปเดตสดจาก IndexedDB)
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

export function useLogData() {
  return useLiveQuery(async () => {
    const [settings, entries, categories, items, groups, goals, adjustments, receipts] = await Promise.all([
      db.settings.get('app'), db.logEntries.toArray(), db.logCategories.orderBy('order').toArray(), db.planItems.toArray(),
      db.planGroups.orderBy('order').toArray(), db.goals.toArray(), db.goalAdjustments.toArray(), db.payReceipts.toArray()
    ]);
    entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    items.sort((a, b) => a.order - b.order);
    return { settings, entries, categories, items, groups, goals, adjustments, receipts };
  }, []);
}
export type LogData = NonNullable<ReturnType<typeof useLogData>>;

const TH_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const dayFull = (w: number) => TH_DAY[w];
