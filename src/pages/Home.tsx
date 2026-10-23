import { useSearchParams } from 'react-router-dom';
import { Empty } from '../components/Empty';
import { PlanMonth } from './plan/PlanMonth';
import { HomeCards } from './HomeCards';
import { PlanEntry } from './PlanEntry';

type Tab = 'summary' | 'plan';

const todayLong = () =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date())
    .replace(/^(วัน\S+)\s/, '$1ที่ ');

export default function Home() {
  const [sp] = useSearchParams();
  const tab: Tab = sp.get('tab') === 'plan' ? 'plan' : 'summary';
  // แท็บแผน: ไม่มีปุ่มสลับ มีปุ่มกลับหน้าสรุปด้านบนแทน
  if (tab === 'plan') return <PlanMonth />;
  return (
    <main className="page">
      <div className="page-head">
        <span className="sub num">{todayLong()}</span>
        <h1>ภาพรวมการเงิน</h1>
      </div>
      <PlanEntry />
      <HomeCards />
      <Empty icon="home" title="สรุป" text={<>สินทรัพย์รวม Savings Rate และ<span className="nw">สิ่งที่ต้องทำ</span> <span className="nw">จะแสดงที่นี่</span></>} />
    </main>
  );
}
