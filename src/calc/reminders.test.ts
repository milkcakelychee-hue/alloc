import { describe, expect, it } from 'vitest';
import { backupStatus } from './reminders';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 18, 12);

describe('เตือนสำรองข้อมูล', () => {
  it('ยังไม่เคยสำรอง → เตือน', () => {
    expect(backupStatus(null, now)).toEqual({ never: true, days: null, due: true });
  });
  it('14 วันยังไม่เตือน · 15 วันเตือน', () => {
    expect(backupStatus(now - 14 * DAY, now)).toEqual({ never: false, days: 14, due: false });
    expect(backupStatus(now - 15 * DAY - 1, now)).toEqual({ never: false, days: 15, due: true });
  });
});
