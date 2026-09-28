import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info)
  }

  handleRetry = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="error-boundary-wrap">
        <div className="error-boundary-card">
          <div className="error-boundary-icon">⚠️</div>
          <h2 className="error-boundary-title">Something went wrong</h2>
          <p style={{ margin: '0 0 0.5rem', color: 'var(--text-3, #6b7280)', fontSize: '0.9rem' }}>
            An unexpected error occurred. Your data has not been lost.
          </p>
          {this.state.error && <pre className="error-boundary-pre">{this.state.error.message}</pre>}
          <div
            style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <button type="button" onClick={this.handleRetry} className="error-boundary-btn-primary">
              Try Again
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '/'
                this.handleRetry()
              }}
              className="error-boundary-btn-secondary"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
