import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('__APP_VERSION__', '1.0.0');

describe('version', () => {
  it('ตัด .0 ท้ายเวอร์ชัน · มีอะไรใหม่ ใหม่สุดตรงกับเวอร์ชันแอป', async () => {
    const { APP_VERSION, CHANGELOG } = await import('./version');
    expect(APP_VERSION).toBe('1.0');
    expect(CHANGELOG[0].version).toBe(APP_VERSION);
  });
});
