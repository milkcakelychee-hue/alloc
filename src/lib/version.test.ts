import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('__APP_VERSION__', '0.2.0');

describe('version', () => {
  it('ตัด .0 ท้ายเวอร์ชัน และหน้ามีอะไรใหม่มีเวอร์ชันปัจจุบัน', async () => {
    const { APP_VERSION, CHANGELOG } = await import('./version');
    expect(APP_VERSION).toBe('0.2');
    expect(CHANGELOG[0].version).toBe(APP_VERSION);
  });
});
