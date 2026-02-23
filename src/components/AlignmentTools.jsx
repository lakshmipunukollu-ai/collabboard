import { useBoard } from '../context/BoardContext';
import { showToast } from './Toast';

export default function AlignmentTools() {
  const { selectedIds, objects, updateObject } = useBoard();

  if (selectedIds.size < 2) return null;

  const selectedObjects = Array.from(selectedIds)
    .map(id => ({ id, ...objects[id] }))
    .filter(obj => obj.x !== undefined);

  const alignLeft = () => {
    const minX = Math.min(...selectedObjects.map(obj => obj.x));
    selectedObjects.forEach(obj => {
      updateObject(obj.id, { x: minX });
    });
    showToast('↔️ Aligned left', 'success');
  };

  const alignRight = () => {
    const maxRight = Math.max(...selectedObjects.map(obj => obj.x + (obj.width || 100)));
    selectedObjects.forEach(obj => {
      const newX = maxRight - (obj.width || 100);
      updateObject(obj.id, { x: newX });
    });
    showToast('↔️ Aligned right', 'success');
  };

  const alignCenterH = () => {
    const avgX = selectedObjects.reduce((sum, obj) => 
      sum + obj.x + (obj.width || 100) / 2, 0) / selectedObjects.length;
    selectedObjects.forEach(obj => {
      const newX = avgX - (obj.width || 100) / 2;
      updateObject(obj.id, { x: newX });
    });
    showToast('↔️ Aligned center (horizontal)', 'success');
  };

  const alignTop = () => {
    const minY = Math.min(...selectedObjects.map(obj => obj.y));
    selectedObjects.forEach(obj => {
      updateObject(obj.id, { y: minY });
    });
    showToast('↕️ Aligned top', 'success');
  };

  const alignBottom = () => {
    const maxBottom = Math.max(...selectedObjects.map(obj => obj.y + (obj.height || 100)));
    selectedObjects.forEach(obj => {
      const newY = maxBottom - (obj.height || 100);
      updateObject(obj.id, { y: newY });
    });
    showToast('↕️ Aligned bottom', 'success');
  };

  const alignCenterV = () => {
    const avgY = selectedObjects.reduce((sum, obj) => 
      sum + obj.y + (obj.height || 100) / 2, 0) / selectedObjects.length;
    selectedObjects.forEach(obj => {
      const newY = avgY - (obj.height || 100) / 2;
      updateObject(obj.id, { y: newY });
    });
    showToast('↕️ Aligned center (vertical)', 'success');
  };

  const distributeH = () => {
    if (selectedObjects.length < 3) {
      showToast('⚠️ Select at least 3 objects to distribute', 'warning');
      return;
    }
    
    const sorted = [...selectedObjects].sort((a, b) => a.x - b.x);
    const minX = sorted[0].x;
    const maxX = sorted[sorted.length - 1].x + (sorted[sorted.length - 1].width || 100);
    const totalWidth = sorted.reduce((sum, obj) => sum + (obj.width || 100), 0);
    const gap = (maxX - minX - totalWidth) / (sorted.length - 1);
    
    let currentX = minX;
    sorted.forEach((obj, index) => {
      if (index > 0) {
        updateObject(obj.id, { x: currentX });
      }
      currentX += (obj.width || 100) + gap;
    });
    showToast('↔️ Distributed horizontally', 'success');
  };

  const distributeV = () => {
    if (selectedObjects.length < 3) {
      showToast('⚠️ Select at least 3 objects to distribute', 'warning');
      return;
    }
    
    const sorted = [...selectedObjects].sort((a, b) => a.y - b.y);
    const minY = sorted[0].y;
    const maxY = sorted[sorted.length - 1].y + (sorted[sorted.length - 1].height || 100);
    const totalHeight = sorted.reduce((sum, obj) => sum + (obj.height || 100), 0);
    const gap = (maxY - minY - totalHeight) / (sorted.length - 1);
    
    let currentY = minY;
    sorted.forEach((obj, index) => {
      if (index > 0) {
        updateObject(obj.id, { y: currentY });
      }
      currentY += (obj.height || 100) + gap;
    });
    showToast('↕️ Distributed vertically', 'success');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.97)',
        border: '1px solid rgba(99, 130, 246, 0.35)',
        borderRadius: 10,
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        zIndex: 900,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Label */}
      <span style={{
        color: '#64748b',
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.05em',
        paddingRight: 6,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        marginRight: 2,
      }}>
        ALIGN {selectedObjects.length}
      </span>

      {/* Horizontal align group */}
      <button onClick={alignLeft} style={btnStyle} title="Align left edges">←|</button>
      <button onClick={alignCenterH} style={btnStyle} title="Center horizontally">|↔|</button>
      <button onClick={alignRight} style={btnStyle} title="Align right edges">|→</button>

      {/* Divider */}
      <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />

      {/* Vertical align group */}
      <button onClick={alignTop} style={btnStyle} title="Align top edges">↑—</button>
      <button onClick={alignCenterV} style={btnStyle} title="Center vertically">↕</button>
      <button onClick={alignBottom} style={btnStyle} title="Align bottom edges">—↓</button>

      {/* Distribute group (only when 3+ selected) */}
      {selectedObjects.length >= 3 && (
        <>
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
          <button onClick={distributeH} style={btnStyle} title="Distribute horizontally">
            ↔ H
          </button>
          <button onClick={distributeV} style={btnStyle} title="Distribute vertically">
            ↕ V
          </button>
        </>
      )}
    </div>
  );
}

const btnStyle = {
  padding: '5px 8px',
  background: 'rgba(59, 130, 246, 0.08)',
  border: '1px solid rgba(59, 130, 246, 0.25)',
  borderRadius: 6,
  color: '#93C5FD',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s',
  lineHeight: 1,
};
