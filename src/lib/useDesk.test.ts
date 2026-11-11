import { describe, expect, it } from 'vitest';
import { deskMode } from './useDesk';

describe('deskMode', () => {
  it('ต่ำกว่า 1024 เป็นมือถือเดิมเสมอ แม้กดย่อเมนูไว้', () => {
    for (const w of [320, 390, 768, 1023]) {
      expect(deskMode(w, false)).toBe('mobile');
      expect(deskMode(w, true)).toBe('mobile');
    }
  });
  it('1024–1279 เป็นแถบไอคอน', () => {
    expect(deskMode(1024, false)).toBe('rail');
    expect(deskMode(1279, false)).toBe('rail');
  });
  it('1280 ขึ้นไปเป็นเมนูเต็ม เว้นแต่กดย่อ', () => {
    expect(deskMode(1280, false)).toBe('full');
    expect(deskMode(1440, false)).toBe('full');
    expect(deskMode(1440, true)).toBe('rail');
  });
});
