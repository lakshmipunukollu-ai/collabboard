import { useCallback, useState, useRef } from 'react';
import { useBoard } from '../context/BoardContext';
import { showToast } from './Toast';

const barStyle = {
  position: 'fixed',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '6px 10px',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  zIndex: 10,
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  backdropFilter: 'blur(10px)',
};

const buttonStyle = {
  padding: '6px 12px',
  background: 'rgba(59, 130, 246, 0.1)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: 6,
  color: '#93C5FD',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

export default function BoardControlBar({
  scale,
  onZoomChange,
  onFitAll,
  isDragging,
  totalObjects,
  visibleObjects,
  stageRef,
  showGrid,
  onToggleGrid,
  onPrint,
}) {
  const { editingNoteId, selectedIds } = useBoard();

  let mode = 'Select';
  let icon = '👆';
  let color = '#6B7280';
  if (editingNoteId) {
    mode = 'Editing';
    icon = '✏️';
    color = '#3B82F6';
  } else if (isDragging) {
    mode = 'Panning';
    icon = '🤚';
    color = '#10B981';
  } else if (selectedIds.size > 0) {
    mode = `${selectedIds.size} Selected`;
    icon = '✓';
    color = '#3B82F6';
  }

  const zoomPercent = Math.round(scale * 100);
  const [editingZoom, setEditingZoom] = useState(false);
  const [zoomDraft, setZoomDraft] = useState('');
  const zoomInputRef = useRef(null);

  const startZoomEdit = () => {
    setZoomDraft(String(zoomPercent));
    setEditingZoom(true);
    // focus after render
    setTimeout(() => zoomInputRef.current?.select(), 0);
  };

  const commitZoomEdit = () => {
    const parsed = parseInt(zoomDraft, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(400, Math.max(1, parsed));
      onZoomChange(clamped / 100);
    }
    setEditingZoom(false);
  };

  const handleDownload = useCallback(() => {
    const stage = stageRef?.current;
    if (!stage) {
      showToast('Canvas not ready', 'error');
      return;
    }
    try {
      const data = stage.toDataURL({ pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `board-${Date.now()}.png`;
      link.href = data;
      link.click();
      showToast('Board downloaded as PNG', 'success');
    } catch (err) {
      console.error(err);
      showToast('Download failed', 'error');
    }
  }, [stageRef]);

  return (
    <div style={barStyle}>
      <div
        title="Drag to pan · Scroll to zoom · Shift+drag for area select"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          color,
          fontSize: '0.8rem',
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <span>{mode}</span>
      </div>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
      <button
        onClick={() => onZoomChange(Math.max(0.1, scale - 0.1))}
        title="Zoom out"
        style={{ ...buttonStyle, padding: '4px 8px', fontSize: '1rem' }}
      >
        −
      </button>
      <input
        type="range"
        min={10}
        max={400}
        step={5}
        value={zoomPercent}
        onChange={(e) => onZoomChange(Number(e.target.value) / 100)}
        title={`Zoom: ${zoomPercent}%`}
        style={{ width: 100, accentColor: '#667eea', cursor: 'pointer' }}
      />
      <button
        onClick={() => onZoomChange(Math.min(4.0, scale + 0.1))}
        title="Zoom in"
        style={{ ...buttonStyle, padding: '4px 8px', fontSize: '1rem' }}
      >
        +
      </button>
      {editingZoom ? (
        <input
          ref={zoomInputRef}
          type="number"
          min={1}
          max={400}
          value={zoomDraft}
          onChange={(e) => setZoomDraft(e.target.value)}
          onBlur={commitZoomEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitZoomEdit(); }
            if (e.key === 'Escape') setEditingZoom(false);
            e.stopPropagation();
          }}
          style={{
            width: 52,
            padding: '2px 4px',
            background: '#0f172a',
            border: '1px solid #3b82f6',
            borderRadius: 4,
            color: '#e2e8f0',
            fontSize: '0.75rem',
            fontWeight: 600,
            textAlign: 'center',
            outline: 'none',
          }}
        />
      ) : (
        <div
          onClick={startZoomEdit}
          title="Click to enter a specific zoom %"
          style={{
            color: '#94A3B8',
            fontSize: '0.75rem',
            fontWeight: 600,
            minWidth: 36,
            textAlign: 'center',
            cursor: 'text',
            padding: '2px 4px',
            borderRadius: 4,
            border: '1px solid transparent',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
        >
          {zoomPercent}%
        </div>
      )}
      <button onClick={onFitAll} title="Fit all (Press 0)" style={buttonStyle}>
        Fit All
      </button>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
      <button
        onClick={onToggleGrid}
        title={showGrid ? 'Hide grid' : 'Show snap grid'}
        style={{
          ...buttonStyle,
          background: showGrid ? 'rgba(102,126,234,0.2)' : 'rgba(59,130,246,0.1)',
          borderColor: showGrid ? '#667eea' : 'rgba(59,130,246,0.3)',
          color: showGrid ? '#a5b4fc' : '#93C5FD',
          fontSize: '0.8rem',
        }}
      >
        ⊞
      </button>
      <button onClick={handleDownload} title="Download board as PNG" style={{ ...buttonStyle, fontSize: '1rem' }}>
        ⬇
      </button>
      <button onClick={onPrint} title="Print board (⌘P)" style={{ ...buttonStyle, fontSize: '1rem' }}>
        🖨
      </button>
      {totalObjects !== visibleObjects && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ color: '#64748B', fontSize: '0.7rem' }}>
            {visibleObjects}/{totalObjects}
          </div>
        </>
      )}
    </div>
  );
}
