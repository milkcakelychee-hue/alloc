// ข้อมูลที่หน้าแผนใช้ (อัปเดตสดจาก IndexedDB)
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

export function usePlanData() {
  return useLiveQuery(async () => {
    const [settings, groups, items, accounts, categories, goals, adjustments] = await Promise.all([
      db.settings.get('app'),
      db.planGroups.orderBy('order').toArray(),
      db.planItems.toArray(),
      db.accounts.orderBy('order').toArray(),
      db.logCategories.orderBy('order').toArray(),
      db.goals.toArray(),
      db.goalAdjustments.toArray()
    ]);
    items.sort((a, b) => a.order - b.order);
    return { settings, groups, items, accounts, categories, goals, adjustments };
  }, []);
}

export type PlanData = NonNullable<ReturnType<typeof usePlanData>>;
