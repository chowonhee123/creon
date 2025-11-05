import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '40px', 
          fontFamily: 'sans-serif',
          backgroundColor: '#f0f0f0',
          minHeight: '100vh'
        }}>
          <h1 style={{ color: '#d32f2f' }}>⚠️ 애플리케이션 에러</h1>
          <p style={{ color: '#666', fontSize: '18px', marginTop: '16px' }}>
            애플리케이션을 로드하는 중 오류가 발생했습니다.
          </p>
          {this.state.error && (
            <div style={{ 
              marginTop: '24px', 
              padding: '16px', 
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              <h3 style={{ color: '#333' }}>에러 메시지:</h3>
              <pre style={{ 
                marginTop: '8px',
                padding: '12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '14px',
                color: '#d32f2f'
              }}>
                {this.state.error.toString()}
                {this.state.error.stack && (
                  <div style={{ marginTop: '12px', color: '#666' }}>
                    {this.state.error.stack}
                  </div>
                )}
              </pre>
            </div>
          )}
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '24px',
              padding: '12px 24px',
              backgroundColor: '#2962FF',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            페이지 새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

