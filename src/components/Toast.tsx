import React, { useEffect, useState } from 'react';

export interface ToastOptions {
  type: 'success' | 'error';
  title: string;
  body: string;
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: string;
}

const toastListeners: Array<(toast: ToastState) => void> = [];

export const showToast = (options: ToastOptions) => {
  const toast: ToastState = {
    ...options,
    id: Date.now().toString(),
  };
  toastListeners.forEach(listener => listener(toast));
};

export const Toast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEffect(() => {
    const listener = (toast: ToastState) => {
      setToasts(prev => [...prev, toast]);
      const duration = toast.duration || 3000;
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, duration);
    };
    
    toastListeners.push(listener);
    
    return () => {
      const index = toastListeners.indexOf(listener);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  return (
    <div className="toast-container" style={{ position: 'fixed', top: 20, right: 20, zIndex: 10000 }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          style={{
            marginBottom: '8px',
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: 'var(--surface-color, #1f1f1f)',
            color: 'var(--text-primary, #ffffff)',
            minWidth: '300px',
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.18)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            borderLeft: '4px solid',
            borderLeftColor:
              toast.type === 'success'
                ? 'var(--accent-color, #4CAF50)'
                : 'var(--danger-color, #F44336)',
          }}
        >
          <strong>{toast.title}</strong>
          <div style={{ fontSize: '14px', marginTop: '4px' }}>{toast.body}</div>
        </div>
      ))}
    </div>
  );
};

