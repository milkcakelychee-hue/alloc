// ตัวช่วยสร้างข้อมูลสมมติสำหรับเทส (ตัวเลขทั้งหมดมาจาก TEST_CASES.md ไม่ใช่ข้อมูลจริง)
import { DEFAULT_GROUPS } from '../db/defaults';
import type { Goal, GoalAdjustment, LogEntry, PlanGroup, PlanItem } from '../db/types';

export const B = (baht: number) => Math.round(baht * 100); // บาท → สตางค์ ใช้เฉพาะเขียนเทสให้อ่านง่าย

export const groups: PlanGroup[] = DEFAULT_GROUPS.map((g, i) => ({ ...g, order: i, enabled: true, createdAt: 0, updatedAt: 0 }));
const gid = (kind: string) => groups.find((g) => g.kind === kind)!.id;

let seq = 0;
export function item(kind: string, name: string, baht: number, extra: Partial<PlanItem> = {}): PlanItem {
  return {
    id: `i${seq++}`, createdAt: 0, updatedAt: 0, groupId: gid(kind), name, icon: 'other',
    defaultAmount: B(baht), monthOverrides: {}, period: { start: '2026-01', endMode: 'none' },
    accountId: null, goalId: null, logCategoryIds: [], order: seq, dueDay: null, ...extra
  };
}

export function goal(type: Goal['type'], name: string, target: number, opening: number, extra: Partial<Goal> = {}): Goal {
  return {
    id: `goal-${seq++}`, createdAt: 0, updatedAt: 0, type, name, icon: 'goal', color: '', target: B(target),
    dueMonth: null, note: '', openingBalance: B(opening), closed: false, ...extra
  };
}

export function adj(goalId: string, baht: number, kind: GoalAdjustment['kind'] = 'correction'): GoalAdjustment {
  return { id: `a${seq++}`, createdAt: 0, updatedAt: 0, goalId, date: '2026-10-01', delta: B(baht), kind, reason: '' };
}

export function entry(date: string, categoryId: string, paid: number, share = paid, extra: Partial<LogEntry> = {}): LogEntry {
  return {
    id: `e${seq++}`, createdAt: 0, updatedAt: 0, date, type: 'expense', amountPaid: B(paid), myShare: B(share),
    categoryId, note: '', billItemId: null, ...extra
  };
}
