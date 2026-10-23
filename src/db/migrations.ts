// แปลงข้อมูลระหว่างเวอร์ชันโครงข้อมูล · ใช้ทั้งตอนอัปเกรดฐานข้อมูลในเครื่อง และตอนกู้คืนไฟล์สำรองเก่า
type Rows = Record<string, unknown[]>;
type Row = Record<string, unknown>;

/** v1 → v2: payday (ตัวเลข) → กฎวันเงินเข้า · รายการในแผนได้ dueDay = null */
export function migrateV1toV2<T extends Rows>(tables: T): T {
  const settings = (tables.settings ?? []).map((r) => {
    const { payday, ...rest } = r as Row;
    return { ...rest, pay: { kind: 'day', day: typeof payday === 'number' ? payday : 27 }, weekendShift: 'before', payOverrides: {}, schemaVersion: 2 };
  });
  const planItems = (tables.planItems ?? []).map((r) => ({ dueDay: null, ...(r as Row) }));
  return { ...tables, settings, planItems };
}
