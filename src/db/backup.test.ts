import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocDB, SCHEMA_VERSION, TABLES } from './db';
import { buildBackup, parseBackup, restoreBackup, summarize } from './backup';
import { ensureDefaults } from './defaults';
import { B, entry, goal, item } from '../calc/testkit';

let n = 0;
const dbs: AllocDB[] = [];
const fresh = () => { const d = new AllocDB(`backup-${n++}`); dbs.push(d); return d; };
afterEach(async () => { await Promise.all(dbs.splice(0).map((d) => d.delete())); });

async function seeded() {
  const d = fresh();
  await ensureDefaults(d, 1);
  await d.planItems.put(item('income', 'เงินเดือน', 31000));
  await d.goals.put(goal('saving', 'เงินสำรอง', 25000, 12000));
  await d.logEntries.put(entry('2026-10-18', 'c-food', 120));
  await d.settings.update('app', { theme: 'dark', receiveInfo: 'โอนผ่านพร้อมเพย์' });
  return d;
}

const dump = async (d: AllocDB) => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await d.table(t).toArray()])));

describe('สำรอง / กู้คืน', () => {
  it('สำรองแล้วกู้คืนในเครื่องใหม่ ได้ทุกตารางเหมือนเดิม', async () => {
    const a = await seeded();
    const text = JSON.stringify(await buildBackup(a, new Date('2026-10-23T05:00:00Z')));
    const b = fresh();
    await ensureDefaults(b, 2);
    await b.planItems.put(item('fixed', 'ของเดิมในเครื่องใหม่', 1));
    await restoreBackup(b, parseBackup(text));
    expect(await dump(b)).toEqual(await dump(a));
    expect((await b.settings.get('app'))?.theme).toBe('dark');
  });

  it('สรุปไฟล์ก่อนกู้คืน', async () => {
    const f = await buildBackup(await seeded(), new Date('2026-10-23T05:00:00Z'));
    expect(f.schemaVersion).toBe(SCHEMA_VERSION);
    expect(summarize(f)).toEqual({ exportedAt: '2026-10-23T05:00:00.000Z', planItems: 1, goals: 1, logEntries: 1, bills: 0 });
  });

  it('เงินยังเป็นสตางค์จำนวนเต็มหลังกู้คืน', async () => {
    const f = parseBackup(JSON.stringify(await buildBackup(await seeded())));
    expect((f.tables.planItems[0] as { defaultAmount: number }).defaultAmount).toBe(B(31000));
  });

  it('ไม่รับไฟล์อื่น ไฟล์เสีย หรือไฟล์จากเวอร์ชันใหม่กว่า', () => {
    expect(() => parseBackup('ไม่ใช่ json')).toThrow('อ่านไฟล์ไม่ได้');
    expect(() => parseBackup(JSON.stringify({ app: 'gym-bro', schema: 1, data: {} }))).toThrow('ไม่ใช่ไฟล์สำรองของ Alloc');
    expect(() => parseBackup(JSON.stringify({ app: 'alloc', schemaVersion: SCHEMA_VERSION + 1, tables: {} }))).toThrow('เวอร์ชันใหม่กว่า');
  });

  it('ไฟล์เก่าผ่าน migration ทีละเวอร์ชัน และตารางที่ขาดกลายเป็นว่าง', () => {
    const old = JSON.stringify({ app: 'alloc', schemaVersion: 1, exportedAt: 'x', tables: { people: [{ id: 'me', name: 'ฉัน' }] } });
    const migrations = { 1: (t: Record<string, unknown[]>) => ({ ...t, people: t.people.map((p) => ({ ...(p as object), note: 'ย้ายแล้ว' })) }) };
    const f = parseBackup(old, migrations, 2);
    expect(f.schemaVersion).toBe(2);
    expect(f.tables.people).toEqual([{ id: 'me', name: 'ฉัน', note: 'ย้ายแล้ว' }]);
    expect(f.tables.bills).toEqual([]);
    expect(() => parseBackup(old, {}, 2)).toThrow('ไม่มีวิธีแปลง');
  });
});

describe('migration v1 → v2', () => {
  it('ไฟล์สำรองเก่า: payday → กฎวันเงินเข้า · รายการได้ dueDay = null', () => {
    const v1 = JSON.stringify({ app: 'alloc', schemaVersion: 1, exportedAt: 'x', tables: {
      settings: [{ id: 'app', payday: 25, theme: 'dark' }],
      planItems: [{ id: 'i1', name: 'ค่าเน็ต', defaultAmount: 59900 }]
    } });
    const f = parseBackup(v1);
    expect(f.schemaVersion).toBe(2);
    expect(f.tables.settings[0]).toEqual({ id: 'app', theme: 'dark', pay: { kind: 'day', day: 25 }, weekendShift: 'before', payOverrides: {}, schemaVersion: 2 });
    expect(f.tables.planItems[0]).toMatchObject({ id: 'i1', dueDay: null });
    expect(f.tables.payReceipts).toEqual([]);
  });

  it('ฐานข้อมูลในเครื่อง v1 อัปเกรดเป็น v2 เองตอนเปิดแอป', async () => {
    const name = `upgrade-${n++}`;
    const Dexie = (await import('dexie')).default;
    const old = new Dexie(name);
    old.version(1).stores({ settings: 'id', planItems: 'id, groupId, accountId, goalId, *logCategoryIds' });
    await old.table('settings').put({ id: 'app', payday: 25, theme: 'system' });
    await old.table('planItems').put({ id: 'i1', groupId: 'g', logCategoryIds: [] });
    old.close();
    const d = new AllocDB(name); dbs.push(d);
    expect(await d.settings.get('app')).toMatchObject({ pay: { kind: 'day', day: 25 }, weekendShift: 'before' });
    expect((await d.planItems.get('i1'))?.dueDay).toBeNull();
  });
});
