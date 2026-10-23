// เริ่มใหม่: ตั้งวันเงินเดือนเข้า + เงินเดือน (รายการแรกในหมวดรายรับ) แล้วผ่านหน้า Welcome
import type { AllocDB } from './db';
import { ensureDefaults } from './defaults';
import type { DateStr, PayRule, PlanItem, Satang, WeekendShift } from './types';
import { cycleOf } from '../calc/dates';

export async function startFresh(db: AllocDB, opts: { salary: Satang | null; pay: PayRule; weekendShift: WeekendShift; today: DateStr; now?: number }) {
  const now = opts.now ?? Date.now();
  await ensureDefaults(db, now);
  await db.transaction('rw', [db.settings, db.planGroups, db.planItems], async () => {
    await db.settings.update('app', { pay: opts.pay, weekendShift: opts.weekendShift, onboardedAt: now, updatedAt: now });
    if (opts.salary && opts.salary > 0) {
      const income = await db.planGroups.where('kind').equals('income').first();
      if (!income) throw new Error('ไม่พบหมวดรายรับ');
      const item: PlanItem = {
        id: crypto.randomUUID(), createdAt: now, updatedAt: now, groupId: income.id, name: 'เงินเดือน', icon: 'salary',
        defaultAmount: opts.salary, monthOverrides: {}, period: { start: cycleOf(opts.today, opts.pay), endMode: 'none' },
        accountId: null, goalId: null, logCategoryIds: [], order: 0, dueDay: null
      };
      await db.planItems.add(item);
    }
  });
}
