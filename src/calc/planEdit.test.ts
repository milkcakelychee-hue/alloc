import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocDB } from '../db/db';
import { ensureDefaults } from '../db/defaults';
import { amountOp, tickOp, writeOps } from '../db/planOps';
import { canTick, emptyHistory, parseCell, planMonth, push, redo, replaceLast, undo, type Op } from './planEdit';
import { rawAmount } from './plan';
import { B, groups, item } from './testkit';

let n = 0;
let cur: AllocDB;
afterEach(async () => { await cur?.delete(); });
const fresh = async () => { cur = new AllocDB(`edit-${n++}`); await ensureDefaults(cur, 1); return cur; };

describe('ขอบเขตของยอด', () => {
  const food = item('variable', 'ค่ากิน', 4800);
  it('เฉพาะเดือนนี้: เดือนอื่นไม่เปลี่ยน', () => {
    const a = amountOp(food, '2026-11', B(5000), 'month').after!;
    expect(rawAmount(a as never, '2026-11')).toBe(B(5000));
    expect(rawAmount(a as never, '2026-10')).toBe(B(4800));
    expect(rawAmount(a as never, '2026-12')).toBe(B(4800));
  });
  it('ตั้งแต่เดือนนี้: เดือนก่อนคงเดิม เดือนหลังเปลี่ยนตาม', () => {
    const a = amountOp(food, '2026-11', B(5000), 'from').after!;
    expect(rawAmount(a as never, '2026-10')).toBe(B(4800));
    expect(rawAmount(a as never, '2026-11')).toBe(B(5000));
    expect(rawAmount(a as never, '2027-03')).toBe(B(5000));
  });
  it('เปลี่ยนขอบเขตหลังบันทึก: ย้อนครั้งเดียวกลับไปค่าก่อนแก้', () => {
    let h = push(emptyHistory(), { label: 'a', ops: [amountOp(food, '2026-11', B(5000), 'month')] });
    h = replaceLast(h, { label: 'b', ops: [amountOp(food, '2026-11', B(5000), 'from')] });
    expect(h.done).toHaveLength(1);
    const { writes } = undo(h);
    expect((writes[0].after as typeof food).defaultAmount).toBe(B(4800));
    expect((writes[0].after as typeof food).monthOverrides).toEqual({});
  });
});

describe('ย้อนกลับ', () => {
  it('ย้อนหลายขั้นรวมการลบ แล้วทำซ้ำได้', async () => {
    const d = await fresh();
    const a = item('fixed', 'ค่าเช่า', 8500);
    const b = item('variable', 'ค่ากิน', 4800);
    await d.planItems.bulkPut([a, b]);
    let h = emptyHistory();
    const run = async (label: string, ops: Op[]) => { await writeOps(d, ops); h = push(h, { label, ops }); };
    await run('แก้ค่าเช่า', [amountOp(a, '2026-11', B(9000), 'from')]);
    const a2 = (await d.planItems.get(a.id))!;
    await run('แก้ค่าเช่าอีก', [amountOp(a2, '2026-12', B(9500), 'month')]);
    await run('ลบค่ากิน', [{ table: 'planItems', id: b.id, before: b, after: null }]);
    expect(await d.planItems.get(b.id)).toBeUndefined();

    const u = undo(h, 3);
    await writeOps(d, u.writes);
    h = u.history;
    expect((await d.planItems.get(b.id))?.name).toBe('ค่ากิน');
    const back = (await d.planItems.get(a.id))!;
    expect(back.defaultAmount).toBe(B(8500));
    expect(back.monthOverrides).toEqual({});
    expect(h.done).toHaveLength(0);

    const r = redo(h);
    await writeOps(d, r.writes);
    expect((await d.planItems.get(a.id))!.defaultAmount).toBe(B(9000));
    expect(r.history.undone).toHaveLength(2);
  });

  it('แก้ใหม่หลังย้อน ล้างรายการทำซ้ำ', () => {
    const a = item('fixed', 'x', 1);
    let h = push(emptyHistory(), { label: '1', ops: [amountOp(a, '2026-11', 2, 'month')] });
    h = undo(h).history;
    h = push(h, { label: '2', ops: [amountOp(a, '2026-11', 3, 'month')] });
    expect(h.undone).toHaveLength(0);
  });

  it('ติ๊กแล้วย้อน = เอาติ๊กออก', async () => {
    const d = await fresh();
    const op = tickOp(undefined, '2026-11', 'i1');
    await writeOps(d, [op]);
    expect((await d.paidChecks.get('2026-11|i1'))?.checked).toBe(true);
    await writeOps(d, undo(push(emptyHistory(), { label: 't', ops: [op] })).writes);
    expect(await d.paidChecks.get('2026-11|i1')).toBeUndefined();
  });
});

describe('ติ๊กจ่ายแล้ว', () => {
  it('ได้เฉพาะเดือนของแผนปัจจุบัน และไม่ใช่รายรับ', () => {
    expect(canTick('variable', '2026-11', '2026-11', B(100))).toBe(true);
    expect(canTick('variable', '2026-12', '2026-11', B(100))).toBe(false); // ล่วงหน้า
    expect(canTick('variable', '2026-10', '2026-11', B(100))).toBe(false); // เดือนที่ผ่านแล้ว
    expect(canTick('income', '2026-11', '2026-11', B(100))).toBe(false);
    expect(canTick('saving', '2026-11', '2026-11', 0)).toBe(false);
    expect(canTick('saving', '2026-11', '2026-11', null)).toBe(false);
  });
});

describe('แผนข้ามไปเดือนถัดไปเมื่อติ๊กครบ', () => {
  const items = [item('income', 'เงินเดือน', 31000), item('fixed', 'ค่าเช่า', 8500), item('saving', 'ออม', 6000), item('variable', 'ไม่มียอด', 0)];
  it('ยังไม่ครบ = รอบเดิม', () => {
    expect(planMonth('2026-11', groups, items, new Set([items[1].id]), rawAmount)).toBe('2026-11');
  });
  it('ครบทุกรายการที่มียอด (ไม่นับรายรับและยอด 0) = เดือนถัดไป', () => {
    expect(planMonth('2026-11', groups, items, new Set([items[1].id, items[2].id]), rawAmount)).toBe('2026-12');
    expect(planMonth('2026-12', groups, items, new Set([items[1].id, items[2].id]), rawAmount)).toBe('2027-01');
  });
  it('ไม่มีรายการให้ติ๊ก = รอบเดิม', () => {
    expect(planMonth('2026-11', groups, [items[0]], new Set(), rawAmount)).toBe('2026-11');
  });
});

describe('ค่าที่พิมพ์ในช่อง', () => {
  it('รับตัวเลข ไม่รับตัวอักษรหรือติดลบ', () => {
    expect(parseCell('1,450.5')).toBe(B(1450.5));
    expect(parseCell('')).toBe(0);
    expect(parseCell('abc')).toBeNull();
    expect(parseCell('-5')).toBeNull();
    expect(parseCell('1.234')).toBeNull();
  });
});
