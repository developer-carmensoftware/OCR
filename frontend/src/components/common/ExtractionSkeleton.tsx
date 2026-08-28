import { Skeleton, SkeletonGrid } from './Skeleton'

interface Props {
  status?: string
  elapsed?: number
}

export default function ExtractionSkeleton({ status, elapsed }: Props) {
  const showElapsed = elapsed !== undefined && elapsed >= 10

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* The status text is the only signal that extraction is progressing rather than
          hung, so it lives in a polite live region. The elapsed counter is hidden from it:
          it changes every second, and inside the region that is one announcement per
          second drowning out the status change that actually matters. */}
      <div className="extraction-status-strip" role="status">
        <div className="extraction-spinner" aria-hidden="true" />
        <span className="extraction-status-text">{status ?? 'Reading document…'}</span>
        {showElapsed && (
          <span className="extraction-elapsed" aria-hidden="true">
            {elapsed}s
          </span>
        )}
      </div>

      <div className="data-card">
        <div
          className="card-body"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <Skeleton height="1.1rem" width="40%" />
          <SkeletonGrid rows={3} cols={2} height="2.2rem" gap="0.75rem" />
        </div>
      </div>
      <div className="data-card">
        <div
          className="card-body"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
        >
          <Skeleton height="1.1rem" width="30%" />
          <SkeletonGrid
            rows={4}
            cols={4}
            height="1.9rem"
            gap="0.5rem"
            colTemplate="2fr 1fr 1fr 1fr"
          />
        </div>
      </div>
    </div>
  )
}
