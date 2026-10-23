// ปุ่มเข้า "วางแผนรายจ่าย" บนสุดของหน้าภาพรวม (แทนปุ่มสลับ สรุป/วางแผนรายจ่าย)
import { Link } from 'react-router-dom';
import { cycleOf, localToday, thaiMonth } from '../calc/dates';
import { formatBaht } from '../calc/money';
import { planTotals } from '../calc/plan';
import { goalAwareAmountOf } from '../calc/goals';
import { Icon } from '../components/Icon';
import { usePlanData } from './plan/usePlanData';

export function PlanEntry() {
  const data = usePlanData();
  const s = data?.settings;
  if (!data || !s) return null;
  const cur = cycleOf(localToday(), s.pay);
  const t = planTotals(data.groups, data.items, cur, goalAwareAmountOf(data.goals, data.items, data.adjustments, cur));
  const hasPlan = t.income > 0;
  return (
    <Link to="/?tab=plan" className="hero plan-entry" aria-label={`วางแผนรายจ่าย แผน ${thaiMonth(cur)}`}>
      <span className="pe-top">
        <span className="pe-ic"><Icon name="plan" size={24} stroke={2} /></span>
        <span className="pe-t">
          <b>วางแผนรายจ่าย</b>
          <span><span className="nw">แบ่งเงินเดือนเป็นรายจ่าย</span> <span className="nw">เงินออม และเงินลงทุน</span></span>
        </span>
        <span className="pe-go" aria-hidden="true"><Icon name="chevron" size={20} stroke={2.2} /></span>
      </span>
      <span className="pe-bot">
        <span className="pe-m">แผน <span className="num">{thaiMonth(cur)}</span></span>
        {hasPlan
          ? <span className="pe-v">เงินเหลือ {s.hideNumbers ? <b>••••••</b> : <b className={`num${t.leftover < 0 ? ' neg' : ''}`}>{t.leftover < 0 ? '−' : ''}{formatBaht(Math.abs(t.leftover))}</b>}</span>
          : <span className="pe-v">ยังไม่มีแผน · <b>เริ่มวางแผน</b></span>}
      </span>
    </Link>
  );
}
