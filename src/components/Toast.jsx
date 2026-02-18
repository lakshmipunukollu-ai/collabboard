import { useEffect, useState } from 'react';

let toastQueue = [];
let toastListener = null;

export function showToast(message, type = 'info') {
  toastQueue.push({ message, type, id: Date.now() });
  if (toastListener) toastListener();
}

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastListener = () => {
      setToasts([...toastQueue]);
    };

    const interval = setInterval(() => {
      if (toastQueue.length > 0) {
        const now = Date.now();
        toastQueue = toastQueue.filter((t) => now - t.id < 3000);
        setToasts([...toastQueue]);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      toastListener = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        right: 20,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: toast.type === 'success' ? '#10B981' : 
                       toast.type === 'error' ? '#EF4444' : 
                       toast.type === 'warning' ? '#F59E0B' : '#3B82F6',
            color: 'white',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: '0.875rem',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            animation: 'slideIn 0.3s ease-out',
            maxWidth: '300px',
          }}
        >
          {toast.message}
        </div>
      ))}
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}
