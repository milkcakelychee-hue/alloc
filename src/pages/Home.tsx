import { useSearchParams } from 'react-router-dom';
import { Segmented } from '../components/Segmented';
import { Empty } from '../components/Empty';

type Tab = 'summary' | 'plan';

const todayLong = () =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date())
    .replace(/^(วัน\S+)\s/, '$1ที่ ');

export default function Home() {
  const [sp, setSp] = useSearchParams();
  const tab: Tab = sp.get('tab') === 'plan' ? 'plan' : 'summary';
  return (
    <main className="page">
      <div className="page-head">
        <span className="sub num">{todayLong()}</span>
        <h1>ภาพรวมการเงิน</h1>
      </div>
      <Segmented<Tab>
        label="มุมมองหน้าหลัก"
        value={tab}
        options={[{ value: 'summary', label: 'สรุป' }, { value: 'plan', label: 'วางแผนรายจ่าย' }]}
        onChange={(v) => setSp(v === 'plan' ? { tab: 'plan' } : {}, { replace: true })}
      />
      {tab === 'summary'
        ? <Empty icon="home" title="สรุป" text="สินทรัพย์รวม Savings Rate และสิ่งที่ต้องทำ จะแสดงที่นี่" />
        : <Empty icon="plan" title="วางแผนรายจ่าย" text="แผนรายเดือนตามรอบเงินเดือน จะแสดงที่นี่" />}
    </main>
  );
}
