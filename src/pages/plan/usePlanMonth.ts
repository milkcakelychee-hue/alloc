// "เดือนนี้" ของหน้าแผน: ติ๊กจ่ายครบทุกรายการของรอบนี้แล้ว → แผนไปเดือนถัดไปเลย (เจ้าของขอ 11 พ.ย. 69)
// เลื่อนแค่หน้าแผน (มือถือและคอม) · หน้าหลัก บันทึก ยอดเป้า ยังนับตามรอบเงินเดือน
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Month } from '../../db/types';
import { appCycle, localToday } from '../../calc/dates';
import { goalAwareAmountOf } from '../../calc/goals';
import { planMonth } from '../../calc/planEdit';
import type { PlanData } from './usePlanData';

export function usePlanMonth(data: PlanData | undefined): { cycle: Month; planCur: Month } | null {
  const s = data?.settings;
  const cycle = s ? appCycle(localToday(), s.pay, s.startCycle) : null;
  const checks = useLiveQuery(() => (cycle ? db.paidChecks.where('cycleMonth').equals(cycle).toArray() : []), [cycle]);
  if (!data || !cycle || !checks) return null;
  const done = new Set(checks.filter((c) => c.checked).map((c) => c.planItemId));
  const amountOf = goalAwareAmountOf(data.goals, data.items, data.adjustments, cycle);
  return { cycle, planCur: planMonth(cycle, data.groups, data.items, done, amountOf) };
}
