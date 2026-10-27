import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocDB } from './db';
import { ensureDefaults } from './defaults';
import { addAccount, applyHideOnOpen, clearAllData, deleteAccount, renameAccount, reorderAccounts } from './settingsActions';
import { addEntry } from './logActions';
import { B, item } from '../calc/testkit';

let n = 0;
let cur: AllocDB;
afterEach(async () => { await cur?.delete(); });
const fresh = async () => { cur = new AllocDB(`set-${n++}`); await ensureDefaults(cur, 1); return cur; };

describe('ตั้งค่า', () => {
  it('บัญชีปลายทาง: เพิ่ม เปลี่ยนชื่อ เรียง', async () => {
    const d = await fresh();
    const a = (await addAccount(d, ' บัญชีบ้าน '))!;
    const b = (await addAccount(d, 'บัญชีออม'))!;
    expect(await addAccount(d, '  ')).toBeNull();
    await renameAccount(d, a.id, 'บัญชีบ้านใหม่');
    await reorderAccounts(d, [b.id, a.id]);
    const list = await d.accounts.orderBy('order').toArray();
    expect(list.map((x) => x.name)).toEqual(['บัญชีออม', 'บัญชีบ้านใหม่']);
  });

  it('ลบบัญชี: รายการที่โอนเข้าบัญชีนี้กลับเป็นไม่โอน ยอดเท่าเดิม', async () => {
    const d = await fresh();
    const a = (await addAccount(d, 'บัญชีบ้าน'))!;
    const it1 = item('fixed', 'ค่าบ้าน', 9000.75, { accountId: a.id });
    await d.planItems.add(it1);
    await deleteAccount(d, a.id);
    expect(await d.accounts.count()).toBe(0);
    expect(await d.planItems.get(it1.id)).toMatchObject({ accountId: null, defaultAmount: B(9000.75) });
  });

  it('ซ่อนตัวเลขตอนเปิดแอป', async () => {
    const d = await fresh();
    await applyHideOnOpen(d);
    expect((await d.settings.get('app'))!.hideNumbers).toBe(false);
    await d.settings.update('app', { hideOnOpen: true });
    await applyHideOnOpen(d);
    expect((await d.settings.get('app'))!.hideNumbers).toBe(true);
  });

  it('ล้างข้อมูลทั้งหมด: เหลือแค่ค่าตั้งต้น และกลับไปหน้าเริ่มใช้งาน', async () => {
    const d = await fresh();
    await d.settings.update('app', { onboardedAt: 5, receiveInfo: 'x' });
    await d.planItems.add(item('fixed', 'ค่าบ้าน', 100));
    await addEntry(d, { type: 'expense', amount: B(50), categoryId: 'c-food', date: '2026-10-01', note: '' });
    await addAccount(d, 'บัญชีบ้าน');
    await clearAllData(d);
    expect(await d.planItems.count()).toBe(0);
    expect(await d.logEntries.count()).toBe(0);
    expect(await d.accounts.count()).toBe(0);
    expect(await d.planGroups.count()).toBe(6);
    expect(await d.logCategories.count()).toBe(17);
    expect(await d.settings.get('app')).toMatchObject({ onboardedAt: null, receiveInfo: '' });
  });
});
