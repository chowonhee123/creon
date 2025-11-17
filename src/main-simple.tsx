import React from 'react';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('Root element not found!');
} else {
  console.log('Root element found, rendering...');
  
  ReactDOM.createRoot(rootElement).render(
    <div style={{
      padding: '40px',
      backgroundColor: 'var(--bg-color, #f0f0f0)',
      minHeight: '100vh',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ color: 'var(--text-primary, #333)' }}>✅ React가 작동 중입니다!</h1>
      <p style={{ color: 'var(--text-secondary, #666)', fontSize: '18px' }}>
        이 메시지가 보이면 React가 정상적으로 렌더링되었습니다.
      </p>
      <div style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: 'var(--surface-color, #ffffff)',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2>현재 시간:</h2>
        <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
          {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  );
  
  console.log('React rendering completed');
}

