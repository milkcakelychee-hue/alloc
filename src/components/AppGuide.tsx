// คู่มือสั้นหลังเริ่มใช้งาน: แอปทำอะไรได้ · อยู่เมนูไหน · ทำอะไรต่อ
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon, P } from './Icon';

type IconName = keyof typeof P;

const MENUS: { tab: number; icon: IconName; name: string; tone: string; items: { icon: IconName; title: string; text: ReactNode }[] }[] = [
  {
    tab: 1, icon: 'home', name: 'หน้าหลัก', tone: 'income',
    items: [
      { icon: 'chart', title: 'สรุป', text: <>ดู<span className="nw">สินทรัพย์รวม</span> Savings Rate และ<span className="nw">สิ่งที่ต้องทำ</span></> },
      { icon: 'plan', title: 'วางแผนรายจ่าย', text: <>แบ่งเงินเดือนเป็น<span className="nw">รายจ่าย ออม ลงทุน</span> ให้<span className="nw">ทุกบาทมีหน้าที่</span></> }
    ]
  },
  {
    tab: 2, icon: 'goal', name: 'เป้าหมาย', tone: 'inv',
    items: [
      { icon: 'goal', title: 'เป้าออมและลงทุน', text: <>ตั้งยอดที่อยากได้ แอป<span className="nw">คาดวันครบ</span>ให้จากแผนแต่ละเดือน</> },
      { icon: 'bag', title: 'รายจ่ายตามเป้าหมาย', text: <>เก็บเงินไว้ใช้ตามเป้า เช่น <span className="nw">ทริปเที่ยว</span> หรือ<span className="nw">ซื้อของชิ้นใหญ่</span></> }
    ]
  },
  {
    tab: 3, icon: 'log', name: 'บันทึก', tone: 'peach',
    items: [
      { icon: 'log', title: 'รายรับ-รายจ่าย', text: <>จดทุกวัน แล้วดูว่า<span className="nw">เหลือใช้ได้วันละเท่าไหร่</span></> },
      { icon: 'bill', title: 'บิลแชร์', text: <>หารบิลกับเพื่อน ดูว่า<span className="nw">ใครยังค้างจ่าย</span> แล้วส่งสรุปให้</> }
    ]
  },
  {
    tab: 4, icon: 'settings', name: 'ตั้งค่า', tone: 'plain',
    items: [
      { icon: 'backup', title: 'สำรองข้อมูล', text: <>ข้อมูลอยู่ใน<span className="nw">เครื่องนี้เท่านั้น</span> สำรองเก็บไว้ใน<span className="nw">แอปไฟล์</span></> },
      { icon: 'theme', title: 'ธีมและวันเงินเดือนเข้า', text: <>สลับ<span className="nw">สว่าง / มืด</span> และแก้<span className="nw">วันเงินเดือนเข้า</span></> }
    ]
  }
];

export function AppGuide({ restored }: { restored: boolean }) {
  const steps: { icon: IconName; title: string; where: string; to: string }[] = restored
    ? [
        { icon: 'chart', title: 'ดูภาพรวมเดือนนี้', where: 'หน้าหลัก → สรุป', to: '/' },
        { icon: 'backup', title: 'สำรองข้อมูลเป็นประจำ', where: 'ตั้งค่า → สำรองข้อมูล', to: '/settings' }
      ]
    : [
        { icon: 'plan', title: 'วางแผนรายจ่ายเดือนนี้', where: 'หน้าหลัก → วางแผนรายจ่าย', to: '/?tab=plan' },
        { icon: 'goal', title: 'ตั้งเป้าหมายแรก', where: 'เป้าหมาย', to: '/goals' },
        { icon: 'backup', title: 'สำรองข้อมูลครั้งแรก', where: 'ตั้งค่า → สำรองข้อมูล', to: '/settings' }
      ];
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone);

  return (
    <div className="guide">
      <section aria-labelledby="g-next">
        <h2 id="g-next">ทำอะไรต่อดี</h2>
        <ol className="g-steps">
          {steps.map((s, i) => (
            <li key={s.to + i}>
              <Link to={s.to} className="g-step">
                <span className="g-num num">{i + 1}</span>
                <span className="tx"><span className="t1">{s.title}</span><span className="t2"><span className="nw">{s.where}</span></span></span>
                <Icon name="chevron" size={16} stroke={2} />
              </Link>
            </li>
          ))}
        </ol>
        {!standalone && (
          <div className="note">
            <Icon name="share" size={16} stroke={2} />
            <span>ติดตั้งเป็นแอป: กด<span className="nw">ปุ่มแชร์</span>ใน Safari → <span className="nw">เพิ่มไปยังหน้าจอโฮม</span> แล้วเปิดจาก<span className="nw">ไอคอน Alloc</span></span>
          </div>
        )}
      </section>

      <section aria-labelledby="g-menu">
        <h2 id="g-menu">เมนูด้านล่าง ทำอะไรได้บ้าง</h2>
        <div className="g-bar" aria-hidden="true">
          {MENUS.map((m) => <span key={m.tab}><Icon name={m.icon} size={18} />{m.name}</span>)}
        </div>
        {MENUS.map((m) => (
          <article key={m.tab} className={`g-menu tone-${m.tone}`}>
            <header>
              <span className="g-ic"><Icon name={m.icon} size={20} stroke={2} /></span>
              <h3>{m.name}</h3>
              <span className="g-where">แท็บที่ <span className="num">{m.tab}</span></span>
            </header>
            <ul>
              {m.items.map((it) => (
                <li key={it.title}>
                  <span className="g-sub"><Icon name={it.icon} size={16} stroke={2} /></span>
                  <span className="tx"><span className="t1">{it.title}</span><span className="t2">{it.text}</span></span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
