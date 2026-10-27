// บิลแชร์ · สร้างสรุปบิล (บอร์ด BillSummary): บิลเดียว / หลายบิล / คนเดียวจากหลายบิล → ใบแจ้งยอดแยกใบต่อคน
// ส่งออกเป็นข้อความ / รูป / แชร์ (Web Share API)
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ME_ID, type Bill } from '../../db/types';
import { billTotal, receiptFor, receiptText, shareOf } from '../../calc/bills';
import { localToday, thaiDate } from '../../calc/dates';
import { Icon } from '../../components/Icon';
import { baht } from '../goals/goalUi';
import { usePlanData } from '../plan/usePlanData';
import { Avatar, Barcode, Dots, Receipt, itemsOf, paymentsOf, useBillData } from './billUi';
import { BillIcon } from './BillList';

type Mode = 'one' | 'many' | 'person';

const ManyIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 3.5h10v15" /><path d="M5 6.5h10v14l-2-1.3-3 1.3-3-1.3-2 1.3z" /></svg>;
const PersonIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5" /></svg>;
const ImgIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m20.5 16-5-5-8 8" /></svg>;
const ShareIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 13v6h14v-6" /></svg>;

export function BillSummary() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const data = useBillData();
  const plan = usePlanData();
  const fromBill = sp.get('b');
  const [mode, setMode] = useState<Mode>('one');
  const [one, setOne] = useState<string | null>(fromBill);
  const [many, setMany] = useState<Record<string, boolean> | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [viewSel, setView] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const paper = useRef<HTMLDivElement>(null);
  const s = plan?.settings;

  const owedBills = useMemo(() => (data ? data.bills.filter((b) => shareOf(itemsOf(data, b.id), paymentsOf(data, b.id), 'all').owed > 0) : []), [data]);
  if (!data || !s) return null;
  const others = data.people.filter((p) => p.id !== ME_ID && data.bills.some((b) => b.peopleIds.includes(p.id)));
  const person = (id: string) => data.people.find((p) => p.id === id);
  const oneId = one ?? owedBills[0]?.id ?? data.bills[0]?.id ?? null;
  const manySel = many ?? Object.fromEntries(owedBills.map((b) => [b.id, true]));
  const whoId = who ?? others[0]?.id ?? null;
  const avail = mode === 'person' ? data.bills.filter((b) => whoId && b.peopleIds.includes(whoId)) : data.bills;
  // คนเดียว: ค่าเริ่มต้นติ๊กบิลที่คนนั้นยังค้าง
  const personSel = (b: Bill) => (many ? !!many[b.id] : !!whoId && shareOf(itemsOf(data, b.id), paymentsOf(data, b.id), whoId).owed > 0);
  const sel = avail.filter((b) => (mode === 'one' ? b.id === oneId : mode === 'many' ? !!manySel[b.id] : personSel(b)));
  const ppl = mode === 'person' ? (whoId ? [whoId] : []) : [...new Set(sel.flatMap((b) => b.peopleIds).filter((p) => p !== ME_ID))];
  const view = mode === 'person' ? whoId : viewSel && ppl.includes(viewSel) ? viewSel : ppl[0] ?? null;
  const toggle = (b: Bill) => {
    if (mode === 'one') return setOne(b.id);
    const base = mode === 'many' ? manySel : Object.fromEntries(avail.map((x) => [x.id, personSel(x)]));
    setMany({ ...base, [b.id]: !base[b.id] });
  };
  const switchMode = (m: Mode) => { setMode(m); setMany(m === 'many' ? manySel : null); };
  const issued = thaiDate(localToday());
  const receiptOf = (pid: string) => receiptFor(pid, sel, (id) => itemsOf(data, id), (id) => paymentsOf(data, id));
  const r = view ? receiptOf(view) : null;
  const name = view ? person(view)?.name ?? '' : '';

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500); };
  const copy = async () => {
    if (!r) return;
    try { await navigator.clipboard.writeText(receiptText(name, issued, r, s.receiveInfo)); flash('คัดลอกข้อความแล้ว'); } catch { flash('คัดลอกไม่ได้ ลองใหม่อีกครั้ง'); }
  };
  const toPng = async (pid: string) => {
    const { toBlob } = await import('html-to-image');
    if (pid !== view) { setView(pid); await new Promise((res) => setTimeout(res, 80)); }
    const blob = paper.current ? await toBlob(paper.current, { pixelRatio: 3, backgroundColor: 'transparent' }) : null;
    return blob ? new File([blob], `ใบแจ้งยอด-${person(pid)?.name ?? ''}.png`, { type: 'image/png' }) : null;
  };
  const saveImg = async () => {
    if (!view) return;
    const f = await toPng(view);
    if (!f) return flash('สร้างรูปไม่ได้');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f); a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash('บันทึกรูปแล้ว');
  };
  const share = async () => {
    const targets = mode !== 'person' && ppl.length > 1 ? ppl : view ? [view] : [];
    if (!targets.length) return;
    const back = view;
    try {
      const files = [];
      for (const pid of targets) { const f = await toPng(pid); if (f) files.push(f); }
      if (back && back !== view) setView(back);
      const text = targets.map((pid) => receiptText(person(pid)?.name ?? '', issued, receiptOf(pid), s.receiveInfo)).join('\n\n');
      if (files.length && navigator.canShare?.({ files })) await navigator.share({ files, title: 'ใบแจ้งยอด' });
      else if (navigator.share) await navigator.share({ text, title: 'ใบแจ้งยอด' });
      else { await navigator.clipboard.writeText(text); flash('เครื่องนี้แชร์ไม่ได้ คัดลอกข้อความให้แล้ว'); }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') flash('แชร์ไม่ได้ ลองบันทึกเป็นรูปแทน');
    }
  };
  const shareLab = mode !== 'person' && ppl.length > 1 ? `แชร์ทั้ง ${ppl.length} ใบ` : `แชร์ใบนี้ให้ ${name}`;

  return (
    <main className="page lgp lgp-sub bl-sum">
      <div className="lg-head">
        <button className="lg-sq" aria-label="กลับไปบิลแชร์" onClick={() => nav(-1)}><Icon name="back" size={20} stroke={2} /></button>
        <span className="bl-dh"><span className="s">บิลแชร์</span><h1>สร้างสรุปบิล</h1></span>
      </div>

      <section aria-label="1 สรุปแบบไหน" className="bl-box bl-modes">
        <h2><span className="num c">1 ·</span> เลือกรูปแบบใบสรุป</h2>
        <div role="radiogroup" aria-label="แบบสรุป">
          {([['one', 'บิลเดียว', <>ใบสรุปของบิลเดียว <span className="nw">ส่งให้ทุกคนในบิลนั้น</span></>, <BillIcon key="i" size={20} />],
            ['many', 'หลายบิล', <>รวมหลายบิลไว้ในใบเดียว <span className="nw">แสดงยอดแยกตามแต่ละคน</span></>, <ManyIcon key="i" />],
            ['person', 'คนเดียว จากหลายบิล', <>ใบเรียกเก็บของคนเดียว <span className="nw">รวมทุกบิลที่เขายังค้างอยู่</span></>, <PersonIcon key="i" />]] as const).map(([m, t, d, ic]) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => switchMode(m)}>
              <span className="ic">{ic}</span><span className="tx"><span className="t">{t}</span><span className="d">{d}</span></span><span className="rd" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section aria-label="2 เลือกบิล" className="bl-box bl-pick">
        <div className="bl-bh"><h2><span className="num c">2 ·</span> {mode === 'one' ? 'เลือกบิล 1 ใบ' : mode === 'many' ? 'เลือกบิลที่จะรวม' : 'เลือกคน แล้วติ๊กบิลที่จะรวม'}</h2>
          {mode !== 'one' && <span className="num">เลือกแล้ว {sel.length} บิล</span>}</div>
        {mode === 'person' && (
          <div role="radiogroup" aria-label="เลือกคน" className="bl-filter chips">
            {others.map((p) => <button key={p.id} role="radio" aria-checked={whoId === p.id} className={`av${whoId === p.id ? ' on' : ''}`} onClick={() => { setWho(p.id); setMany(null); }}><Avatar person={p} size={26} />{p.name}</button>)}
          </div>
        )}
        <div className="bills">
          {avail.map((b) => {
            const on = sel.includes(b);
            return (
              <button key={b.id} role={mode === 'one' ? 'radio' : 'checkbox'} aria-checked={on} onClick={() => toggle(b)}>
                <span className={`mk ${mode === 'one' ? 'r' : 'c'}${on ? ' on' : ''}`} aria-hidden="true">{on && mode !== 'one' && <Icon name="check" size={14} stroke={3} />}</span>
                <span className="tx"><span className="t">{b.title}</span><span className="d num">{b.dateLabel}</span></span>
                <span className="avs">{b.peopleIds.map((id) => <Avatar key={id} person={person(id)} size={22} ring />)}</span>
                <span className="num amt">{baht(billTotal(itemsOf(data, b.id)))}<small>บาท</small></span>
              </button>
            );
          })}
          {avail.length === 0 && <div className="bl-empty sm">ยังไม่มีบิล</div>}
        </div>
      </section>

      <section aria-label="3 ตัวอย่างใบสรุป" className="bl-prev">
        <div className="h"><h2><span className="num c">3 ·</span> ตัวอย่างใบสรุป</h2>
          <span>{mode === 'person' ? `ใบเดียวสำหรับ ${name}` : ppl.length > 1 ? `แยกใบตามคน · ${ppl.length} ใบ` : ppl.length ? '1 ใบ' : ''}</span></div>
        {mode !== 'person' && ppl.length > 1 && (
          <div role="tablist" aria-label="ดูใบของใคร" className="bl-filter chips">
            {ppl.map((pid) => <button key={pid} role="tab" aria-selected={view === pid} className={`av${view === pid ? ' on' : ''}`} onClick={() => setView(pid)}><Avatar person={person(pid)} size={26} />{person(pid)?.name}</button>)}
          </div>
        )}
        {r && view ? (
          <div ref={paper} className="bl-shot">
            <Receipt pad="20px 18px 26px">
              <div className="bl-rc-h"><span className="k">ALLOC · ใบแจ้งยอด</span><span className="t">ถึง {name}</span><span className="m num">ออกเมื่อ {issued} · {r.blocks.length} บิล</span></div>
              <div className="bl-dash" aria-hidden="true" />
              {r.blocks.map((b) => (
                <div key={b.bill.id} className="bl-rb">
                  <div className="bh"><span>{b.bill.title}</span><span className="num">{b.bill.dateLabel}</span></div>
                  {b.lines.map((l) => <div key={l.id} className="ln">{l.name} <small>÷{l.n}</small><Dots /><span className="num">{baht(l.share)}</span></div>)}
                  {b.paid > 0 && <div className="ln ok">ชำระแล้ว<Dots /><span className="num">−{baht(b.paid)}</span></div>}
                  <div className="ln tot">รวมบิลนี้<Dots /><span className="num">{baht(b.due)}</span></div>
                  {b.bill.note && <div className="nt">หมายเหตุ: {b.bill.note}</div>}
                  <div className="bl-dash" aria-hidden="true" />
                </div>
              ))}
              <div className="bl-rc-tot due"><span>ยอดที่ต้องโอน</span><b className="num">{baht(r.grand)}<small>บาท</small></b></div>
              <div className="bl-rc-foot"><Barcode h={20} />
                <span className="n r">{s.receiveInfo.trim() ? <>โอนเข้า: {s.receiveInfo.trim()}</> : <>โอนเข้า: บัญชีของฉัน<br />ตั้งช่องทางรับเงินได้ในตั้งค่า</>}</span></div>
            </Receipt>
          </div>
        ) : <div className="bl-empty">เลือกบิลที่มีคนหารด้วย <span className="nw">เพื่อดูตัวอย่างใบสรุป</span></div>}
      </section>

      <div className="bl-acts two">
        <button className="out" disabled={!r} onClick={copy}><Icon name="copy" size={18} stroke={2} />คัดลอกข้อความ</button>
        <button className="out" disabled={!r} onClick={saveImg}><ImgIcon />บันทึกเป็นรูป</button>
      </div>
      <button className="bl-share" disabled={!r} onClick={share}><ShareIcon />{shareLab}</button>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

