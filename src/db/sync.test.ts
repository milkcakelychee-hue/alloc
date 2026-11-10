import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocDB } from './db';
import { ensureDefaults } from './defaults';
import type { BackupFile } from './backup';
import { decide, resolveAsk, syncOnce, trackChanges, type Remote, type RemoteRow, type SyncMeta } from './sync';
import { entry, item } from '../calc/testkit';

let n = 0;
const dbs: AllocDB[] = [];
afterEach(async () => { await Promise.all(dbs.splice(0).map((d) => d.delete())); });

/** เครื่องหนึ่งเครื่อง: ฐานข้อมูล + สถานะซิงก์ + ตัวนับการแก้ */
async function device(onboard = true) {
  const db = new AllocDB(`sync-${n++}`); dbs.push(db);
  await ensureDefaults(db, 1);
  if (onboard) await db.settings.update('app', { onboardedAt: 1 });
  const meta: SyncMeta = {};
  trackChanges(db, () => { meta.dirty = true; });
  const kept: BackupFile[] = [];
  return { db, meta, kept };
}
type Dev = Awaited<ReturnType<typeof device>>;

/** เซิร์ฟเวอร์ปลอม: เก็บแถวเดียว */
function server() {
  let row: RemoteRow | null = null;
  const remote: Remote = {
    pull: async () => row,
    push: async (data, updatedAt) => { row = { data: JSON.parse(JSON.stringify(data)), updatedAt }; }
  };
  return { remote, get row() { return row; } };
}
const T = (m: number) => () => new Date(Date.UTC(2026, 10, 1, 0, m));
const run = (d: Dev, s: ReturnType<typeof server>, minute: number) =>
  syncOnce({ db: d.db, remote: s.remote, meta: d.meta, keepConflict: (b) => d.kept.push(b), now: T(minute) });

describe('decide', () => {
  const t1 = '2026-11-01T00:01:00.000Z', t2 = '2026-11-01T00:02:00.000Z';
  it('ยังไม่มีข้อมูลบนเซิร์ฟเวอร์ → ส่งขึ้น เฉพาะเครื่องที่เริ่มใช้งานแล้ว', () => {
    expect(decide({}, null, true)).toBe('push');
    expect(decide({}, null, false)).toBe('none');
  });
  it('เซิร์ฟเวอร์ใหม่กว่า → ดึง แม้เครื่องมีแก้ค้าง', () => {
    expect(decide({ syncedAt: t1 }, t2, true)).toBe('pull');
    expect(decide({ syncedAt: t1, dirty: true }, t2, true)).toBe('pull');
  });
  it('เทียบเวลาเป็นค่าเวลา ไม่ใช่ตัวอักษร (รูปแบบจากเซิร์ฟเวอร์ลงท้าย +00:00)', () => {
    expect(decide({ syncedAt: t1 }, '2026-11-01T00:01:00+00:00', true)).toBe('none');
    expect(decide({ syncedAt: t1 }, '2026-11-01T00:01:00.5+00:00', true)).toBe('pull');
  });
  it('ตรงกันอยู่ → ส่งเมื่อมีแก้ค้างเท่านั้น', () => {
    expect(decide({ syncedAt: t2, dirty: true }, t2, true)).toBe('push');
    expect(decide({ syncedAt: t2 }, t2, true)).toBe('none');
  });
  it('เครื่องที่มีข้อมูลแต่ยังไม่เคยซิงก์ เจอข้อมูลบนเซิร์ฟเวอร์ → ถามก่อน · เครื่องใหม่ดึงเลย', () => {
    expect(decide({}, t1, true)).toBe('ask');
    expect(decide({}, t1, false)).toBe('pull');
  });
});

describe('ซิงก์สองเครื่อง', () => {
  it('เครื่องแรกส่งขึ้น เครื่องใหม่ดึงลงมาได้ข้อมูลเหมือนกัน', async () => {
    const s = server();
    const a = await device();
    await a.db.planItems.put(item('income', 'เงินเดือน', 31000));
    expect(await run(a, s, 1)).toBe('pushed');
    expect(a.meta.dirty).toBe(false);

    const b = await device(false);
    expect(await run(b, s, 2)).toBe('pulled');
    expect(await b.db.planItems.toArray()).toEqual(await a.db.planItems.toArray());
    expect((await b.db.settings.get('app'))?.onboardedAt).toBe(1);
    expect(b.meta.dirty).toBe(false); // การเขียนข้อมูลที่ดึงมาไม่นับเป็นการแก้
    expect(await run(b, s, 3)).toBe('none');
  });

  it('แก้ที่เครื่อง ข แล้วเครื่อง ก เปิดแอป ได้ของใหม่', async () => {
    const s = server();
    const a = await device(); await run(a, s, 1);
    const b = await device(false); await run(b, s, 2);
    await b.db.logEntries.put(entry('2026-11-02', 'c-food', 120));
    expect(await run(b, s, 3)).toBe('pushed');
    expect(await run(a, s, 4)).toBe('pulled');
    expect(await a.db.logEntries.count()).toBe(1);
    expect(a.kept).toHaveLength(0);
  });

  it('แก้พร้อมกันสองเครื่อง: ของที่ส่งทีหลังชนะ เครื่องที่แพ้เก็บสำเนาของตัวเองไว้', async () => {
    const s = server();
    const a = await device(); await run(a, s, 1);
    const b = await device(false); await run(b, s, 2);
    await a.db.logEntries.put(entry('2026-11-02', 'c-food', 50));
    await b.db.logEntries.put(entry('2026-11-02', 'c-food', 120));
    await run(b, s, 3);
    expect(await run(a, s, 4)).toBe('pulled-conflict');
    expect((await a.db.logEntries.toArray()).map((e) => e.myShare)).toEqual([12000]);
    expect(a.kept).toHaveLength(1);
    expect((a.kept[0].tables.logEntries as { myShare: number }[])[0].myShare).toBe(5000);
  });

  it('เครื่องว่างที่ยังไม่เริ่มใช้งานไม่ส่งข้อมูลว่างขึ้นไป', async () => {
    const s = server();
    const b = await device(false);
    expect(await run(b, s, 1)).toBe('none');
    expect(s.row).toBeNull();
  });

  it('เครื่องที่มีข้อมูลอยู่แล้วเข้าสู่ระบบ เจอข้อมูลบนเซิร์ฟเวอร์: ไม่แตะอะไรจนกว่าจะเลือก', async () => {
    const s = server();
    const a = await device();
    await a.db.planItems.put(item('income', 'เงินเดือน', 31000));
    await run(a, s, 1);
    const c = await device();
    await c.db.planItems.put(item('income', 'งานเสริม', 9000));
    expect(await run(c, s, 2)).toBe('ask');
    expect((await c.db.planItems.toArray()).map((p) => p.name)).toEqual(['งานเสริม']);

    await resolveAsk({ db: c.db, remote: s.remote, meta: c.meta, keepConflict: (b) => c.kept.push(b) }, 'cloud');
    expect((await c.db.planItems.toArray()).map((p) => p.name)).toEqual(['เงินเดือน']);
    expect(c.kept).toHaveLength(1);
    expect(await run(c, s, 3)).toBe('none');
  });

  it('เลือกใช้ข้อมูลเครื่องนี้: ส่งขึ้นไปทับ', async () => {
    const s = server();
    const a = await device(); await run(a, s, 1);
    const c = await device();
    await c.db.planItems.put(item('income', 'งานเสริม', 9000));
    expect(await run(c, s, 2)).toBe('ask');
    await resolveAsk({ db: c.db, remote: s.remote, meta: c.meta, now: T(3) }, 'local');
    expect(await run(a, s, 4)).toBe('pulled');
    expect((await a.db.planItems.toArray()).map((p) => p.name)).toEqual(['งานเสริม']);
  });

  it('ซ่อนตัวเลข / เวลาสำรองล่าสุด เป็นของแต่ละเครื่อง ไม่นับเป็นการแก้', async () => {
    const s = server();
    const a = await device(); await run(a, s, 1);
    await a.db.settings.update('app', { hideNumbers: true, updatedAt: 5 });
    await a.db.settings.update('app', { lastBackupAt: 5, updatedAt: 5 });
    expect(a.meta.dirty).toBe(false);
    await a.db.settings.update('app', { hideOnOpen: true, updatedAt: 6 });
    expect(a.meta.dirty).toBe(true);
  });

  it('ลบรายการก็นับเป็นการแก้', async () => {
    const s = server();
    const a = await device();
    const e = entry('2026-11-02', 'c-food', 50);
    await a.db.logEntries.put(e);
    await run(a, s, 1);
    await a.db.logEntries.delete(e.id);
    expect(a.meta.dirty).toBe(true);
  });

  it('ข้อมูลบนเซิร์ฟเวอร์มาจากแอปเวอร์ชันใหม่กว่า: ไม่ทับ และแจ้งให้อัปเดตแอป', async () => {
    const s = server();
    const a = await device(); await run(a, s, 1);
    const row = s.row!;
    (row.data as { schemaVersion: number }).schemaVersion = 99;
    row.updatedAt = '2026-11-01T01:00:00.000Z';
    await expect(run(a, s, 5)).rejects.toThrow('อัปเดตแอป');
    expect((await a.db.settings.get('app'))?.onboardedAt).toBe(1);
  });
});
