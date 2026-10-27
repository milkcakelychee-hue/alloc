// บันทึก · บิลแชร์ (บอร์ด BillList / BillListDark): ใบสรุปค้างรับ · เลือกเดือน · ดูของใคร · สถานะ · รายการบิล
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ME_ID, type Bill, type Month } from '../../db/types';
import { addMonths, appCycle, localToday, thaiMonth } from '../../calc/dates';
import { billTotal, monthBars, personLines, shareOf, billSummary } from '../../calc/bills';
import { Icon } from '../../components/Icon';
import { formatWhole } from '../../calc/money';
import { baht } from '../goals/goalUi';
import { Avatar, Barcode, Dots, Receipt, StatusPill, itemsOf, paymentsOf, useBillData, type BillData } from './billUi';
import { usePlanData } from '../plan/usePlanData';

type Per = Month | 'all';
type St = 'all' | 'open' | 'done';

export const PeopleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8.5" r="3.5" /><path d="M3 19.5c.8-3.2 3.2-5 6-5s5.2 1.8 6 5" /><path d="M16 5.5a3 3 0 0 1 0 6M18 14.8c1.6.7 2.6 2.4 3 4.7" />
  </svg>
);
export const BillIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 3.5h10v17l-2.5-1.6L12 20.5l-2.5-1.6L7 20.5z" /><path d="M9.5 8h5M9.5 11.5h5" />
  </svg>
);

export function BillList({ tabs }: { tabs: React.ReactNode }) {
  const data = useBillData();
  const plan = usePlanData();
  const [per, setPer] = useState<Per | null>(null);
  const [who, setWho] = useState<string>('all');
  const [st, setSt] = useState<St>('all');
  const s = plan?.settings;
  if (!data || !s) return null;
  const cur = appCycle(localToday(), s.pay, s.startCycle);
  const period: Per = per ?? cur;
  const months = [-1, 0, 1, 2].map((n) => addMonths(cur, n));
  const all = who === 'all';
  const others = data.people.filter((p) => p.id !== ME_ID);
  const pName = (id: string) => data.people.find((p) => p.id === id)?.name ?? '';

  const view = data.bills.filter((b) => {
    if (period !== 'all' && b.cycleMonth !== period) return false;
    const its = itemsOf(data, b.id), pays = paymentsOf(data, b.id);
    const x = shareOf(its, pays, who);
    if (!all && !x.inBill) return false;
    if (st === 'open') return x.owed > 0;
    if (st === 'done') return x.owed === 0;
    return true;
  });
  let sum = 0, paid = 0, open = 0;
  for (const b of view) {
    const x = shareOf(itemsOf(data, b.id), paymentsOf(data, b.id), who);
    sum += x.share; paid += x.paid; open += x.owed;
  }
  const head = all ? open : sum - paid;
  // ค้างรับต่อคน (เฉพาะบิลที่แสดง)
  const byPerson = others.map((p) => {
    let o = 0, inAny = false;
    for (const b of view) { const x = shareOf(itemsOf(data, b.id), paymentsOf(data, b.id), p.id); if (x.inBill) { inAny = true; o += x.owed; } }
    return { p, o, inAny };
  }).filter((r) => r.inAny);
  const noteBill = view.find((b) => b.note);
  const meta = period === 'all' ? 'ทุกช่วงเวลา' : period === cur ? `เดือนนี้ · ${thaiMonth(period)}` : period === addMonths(cur, 1) ? `เดือนหน้า · ${thaiMonth(period)} · รอเรียกเก็บ` : period > cur ? `${thaiMonth(period)} · รอเรียกเก็บ` : thaiMonth(period);

  const bars = monthBars(data.bills, (id) => itemsOf(data, id), (id) => paymentsOf(data, id), months, cur, who);
  const mx = Math.max(1, ...bars.map((b) => b.paid + b.open));
  const listLab = all ? `บิล ${view.length} รายการ` : `บิลที่${pName(who)}มีส่วน · ${view.length} บิล`;

  return (
    <main className="page lgp">
      <div className="lg-head">
        <h1>บันทึก</h1>
        <Link to="/log/people" className="bl-peoplebtn"><PeopleIcon /><span>เพิ่ม/จัดการคน</span></Link>
      </div>
      {tabs}

      <section aria-label="สรุปยอดค้างรับ" style={{ paddingTop: 4 }}>
        <Receipt>
          <div className="bl-rc-h">
            <span className="k">ALLOC · บิลแชร์</span>
            <span className="t">{all ? 'ใบสรุปค้างรับ' : `ใบแจ้งยอด · ${pName(who)}`}</span>
            <span className="m num">{meta} · {view.length} บิล</span>
          </div>
          <div className="bl-dash" aria-hidden="true" />
          {all ? (
            <div className="bl-rc-rows">
              {byPerson.length === 0 && <div className="bl-rc-line muted"><span>ยังไม่มีบิลในช่วงนี้</span></div>}
              {byPerson.map(({ p, o }) => (
                <div key={p.id} className="bl-rc-line"><Avatar person={p} size={26} /><span className="nw">{p.name}</span><Dots /><b className="num">{o > 0 ? `ค้าง ${baht(o)}` : 'ครบแล้ว'}</b></div>
              ))}
            </div>
          ) : (
            <div className="bl-rc-rows">
              <div className="bl-rc-line"><span>ยอดตามบิล</span><Dots /><b className="num">{baht(sum)}</b></div>
              <div className="bl-rc-line"><span>จ่ายแล้ว</span><Dots /><b className="num">{paid ? `−${baht(paid)}` : '0'}</b></div>
            </div>
          )}
          <div className="bl-dash" aria-hidden="true" />
          <div className="bl-rc-tot"><span>{all ? 'รวมค้างรับ' : 'ค้างชำระ'}</span><b className="num">{baht(head)}<small>บาท</small></b></div>
          <div className="bl-rc-foot"><Barcode />
            <span className="n"><span className="k">หมายเหตุ · {noteBill ? noteBill.title : 'บิลที่แสดง'}</span><span>{noteBill ? noteBill.note : 'ไม่มีหมายเหตุ'}</span></span>
          </div>
          <span aria-hidden="true" className={`bl-stamp${head > 0 ? ' open' : ''}`}>{head > 0 ? 'ค้างอยู่' : 'ครบแล้ว'}</span>
        </Receipt>
      </section>

      <section aria-label="เลือกเดือน" className="bl-months">
        <div className="h"><h2>เลือกเดือน</h2>
          <button aria-pressed={period === 'all'} className={period === 'all' ? 'on' : ''} onClick={() => setPer('all')}>ทั้งหมด</button></div>
        <div className="sub">แตะที่กราฟเพื่อดูรายละเอียดบิลของเดือนนั้น</div>
        <div className="grid">
          {bars.map((b) => {
            const H = 70, P = Math.round((b.paid / mx) * H), O = Math.round((b.open / mx) * H);
            const on = period === b.month;
            const [mm, yy] = thaiMonth(b.month).split(' ');
            const lab: [string, string?] = b.future ? (b.open ? ['รอเก็บ', formatWhole(b.open)] : ['ยังไม่มีบิล']) : b.open > 0 ? ['ค้าง', formatWhole(b.open)] : b.paid ? ['ครบแล้ว'] : ['ไม่มีบิล'];
            const tone = b.future ? (b.open ? 'fut' : 'none') : b.open > 0 ? 'open' : b.paid ? 'done' : 'none';
            return (
              <button key={b.month} aria-label={`ดูบิล ${thaiMonth(b.month)}`} aria-pressed={on} className={on ? 'on' : ''} onClick={() => setPer(b.month)}>
                {b.month === cur && <span className="now">เดือนนี้</span>}
                <span className="plot" aria-hidden="true"><span className="col">
                  {b.future ? <span className="f" style={{ height: O || 6 }} /> : <span className="o" style={{ height: O }} />}
                  <span className="p" style={{ height: P }} />
                </span></span>
                <span className="mn">{mm} <span className="num">{yy}</span></span>
                <span className={`lb ${tone}`}><span>{lab[0]}</span>{lab[1] && <span className="num">{lab[1]}</span>}</span>
              </button>
            );
          })}
        </div>
        <div className="lgd"><span><i className="p" />ชำระแล้ว</span><span><i className="o" />ค้างชำระ</span><span><i className="f" />รอเรียกเก็บ (อนาคต)</span></div>
      </section>

      {others.length > 0 && (
        <div className="bl-filter">
          <span className="cap">ดูของใคร</span>
          <div role="group" aria-label="เลือกบุคคล" className="chips">
            <button aria-pressed={all} className={all ? 'on' : ''} onClick={() => setWho('all')}>ทุกคน</button>
            {others.map((p) => (
              <button key={p.id} aria-pressed={who === p.id} className={`av${who === p.id ? ' on' : ''}`} onClick={() => setWho(p.id)}><Avatar person={p} size={22} />{p.name}</button>
            ))}
          </div>
        </div>
      )}
      <div className="bl-sthead">สถานะบิล</div>
      <div role="group" aria-label="สถานะ" className="bl-filter chips st">
        {([['all', 'ทั้งหมด'], ['open', 'ค้างชำระ'], ['done', 'ครบแล้ว']] as const).map(([k, l]) => (
          <button key={k} aria-pressed={st === k} className={st === k ? 'on' : ''} onClick={() => setSt(k)}><i className={k} />{l}</button>
        ))}
      </div>

      <div className="bl-listh"><h2>{listLab}</h2>
        <Link to="/log/bill-summary" className="bl-outbtn"><BillIcon />สร้างสรุปบิล</Link></div>

      {view.map((b) => <BillCard key={b.id} bill={b} data={data} who={who} />)}
      {view.length === 0 && <div className="bl-empty">{data.bills.length ? 'ไม่มีบิลตามตัวกรองนี้' : <>ยังไม่มีบิล · กด <span className="nw">"บิลใหม่"</span> <span className="nw">เพื่อเริ่มหารกับเพื่อน</span></>}</div>}

      <Link to="/log/bill/new" className="lg-fab" aria-label="สร้างบิลใหม่"><Icon name="plus" size={22} stroke={2.4} />บิลใหม่</Link>
    </main>
  );
}

function BillCard({ bill: b, data, who }: { bill: Bill; data: BillData; who: string }) {
  const its = itemsOf(data, b.id), pays = paymentsOf(data, b.id);
  const sum = billSummary(its, pays);
  const ppl = b.peopleIds.map((id) => data.people.find((p) => p.id === id)).filter(Boolean);
  if (who === 'all') {
    return (
      <Link to={`/log/bill/${b.id}`} className="bl-card" aria-label={`บิล ${b.title}`}>
        <div className="top"><span className="tx"><span className="t">{b.title}</span><span className="s num"><span className="nw">{b.dateLabel}</span> · <span className="nw">{its.length} รายการ</span></span></span><StatusPill s={sum.status} /></div>
        <div className="mid"><span className="avs">{ppl.map((p) => <Avatar key={p!.id} person={p} size={26} ring />)}</span>
          <span className="n">หารเท่า {ppl.length} คน</span><b className="num">{baht(billTotal(its))}</b></div>
        <div className="bot"><span>ส่วนของฉัน <b className="num">{baht(sum.myShare)}</b></span>
          {sum.outstanding > 0 ? <span>ค้างรับ <b className="num neg">{baht(sum.outstanding)}</b></span> : <span>รับครบแล้ว</span>}</div>
      </Link>
    );
  }
  const name = data.people.find((p) => p.id === who)?.name ?? '';
  const x = shareOf(its, pays, who);
  const lines = personLines(its, who);
  return (
    <Link to={`/log/bill/${b.id}`} className="bl-card" aria-label={`บิล ${b.title} ส่วนของ${name}`}>
      <div className="top"><span className="tx"><span className="t">{b.title}</span><span className="s num"><span className="nw">{b.dateLabel}</span> · <span className="nw">{name}มีส่วน {lines.length} รายการ</span></span></span><StatusPill s={x.status} /></div>
      <ul className="lines">{lines.map((l) => <li key={l.id}><span className="nm">{l.name}</span><span className="dv">หาร {l.n}</span><span className="num v">{baht(l.share)}</span></li>)}</ul>
      <div className="sumbox"><span>รวมส่วนของ{name} · จ่ายแล้ว <span className="num">{baht(x.paid)}</span></span><b className="num">{baht(x.share)}</b></div>
    </Link>
  );
}
