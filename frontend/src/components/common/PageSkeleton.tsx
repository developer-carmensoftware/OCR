/**
 * PageSkeleton — Sentry-style skeleton shown during Suspense lazy-load.
 * Uses the design system's CSS variables so it respects light/dark mode.
 */
export default function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-hidden="true">
      {/* Top progress bar that runs to 100% and fades out */}
      <div className="page-skeleton-bar" />

      {/* Centred skeleton card */}
      <div className="page-skeleton-body">
        {/* Header row */}
        <div className="page-skeleton-header">
          <div className="sk-block sk-title" />
          <div className="sk-block sk-badge" />
        </div>

        {/* Main card */}
        <div className="page-skeleton-card">
          {/* File upload zone placeholder */}
          <div className="sk-block sk-upload-zone">
            <div className="sk-block sk-icon" />
            <div className="sk-block sk-line sk-line-md" />
            <div className="sk-block sk-line sk-line-sm" />
          </div>

          {/* Divider */}
          <div className="sk-divider" />

          {/* Row of three pills */}
          <div className="sk-pills">
            <div className="sk-block sk-pill" />
            <div className="sk-block sk-pill" />
            <div className="sk-block sk-pill" />
          </div>

          {/* Two wide lines */}
          <div className="sk-block sk-line sk-line-full" />
          <div className="sk-block sk-line sk-line-lg" />
        </div>

        {/* Bottom action strip */}
        <div className="page-skeleton-footer">
          <div className="sk-block sk-btn" />
          <div className="sk-block sk-btn sk-btn-primary" />
        </div>
      </div>
    </div>
  )
}
