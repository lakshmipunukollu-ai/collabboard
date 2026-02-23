import { useState, useEffect } from 'react';

export default function HelpPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasSeenHelp, setHasSeenHelp] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('collabboard_help_seen');
    if (!seen) {
      setIsVisible(true);
      setHasSeenHelp(false);
    } else {
      setHasSeenHelp(true);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('collabboard_help_seen', 'true');
    setHasSeenHelp(true);
  };

  const toggleHelp = () => {
    setIsVisible(!isVisible);
  };

  return (
    <>
      {/* Help button - always visible */}
      <button
        onClick={toggleHelp}
        title="Show help and keyboard shortcuts"
        style={{
          position: 'fixed',
          bottom: 144,
          right: 20,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#3B82F6',
          border: 'none',
          color: 'white',
          fontSize: '1.5rem',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
        }}
      >
        ?
      </button>

      {/* Help overlay */}
      {isVisible && (
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
            zIndex: 2000,
            padding: 20,
          }}
          onClick={handleClose}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: 32,
              maxWidth: 600,
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: 'white', marginTop: 0, marginBottom: 24 }}>
              🎨 Welcome to CollabBoard!
            </h2>

            <div style={{ color: '#94A3B8', lineHeight: 1.6 }}>
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ color: '#E2E8F0', fontSize: '1rem', marginBottom: 12 }}>
                  🖱️ Basic Controls
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Click and drag to pan the canvas</li>
                  <li>Scroll or trackpad pinch to zoom in/out</li>
                  <li>Click toolbar buttons to create objects at viewport center</li>
                  <li>Drag objects to move them</li>
                  <li>Click to select, Shift+Click for multi-select</li>
                  <li>Drag corners to resize selected objects</li>
                  <li>Double-click sticky notes to edit text</li>
                </ul>
              </section>

              <section style={{ marginBottom: 24 }}>
                <h3 style={{ color: '#E2E8F0', fontSize: '1rem', marginBottom: 12 }}>
                  ⌨️ Keyboard Shortcuts
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.875rem' }}>
                  <li><strong>Delete/Backspace:</strong> Delete selected objects</li>
                  <li><strong>Cmd/Ctrl + D:</strong> Duplicate selected</li>
                  <li><strong>Cmd/Ctrl + C/V:</strong> Copy and paste</li>
                  <li><strong>Cmd/Ctrl + A:</strong> Select all objects</li>
                  <li><strong>Cmd/Ctrl + Shift + Delete:</strong> Clear entire board</li>
                  <li><strong>1:</strong> Zoom to 100%</li>
                  <li><strong>2:</strong> Zoom to 200%</li>
                  <li><strong>0:</strong> Fit all objects in view</li>
                  <li><strong>+/-:</strong> Zoom in/out 25%</li>
                  <li><strong>Shift + Drag:</strong> Area selection</li>
                  <li><strong>Escape:</strong> Exit text editing</li>
                </ul>
              </section>

              <section style={{ marginBottom: 24 }}>
                <h3 style={{ color: '#E2E8F0', fontSize: '1rem', marginBottom: 12 }}>
                  👥 Collaboration
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>See other users' cursors in real-time</li>
                  <li>Changes sync automatically within 1-3 seconds</li>
                  <li>Click on a user in the presence panel to follow them</li>
                  <li>All board state persists - nothing is lost!</li>
                </ul>
              </section>

              <section>
                <h3 style={{ color: '#E2E8F0', fontSize: '1rem', marginBottom: 12 }}>
                  ⚠️ Concurrent Edits
                </h3>
                <p style={{ margin: 0 }}>
                  If two users move the same object simultaneously, the <strong>last user to release</strong> their drag wins (last-write-wins). You'll see other users' cursors on objects they're interacting with.
                </p>
              </section>
            </div>

            <button
              onClick={handleClose}
              style={{
                marginTop: 32,
                width: '100%',
                padding: '12px 24px',
                background: '#3B82F6',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
