import { useSearchParams } from 'react-router-dom';
import { Segmented } from '../components/Segmented';
import { Empty } from '../components/Empty';

type Tab = 'entries' | 'bills';

export default function Log() {
  const [sp, setSp] = useSearchParams();
  const tab: Tab = sp.get('tab') === 'bills' ? 'bills' : 'entries';
  return (
    <main className="page">
      <div className="page-head"><h1>บันทึก</h1></div>
      <Segmented<Tab>
        label="มุมมองบันทึก"
        value={tab}
        options={[{ value: 'entries', label: 'รายรับ-รายจ่าย' }, { value: 'bills', label: 'บิลแชร์' }]}
        onChange={(v) => setSp(v === 'bills' ? { tab: 'bills' } : {}, { replace: true })}
      />
      {tab === 'entries'
        ? <Empty icon="log" title="ยังไม่มีรายการ" text="ปฏิทินรอบเงินเดือนและงบใช้จ่ายรายวัน จะแสดงที่นี่" />
        : <Empty icon="bill" title="ยังไม่มีบิล" text="บิลที่หารกับคนอื่นและยอดค้างรับ จะแสดงที่นี่" />}
    </main>
  );
}
