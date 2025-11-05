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
            borderRadius: '8px',
            backgroundColor: toast.type === 'success' ? '#4CAF50' : '#F44336',
            color: 'white',
            minWidth: '300px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <strong>{toast.title}</strong>
          <div style={{ fontSize: '14px', marginTop: '4px' }}>{toast.body}</div>
        </div>
      ))}
    </div>
  );
};

