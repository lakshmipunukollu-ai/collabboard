import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useBoard } from '../context/BoardContext';

export default function PresencePanel() {
  const { presence, cursors, followUserId, setFollowUserId } = useBoard();
  const { user } = useUser();
  const [now, setNow] = useState(Date.now());

  // Refresh every 2 seconds to remove stale users from the list
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, []);

  // Only show users who are truly online (active in last 30 seconds)
  const onlineUsers = Object.entries(presence).filter(([uid, p]) => {
    if (!p || p.online === false) return false;
    // Check if they've been seen recently (within 30 seconds)
    const lastSeen = p.lastSeen;
    if (!lastSeen) return true; // Show if no timestamp
    const age = now - lastSeen;
    return age < 30000; // Only show if active in last 30 seconds
  });

  const others = onlineUsers.filter(([uid]) => uid !== user?.id);
  const followingName =
    followUserId &&
    (presence[followUserId]?.displayName ||
      cursors?.[followUserId]?.displayName ||
      'Someone');

  return (
    <div className="presence-panel">
      <div className="presence-header">Who&apos;s online</div>
      {followUserId && (
        <div className="presence-following">
          <span>Following: {followingName}</span>
          <button
            type="button"
            className="presence-unfollow"
            onClick={() => setFollowUserId(null)}
          >
            Stop
          </button>
        </div>
      )}
      <ul className="presence-list">
        {user && (
          <li key={user.id} className="presence-item you">
            <span className="presence-dot" />
            {user.firstName || user.emailAddresses?.[0]?.emailAddress || 'You'} (you)
          </li>
        )}
        {others.map(([uid, p]) => {
          const name = p.displayName || 'Anonymous';
          const isFollowing = followUserId === uid;
          return (
            <li key={uid} className="presence-item">
              <span className="presence-dot" />
              <button
                type="button"
                className={`presence-name ${isFollowing ? 'following' : ''}`}
                onClick={() => setFollowUserId(isFollowing ? null : uid)}
                title={isFollowing ? 'Click to stop following' : 'Click to follow'}
              >
                {name}
                {isFollowing ? ' ✓' : ''}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
