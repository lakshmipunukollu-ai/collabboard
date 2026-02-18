import { useMemo, useRef, useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useBoard } from '../context/BoardContext';

const CURSOR_STALE_MS = 20000; // Hide cursor if we haven't seen a *position change* in 20s (user left)

// Generate a consistent color from a user ID
function getUserColor(userId) {
  const colors = [
    '#6366F1', // Indigo
    '#EC4899', // Pink
    '#10B981', // Green
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EF4444', // Red
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ];
  
  // Simple hash function to get consistent color for each user
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function CursorOverlay({ stageRef, scale, stagePos }) {
  const { cursors } = useBoard();
  const { user } = useUser();
  const [now, setNow] = useState(() => Date.now());
  const lastSeenRef = useRef({});
  const prevPosRef = useRef({});

  // Only refresh lastSeen when this cursor's position actually changed. Don't set lastSeen on first
  // sight so stale cursors (user left hours ago) never show; only show after we've seen them move.
  useEffect(() => {
    const cur = cursors || {};
    const t = Date.now();
    const prev = prevPosRef.current;
    Object.keys(cur).forEach((uid) => {
      if (uid === user?.id) return;
      const c = cur[uid];
      if (c?.x == null || c?.y == null) return;
      const prevPos = prev[uid];
      const positionChanged =
        prevPos != null && (prevPos.x !== c.x || prevPos.y !== c.y);
      if (positionChanged) {
        lastSeenRef.current[uid] = t;
      }
      prev[uid] = { x: c.x, y: c.y };
    });
    prevPosRef.current = prev;
  }, [cursors, user?.id]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const otherCursors = useMemo(() => {
    if (!user) return [];
    return Object.entries(cursors || {})
      .filter(([uid]) => uid !== user.id)
      .filter(([uid, cursor]) => {
        if (!cursor || cursor.x == null || cursor.y == null) return false;
        const lastSeen = lastSeenRef.current[uid];
        if (lastSeen == null) return false; // only show after we've seen a position change (avoids stale ghosts)
        return now - lastSeen < CURSOR_STALE_MS;
      });
  }, [cursors, user, now]);

  const { followUserId, setFollowUserId } = useBoard();

  return (
    <div
      className="cursor-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {otherCursors.map(([uid, cursor]) => {
        if (!cursor || cursor.x == null || cursor.y == null) return null;
        const screenX = cursor.x * scale + stagePos.x;
        const screenY = cursor.y * scale + stagePos.y;
        const name = cursor.displayName || 'Anonymous';
        const isFollowing = followUserId === uid;
        const userColor = getUserColor(uid);
        const darkerColor = isFollowing 
          ? `color-mix(in srgb, ${userColor} 80%, black)`
          : userColor;
        
        return (
          <div
            key={uid}
            className="remote-cursor"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${screenX}px, ${screenY}px)`,
              willChange: 'transform',
              pointerEvents: 'none',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
            >
              <path
                d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36Z"
                fill={userColor}
              />
            </svg>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setFollowUserId(isFollowing ? null : uid);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFollowUserId(isFollowing ? null : uid);
                }
              }}
              style={{
                position: 'absolute',
                left: 20,
                top: 0,
                background: darkerColor,
                color: 'white',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                whiteSpace: 'nowrap',
                fontFamily: 'Inter, sans-serif',
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
              title={isFollowing ? 'Click to stop following' : 'Click to follow'}
            >
              {name}
              {isFollowing ? ' ✓' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default CursorOverlay;
