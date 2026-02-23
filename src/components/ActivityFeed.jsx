import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../context/BoardContext';

function getUserColor(userId) {
  const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const ACTION_LABEL = {
  created: 'added',
  updated: 'edited',
  deleted: 'deleted',
  moved: 'moved',
};

const TYPE_EMOJI = {
  sticky: '📝',
  rectangle: '▭',
  circle: '○',
  frame: '🖼',
  text: '✏️',
  connector: '↔',
  arrow: '→',
  image: '🖼',
  kanban: '📋',
  mindmap: '🧠',
};

export default function ActivityFeed() {
  const { history } = useBoard();
  const [feed, setFeed] = useState([]);
  const seenRef = useRef(new Set());
  const timersRef = useRef([]);
  const prevLenRef = useRef(0);

  useEffect(() => {
    if (!history || history.length === 0) return;
    // history is sorted most-recent first; pick entries we haven't shown yet
    const newEntries = history.filter(
      (h) => h?.timestamp && !seenRef.current.has(h.timestamp),
    );
    if (newEntries.length === 0) return;

    // On first mount, mark all existing as seen (don't flood the feed)
    if (prevLenRef.current === 0) {
      history.forEach((h) => seenRef.current.add(h.timestamp));
      prevLenRef.current = history.length;
      return;
    }
    prevLenRef.current = history.length;

    newEntries.forEach((h) => seenRef.current.add(h.timestamp));

    const items = newEntries.slice(0, 3).map((h) => ({
      ...h,
      _key: `${h.timestamp}-${Math.random().toString(36).slice(2)}`,
    }));

    setFeed((prev) => [...items, ...prev].slice(0, 4));

    // Auto-remove each item after 4 seconds
    items.forEach((item) => {
      const t = setTimeout(() => {
        setFeed((prev) => prev.filter((i) => i._key !== item._key));
      }, 4000);
      timersRef.current.push(t);
    });
  }, [history]);

  // Cleanup on unmount
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  if (feed.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: 84,
        zIndex: 100,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 5,
      }}
    >
      {feed.map((item) => {
        const emoji = TYPE_EMOJI[item.objectType] || '◻';
        const verb = ACTION_LABEL[item.action] || item.action;
        const color = getUserColor(item.userId || 'x');
        return (
          <div
            key={item._key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20,
              padding: '5px 12px',
              fontSize: '0.72rem',
              color: '#94a3b8',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              animation: 'slideInLeft 0.25s ease-out',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            <strong style={{ color: '#e2e8f0', fontWeight: 600 }}>
              {item.displayName || 'Someone'}
            </strong>
            <span>
              {verb} {emoji} {item.objectType || 'object'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
