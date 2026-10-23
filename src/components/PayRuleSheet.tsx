// ตั้งค่า → วันเงินเดือนเข้า: แก้กฎหลัก (ต้องกดยืนยัน เพราะรอบงบเปลี่ยน)
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Settings } from '../db/types';
import { addMonths, cycleOf, cycleRange, localToday, nominalPayDate, thaiDate, thaiMonth } from '../calc/dates';
import { formatBaht } from '../calc/money';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { PayRuleFields, dateWithDay } from './PayRuleFields';

export function PayRuleSheet({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const [rule, setRule] = useState(settings.pay);
  const [shift, setShift] = useState(settings.weekendShift);
  const today = localToday();
  const cycle = cycleOf(today, rule);
  const range = cycleRange(cycle, rule);
  const receipts = useLiveQuery(() => db.payReceipts.where('status').equals('received').toArray(), []) ?? [];
  const history = receipts.filter((r) => r.date).sort((a, b) => a.id.localeCompare(b.id)).slice(-6);
  const changed = JSON.stringify(rule) !== JSON.stringify(settings.pay) || shift !== settings.weekendShift;
  const save = async () => {
    await db.settings.update('app', { pay: rule, weekendShift: shift, updatedAt: Date.now() });
    onClose();
  };
  return (
    <Sheet title="วันเงินเดือนเข้า" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {history.length > 0 && <PayHistory history={history} settings={settings} />}
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

/** ประวัติวันเงินเข้าจริง 6 รอบล่าสุด (ต้นแบบ B6) · เทียบกับวันที่ตั้งไว้ ให้เห็นรูปแบบแล้วปรับกฎ */
function PayHistory({ history, settings }: { history: { id: string; date: string | null; amount: number | null }[]; settings: Settings }) {
  const rows = history.map((r) => {
    const nominal = nominalPayDate(settings.pay, addMonths(r.id, -1));
    const diff = Math.round((Date.parse(nominal) - Date.parse(r.date!)) / 86_400_000);
    return { ...r, date: r.date!, diff };
  });
  const early = rows.filter((r) => r.diff > 0).length;
  const late = rows.filter((r) => r.diff < 0).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="sec" style={{ padding: 0 }}><span className="num">{rows.length}</span> เดือนที่ผ่านมา เงินเข้าวันที่</span>
      <div className="day-strip" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
        {rows.map((r) => <span key={r.id} className={r.diff ? 'early' : ''}><b className="num">{Number(r.date.slice(8))}</b><small>{thaiMonth(r.date.slice(0, 7)).split(' ')[0]}</small></span>)}
      </div>
      <div className="list">
        {rows.slice().reverse().map((r) => (
          <div key={r.id} className="row">
            <span className="tx"><span className="t1 num">{dateWithDay(r.date)}</span>
              {r.diff !== 0 && <span className="t2">เข้า{r.diff > 0 ? 'ก่อน' : 'หลัง'}กำหนด <span className="num">{Math.abs(r.diff)}</span> วัน</span>}</span>
            <span className="val num">{r.amount !== null ? formatBaht(r.amount) : ''}</span>
          </div>
        ))}
      </div>
      {early + late > 0 && <div className="note"><Icon name="info" size={16} stroke={2} /><span>เงินเข้า<span className="nw">ไม่ตรงวันที่ตั้งไว้</span> <span className="num">{early + late}</span> ครั้งจาก <span className="num">{rows.length}</span> · ถ้าเป็นแบบนี้ประจำ <span className="nw">ปรับกฎด้านล่างให้ตรง</span>ได้</span></div>}
    </div>
  );
}
