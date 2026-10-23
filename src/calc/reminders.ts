// เตือนสำรองข้อมูล (SPEC 9 ข้อ 2): ยังไม่เคยสำรอง หรือผ่านไปเกิน 14 วัน
export const BACKUP_WARN_DAYS = 14;
const DAY = 86_400_000;

export function backupStatus(lastBackupAt: number | null | undefined, now = Date.now()) {
  if (!lastBackupAt) return { never: true, days: null as number | null, due: true };
  const days = Math.floor((now - lastBackupAt) / DAY);
  return { never: false, days, due: days > BACKUP_WARN_DAYS };
}
