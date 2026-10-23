// สร้างไอคอนแอป PNG ทุกขนาดจาก SVG เดียว ตามบอร์ด AppIcon · รัน: npm run icons
// พื้น hero gradient + แถบ 4 ท่อน · iOS ตัดมุมเอง จึงส่งเป็นสี่เหลี่ยมเต็ม (มุมโค้งเฉพาะ favicon)
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const BARS = `
  <rect x="8" y="9" width="28" height="7" rx="3.5" fill="#FFFFFF"/>
  <rect x="8" y="19" width="19" height="7" rx="3.5" fill="#C6E43F"/>
  <rect x="29" y="19" width="7" height="7" rx="3.5" fill="#8FC2A0"/>
  <rect x="8" y="29" width="11" height="7" rx="3.5" fill="#8FC2A0"/>
  <rect x="21" y="29" width="15" height="7" rx="3.5" fill="#FFFFFF" opacity=".55"/>`;

// symbol = สัดส่วนของสัญลักษณ์ต่อไอคอน (ต้นแบบ 104/180 ≈ 0.578) · maskable ต้องอยู่ในวงกลมปลอดภัย 80%
function svg({ symbol = 0.578, radius = 0 } = {}) {
  const s = 1024, sym = s * symbol, off = (s - sym) / 2, r = s * radius;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs><linearGradient id="g" x1="0.17" y1="0" x2="0.83" y2="1">
    <stop offset="0" stop-color="#3A6B50"/><stop offset=".55" stop-color="#1E3B2C"/><stop offset="1" stop-color="#11251A"/>
  </linearGradient></defs>
  <rect width="${s}" height="${s}" rx="${r}" fill="url(#g)"/>
  <svg x="${off}" y="${off}" width="${sym}" height="${sym}" viewBox="0 0 44 44">${BARS}</svg>
</svg>`;
}

const out = (name, size, opts) => {
  const png = new Resvg(svg(opts), { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), png);
  console.log(name, size);
};

out('icon-180.png', 180);
out('icon-192.png', 192);
out('icon-512.png', 512);
out('icon-maskable-512.png', 512, { symbol: 0.46 });
out('favicon-32.png', 32, { radius: 0.224 });
