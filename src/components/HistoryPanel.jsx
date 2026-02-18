import { useState } from 'react';
import { useBoard } from '../context/BoardContext';

export default function HistoryPanel() {
  const { history, objects } = useBoard();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'created', 'deleted', 'updated'

  const filteredHistory = filter === 'all' 
    ? history 
    : history.filter(entry => entry.action === filter);

  const getActionIcon = (action) => {
    switch (action) {
      case 'created': return '✨';
      case 'deleted': return '🗑️';
      case 'updated': return '✏️';
      case 'moved': return '↔️';
      case 'resized': return '↕️';
      default: return '•';
    }
  };

  const getTimeSince = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="toolbar-btn"
        title="View change history"
        style={{
          background: 'rgba(139, 92, 246, 0.1)',
          borderColor: 'rgba(139, 92, 246, 0.3)',
          color: '#C4B5FD',
        }}
      >
        📜 History
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: 20,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 600,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <h2 style={{ color: 'white', margin: 0 }}>
                📜 Change History
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Filters */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
              {['all', 'created', 'deleted', 'updated'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 12px',
                    background: filter === f ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${filter === f ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 6,
                    color: filter === f ? '#93C5FD' : '#94A3B8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* History list */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              color: '#94A3B8',
              fontSize: '0.875rem',
            }}>
              {filteredHistory.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#64748B',
                  fontStyle: 'italic',
                }}>
                  No history yet. Start creating objects!
                </div>
              ) : (
                filteredHistory.map((entry, idx) => {
                  const stillExists = objects[entry.objectId];
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'start',
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>
                        {getActionIcon(entry.action)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#E2E8F0', marginBottom: 4 }}>
                          <strong>{entry.displayName}</strong> {entry.action} {entry.objectType}
                        </div>
                        <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                          {getTimeSince(entry.timestamp)}
                          {!stillExists && entry.action !== 'deleted' && (
                            <span style={{ marginLeft: 8, color: '#F59E0B' }}>
                              (object deleted)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
