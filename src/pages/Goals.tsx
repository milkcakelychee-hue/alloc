import { Empty } from '../components/Empty';

export default function Goals() {
  return (
    <main className="page">
      <div className="page-head"><h1>เป้าหมาย</h1></div>
      <Empty icon="goal" title="ยังไม่มีเป้าหมาย" text="เป้าออม ลงทุน PVD และรายจ่ายตามเป้าหมาย จะแสดงที่นี่" />
    </main>
  );
}
