# Alloc

อ่าน `../ALLOC_SPEC.md` (อยู่นอก repo) ก่อนเริ่มทุกครั้ง — เป็นแหล่งความจริงหลัก ถ้าขัดกับต้นแบบบนแคนวาส ให้เชื่อ SPEC แล้วถามเจ้าของ

สเปกมีตัวเลขการเงินจริง จึงไม่อยู่ใน repo · เทสและข้อมูลตัวอย่างใช้ชุดสมมติใน `TEST_CASES.md` เท่านั้น

## กติกา
- ทำตาม SPEC หัวข้อ 10 ทีละขั้น จบขั้นแล้วหยุด สรุปเป็นภาษาไทยสั้น ๆ และบอกวิธีลองบน iPhone
- เงินเป็นสตางค์ (จำนวนเต็ม) เสมอ ห้าม float บวกลบเงิน
- ตัวคำนวณทุกตัวต้องมีเทสตามตัวเลขใน `TEST_CASES.md` (แทนตัวอย่างหัวข้อ 6) และต้องผ่านก่อนทำหน้าจอที่ใช้
- repo สาธารณะ: ห้ามใส่ข้อมูลการเงินจริง (รวมตัวเลข ชื่อบัญชี ชื่อเป้าจากสเปก), สเปก, port.xlsx, ไฟล์สำรอง, key ใด ๆ
- ข้อความในแอปภาษาไทยตามคำศัพท์หัวข้อ 4 · ไม่ใช้อิโมจิ ใช้ไอคอนเส้น
- ไม่เดาตัวเลขหรือกฎ ถ้าไม่แน่ใจให้ถาม · ทุกการเปลี่ยนแผนต้องให้ผู้ใช้ยืนยัน
- เวอร์ชัน 0.x ต่อขั้น (`package.json` + `src/lib/version.ts` CHANGELOG ใส่เฉพาะฟีเจอร์หลัก)

## Stack
Vite + React 18 + TypeScript + Dexie (IndexedDB) + vite-plugin-pwa + HashRouter · Vitest
- `npm run dev` · `npm test` · `npm run build` · `npm run icons` (สร้างไอคอนจาก SVG)
- push ขึ้น `main` → GitHub Actions รันเทส + build + ขึ้น GitHub Pages

## โครง
- `src/styles/tokens.css` token สีสว่าง/มืด (หัวข้อ 3) · `base.css` ส่วนประกอบ
- `src/calc/` ตัวคำนวณ (pure, มีเทส) · `src/db/` Dexie + migration
- `src/pages/` หน้าแท็บ · `src/components/` TabBar, Sheet, Segmented, Icon
