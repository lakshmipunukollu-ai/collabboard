import { useState, useEffect, useRef, useCallback } from 'react';
import { useBoard } from '../context/BoardContext';
import AIAssistant from './AIAssistant';
import PropertiesPanel from './PropertiesPanel';

// Panel geometry constants — change these to reposition the panel
const PANEL_W = 300;
const PANEL_GAP = 20;   // gap from right viewport edge
const SLIDE_OUT = PANEL_W + PANEL_GAP; // 320px total to push fully off-screen

export default function RightPanel() {
  const { selectedIds } = useBoard();
  const [activeTab, setActiveTab] = useState('ai');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('rightPanelCollapsed') === 'true'; } catch { return false; }
  });
  // Red dot on FAB when AI responds while panel is hidden
  const [hasUnreadAI, setHasUnreadAI] = useState(false);
  // Tracks whether the user manually chose a tab so auto-switching respects their intent
  const userOverrideRef = useRef(false);

  useEffect(() => {
    if (selectedIds.size > 0) {
      // Auto-switch to Properties only if user hasn't manually overridden
      if (!userOverrideRef.current) {
        setActiveTab('props');
      }
    } else {
      // Nothing selected — clear override and return to AI
      userOverrideRef.current = false;
      setActiveTab('ai');
    }
  }, [selectedIds.size]);

  const switchTab = (tab) => {
    userOverrideRef.current = true;
    setActiveTab(tab);
  };

  // Toggle collapse/expand with localStorage persistence
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('rightPanelCollapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  // Open panel AND switch to AI tab — used by the floating FAB
  const openToAI = useCallback(() => {
    setCollapsed(false);
    try { localStorage.setItem('rightPanelCollapsed', 'false'); } catch {}
    userOverrideRef.current = true;
    setActiveTab('ai');
    setHasUnreadAI(false);
  }, []);

  // Clear unread badge whenever the panel is opened
  useEffect(() => {
    if (!collapsed) setHasUnreadAI(false);
  }, [collapsed]);

  // Listen for a custom event dispatched by AIAssistant when a new response arrives
  useEffect(() => {
    const onAIResponse = () => {
      // Only mark unread when the panel is currently hidden
      setCollapsed((c) => {
        if (c) setHasUnreadAI(true);
        return c;
      });
    };
    window.addEventListener('ai:response', onAIResponse);
    return () => window.removeEventListener('ai:response', onAIResponse);
  }, []);

  // Keyboard shortcut: Ctrl+\ or Cmd+\
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  const hasSelection = selectedIds.size > 0;

  const tabBtn = (id, label, isActive) => (
    <button
      key={id}
      onClick={() => switchTab(id)}
      style={{
        flex: 1,
        padding: '10px 6px',
        background: isActive ? 'rgba(102,126,234,0.15)' : 'transparent',
        border: 'none',
        borderBottom: `2px solid ${isActive ? '#667eea' : 'transparent'}`,
        color: isActive ? '#E2E8F0' : '#64748B',
        fontSize: '0.78rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        position: 'relative',
      }}
    >
      {label}
      {/* Blue dot when Properties has content but AI tab is active */}
      {id === 'props' && hasSelection && !isActive && (
        <span style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#667eea',
          display: 'inline-block',
        }} />
      )}
    </button>
  );

  return (
    <>
      {/* ── Toggle tab — always visible, slides in sync with the panel ── */}
      <div
        onClick={toggle}
        title={collapsed ? 'Show panel (Ctrl+\\)' : 'Hide panel (Ctrl+\\)'}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(30,41,59,0.98)';
          e.currentTarget.style.color = '#e2e8f0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(15,23,42,0.98)';
          e.currentTarget.style.color = '#94a3b8';
        }}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          // When expanded: slide left so the tab sits flush against the panel's left edge.
          // When collapsed: stay at the right screen edge.
          transform: `translateY(-50%) translateX(${collapsed ? 0 : -SLIDE_OUT}px)`,
          transition: 'transform 0.25s ease',
          zIndex: 1600,
          width: 22,
          height: 48,
          background: 'rgba(15,23,42,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#94a3b8',
          fontSize: 13,
          userSelect: 'none',
          boxShadow: '-3px 0 10px rgba(0,0,0,0.35)',
        }}
      >
        {/* › = panel visible (click to collapse), ‹ = panel hidden (click to expand) */}
        {collapsed ? '‹' : '›'}
      </div>

      {/* ── Floating AI FAB — visible only when panel is collapsed ── */}
      {/* Wraps both the button and the "AI" label so they fade together */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        zIndex: 999,
        // Fade in after panel finishes sliding out; fade out before/as it slides in
        opacity: collapsed ? 1 : 0,
        pointerEvents: collapsed ? 'auto' : 'none',
        transition: collapsed
          ? 'opacity 0.2s ease 0.25s'   // 0.25s delay = wait for panel slide to finish
          : 'opacity 0.15s ease 0s',    // no delay on hide — starts fading immediately
      }}>
        {/* Circle FAB button */}
        <button
          onClick={openToAI}
          title="Open AI Assistant"
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: 'none',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            animation: 'aiPulse 2s ease-in-out infinite',
            transition: 'transform 0.15s ease',
            position: 'relative',  // for the notification dot
            flexShrink: 0,
          }}
        >
          ✨
          {/* Red unread notification dot */}
          {hasUnreadAI && (
            <span style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#ef4444',
              border: '2px solid #0f172a',
              boxSizing: 'border-box',
            }} />
          )}
        </button>

        {/* "AI" label below the button */}
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.08em',
          userSelect: 'none',
          textShadow: '0 1px 3px rgba(0,0,0,0.6)',
        }}>
          AI
        </span>
      </div>

      {/* ── Panel — slides off-screen to the right when collapsed ── */}
      <div style={{
        position: 'fixed',
        top: 60,
        right: PANEL_GAP,
        width: PANEL_W,
        height: 'calc(100vh - 136px)',
        background: 'rgba(15, 23, 42, 0.98)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 1500,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // GPU-accelerated slide animation
        transform: collapsed ? `translateX(${SLIDE_OUT}px)` : 'translateX(0)',
        transition: 'transform 0.25s ease',
        // Keep mounted (never unmount) so state and chat history are preserved
        pointerEvents: collapsed ? 'none' : 'all',
      }}>
        {/* ── Tab bar ── */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          background: 'rgba(10,17,30,0.9)',
        }}>
          {tabBtn('ai', '✨ AI Assistant', activeTab === 'ai')}
          {tabBtn('props', '⚙️ Properties', activeTab === 'props')}
        </div>

        {/* ── AI Assistant tab ── */}
        <div style={{
          display: activeTab === 'ai' ? 'flex' : 'none',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}>
          <AIAssistant embedded />
        </div>

        {/* ── Properties tab ── */}
        <div style={{
          display: activeTab === 'props' ? 'flex' : 'none',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
        }}>
          {hasSelection ? (
            <PropertiesPanel embedded />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: '#475569',
              gap: 12,
              padding: 32,
            }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.4 }}>📋</div>
              <p style={{
                margin: 0,
                fontSize: '0.85rem',
                textAlign: 'center',
                lineHeight: 1.6,
                color: '#64748B',
              }}>
                Select an object on the canvas to view and edit its properties.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
