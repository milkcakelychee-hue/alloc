// แผงแยกบัญชี (บนคอม): ยอดโอนเข้าแต่ละบัญชีของเดือนที่เลือก + เหลือในบัญชีเงินเดือน · คำนวณจากแผน แก้ยอดในตาราง
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Month } from '../../db/types';
import { addMonths, thaiMonth } from '../../calc/dates';
import { formatBaht } from '../../calc/money';
import { accountTransfers, type AmountOf } from '../../calc/plan';
import { kindTone } from '../../calc/planGrid';
import { Icon } from '../../components/Icon';
import type { PlanData } from '../plan/usePlanData';
import { iconOf } from '../plan/planUi';

export function DeskAccountPanel({ data, month: m0, planCur, amountOf, onClose }: {
  data: PlanData; month: Month; planCur: Month; amountOf: AmountOf; onClose: () => void;
}) {
  const [m, setM] = useState(m0);
  const { byAccount, salaryLeft } = accountTransfers(data.groups, data.items, m, amountOf);
  const enabled = new Map(data.groups.filter((g) => g.enabled).map((g) => [g.id, g]));
  const accs = data.accounts.filter((a) => (byAccount.get(a.id) ?? 0) !== 0);
  const itemsOf = (accId: string | null) => data.items
    .filter((i) => (i.accountId ?? null) === accId && enabled.has(i.groupId) && enabled.get(i.groupId)!.kind !== 'income' && amountOf(i, m) !== 0)
    .sort((a, b) => amountOf(b, m) - amountOf(a, m));
  const stays = itemsOf(null);
  const staysTotal = stays.reduce((a, i) => a + amountOf(i, m), 0);
  const income = data.items.filter((i) => enabled.get(i.groupId)?.kind === 'income').reduce((a, i) => a + amountOf(i, m), 0);

  const row = (i: typeof data.items[number]) => {
    const g = enabled.get(i.groupId)!;
    return (
      <div key={i.id} className="dka-it">
        <span className="ic" style={{ color: `var(--t-${kindTone(g.kind)})` }}><Icon name={iconOf(i.icon)} size={14} stroke={2} /></span>
        <span className="n">{i.name}</span><span className="num">{formatBaht(amountOf(i, m))}</span>
      </div>
    );
  };

  return (
    <aside className="dk-panel" aria-label="แยกบัญชี">
      <div className="dk-head">
        <span className="ic36" style={{ background: 'var(--card2)', color: 'var(--ink)' }}><Icon name="wallet" size={20} stroke={1.9} /></span>
        <span className="tx"><b>แยกบัญชี</b><span>คำนวณจากแผน · แก้ยอดได้ในตาราง</span></span>
        <button className="icb" aria-label="ปิดแผง" onClick={onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <div className="dk-body">
        <div className="dka-mon">
          <button className="icb" aria-label="เดือนก่อน" onClick={() => setM(addMonths(m, -1))}><Icon name="back" size={16} stroke={2} /></button>
          <b className="num">{thaiMonth(m)}{m === planCur ? <small> · เดือนนี้</small> : null}</b>
          <button className="icb" aria-label="เดือนถัดไป" onClick={() => setM(addMonths(m, 1))}><Icon name="chevron" size={16} stroke={2} /></button>
        </div>
        <p className="dka-p">โอนเงินแต่ละก้อนเข้าบัญชีตามหน้าที่ทันทีที่เงินเดือนออก <span className="nw">ให้รู้ว่าเงินก้อนไหนมีหน้าที่อะไร</span></p>

        <section className="dk-sec">
          <span className="st">โอนไปบัญชี</span>
          {accs.length === 0 ? (
            <div className="dka-empty">ยังไม่ได้เลือก<span className="nw">บัญชีปลายทาง</span>ให้รายการไหน · ตั้งได้ในแผงรายละเอียดรายการ <span className="nw">หัวข้อ "บัญชีปลายทาง"</span></div>
          ) : accs.map((a) => (
            <div key={a.id} className="grp dka-acc">
              <div className="fr"><span className="k"><b>{a.name}</b></span><span className="v num">{formatBaht(byAccount.get(a.id) ?? 0)}</span></div>
              {itemsOf(a.id).map(row)}
            </div>
          ))}
        </section>

        {(stays.length > 0 || salaryLeft !== 0) && (
          <section className="dk-sec">
            <span className="st">อยู่ในบัญชีเงินเดือน</span>
            <div className="grp dka-acc">
              <div className="fr"><span className="k"><b>ไม่โอน</b></span><span className="v num">{formatBaht(salaryLeft)}</span></div>
              {stays.map(row)}
              {salaryLeft - staysTotal !== 0 && (
                <div className="dka-it dka-free"><span className="ic" /><span className="n">ยังไม่ได้ใส่ในแผน</span><span className="num">{formatBaht(salaryLeft - staysTotal)}</span></div>
              )}
            </div>
          </section>
        )}

        <section className="dk-sec">
          <div className="grp">
            <div className="fr"><span className="k">รายรับเดือนนี้</span><span className="v num">{formatBaht(income)}</span></div>
            <div className="fr"><span className="k">โอนออกรวม</span><span className="v num">{formatBaht(income - salaryLeft)}</span></div>
            <div className="fr dka-left"><span className="k"><b>เหลือในบัญชีเงินเดือน</b><small>รายการที่ไม่ได้เลือกบัญชี นับว่าอยู่ในบัญชีนี้</small></span>
              <span className={`v num${salaryLeft < 0 ? ' neg' : ''}`}>{formatBaht(salaryLeft)}</span></div>
          </div>
        </section>
        <Link className="dka-set" to="/settings">จัดการบัญชีในตั้งค่า</Link>
      </div>
    </aside>
  );
}
