import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocDB } from './db';
import { ensureDefaults } from './defaults';
import { addCategory, addEntry, linkCategoryFirst, moveCategory, repeatEntry, setCategoryLinks, toggleCategoryHidden, updateEntry } from './logActions';
import { B, item } from '../calc/testkit';

let n = 0;
let cur: AllocDB;
afterEach(async () => { await cur?.delete(); });
const fresh = async () => { cur = new AllocDB(`log-${n++}`); await ensureDefaults(cur, 1); return cur; };

describe('บันทึก', () => {
  it('หมวดตั้งต้น: รายจ่าย 11 รายรับ 6', async () => {
    const d = await fresh();
    expect(await d.logCategories.where('type').equals('expense').count()).toBe(11);
    expect(await d.logCategories.where('type').equals('income').count()).toBe(6);
  });

  it('เพิ่ม แก้ จดซ้ำวันนี้', async () => {
    const d = await fresh();
    const e = await addEntry(d, { type: 'expense', amount: B(189.5), categoryId: 'c-household', date: '2026-10-17', note: ' แชมพู ' });
    expect(e).toMatchObject({ amountPaid: B(189.5), myShare: B(189.5), note: 'แชมพู' });
    await updateEntry(d, e.id, { type: 'expense', amount: B(200), categoryId: 'c-shopping', date: '2026-10-17', note: 'แชมพู' });
    expect(await d.logEntries.get(e.id)).toMatchObject({ amountPaid: B(200), myShare: B(200), categoryId: 'c-shopping' });
    const r = await repeatEntry(d, e.id, '2026-10-18');
    expect(r).toMatchObject({ date: '2026-10-18', amountPaid: B(200), categoryId: 'c-shopping', note: 'แชมพู' });
  });

  it('แก้ยอดรายการที่หาร: ส่วนของฉันตามสัดส่วนเดิม', async () => {
    const d = await fresh();
    await d.logEntries.add({ id: 'x', createdAt: 0, updatedAt: 0, date: '2026-10-17', type: 'expense', amountPaid: B(845), myShare: B(422.5), categoryId: 'c-household', note: '', billItemId: 'b1' });
    await updateEntry(d, 'x', { type: 'expense', amount: B(900), categoryId: 'c-household', date: '2026-10-17', note: '' });
    expect((await d.logEntries.get('x'))!.myShare).toBe(B(450));
  });

  it('ใช้หมวดใหม่กับรายการในแผน: ขึ้นเป็นหมวดแรก', async () => {
    const d = await fresh();
    const it1 = item('fixed', 'ค่าเน็ต', 599, { logCategoryIds: ['c-other'] });
    await d.planItems.put(it1);
    await linkCategoryFirst(d, it1.id, 'c-bill');
    expect((await d.planItems.get(it1.id))!.logCategoryIds).toEqual(['c-bill', 'c-other']);
  });

  it('จัดหมวด: เพิ่มต่อท้าย เลื่อน ซ่อน ผูกแผน', async () => {
    const d = await fresh();
    const c = await addCategory(d, { type: 'expense', name: 'ค่าหมอ', icon: 'n-heart', bg: '#FBE3E3', fg: '#16231C' });
    expect(c.order).toBe(11);
    await moveCategory(d, c.id, -1);
    const list = (await d.logCategories.where('type').equals('expense').toArray()).sort((a, b) => a.order - b.order);
    expect(list.slice(-2).map((x) => x.name)).toEqual(['ค่าหมอ', 'สัตว์เลี้ยง']);
    await toggleCategoryHidden(d, c.id);
    expect((await d.logCategories.get(c.id))!.hidden).toBe(true);
    const a = item('variable', 'ยา', 300), b = item('variable', 'ยิม', 900, { logCategoryIds: [c.id] });
    await d.planItems.bulkPut([a, b]);
    await setCategoryLinks(d, c.id, [a.id]);
    expect([(await d.planItems.get(a.id))!.logCategoryIds, (await d.planItems.get(b.id))!.logCategoryIds]).toEqual([[c.id], []]);
  });
});

describe('แก้/ลบหมวด', () => {
  it('แก้ชื่อหมวดที่แอปมีให้', async () => {
    const { updateCategory } = await import('./logActions');
    const d = await fresh();
    await updateCategory(d, 'c-fun', { name: ' สตรีมมิ่ง ' });
    expect((await d.logCategories.get('c-fun'))!.name).toBe('สตรีมมิ่ง');
  });

  it('ลบหมวด: รายการย้ายไป อื่น ๆ · เอาออกจากแผน · อื่น ๆ ลบไม่ได้', async () => {
    const { deleteCategory } = await import('./logActions');
    const d = await fresh();
    await addEntry(d, { type: 'expense', amount: B(220), categoryId: 'c-fun', date: '2026-10-05', note: 'ดูหนัง' });
    const it1 = item('variable', 'บันเทิง', 500, { logCategoryIds: ['c-fun', 'c-drink'] });
    await d.planItems.put(it1);
    expect(await deleteCategory(d, 'c-fun')).toBe(1);
    expect(await d.logCategories.get('c-fun')).toBeUndefined();
    expect((await d.logEntries.toArray())[0].categoryId).toBe('c-other');
    expect((await d.planItems.get(it1.id))!.logCategoryIds).toEqual(['c-drink']);
    expect(await deleteCategory(d, 'c-other')).toBe(0);
    expect(await d.logCategories.get('c-other')).toBeDefined();
  });
});
