// เวอร์ชัน 0.x ต่อขั้น (ขั้นที่ 1 = 0.1 … ครบ 9 ขั้น = 1.0)
declare const __APP_VERSION__: string;
export const APP_VERSION = __APP_VERSION__.replace(/\.0$/, '');

// หน้า "มีอะไรใหม่": ว่างไว้ช่วงวางโครง · เริ่มใส่เมื่อแอปพร้อมใช้จริง
// ใส่ว่าทำอะไรได้บ้าง และสิ่งที่ปรับแก้/จะเพิ่มในอนาคต (ไม่ใช่รายการงานแต่ละขั้น)
export const CHANGELOG: { version: string; items: string[] }[] = [];
