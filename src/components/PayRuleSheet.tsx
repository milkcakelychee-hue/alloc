// ตั้งค่า → วันเงินเดือนเข้า: แก้กฎหลัก (ต้องกดยืนยัน เพราะรอบงบเปลี่ยน)
import { useState } from 'react';
import { db } from '../db/db';
import type { Settings } from '../db/types';
import { cycleOf, cycleRange, localToday, thaiDate, thaiMonth } from '../calc/dates';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { PayRuleFields } from './PayRuleFields';

export function PayRuleSheet({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const [rule, setRule] = useState(settings.pay);
  const [shift, setShift] = useState(settings.weekendShift);
  const today = localToday();
  const cycle = cycleOf(today, rule);
  const range = cycleRange(cycle, rule);
  const changed = JSON.stringify(rule) !== JSON.stringify(settings.pay) || shift !== settings.weekendShift;
  const save = async () => {
    await db.settings.update('app', { pay: rule, weekendShift: shift, updatedAt: Date.now() });
    onClose();
  };
  return (
    <Sheet title="วันเงินเดือนเข้า" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <PayRuleFields rule={rule} shift={shift} from={cycle} onChange={(r, s) => { setRule(r); setShift(s); }} />
        <div className="note"><Icon name="info" size={16} stroke={2} />
          <span>ตามกฎนี้ ตอนนี้อยู่รอบ <b className="num nw">{thaiMonth(cycle)}</b> (<span className="num nw">{thaiDate(range.start)} – {thaiDate(range.end)}</span>) · เปลี่ยนกฎแล้ว<span className="nw">ยอดในแผนแต่ละเดือนไม่ย้าย</span> แต่<span className="nw">ช่วงวันของรอบ</span>และบันทึกที่นับเข้ารอบจะเปลี่ยนตาม · วันหยุดนักขัตฤกษ์<span className="nw">แก้เป็นรายเดือน</span>ได้ที่หัวแผนเดือนนั้น</span>
        </div>
        <button className="btn btn-pri" disabled={!changed} onClick={save}>บันทึกกฎใหม่</button>
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
      </div>
    </Sheet>
  );
}
