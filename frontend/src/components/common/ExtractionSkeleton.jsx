import { Skeleton, SkeletonGrid } from './Skeleton'

/**
 * Shared loading skeleton shown while AI extracts data from a document.
 * Eliminates the identical pattern duplicated 4 times across CreditCardOCR and APInvoice pages.
 */
export default function ExtractionSkeleton() {
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
