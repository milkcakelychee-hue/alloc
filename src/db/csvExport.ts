// ส่งออก CSV 2 ไฟล์ (บันทึก + แผนรายเดือน) ผ่านหน้าแชร์ของระบบ · เครื่องที่แชร์ไฟล์ไม่ได้ดาวน์โหลดทีละไฟล์
import type { AllocDB } from './db';
import { logCsv, planCsv, planMonths } from '../calc/csv';
import { appCycle, localToday } from '../calc/dates';

const stamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function buildCsvFiles(db: AllocDB, now = new Date()) {
  const [s, entries, cats, groups, items, accounts] = await Promise.all([
    db.settings.get('app'), db.logEntries.toArray(), db.logCategories.toArray(),
    db.planGroups.toArray(), db.planItems.toArray(), db.accounts.toArray()
  ]);
  const cur = appCycle(localToday(now), s!.pay, s?.startCycle);
  const months = planMonths(items, cur, s?.startCycle);
  const d = stamp(now);
  return [
    new File([logCsv(entries, cats)], `alloc-บันทึก-${d}.csv`, { type: 'text/csv' }),
    new File([planCsv(groups, items, accounts, months)], `alloc-แผน-${d}.csv`, { type: 'text/csv' })
  ];
}

export async function exportCsv(db: AllocDB): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const files = await buildCsvFiles(db);
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files }) && nav.share) {
    try { await nav.share({ files, title: 'ส่งออก Alloc' }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  return 'downloaded';
}
