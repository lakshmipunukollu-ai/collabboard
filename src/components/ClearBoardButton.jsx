import { useState } from 'react';
import { useBoard } from '../context/BoardContext';
import { showToast } from './Toast';

export default function ClearBoardButton() {
  const { objects, deleteObject } = useBoard();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClearBoard = () => {
    const objectIds = Object.keys(objects);
    if (objectIds.length === 0) {
      showToast('ℹ️ Board is already empty', 'info');
      return;
    }
    
    // Delete all objects
    objectIds.forEach(id => deleteObject(id));
    setShowConfirm(false);
    showToast(`🗑️ Cleared ${objectIds.length} objects`, 'success');
  };

  return (
    <>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => setShowConfirm(true)}
        title="Clear entire board (Cmd/Ctrl+Shift+Delete)"
        style={{
          background: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          color: '#FCA5A5',
        }}
      >
        🗑️ Clear Board
      </button>

      {showConfirm && (
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
          }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: 'white', marginTop: 0, marginBottom: 16 }}>
              Clear Board?
            </h3>
            <p style={{ color: '#94A3B8', marginBottom: 24, lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>all {Object.keys(objects).length} objects</strong>? 
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearBoard}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  background: '#EF4444',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
