// รายการที่ลากเรียงได้ (ห่อ useDragSort ให้ใช้ในลูปได้) + ปุ่มจุด 6 จุด
import type { ReactNode } from 'react';
import { useDragSort } from './useDragSort';

type ItemProps = ReturnType<ReturnType<typeof useDragSort>['item']>;
type HandleProps = ReturnType<ReturnType<typeof useDragSort>['handle']>;

export function SortList({ ids, onCommit, children }: {
  ids: string[]; onCommit: (ids: string[]) => void;
  children: (id: string, item: ItemProps, handle: HandleProps, dragging: boolean) => ReactNode;
}) {
  const d = useDragSort(ids, onCommit);
  return <>{d.list.map((id) => children(id, d.item(id), d.handle(id), d.dragging === id))}</>;
}

export function Grip({ label, ...props }: { label: string } & HandleProps) {
  return (
    <span role="button" tabIndex={-1} aria-label={label} className="grip" {...props}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
    </span>
  );
}
