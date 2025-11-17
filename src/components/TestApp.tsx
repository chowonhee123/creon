import React from 'react';

export const TestApp: React.FC = () => {
  return (
    <div style={{ padding: '40px', backgroundColor: 'var(--bg-color, #f0f0f0)', minHeight: '100vh' }}>
      <h1 style={{ color: 'var(--text-primary, #333)' }}>React가 정상적으로 작동 중입니다!</h1>
      <p style={{ color: 'var(--text-secondary, #666)' }}>이 텍스트가 보이면 React가 정상적으로 렌더링되고 있습니다.</p>
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: 'var(--surface-color, #fff)', borderRadius: '8px' }}>
        <h2>현재 시간:</h2>
        <p>{new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

