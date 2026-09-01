import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  onClose?: () => void
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(30, 20, 10, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: 16,
          }}
          onClick={this.props.onClose}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: 24,
              boxShadow: '0 8px 32px rgba(43, 31, 21, 0.25)',
              border: '1px solid var(--color-border, #D9D3C5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-error, #8B2E2E)', marginBottom: 8 }}>
              {this.props.fallbackTitle ?? 'An unexpected error occurred'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16, wordBreak: 'break-word' }}>
              {this.state.error?.message ?? 'Please check the console for more details.'}
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                this.props.onClose?.()
              }}
              style={{
                width: '100%',
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-primary, #3B2A1F)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
