import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocDB } from './db';
import { startFresh } from './onboarding';
import { B } from '../calc/testkit';

let cur: AllocDB;
let n = 0;
afterEach(async () => { await cur?.delete(); });

describe('เริ่มใหม่', () => {
  it('ตั้งวันเงินเดือนเข้า สร้างเงินเดือนในหมวดรายรับ เริ่มรอบของวันนี้', async () => {
    cur = new AllocDB(`onb-${n++}`);
    await startFresh(cur, { salary: B(31000), pay: { kind: 'day', day: 25 }, weekendShift: 'after', today: '2026-10-25', now: 5 });
    const s = await cur.settings.get('app');
    expect(s).toMatchObject({ pay: { kind: 'day', day: 25 }, weekendShift: 'after', onboardedAt: 5 });
    const [it1] = await cur.planItems.toArray();
    const g = await cur.planGroups.get(it1.groupId);
    expect(g?.kind).toBe('income');
    expect(it1).toMatchObject({ name: 'เงินเดือน', defaultAmount: B(31000), period: { start: '2026-11', endMode: 'none' } });
  });

  it('ข้ามเงินเดือนได้', async () => {
    cur = new AllocDB(`onb-${n++}`);
    await startFresh(cur, { salary: null, pay: { kind: 'endOfMonth' }, weekendShift: 'before', today: '2026-10-18' });
    expect(await cur.planItems.count()).toBe(0);
    expect((await cur.settings.get('app'))?.onboardedAt).toBeTruthy();
  });
});
