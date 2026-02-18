import { useBoard } from '../context/BoardContext';

export default function ModeIndicator({ isDragging, scale, totalObjects, visibleObjects }) {
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

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        <span style={{ color, fontWeight: 600, fontSize: '0.875rem' }}>
          {mode}
        </span>
      </div>
      <div
        style={{
          width: 1,
          height: 24,
          background: 'rgba(255,255,255,0.1)',
        }}
      />
      <div style={{ color: '#94A3B8', fontSize: '0.875rem', fontWeight: 500 }}>
        {zoomPercent}%
      </div>
      <div
        style={{
          width: 1,
          height: 24,
          background: 'rgba(255,255,255,0.1)',
        }}
      />
      <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>
        <div>Drag to pan · Scroll to zoom</div>
        <div>Shift+drag for area select</div>
        {totalObjects !== visibleObjects && (
          <div style={{ color: '#64748B', fontSize: '0.7rem', marginTop: 2 }}>
            {visibleObjects}/{totalObjects} objects rendered
          </div>
        )}
      </div>
    </div>
  );
}
