import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useBoard } from '../context/BoardContext';

function getUserColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

export default function EnhancedPresence() {
  const { presence, activeEdits } = useBoard();
  const { user } = useUser();
  const [now, setNow] = useState(Date.now());
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const onlineUsers = Object.entries(presence).filter(([uid, p]) => {
    if (!p || p.online === false) return false;
    const lastSeen = p.lastSeen;
    if (!lastSeen) return true;
    const age = now - lastSeen;
    return age < 60000; // Show if active in last 60 seconds
  });

  const onlineCount = onlineUsers.length;
  const others = onlineUsers.filter(([uid]) => uid !== user?.id);

  const getTimeSince = (timestamp) => {
    if (!timestamp) return 'now';
    const seconds = Math.floor((now - timestamp) / 1000);
    if (seconds < 5) return 'now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const getUserActivity = (uid) => {
    // Check if user is editing any object
    const editingObjects = Object.entries(activeEdits).filter(
      ([objId, edit]) => edit.userId === uid
    );
    if (editingObjects.length > 0) {
      return 'Editing object';
    }
    return 'Viewing';
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowPanel(!showPanel)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 6,
          color: '#6EE7B7',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        title="View who's online"
      >
        <span>👥</span>
        <span>{onlineCount} online</span>
      </button>

      {showPanel && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: 'rgba(15, 23, 42, 0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: 16,
            minWidth: 280,
            maxHeight: 400,
            overflowY: 'auto',
            zIndex: 2000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{
            color: '#E2E8F0',
            fontSize: '0.875rem',
            fontWeight: 600,
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            Who's Online ({onlineCount})
          </div>

          {/* Current user */}
          {user && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: getUserColor(user.id),
                  boxShadow: '0 0 8px currentColor',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#E2E8F0', fontSize: '0.875rem', fontWeight: 500 }}>
                  {user.firstName || user.emailAddresses?.[0]?.emailAddress || 'You'} (you)
                </div>
                <div style={{ color: '#6EE7B7', fontSize: '0.75rem' }}>
                  Active now
                </div>
              </div>
            </div>
          )}

          {/* Other users */}
          {others.map(([uid, p]) => {
            const name = p.displayName || 'Anonymous';
            const lastSeen = p.lastSeen;
            const timeSince = getTimeSince(lastSeen);
            const activity = getUserActivity(uid);
            const isActive = timeSince === 'now' || timeSince.includes('s ago');

            return (
              <div
                key={uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: getUserColor(uid),
                    boxShadow: isActive ? '0 0 8px currentColor' : 'none',
                    opacity: isActive ? 1 : 0.5,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#E2E8F0', fontSize: '0.875rem', fontWeight: 500 }}>
                    {name}
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>
                    {activity} · Last seen {timeSince}
                  </div>
                </div>
              </div>
            );
          })}

          {others.length === 0 && (
            <div style={{
              color: '#64748B',
              fontSize: '0.875rem',
              fontStyle: 'italic',
              padding: '12px 0',
              textAlign: 'center',
            }}>
              No other users online
            </div>
          )}
        </div>
      )}
    </div>
  );
}
