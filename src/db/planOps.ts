// เขียนการแก้แผนจากตารางบนคอมลงฐานข้อมูล (ทุกขั้นย้อนกลับได้ด้วย Op ใน calc/planEdit)
import type { AllocDB } from './db';
import type { Month, PaidCheck, PlanItem, Satang } from './types';
import { applyAmountChange } from '../calc/plan';
import type { Op } from '../calc/planEdit';

export async function writeOps(db: AllocDB, ops: Op[]) {
  if (!ops.length) return;
  await db.transaction('rw', db.planItems, db.paidChecks, async () => {
    for (const o of ops) {
      const t = o.table === 'planItems' ? db.planItems : db.paidChecks;
      if (o.after) await (t as typeof db.planItems).put({ ...(o.after as PlanItem), updatedAt: Date.now() });
      else await t.delete(o.id);
    }
  });
}

/** แก้ยอดหนึ่งช่อง → Op (ยังไม่เขียน) */
export function amountOp(item: PlanItem, m: Month, amount: Satang, scope: 'month' | 'from'): Op {
  return { table: 'planItems', id: item.id, before: item, after: { ...applyAmountChange(item, m, amount, scope), updatedAt: Date.now() } };
}

/** สลับติ๊กจ่ายแล้ว → Op (ติ๊กอย่างเดียว ไม่ลงบันทึก เหมือนมือถือ) */
export function tickOp(existing: PaidCheck | undefined, cycle: Month, itemId: string): Op {
  const id = `${cycle}|${itemId}`;
  if (existing?.checked) return { table: 'paidChecks', id, before: existing, after: null };
  const now = Date.now();
  return { table: 'paidChecks', id, before: existing ?? null, after: { id, cycleMonth: cycle, planItemId: itemId, checked: true, logEntryId: null, createdAt: now, updatedAt: now } };
}
