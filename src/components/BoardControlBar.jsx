import { useCallback } from 'react';
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
  zIndex: 1000,
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
      <button onClick={() => onZoomChange(0.5)} title="Zoom to 50%" style={buttonStyle}>
        50%
      </button>
      <button onClick={() => onZoomChange(1)} title="Zoom to 100% (Press 1)" style={buttonStyle}>
        100%
      </button>
      <button onClick={() => onZoomChange(2)} title="Zoom to 200% (Press 2)" style={buttonStyle}>
        200%
      </button>
      <button onClick={onFitAll} title="Fit all (Press 0)" style={buttonStyle}>
        Fit All
      </button>
      <div
        style={{
          padding: '4px 10px',
          color: '#94A3B8',
          fontSize: '0.75rem',
          fontWeight: 600,
          minWidth: 40,
          textAlign: 'center',
        }}
      >
        {zoomPercent}%
      </div>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
      <button onClick={handleDownload} title="Download board as PNG" style={buttonStyle}>
        ⬇ Download
      </button>
      <button onClick={handleDownload} title="Download board as PNG" style={buttonStyle}>
        ⬇ PNG
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
