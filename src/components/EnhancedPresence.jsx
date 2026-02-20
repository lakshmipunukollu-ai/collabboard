import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useBoard } from '../context/BoardContext';

function getUserColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const MAX_BUBBLES = 5;

export default function EnhancedPresence() {
  const { presence, activeEdits, followUserId, setFollowUserId } = useBoard();
  const { user } = useUser();
  const [now, setNow] = useState(Date.now());
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setShowPanel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel]);

  const onlineUsers = Object.entries(presence).filter(([, p]) => {
    if (!p || p.online === false) return false;
    return !p.lastSeen || (now - p.lastSeen) < 60000;
  });

  const allUsers = [
    ...(user ? [{ uid: user.id, name: user.firstName || user.emailAddresses?.[0]?.emailAddress || 'You', isMe: true }] : []),
    ...onlineUsers
      .filter(([uid]) => uid !== user?.id)
      .map(([uid, p]) => ({ uid, name: p.displayName || 'Anonymous', isMe: false, lastSeen: p.lastSeen, p })),
  ];

  const visibleBubbles = allUsers.slice(0, MAX_BUBBLES);
  const overflow = Math.max(0, allUsers.length - MAX_BUBBLES);

  const getTimeSince = (ts) => {
    if (!ts) return 'now';
    const s = Math.floor((now - ts) / 1000);
    if (s < 5) return 'now';
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  };

  const getUserActivity = (uid) => {
    const editing = Object.values(activeEdits).some((e) => e.userId === uid);
    return editing ? 'Editing' : 'Viewing';
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {/* Bubble row */}
      <div
        ref={btnRef}
        className="presence-bubbles"
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={() => setShowPanel((v) => !v)}
        title={`${allUsers.length} online — click to see who`}
      >
        {visibleBubbles.map(({ uid, name, isMe }) => (
          <div
            key={uid}
            className="presence-bubble"
            style={{ background: getUserColor(uid), zIndex: isMe ? 1 : undefined }}
            title={isMe ? `${name} (you)` : name}
          >
            {getInitials(name)}
          </div>
        ))}
        {overflow > 0 && (
          <div className="presence-overflow-pill" title={`${overflow} more online`}>
            +{overflow}
          </div>
        )}
      </div>

      {/* Dropdown panel */}
      {showPanel && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            background: 'rgba(15, 23, 42, 0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: 16,
            minWidth: 260,
            maxHeight: 380,
            overflowY: 'auto',
            zIndex: 2000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{
            color: '#E2E8F0', fontSize: '0.8rem', fontWeight: 600,
            marginBottom: 10, paddingBottom: 8,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            Who's Online ({allUsers.length})
          </div>

          {allUsers.map(({ uid, name, isMe, lastSeen }) => {
            const activity = isMe ? 'Active now' : getUserActivity(uid);
            const time = isMe ? '' : getTimeSince(lastSeen);
            const isFollowing = followUserId === uid;
            return (
              <div key={uid} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: getUserColor(uid),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 700, color: 'white',
                  flexShrink: 0,
                }}>
                  {getInitials(name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#E2E8F0', fontSize: '0.82rem', fontWeight: 500 }}>
                    {name}{isMe ? ' (you)' : ''}
                  </div>
                  <div style={{ color: isMe ? '#6EE7B7' : '#94A3B8', fontSize: '0.72rem' }}>
                    {activity}{time ? ` · ${time}` : ''}
                  </div>
                </div>
                {!isMe && (
                  <button
                    onClick={() => setFollowUserId(isFollowing ? null : uid)}
                    title={isFollowing ? 'Stop following' : `Follow ${name}`}
                    style={{
                      background: isFollowing ? 'rgba(110,231,183,0.15)' : 'rgba(255,255,255,0.07)',
                      border: `1px solid ${isFollowing ? 'rgba(110,231,183,0.4)' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: 6,
                      color: isFollowing ? '#6EE7B7' : '#94A3B8',
                      fontSize: '0.68rem',
                      padding: '3px 7px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {isFollowing ? '✓ Following' : 'Follow'}
                  </button>
                )}
              </div>
            );
          })}

          {allUsers.length === 0 && (
            <div style={{ color: '#64748B', fontSize: '0.8rem', fontStyle: 'italic', padding: '10px 0', textAlign: 'center' }}>
              No users online
            </div>
          )}
        </div>
      )}
    </div>
  );
}
