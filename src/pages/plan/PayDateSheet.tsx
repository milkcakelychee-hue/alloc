// แก้วันที่เงินเข้าเฉพาะเดือน (ต้นแบบ B7) · ไม่แตะกฎหลัก ไม่เปลี่ยนรอบงบ
import { useState } from 'react';
import { db } from '../../db/db';
import type { Month, Settings } from '../../db/types';
import { addMonths, thaiMonth } from '../../calc/dates';
import { expectedPayDate } from '../../calc/payday';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { dateWithDay, payRuleLabel } from '../../components/PayRuleFields';

export function PayDateSheet({ settings, cycle, onClose }: { settings: Settings; cycle: Month; onClose: () => void }) {
  const payMonth = addMonths(cycle, -1);
  const byRule = expectedPayDate(settings.pay, settings.weekendShift, payMonth);
  const [date, setDate] = useState(settings.payOverrides[payMonth] ?? byRule.date);
  const hasOverride = payMonth in settings.payOverrides;
  const save = async (value: string | null) => {
    const o = { ...settings.payOverrides };
    if (value && value !== byRule.date) o[payMonth] = value; else delete o[payMonth];
    await db.settings.update('app', { payOverrides: o, updatedAt: Date.now() });
    onClose();
  };
  return (
    <Sheet title="แก้วันที่เงินเข้าเดือนนี้" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="field"><span className="label">รอบ <span className="num">{thaiMonth(cycle)}</span> เงินเข้าวันที่</span>
          <input type="date" className="num" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <span className="hint">ตามกฎ: <span className="num nw">{dateWithDay(byRule.date)}</span></span>
        </label>
        <div className="note"><Icon name="info" size={16} stroke={2} />
          <span><span className="nw">ใช้กับเดือนนี้เท่านั้น</span> เช่น <span className="nw">วันหยุดนักขัตฤกษ์</span> หรือ<span className="nw">บริษัทจ่ายก่อนสงกรานต์</span> · <span className="nw">กฎหลักยังเป็น{payRuleLabel(settings.pay, settings.weekendShift).main}</span> · <span className="nw">รอบงบไม่เปลี่ยน</span></span>
        </div>
        <button className="btn btn-pri" onClick={() => save(date)}>บันทึก</button>
        {hasOverride && <button className="btn btn-ghost" onClick={() => save(null)}>กลับไปใช้ตามกฎ</button>}
      </div>
    </Sheet>
  );
}
