import { useState } from 'react';
import { useBoard } from '../context/BoardContext';

function sanitizeUrl(url) {
  if (!url) return '';
  // Allow only http/https
  if (!/^https?:\/\//i.test(url)) return '';
  return url;
}

export default function EmbedObject({ id, data, scale, stagePos }) {
  const { updateObject, deleteObject, selectedIds, toggleSelection } = useBoard();
  const [editing, setEditing] = useState(!data.url);
  const [draft, setDraft] = useState(data.url || '');

  const {
    x = 0, y = 0, width = 480, height = 320,
    url = '',
  } = data;

  const isSelected = selectedIds.has(id);
  const screenX = stagePos.x + x * scale;
  const screenY = stagePos.y + y * scale;
  const screenW = width * scale;
  const screenH = height * scale;
  const safeUrl = sanitizeUrl(url);

  const commit = () => {
    const safe = sanitizeUrl(draft.trim());
    if (safe) updateObject(id, { url: safe });
    setEditing(false);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX, top: screenY,
        width: screenW, height: screenH,
        border: isSelected ? '2px solid #667eea' : '1px solid #334155',
        borderRadius: 8, background: '#0f172a',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        zIndex: 20, overflow: 'hidden', pointerEvents: 'all',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={(e) => { e.stopPropagation(); toggleSelection(id, e.shiftKey); }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px', background: '#1e293b', borderBottom: '1px solid #334155',
        }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>🔗 Embed</span>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
                onClick={(e) => e.stopPropagation()}
                placeholder="https://..."
                style={{
                  width: '100%', background: '#0f172a', border: '1px solid #667eea',
                  borderRadius: 4, color: '#e2e8f0', fontSize: 10, padding: '2px 6px', outline: 'none',
                }}
              />
            ) : (
              <span
                style={{ color: '#64748b', fontSize: 10, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}
                onClick={(e) => { e.stopPropagation(); setEditing(true); setDraft(url); }}
                title={url}
              >
                {url || 'Click to set URL'}
              </span>
            )}
          </div>
          {editing ? (
            <button onClick={(e) => { e.stopPropagation(); commit(); }}
              style={{ padding: '2px 7px', fontSize: 10, background: '#667eea', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
              Go
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setEditing(true); setDraft(url); }}
              style={{ padding: '2px 7px', fontSize: 10, background: '#334155', border: 'none', borderRadius: 4, color: '#e2e8f0', cursor: 'pointer' }}>
              Edit
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete embed?')) deleteObject(id); }}
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>×</button>
        </div>

        {/* iFrame */}
        {safeUrl ? (
          <iframe
            src={safeUrl}
            title="Embedded content"
            style={{ flex: 1, border: 'none', background: '#fff' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#475569', gap: 8,
          }}>
            <span style={{ fontSize: 28 }}>🔗</span>
            <span style={{ fontSize: 11 }}>Paste a URL above to embed content</span>
          </div>
        )}
      </div>
    </div>
  );
}
