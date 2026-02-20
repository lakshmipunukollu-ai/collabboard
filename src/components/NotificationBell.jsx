import { useState, useEffect, useRef, useCallback } from 'react';
import { getNotificationHistory, clearNotificationHistory, subscribeToHistory } from './Toast';

const DOT_COLOR = {
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(() => getNotificationHistory());
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadCount, setLastReadCount] = useState(0);
  const panelRef = useRef(null);
  const bellRef = useRef(null);
  // tick every 30s to refresh relative timestamps
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeToHistory((h) => {
      setHistory(h);
    });
    return unsub;
  }, []);

  // Update unread count when new notifications arrive and panel is closed
  useEffect(() => {
    if (!open) {
      setUnreadCount(Math.max(0, history.length - lastReadCount));
    }
  }, [history, open, lastReadCount]);

  // Mark all as read when panel opens
  useEffect(() => {
    if (open) {
      setLastReadCount(history.length);
      setUnreadCount(0);
    }
  }, [open, history.length]);

  // Refresh timestamps every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClear = useCallback(() => {
    clearNotificationHistory();
    setHistory([]);
    setUnreadCount(0);
    setLastReadCount(0);
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        style={{
          position: 'relative',
          background: open ? 'rgba(102, 126, 234, 0.15)' : 'transparent',
          border: '1px solid ' + (open ? 'rgba(102,126,234,0.4)' : 'rgba(255,255,255,0.1)'),
          borderRadius: 8,
          color: '#94A3B8',
          fontSize: '1.1rem',
          cursor: 'pointer',
          padding: '6px 10px',
          lineHeight: 1,
          transition: 'all 0.15s',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: '#EF4444',
            color: 'white',
            borderRadius: '50%',
            fontSize: '0.6rem',
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            padding: '0 3px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            maxHeight: 420,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 3000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid #334155',
            flexShrink: 0,
          }}>
            <span style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem' }}>
              Notifications
            </span>
            <button
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#94A3B8'}
              onMouseOut={(e) => e.currentTarget.style.color = '#64748B'}
            >
              Clear all
            </button>
          </div>

          {/* Notification list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {history.length === 0 ? (
              <div style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: '#475569',
                fontSize: '0.8rem',
              }}>
                No notifications yet
              </div>
            ) : (
              history.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 14px',
                    borderBottom: '1px solid #1e293b',
                    background: '#0f172a',
                  }}
                >
                  {/* Color dot */}
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: DOT_COLOR[n.type] || DOT_COLOR.info,
                    flexShrink: 0,
                    marginTop: 5,
                  }} />
                  {/* Message */}
                  <span style={{
                    color: '#CBD5E1',
                    fontSize: '0.8rem',
                    flex: 1,
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}>
                    {n.message}
                  </span>
                  {/* Timestamp */}
                  <span style={{
                    color: '#475569',
                    fontSize: '0.7rem',
                    flexShrink: 0,
                    marginTop: 3,
                  }}>
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
