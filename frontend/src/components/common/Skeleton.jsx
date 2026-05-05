export function Skeleton({ width = '100%', height = '1rem', radius = '6px', className = '' }) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--gray-100) 25%, var(--gray-200) 50%, var(--gray-100) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  )
}

export function SkeletonRow({ cols = 3 }) {
  return (
    <tr style={{ pointerEvents: 'none' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '0.5rem 0.75rem' }}>
          <Skeleton height="1.8rem" />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonGrid({ rows = 3, cols = 4, height = '1.9rem', gap = '0.5rem', colTemplate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: colTemplate || `repeat(${cols}, 1fr)`, gap }}>
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} height={height} />
          ))}
        </div>
      ))}
    </div>
  )
}
