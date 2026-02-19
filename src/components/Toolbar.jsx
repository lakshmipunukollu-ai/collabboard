import { useCallback, useState, useEffect } from 'react';
import { useBoard } from '../context/BoardContext';
import { showToast } from './Toast';
import ClearBoardButton from './ClearBoardButton';
import HistoryPanel from './HistoryPanel';

const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#FDE68A'];

export default function Toolbar() {
  const { createStickyNote, createShape, createConnector, createFrame, stageRef, selectedIds, userPermission } = useBoard();
  const [connectorMode, setConnectorMode] = useState(false);
  const [connectorStyle, setConnectorStyle] = useState('arrow'); // 'arrow', 'line', 'curved', 'elbowed'
  const [firstSelectedForConnector, setFirstSelectedForConnector] = useState(null);
  
  const canEdit = userPermission === 'edit' || userPermission === 'owner';

  const getBoardCenter = useCallback(() => {
    const stage = stageRef?.current;
    if (!stage) return { x: 200, y: 200 };
    const transform = stage.getAbsoluteTransform().copy().invert();
    const center = transform.point({
      x: stage.width() / 2,
      y: stage.height() / 2,
    });
    return center;
  }, [stageRef]);

  const getScaledSize = useCallback((baseSize) => {
    const stage = stageRef?.current;
    const scale = stage ? stage.scaleX() : 1;
    // Ensure object appears at minimum 150px on screen
    const minScreenSize = 150;
    
    // Calculate world size needed to achieve minScreenSize on screen
    // screenSize = worldSize * scale
    // So: worldSize = screenSize / scale
    const minWorldSize = minScreenSize / scale;
    const scaleFactor = Math.max(1, minWorldSize / baseSize);
    
    // Cap at 200x to prevent absurdly massive objects
    return Math.min(scaleFactor, 200);
  }, [stageRef]);

  const handleAddSticky = useCallback(() => {
    const { x, y } = getBoardCenter();
    const baseWidth = 160;
    const baseHeight = 120;
    const scaleFactor = getScaledSize(baseWidth);
    const width = baseWidth * scaleFactor;
    const height = baseHeight * scaleFactor;
    const color = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
    createStickyNote('New note', x - width / 2, y - height / 2, color, width, height);
    showToast('📝 Sticky note created', 'success');
  }, [createStickyNote, getBoardCenter, getScaledSize]);

  const handleAddRectangle = useCallback(() => {
    const { x, y } = getBoardCenter();
    const baseWidth = 100;
    const baseHeight = 80;
    const scaleFactor = getScaledSize(baseWidth);
    const width = baseWidth * scaleFactor;
    const height = baseHeight * scaleFactor;
    createShape('rectangle', x - width / 2, y - height / 2, width, height);
    showToast('◻️ Rectangle created', 'success');
  }, [createShape, getBoardCenter, getScaledSize]);

  const handleAddCircle = useCallback(() => {
    const { x, y } = getBoardCenter();
    const baseDiameter = 100;
    const scaleFactor = getScaledSize(baseDiameter);
    const diameter = baseDiameter * scaleFactor;
    createShape('circle', x - diameter / 2, y - diameter / 2, diameter, diameter, '#10B981');
    showToast('⭕ Circle created', 'success');
  }, [createShape, getBoardCenter, getScaledSize]);

  const handleAddLine = useCallback(() => {
    const { x, y } = getBoardCenter();
    const baseWidth = 150;
    const baseHeight = 20;
    const scaleFactor = getScaledSize(baseWidth);
    const width = baseWidth * scaleFactor;
    const height = baseHeight * scaleFactor;
    createShape('line', x - width / 2, y - height / 2, width, height, '#F59E0B');
    showToast('➖ Line created', 'success');
  }, [createShape, getBoardCenter, getScaledSize]);

  const handleAddOval = useCallback(() => {
    const { x, y } = getBoardCenter();
    const baseWidth = 120;
    const baseHeight = 80;
    const scaleFactor = getScaledSize(baseWidth);
    const width = baseWidth * scaleFactor;
    const height = baseHeight * scaleFactor;
    createShape('oval', x - width / 2, y - height / 2, width, height, '#8B5CF6');
    showToast('⭕ Oval created', 'success');
  }, [createShape, getBoardCenter, getScaledSize]);

  const toggleConnectorMode = useCallback(() => {
    const newMode = !connectorMode;
    setConnectorMode(newMode);
    setFirstSelectedForConnector(null);
    
    if (newMode) {
      showToast('🔗 Connector mode: Click 2 objects to connect', 'info');
    } else {
      showToast('✓ Connector mode disabled', 'info');
    }
  }, [connectorMode]);

  // Handle connector creation when in connector mode
  useEffect(() => {
    if (!connectorMode) return;

    const selectedArray = Array.from(selectedIds);
    
    if (selectedArray.length === 1 && !firstSelectedForConnector) {
      setFirstSelectedForConnector(selectedArray[0]);
      showToast('✓ First object selected. Click another to connect.', 'info');
    } else if (selectedArray.length === 1 && firstSelectedForConnector && selectedArray[0] !== firstSelectedForConnector) {
      // Create connector between first and second selected with chosen style
      createConnector(firstSelectedForConnector, selectedArray[0], connectorStyle);
      showToast('🔗 Connector created! Select 2 more objects or press ESC to exit.', 'success');
      // Keep connector mode active, just reset for next connection
      setFirstSelectedForConnector(null);
    }
  }, [selectedIds, connectorMode, firstSelectedForConnector, connectorStyle, createConnector]);

  // ESC key handler to exit connector mode
  useEffect(() => {
    if (!connectorMode) return;
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setConnectorMode(false);
        setFirstSelectedForConnector(null);
        showToast('✓ Connector mode exited', 'info');
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [connectorMode]);

  return (
    <div className="toolbar">
      <div style={{ 
        color: '#94A3B8', 
        fontSize: '0.75rem', 
        fontWeight: 600, 
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        marginBottom: 8,
      }}>
        CREATE OBJECTS
      </div>
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={canEdit ? handleAddSticky : undefined}
        disabled={!canEdit}
        title={canEdit ? "Create a sticky note at viewport center (S)" : "View-only access"}
        style={{
          opacity: canEdit ? 1 : 0.5,
          cursor: canEdit ? 'pointer' : 'not-allowed',
        }}
      >
        📝 Sticky Note
      </button>
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={canEdit ? handleAddRectangle : undefined}
        disabled={!canEdit}
        title={canEdit ? "Create a rectangle at viewport center (R)" : "View-only access"}
        style={{
          opacity: canEdit ? 1 : 0.5,
          cursor: canEdit ? 'pointer' : 'not-allowed',
        }}
      >
        ◻️ Rectangle
      </button>
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={canEdit ? handleAddCircle : undefined}
        disabled={!canEdit}
        title={canEdit ? "Create a circle at viewport center (C)" : "View-only access"}
        style={{
          opacity: canEdit ? 1 : 0.5,
          cursor: canEdit ? 'pointer' : 'not-allowed',
        }}
      >
        ⭕ Circle
      </button>
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={canEdit ? handleAddLine : undefined}
        disabled={!canEdit}
        title={canEdit ? "Create a line at viewport center (L)" : "View-only access"}
        style={{
          opacity: canEdit ? 1 : 0.5,
          cursor: canEdit ? 'pointer' : 'not-allowed',
        }}
      >
        ➖ Line
      </button>
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={canEdit ? handleAddOval : undefined}
        disabled={!canEdit}
        title={canEdit ? "Create an oval at viewport center (O)" : "View-only access"}
        style={{
          opacity: canEdit ? 1 : 0.5,
          cursor: canEdit ? 'pointer' : 'not-allowed',
        }}
      >
        ⭕ Oval
      </button>
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={canEdit ? toggleConnectorMode : undefined}
        disabled={!canEdit}
        title={canEdit ? "Connect two objects" : "View-only access"}
        style={{
          background: connectorMode ? '#667eea' : 'transparent',
          color: connectorMode ? 'white' : '#94A3B8',
          opacity: canEdit ? 1 : 0.5,
          cursor: canEdit ? 'pointer' : 'not-allowed',
        }}
      >
        {connectorMode ? '🔗 Connecting...' : '🔗 Connector'}
      </button>
      {connectorMode && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(102, 126, 234, 0.1)',
          borderRadius: 8,
          marginTop: 8,
        }}>
          <label style={{
            display: 'block',
            color: '#94A3B8',
            fontSize: '0.75rem',
            fontWeight: 600,
            marginBottom: 8,
          }}>
            Connector Style:
          </label>
          <select
            value={connectorStyle}
            onChange={(e) => setConnectorStyle(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 6,
              color: 'white',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            <option value="arrow">→ Arrow</option>
            <option value="line">─ Line (no arrow)</option>
            <option value="curved">⤴ Curved</option>
            <option value="elbowed">⌐ Elbowed</option>
          </select>
        </div>
      )}
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={canEdit ? () => {
          const { x, y } = getBoardCenter();
          const frameWidth = 600;
          const frameHeight = 400;
          createFrame(x - frameWidth / 2, y - frameHeight / 2, frameWidth, frameHeight, 'Frame');
          showToast('📦 Frame created', 'success');
        } : undefined}
        disabled={!canEdit}
        title={canEdit ? "Create a frame to group content (F)" : "View-only access"}
        style={{
          opacity: canEdit ? 1 : 0.5,
          cursor: canEdit ? 'pointer' : 'not-allowed',
        }}
      >
        📦 Frame
      </button>
      
      <div style={{ 
        color: '#94A3B8', 
        fontSize: '0.75rem', 
        fontWeight: 600, 
        padding: '8px 12px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        marginTop: 16,
        marginBottom: 8,
      }}>
        ACTIONS
      </div>
      <HistoryPanel />
      <ClearBoardButton />
    </div>
  );
}
