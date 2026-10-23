import { useSearchParams } from 'react-router-dom';
import { Segmented } from '../components/Segmented';
import { Empty } from '../components/Empty';
import { PlanMonth } from './plan/PlanMonth';
import { HomeCards } from './HomeCards';

type Tab = 'summary' | 'plan';

const todayLong = () =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date())
    .replace(/^(วัน\S+)\s/, '$1ที่ ');

export default function Home() {
  const [sp, setSp] = useSearchParams();
  const tab: Tab = sp.get('tab') === 'plan' ? 'plan' : 'summary';
  const segmented = (
    <Segmented<Tab>
      label="มุมมองหน้าหลัก"
      value={tab}
      options={[{ value: 'summary', label: 'สรุป' }, { value: 'plan', label: 'วางแผนรายจ่าย' }]}
      onChange={(v) => setSp(v === 'plan' ? { tab: 'plan' } : {}, { replace: true })}
    />
  );
  // แท็บแผน: หัวหน้าเป็นชื่อเดือนของรอบ (ต้นแบบ Plan1)
  if (tab === 'plan') return <PlanMonth segmented={segmented} />;
  return (
    <main className="page">
      <div className="page-head">
        <span className="sub num">{todayLong()}</span>
        <h1>ภาพรวมการเงิน</h1>
      </div>
      {segmented}
      <HomeCards />
      <Empty icon="home" title="สรุป" text={<>สินทรัพย์รวม Savings Rate และ<span className="nw">สิ่งที่ต้องทำ</span> <span className="nw">จะแสดงที่นี่</span></>} />
    </main>
  );
}
