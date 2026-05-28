import { Component, type ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}
type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="block" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <p className="block-title">页面遇到了一点问题</p>
          <p className="block-note" style={{ marginTop: '0.45rem' }}>
            {this.state.error.message || '未知错误'}
          </p>
          <button
            type="button"
            className="ghost-btn"
            style={{ marginTop: '0.75rem' }}
            onClick={() => this.setState({ error: null })}
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
