import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocDB, SCHEMA_VERSION } from './db';
import { deletePerson, ensureDefaults } from './defaults';
import { ME_ID } from './types';

let n = 0;
const fresh = () => new AllocDB(`test-${n++}`);
let cur: AllocDB;
afterEach(async () => { await cur?.delete(); });

describe('ข้อมูลตั้งต้น', () => {
  it('สร้าง settings, "ฉัน", หมวดใหญ่ 6 หมวด, หมวดบันทึก 11 หมวด', async () => {
    cur = fresh();
    await ensureDefaults(cur, 1);
    const s = await cur.settings.get('app');
    expect(s).toMatchObject({ payday: 27, theme: 'system', schemaVersion: SCHEMA_VERSION, lastBackupAt: null });
    expect((await cur.people.get(ME_ID))?.name).toBe('ฉัน');
    expect((await cur.planGroups.orderBy('order').toArray()).map((g) => g.kind))
      .toEqual(['income', 'fixed', 'variable', 'goalSpend', 'saving', 'invest']);
    expect(await cur.logCategories.count()).toBe(11);
  });

  it('รันซ้ำไม่ทับสิ่งที่ผู้ใช้แก้', async () => {
    cur = fresh();
    await ensureDefaults(cur, 1);
    await cur.settings.update('app', { payday: 25 });
    await cur.logCategories.update('c-food', { name: 'ข้าว' });
    await ensureDefaults(cur, 2);
    expect((await cur.settings.get('app'))?.payday).toBe(25);
    expect((await cur.logCategories.get('c-food'))?.name).toBe('ข้าว');
  });

  it('ลบ "ฉัน" ไม่ได้', async () => {
    cur = fresh();
    await ensureDefaults(cur, 1);
    await expect(deletePerson(cur, ME_ID)).rejects.toThrow();
    expect(await cur.people.get(ME_ID)).toBeTruthy();
  });
});
