// การกระทำจากการ์ดในหน้าหลัก (docs/decisions.md)
import type { AllocDB } from './db';
import type { DateStr, GroupKind, LogEntry, Month, PlanItem, Satang } from './types';
import { addDays } from '../calc/dates';
import { applyAmountChange, rawAmount } from '../calc/plan';
import { syncDeposits } from './goalActions';

/**
 * ติ๊ก "จ่ายแล้ว" บนการ์ด: ติ๊กในแผน (จ่าย/โอนแล้ว) + บันทึกรายจ่ายในบันทึกให้อัตโนมัติ
 * ยอด = ยอดในแผน · หมวด = หมวดแรกที่ผูกไว้ ถ้าไม่ผูก = "อื่น ๆ" (นอกงบ)
 * รายการออม/ลงทุนไม่ใช่รายจ่าย: ติ๊กอย่างเดียว ไม่บันทึก
 */
export async function markDuePaid(db: AllocDB, opts: { item: PlanItem; kind: GroupKind; cycle: Month; amount: Satang; today: DateStr; now?: number }) {
  const now = opts.now ?? Date.now();
  const logs = opts.kind !== 'saving' && opts.kind !== 'invest';
  return db.transaction('rw', db.paidChecks, db.logEntries, async () => {
    let logEntryId: string | null = null;
    if (logs) {
      const entry: LogEntry = {
        id: crypto.randomUUID(), createdAt: now, updatedAt: now, date: opts.today, type: 'expense',
        amountPaid: opts.amount, myShare: opts.amount, categoryId: opts.item.logCategoryIds[0] ?? 'c-other',
        note: opts.item.name, billItemId: null, planItemId: opts.item.id, cycleMonth: opts.cycle
      };
      await db.logEntries.add(entry);
      logEntryId = entry.id;
    }
    await db.paidChecks.put({ id: `${opts.cycle}|${opts.item.id}`, cycleMonth: opts.cycle, planItemId: opts.item.id, checked: true, logEntryId, createdAt: now, updatedAt: now });
    return logEntryId;
  });
}

/** ลบรายการในบันทึก · ถ้าบันทึกมาจากการ์ด "จ่ายหรือยัง" ยกเลิกติ๊กจ่ายแล้วด้วย (การ์ดกลับมาถ้ายังอยู่ในช่วงครบกำหนด) */
export async function deleteLogEntry(db: AllocDB, id: string) {
  await db.transaction('rw', db.paidChecks, db.logEntries, async () => {
    await db.logEntries.delete(id);
    await db.paidChecks.filter((c) => c.logEntryId === id).delete();
  });
}

/** เงินเดือนเข้าแล้ว: เก็บวันที่และยอดจริง (ไม่แก้แผน) แล้วบวกยอดเป้าตามแผนของรอบนั้น */
export async function confirmPay(db: AllocDB, opts: { cycle: Month; date: DateStr; amount: Satang; now?: number }) {
  const now = opts.now ?? Date.now();
  await db.payReceipts.put({ id: opts.cycle, status: 'received', date: opts.date, amount: opts.amount, snoozeUntil: null, createdAt: now, updatedAt: now });
  await syncDeposits(db, opts.date, now);
}

/** ยังไม่เข้า: ถามอีกครั้งพรุ่งนี้ */
export async function snoozePay(db: AllocDB, opts: { cycle: Month; today: DateStr; now?: number }) {
  const now = opts.now ?? Date.now();
  await db.payReceipts.put({ id: opts.cycle, status: 'snoozed', date: null, amount: null, snoozeUntil: addDays(opts.today, 1), createdAt: now, updatedAt: now });
}

/**
 * ใช้ยอดเงินเดือนจริงในแผนเดือนนั้น (ผู้ใช้กดยืนยันแล้ว): แก้รายการรายรับที่ยอดสูงสุดของรอบนั้นเป็นยอดเฉพาะเดือน
 * ให้รายรับรวมของรอบเท่ายอดที่เข้าจริงบวกรายรับอื่น
 */
export function salaryItemFor(items: PlanItem[], incomeGroupIds: Set<string>, cycle: Month) {
  return items.filter((i) => incomeGroupIds.has(i.groupId)).sort((a, b) => rawAmount(b, cycle) - rawAmount(a, cycle))[0] ?? null;
}
export async function applyActualSalary(db: AllocDB, opts: { item: PlanItem; cycle: Month; actual: Satang; now?: number }) {
  await db.planItems.put({ ...applyAmountChange(opts.item, opts.cycle, opts.actual, 'month'), updatedAt: opts.now ?? Date.now() });
}

/**
 * เรียงรายการในหมวดใหม่จากการลาก: visibleIds คือลำดับใหม่ของรายการที่แสดงอยู่
 * รายการที่ซ่อน (ยอด 0) คงตำแหน่งเดิม · เขียน order ใหม่ทั้งหมวดเป็น 0..n
 */
export async function reorderPlanItems(db: AllocDB, groupId: string, visibleIds: string[], now = Date.now()) {
  const all = (await db.planItems.where('groupId').equals(groupId).toArray()).sort((a, b) => a.order - b.order);
  const vis = new Set(visibleIds);
  const queue = [...visibleIds];
  const next = all.map((it) => (vis.has(it.id) ? queue.shift()! : it.id));
  await db.transaction('rw', db.planItems, async () => {
    for (let i = 0; i < next.length; i++) {
      const it = all.find((x) => x.id === next[i])!;
      if (it.order !== i) await db.planItems.update(it.id, { order: i, updatedAt: now });
    }
  });
}
