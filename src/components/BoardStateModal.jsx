import { useMemo } from 'react';

/**
 * Modal to view, copy, or export the current board state (same shape as sent to the AI in boardState).
 * Read-only; no editing.
 */
export default function BoardStateModal({ getBoardState, onClose, showToast }) {
  const state = useMemo(() => getBoardState(), [getBoardState]);
  const json = useMemo(() => JSON.stringify(state, null, 2), [state]);

  const handleCopy = () => {
    navigator.clipboard.writeText(json).then(
      () => showToast?.('Board state copied to clipboard', 'success'),
      () => showToast?.('Failed to copy', 'error')
    );
  };

  const handleExport = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collabboard-state-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('Board state exported', 'success');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e293b',
          borderRadius: 12,
          maxWidth: '90vw',
          maxHeight: '85vh',
          width: 560,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: 16,
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, color: '#f1f5f9' }}>📋 Board state</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: 4,
            }}
          >
            ×
          </button>
        </div>
        <p style={{
          margin: 0,
          padding: '8px 16px',
          fontSize: '0.75rem',
          color: '#94a3b8',
          borderBottom: '1px solid #334155',
        }}>
          Same data the AI Assistant uses (sent as boardState). Read-only.
        </p>
        <pre
          style={{
            flex: 1,
            margin: 0,
            padding: 16,
            overflow: 'auto',
            fontSize: '0.8rem',
            color: '#e2e8f0',
            background: '#0f172a',
            minHeight: 200,
            maxHeight: 400,
          }}
        >
          {json}
        </pre>
        <div style={{
          padding: 16,
          borderTop: '1px solid #334155',
          display: 'flex',
          gap: 8,
        }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: '10px 16px',
              background: '#334155',
              border: 'none',
              borderRadius: 8,
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Copy
          </button>
          <button
            type="button"
            onClick={handleExport}
            style={{
              padding: '10px 16px',
              background: '#667eea',
              border: 'none',
              borderRadius: 8,
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}
