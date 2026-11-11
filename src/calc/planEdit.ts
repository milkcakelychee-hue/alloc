// แก้แผนในตารางบนคอม (ALLOC_DESKTOP_SPEC ข้อ 5–6) · ตัวคำนวณล้วน ไม่แตะฐานข้อมูล
import type { Month, PaidCheck, PlanGroup, PlanItem, Satang } from '../db/types';
import { addMonths } from './dates';
import { parseBaht } from './money';
import type { AmountOf } from './plan';

/** การเปลี่ยนหนึ่งแถว: before = null คือแถวใหม่ · after = null คือลบ */
export type Op =
  | { table: 'planItems'; id: string; before: PlanItem | null; after: PlanItem | null }
  | { table: 'paidChecks'; id: string; before: PaidCheck | null; after: PaidCheck | null };

export interface Step { label: string; ops: Op[] }
export interface History { done: Step[]; undone: Step[] }

export const emptyHistory = (): History => ({ done: [], undone: [] });
export const push = (h: History, s: Step): History => ({ done: [...h.done, s], undone: [] });
/** แทนขั้นล่าสุด (เปลี่ยนขอบเขตยอดหลังบันทึก): before ของขั้นเดิม + after ของขั้นใหม่ */
export function replaceLast(h: History, s: Step): History {
  const last = h.done[h.done.length - 1];
  if (!last) return push(h, s);
  const ops = s.ops.map((o) => {
    const prev = last.ops.find((p) => p.table === o.table && p.id === o.id);
    return (prev ? { ...o, before: prev.before } : o) as Op;
  });
  return { done: [...h.done.slice(0, -1), { label: s.label, ops }], undone: [] };
}

/** ย้อน n ขั้น: คืนประวัติใหม่ และ op ที่ต้องเขียน (ค่า before ย้อนลำดับ) */
export function undo(h: History, n = 1): { history: History; writes: Op[] } {
  const k = Math.min(n, h.done.length);
  const steps = h.done.slice(h.done.length - k).reverse();
  const writes = steps.flatMap((s) => [...s.ops].reverse().map((o) => ({ ...o, before: o.after, after: o.before }) as Op));
  return { history: { done: h.done.slice(0, h.done.length - k), undone: [...h.undone, ...steps] }, writes };
}

export function redo(h: History): { history: History; writes: Op[] } {
  const s = h.undone[h.undone.length - 1];
  if (!s) return { history: h, writes: [] };
  return { history: { done: [...h.done, s], undone: h.undone.slice(0, -1) }, writes: s.ops };
}

/** ค่าที่พิมพ์ในช่อง: ตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง · ว่าง = 0 */
export function parseCell(text: string): Satang | null {
  if (text.trim() === '') return 0;
  const v = parseBaht(text);
  return v === null || v < 0 ? null : v;
}

/** ติ๊กจ่ายแล้วได้: รายจ่าย ออม ลงทุน · เฉพาะเดือนของแผนปัจจุบัน · ยอดมากกว่า 0 */
export function canTick(kind: PlanGroup['kind'], m: Month, planMonth: Month, amount: Satang | null) {
  return kind !== 'income' && m === planMonth && amount !== null && amount > 0;
}

/** รายการที่ต้องติ๊กในเดือน m (กติกาเดียวกับ "ติ๊กว่าแบ่งเงินแล้ว" บนมือถือ) */
export function tickable(groups: PlanGroup[], items: PlanItem[], m: Month, amountOf: AmountOf) {
  const kinds = new Map(groups.filter((g) => g.enabled).map((g) => [g.id, g.kind]));
  return items.filter((i) => { const k = kinds.get(i.groupId); return !!k && k !== 'income' && amountOf(i, m) > 0; });
}

/**
 * เดือนที่หน้าแผนแสดงเป็น "เดือนนี้": ติ๊กครบทุกรายการของรอบปัจจุบันแล้ว → ไปเดือนถัดไปเลย
 * ถ้าไม่ติ๊กครบ เดือนเปลี่ยนเองเมื่อเงินเดือนเข้า (ตามรอบ) · เลื่อนแค่หน้าแผน ส่วนอื่นยังนับตามรอบ
 */
export function planMonth(cycle: Month, groups: PlanGroup[], items: PlanItem[], checkedIds: Set<string>, amountOf: AmountOf): Month {
  const list = tickable(groups, items, cycle, amountOf);
  return list.length > 0 && list.every((i) => checkedIds.has(i.id)) ? addMonths(cycle, 1) : cycle;
}
