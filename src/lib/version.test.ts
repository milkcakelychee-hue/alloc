import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('__APP_VERSION__', '0.3.0');

describe('version', () => {
  it('ตัด .0 ท้ายเวอร์ชัน · ช่วงวางโครงยังไม่มีรายการ มีอะไรใหม่', async () => {
    const { APP_VERSION, CHANGELOG } = await import('./version');
    expect(APP_VERSION).toBe('0.3');
    expect(CHANGELOG).toEqual([]);
  });
});
