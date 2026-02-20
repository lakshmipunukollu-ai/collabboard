import { useEffect, useState } from 'react';

let toastQueue = [];
let toastListener = null;

// Persistent notification history (max 50, never auto-expires)
let notificationHistory = [];
let historyListeners = [];

let toastIdCounter = 0;

export function showToast(message, type = 'info') {
  const now = Date.now();
  const entry = { message, type, id: `toast-${now}-${++toastIdCounter}`, createdAt: now };

  // Add to persistent history
  notificationHistory = [entry, ...notificationHistory].slice(0, 50);
  historyListeners.forEach((fn) => fn([...notificationHistory]));

  // Only show floating popup for error and warning
  if (type === 'error' || type === 'warning') {
    toastQueue.push(entry);
    if (toastListener) toastListener();
  }
}

export function getNotificationHistory() {
  return [...notificationHistory];
}

export function clearNotificationHistory() {
  notificationHistory = [];
  historyListeners.forEach((fn) => fn([]));
}

export function subscribeToHistory(fn) {
  historyListeners.push(fn);
  return () => {
    historyListeners = historyListeners.filter((l) => l !== fn);
  };
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
        toastQueue = toastQueue.filter((t) => (t.createdAt != null ? now - t.createdAt < 3000 : true));
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
