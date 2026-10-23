// เวอร์ชัน 0.x ต่อขั้น (ขั้นที่ 1 = 0.1 … ครบ 9 ขั้น = 1.0)
// หน้า "มีอะไรใหม่" ใส่เฉพาะฟีเจอร์หลักของแต่ละขั้น
declare const __APP_VERSION__: string;
export const APP_VERSION = __APP_VERSION__.replace(/\.0$/, '');

export const CHANGELOG: { version: string; items: string[] }[] = [
  { version: '0.1', items: ['โครงแอป เมนูล่าง 4 แท็บ', 'ธีมสว่าง / มืด / ตามเครื่อง', 'ติดตั้งลงหน้าจอโฮมและใช้ออฟไลน์ได้'] }
];
