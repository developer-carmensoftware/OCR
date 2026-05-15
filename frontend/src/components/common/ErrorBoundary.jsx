import { Component } from 'react'

/**
 * Error Boundary — catches render errors in the component tree below it
 * and shows a friendly fallback UI instead of a blank screen.
 * Must be a class component (React requirement for componentDidCatch).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'var(--bg-1, #f8f9fc)',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: 'var(--bg-2, white)',
            borderRadius: '1rem',
            border: '1px solid var(--border, #e2e8f0)',
            padding: '2.5rem',
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              fontSize: '1.75rem',
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              margin: '0 0 0.5rem',
              fontSize: '1.125rem',
              fontWeight: 700,
              color: 'var(--text-1, #111)',
            }}
          >
            Something went wrong
          </h2>
          <p style={{ margin: '0 0 0.5rem', color: 'var(--text-3, #6b7280)', fontSize: '0.9rem' }}>
            An unexpected error occurred. Your data has not been lost.
          </p>
          {this.state.error && (
            <pre
              style={{
                margin: '0.75rem 0 1.25rem',
                padding: '0.75rem',
                background: 'var(--bg-3, #f1f5f9)',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                textAlign: 'left',
                color: 'var(--text-2, #374151)',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div
            style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.5rem 1.25rem',
                background: 'var(--purple, #7c3aed)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => {
                window.location.hash = '/'
                this.handleRetry()
              }}
              style={{
                padding: '0.5rem 1.25rem',
                background: 'transparent',
                color: 'var(--text-2, #374151)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
