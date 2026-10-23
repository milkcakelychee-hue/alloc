// อัปเดตแอปอัตโนมัติ (ยกจาก gym bro): เช็กเวอร์ชันใหม่ตอนเปิด / กลับเข้าแอป / ทุก 30 นาที แล้วรีเฟรชเอง
// ถ้ามีแผ่นเด้งเปิดอยู่ (กำลังกรอก) จะไม่รีเฟรชกลางคัน: ขึ้นป้ายให้กดเอง
import { registerSW } from 'virtual:pwa-register';

let pending = false;
const listeners = new Set<() => void>();
const busy = () => !!document.querySelector('.sheet');
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (!busy()) { updateSW(true); return; }
    pending = true; listeners.forEach((f) => f());
  },
  onRegisteredSW(_url, r) {
    if (!r) return;
    const check = () => { if (navigator.onLine) r.update().catch(() => {}); };
    setInterval(check, 30 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }
});
export const hasPendingUpdate = () => pending;
export const onPendingUpdate = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const applyUpdate = () => updateSW(true);
