// เงินไปไหน (บอร์ด LogSpend): สัดส่วนรายจ่ายตามหมวด · งบแต่ละหมวด · สิ่งที่น่าสังเกต (คิดจากตัวเลขเท่านั้น)
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { appCycle, addMonths, cycleRange, localToday, thaiDate, thaiMonth } from '../../calc/dates';
import { weekday } from '../../calc/payday';
import { categoryBudget, cycleDays, expensesIn, offBudgetTotal, pace, topDay, whereMoneyGoes } from '../../calc/log';
import { cutPerDay, dailyBudgetParts, planLabelOf, typicalRange, weekdaySplit } from '../../calc/logView';
import { goalAwareAmountOf } from '../../calc/goals';
import { Icon } from '../../components/Icon';
import { baht } from '../goals/goalUi';
import { CatIcon, catStyle } from './catIcon';
import { useLogData } from './useLogData';

// สีกราฟตามลำดับตายตัว (SPEC หัวข้อ 3 · บอร์ด LogSpend) · เกิน 7 หมวดรวมเป็น "อื่น ๆ" สีเทา
const RANK = ['#eb6834', '#2a78d6', '#eda100', '#e87ba4', '#6250d6', '#1baf7a', '#e34948'];
const OTHER = '#9AA29C';
const dm = (d: string) => thaiDate(d).split(' ').slice(0, 2).join(' ');
const WDS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const pctI = (r: number) => `${Math.round(r * 100)}%`;
const light = (c: string, p = 70) => `color-mix(in srgb, ${c} ${p}%, #FFFFFF)`;

export default function LogSpend() {
  const data = useLogData();
  const nav = useNavigate();
  const [prev, setPrev] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  if (!data?.settings) return null;
  const s = data.settings;
  const today = localToday();
  const cur = appCycle(today, s.pay, s.startCycle);
  const cycle = prev ? addMonths(cur, -1) : cur;
  const r = cycleRange(cycle, s.pay);
  const end = prev ? r.end : today;
  const days = prev ? r.days : cycleDays(today, s.pay).elapsed;
  const amountOf = goalAwareAmountOf(data.goals, data.items, data.adjustments, cur);
  const exp = expensesIn(data.entries, cycle, s.pay);
  const w = whereMoneyGoes(exp, 8);
  const total = w.total;
  const colorOf = (id: string) => (id === 'other' ? OTHER : RANK[w.rows.findIndex((x) => x.categoryId === id)] ?? OTHER);
  const catOf = (id: string) => data.categories.find((c) => c.id === id);
  const nameOf = (id: string) => (id === 'other' ? 'อื่น ๆ รวม' : catOf(id)?.name ?? 'อื่น ๆ');

  // โดนัท: เว้น 2px ระหว่างชิ้น
  const C = 2 * Math.PI * 70;
  let acc = 0;
  const segs = w.rows.map((x) => { const len = x.ratio * C; const seg = { id: x.categoryId, off: acc, len: Math.max(len - (w.rows.length > 1 ? 2 : 0), 0.5) }; acc += len; return seg; });
  const s1 = sel ? w.rows.find((x) => x.categoryId === sel) : null;

  // อินไซต์
  const top = w.rows[0];
  const topLinked = top && top.categoryId !== 'other' ? data.items.filter((i) => i.logCategoryIds.includes(top.categoryId)) : [];
  const topGroup = top ? [...new Set([top.categoryId, ...topLinked.flatMap((i) => i.logCategoryIds)])].filter((id) => w.rows.some((x) => x.categoryId === id)) : [];
  const topSum = topGroup.reduce((a, id) => a + (w.rows.find((x) => x.categoryId === id)?.total ?? 0), 0);
  const range = top ? typicalRange(exp.filter((e) => topGroup.includes(e.categoryId))) : null;
  const parts = dailyBudgetParts(data.groups, data.items, exp, cycle, amountOf).sort((a, b) => b.spent - a.spent);
  const main = parts[0];
  const pc = main ? pace(main.spent, main.budget, prev ? r.end : today, s.pay) : null;
  const dLeft = prev ? 0 : cycleDays(today, s.pay).daysLeft;
  const cut = main && pc && !prev ? cutPerDay(main.spent, main.budget, pc.projected, dLeft) : null;
  const off = offBudgetTotal(exp, data.items);
  const offRows = w.rows.filter((x) => x.categoryId !== 'other' && !planLabelOf(x.categoryId, data.items)).slice(0, 3);
  const ws = weekdaySplit(exp, end, s.pay);
  const td = topDay(exp);
  const next = addMonths(cur, 1);

  return (
    <main className="page lgp lgp-sub">
      <div className="lg-head">
        <button className="lg-sq" aria-label="กลับไปบันทึก" onClick={() => nav('/log')}><Icon name="back" size={20} stroke={2} /></button>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}><span style={{ fontSize: 12, color: 'var(--ink3)' }}>บันทึก · สรุปรายจ่าย</span><b style={{ fontSize: 20, fontWeight: 700 }}>เงินไปไหน</b></span>
      </div>
      <div className="lg-tabs" role="tablist" aria-label="ช่วงเวลา" style={{ padding: 4, background: 'var(--card2)', boxShadow: 'none' }}>
        <button role="tab" aria-selected={!prev} onClick={() => { setPrev(false); setSel(null); }} style={{ height: 36, fontSize: 13, fontWeight: 600 }}>รอบนี้ · <span className="num nw">{dm(cycleRange(cur, s.pay).start)}–{dm(today)}</span></button>
        <button role="tab" aria-selected={prev} onClick={() => { setPrev(true); setSel(null); }} style={{ height: 36, fontSize: 14, fontWeight: 600 }}>รอบก่อน</button>
      </div>

      {total === 0 ? (
        <section className="lgs-donut"><span className="lg-empty" style={{ border: 0 }}>ยังไม่มีรายจ่ายใน{prev ? 'รอบก่อน' : 'รอบนี้'}</span></section>
      ) : <>
        <section className="lgs-donut" aria-label="สัดส่วนรายจ่ายตามหมวด">
          <div className="ring">
            <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label={`สัดส่วนรายจ่าย ${w.rows.length} หมวด รวม ${baht(total)} บาท`}>
              <g transform="rotate(-90 100 100)" fill="none">
                {segs.map((g) => (
                  <circle key={g.id} cx="100" cy="100" r="70" stroke={colorOf(g.id)} strokeWidth={sel === g.id ? 32 : 24} opacity={sel && sel !== g.id ? 0.3 : 1}
                    strokeDasharray={`${g.len.toFixed(2)} ${C.toFixed(1)}`} strokeDashoffset={-g.off} onClick={() => setSel(sel === g.id ? null : g.id)}>
                    <title>{nameOf(g.id)} {baht(w.rows.find((x) => x.categoryId === g.id)!.total)}</title>
                  </circle>
                ))}
              </g>
            </svg>
            <span className="ctr"><span>{s1 ? nameOf(s1.categoryId) : 'จ่ายไปแล้ว'}</span><b className="num">{baht(s1 ? s1.total : total)}</b>
              <span className="num">{s1 ? `${(s1.ratio * 100).toFixed(1)}% ของทั้งหมด` : `บาท · ${w.rows.length} หมวด`}</span></span>
          </div>
          <span className="tap">แตะชิ้นกราฟหรือหมวดด้านล่างเพื่อดูทีละหมวด</span>
          <div className="ft num"><span>รวม {w.rows.length} หมวด · {days} วัน</span><span>เฉลี่ยวันละ <b>{baht(Math.round(total / days / 100) * 100)}</b></span></div>
        </section>

        <div className="lgs-h"><h2>รายละเอียดตามหมวด</h2>
          <span className="lgk"><span><i style={{ background: RANK[0] }} />ใช้แล้ว</span><span><i style={{ background: 'repeating-linear-gradient(135deg, var(--lg-remain) 0 2px, var(--card) 2px 4px)', boxShadow: 'inset 0 0 0 1px var(--lg-remain)' }} />งบที่เหลือ</span></span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {w.rows.map((x) => {
            const cat = x.categoryId === 'other' ? null : catOf(x.categoryId);
            const col = colorOf(x.categoryId);
            const label = cat ? planLabelOf(cat.id, data.items) : null;
            const b = cat && label ? categoryBudget(cat.id, data.items, exp, cycle, amountOf) : null;
            const sibs = b ? [...new Set(data.items.filter((i) => i.logCategoryIds.includes(cat!.id)).flatMap((i) => i.logCategoryIds))].filter((id) => id !== cat!.id && exp.some((e) => e.categoryId === id)) : [];
            const sibAmt = (id: string) => exp.filter((e) => e.categoryId === id).reduce((a, e) => a + e.myShare, 0);
            const used = b ? b.spentSelf + b.spentSiblings : 0;
            const scale = b ? Math.max(b.budget!, used) : 1;
            return (
              <article key={x.categoryId} className="lgs-card" aria-pressed={sel === x.categoryId} onClick={() => setSel(sel === x.categoryId ? null : x.categoryId)}>
                <div className="hd">
                  <span className="cat-ic" style={catStyle(cat)}><CatIcon icon={cat?.icon ?? 'other'} /></span>
                  <span className="t"><span><i className="dotc" aria-hidden="true" style={{ background: col }} />{nameOf(x.categoryId)}</span>
                    <span className="num">จด {x.count} ครั้ง · {label ? `นับเข้างบ${label}` : x.categoryId === 'other' ? 'หลายหมวด' : 'นอกงบ'}</span></span>
                  <Link to="/log" aria-label={`ดูรายการ${nameOf(x.categoryId)}`} className="go" onClick={(e) => e.stopPropagation()}><Icon name="calendar" size={17} stroke={2} /></Link>
                </div>
                <div className="st">
                  <span><span className="k">ยอด</span><span className="v num">{baht(x.total)}</span></span>
                  <span><span className="k">สัดส่วน</span><span className="v num">{pctI(x.ratio)}</span></span>
                  <span><span className="k">เฉลี่ยต่อครั้ง</span><span className="v num">{baht(Math.round(x.avg / 100) * 100)}</span></span>
                </div>
                {b && <>
                  <div className="lgs-bar" aria-hidden="true">
                    <span style={{ width: `${(b.spentSelf / scale) * 100}%`, background: `linear-gradient(90deg, ${light(col)}, ${col})` }} />
                    {sibs.map((id) => <span key={id} title={nameOf(id)} style={{ width: `${(sibAmt(id) / scale) * 100}%`, background: light(colorOf(id), 60) }} />)}
                    {b.remaining! > 0 && <span className="rem" />}
                  </div>
                  {sibs.length > 0 && (
                    <div className="lgd">
                      <span><i style={{ background: col }} />{cat!.name}</span>
                      {sibs.map((id) => <span key={id}><i style={{ background: light(colorOf(id), 60) }} />{nameOf(id)} <span className="num">{baht(sibAmt(id))}</span> (นับรวมในงบ{label})</span>)}
                      <span><i style={{ background: 'repeating-linear-gradient(135deg, var(--lg-remain) 0 2px, var(--card) 2px 4px)', boxShadow: 'inset 0 0 0 1px var(--lg-remain)' }} />งบที่เหลือ</span>
                    </div>
                  )}
                  <div className="bf"><span>งบ{label}{sibs.length ? <> · รวม{sibs.map((id) => `${nameOf(id)} ${baht(sibAmt(id))}`).join(' ')}</> : null}</span>
                    <span className={`pill num${b.remaining! < 0 ? ' over' : ''}`}>ใช้ {pctI(used / b.budget!)}</span>
                    <span className="num nw">{b.remaining! < 0 ? `เกิน ${baht(-b.remaining!)}` : `เหลือ ${baht(b.remaining!)}`} / {baht(b.budget!)}</span></div>
                </>}
              </article>
            );
          })}
        </div>

        <h2 style={{ margin: '6px 2px 0', fontSize: 16, fontWeight: 600 }}>สิ่งที่น่าสังเกต</h2>
        {top && (
          <article className="lgs-ins">
            <span className="ic cat-ic" style={catStyle(catOf(top.categoryId))}><CatIcon icon={catOf(top.categoryId)?.icon ?? 'other'} size={18} /></span>
            <span className="t"><span className="itag" style={{ color: 'var(--lg-exp)' }}>มากที่สุด</span>
              <span className="ti">เงินส่วนใหญ่ไปกับหมวด{topGroup.map((id, i) => <span key={id}>{i ? ' + ' : ''}<span className="nw">{nameOf(id)}</span></span>)}</span>
              <span className="bd">{topGroup.map(nameOf).join(' + ')} รวม <b className="num">{baht(topSum)}</b> คิดเป็น <b className="num">{pctI(topSum / total)}</b> ของรายจ่าย{prev ? 'รอบก่อน' : 'รอบนี้'}{range && <> · ส่วนใหญ่ครั้งละ <span className="num nw">{baht(Math.round(range.low / 100) * 100)}–{baht(Math.round(range.high / 100) * 100)}</span> บาท</>}</span></span>
          </article>
        )}
        {main && pc && (
          <article className="lgs-ins">
            <span className="ic" style={{ background: 'var(--gx-ok-bg)', color: 'var(--gx-ok)' }}><Icon name="trend" size={18} stroke={2} /></span>
            <span className="t"><span className="itag" style={{ color: 'var(--gx-ok)' }}>ตามงบ</span>
              <span className="ti">{prev ? (main.spent <= main.budget ? `${main.name}จบรอบในงบ` : `${main.name}เกินงบ`) : pc.projected <= main.budget * 0.95 ? `${main.name}อยู่ในงบ` : pc.projected <= main.budget ? `${main.name}พอดีงบแบบเฉียดฉิว` : `${main.name}มีแนวโน้มเกินงบ`}</span>
              <span className="bd">ใช้ไป {pctI(pc.usedRatio)} ของงบ{prev ? <> · <span className="num">{baht(main.spent)}</span> จากงบ <span className="num">{baht(main.budget)}</span></>
                : <> ในขณะที่รอบผ่านไป {pctI(pc.elapsedRatio)} (<span className="num">{cycleDays(today, s.pay).elapsed}/{r.days}</span> วัน) ถ้าจ่ายแบบนี้ต่อจะจบรอบที่ราว <b className="num">{baht(Math.round(pc.projected / 100) * 100)}</b> จากงบ <span className="num">{baht(main.budget)}</span>{cut ? <> · ลดวันละ <span className="num">{baht(cut)}</span> บาทจะพอดีงบ</> : null}</>}</span></span>
          </article>
        )}
        {off > 0 && (
          <article className="lgs-ins">
            <span className="ic" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><Icon name="alert" size={18} stroke={2} /></span>
            <span className="t"><span className="itag" style={{ color: 'var(--warning)' }}>นอกงบ</span>
              <span className="ti">มีรายจ่ายนอกงบ <span className="num">{baht(off)}</span> บาท</span>
              <span className="bd">{offRows.map((x) => `${nameOf(x.categoryId)} ${baht(x.total)}`).join(' · ')} ยังไม่มีงบรองรับ <span className="nw">ลองตั้งงบเล็ก ๆ ไว้ในแผนเดือนหน้า</span></span>
              <Link to={`/?tab=plan&m=${next}`}>เพิ่มในแผน {thaiMonth(next).split(' ')[0]} →</Link></span>
          </article>
        )}
        <article className="lgs-ins">
          <span className="ic" style={{ background: 'var(--inv-bg)', color: 'var(--inv)' }}><Icon name="calendar" size={18} stroke={2} /></span>
          <span className="t"><span className="itag" style={{ color: 'var(--inv)' }}>จังหวะการจ่าย</span>
            <span className="ti">{Math.abs(ws.weekdayAvg - ws.weekendAvg) <= Math.max(ws.weekdayAvg, ws.weekendAvg) * 0.1 ? 'วันธรรมดากับวันหยุดจ่ายพอ ๆ กัน' : ws.weekdayAvg > ws.weekendAvg ? 'วันธรรมดาจ่ายมากกว่าวันหยุด' : 'เสาร์-อาทิตย์จ่ายมากกว่าวันธรรมดา'}</span>
            <span className="bd">วันธรรมดาเฉลี่ย <b className="num">{baht(Math.round(ws.weekdayAvg / 100) * 100)}</b> · เสาร์-อาทิตย์ <b className="num">{baht(Math.round(ws.weekendAvg / 100) * 100)}</b>{td && <> · วันที่จ่ายเยอะสุดคือ <span className="nw num">{WDS[weekday(td.date)]} {dm(td.date)} {baht(td.total)}</span></>}</span></span>
        </article>
      </>}
      <span className="lgs-note">คิดจากรายจ่ายที่จดในหน้าบันทึก (นับเฉพาะส่วนของคุณในบิลที่หาร) · ไม่รวมเงินออม และเงินลงทุนที่อยู่ในแผน</span>
    </main>
  );
}
