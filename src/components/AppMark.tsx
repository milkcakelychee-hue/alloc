// สัญลักษณ์แอป (แถบ 4 ท่อน) บนพื้น hero ตามบอร์ด AppIcon
export function AppMark({ size = 76 }: { size?: number }) {
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: size * 0.29, background: 'var(--hero)', flex: 'none',
      boxShadow: '0 10px 24px rgba(17,37,26,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 44 44">
        <rect x="8" y="9" width="28" height="7" rx="3.5" fill="#FFFFFF" />
        <rect x="8" y="19" width="19" height="7" rx="3.5" fill="#C6E43F" />
        <rect x="29" y="19" width="7" height="7" rx="3.5" fill="#8FC2A0" />
        <rect x="8" y="29" width="11" height="7" rx="3.5" fill="#8FC2A0" />
        <rect x="21" y="29" width="15" height="7" rx="3.5" fill="#FFFFFF" opacity=".55" />
      </svg>
    </span>
  );
}
