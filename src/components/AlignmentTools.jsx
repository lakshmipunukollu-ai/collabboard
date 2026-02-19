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
        top: '50%',
        right: 20,
        transform: 'translateY(-50%)',
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{
        color: '#94A3B8',
        fontSize: '0.75rem',
        fontWeight: 600,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        ALIGN ({selectedObjects.length})
      </div>
      
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={alignLeft} style={buttonStyle} title="Align left">
          ←|
        </button>
        <button onClick={alignCenterH} style={buttonStyle} title="Align center (horizontal)">
          |↔|
        </button>
        <button onClick={alignRight} style={buttonStyle} title="Align right">
          |→
        </button>
      </div>
      
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={alignTop} style={buttonStyle} title="Align top">
          ↑―
        </button>
        <button onClick={alignCenterV} style={buttonStyle} title="Align center (vertical)">
          ↕
        </button>
        <button onClick={alignBottom} style={buttonStyle} title="Align bottom">
          ―↓
        </button>
      </div>

      {selectedObjects.length >= 3 && (
        <>
          <div style={{
            height: 1,
            background: 'rgba(255,255,255,0.05)',
            margin: '4px 0',
          }} />
          <button onClick={distributeH} style={buttonStyleWide} title="Distribute horizontally">
            ↔ Distribute H
          </button>
          <button onClick={distributeV} style={buttonStyleWide} title="Distribute vertically">
            ↕ Distribute V
          </button>
        </>
      )}
    </div>
  );
}

const buttonStyle = {
  padding: '8px',
  background: 'rgba(59, 130, 246, 0.1)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: 6,
  color: '#93C5FD',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
  flex: 1,
  minWidth: 40,
};

const buttonStyleWide = {
  ...buttonStyle,
  width: '100%',
};
