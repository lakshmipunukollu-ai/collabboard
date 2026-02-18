import { useCallback } from 'react';
import { useBoard } from '../context/BoardContext';
import { showToast } from './Toast';
import ClearBoardButton from './ClearBoardButton';
import HistoryPanel from './HistoryPanel';

const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#FDE68A'];

export default function Toolbar() {
  const { createStickyNote, createShape, stageRef } = useBoard();

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
        onClick={handleAddSticky}
        title="Create a sticky note at viewport center (S)"
      >
        📝 Sticky Note
      </button>
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={handleAddRectangle}
        title="Create a rectangle at viewport center (R)"
      >
        ◻️ Rectangle
      </button>
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={handleAddCircle}
        title="Create a circle at viewport center (C)"
      >
        ⭕ Circle
      </button>
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={handleAddLine}
        title="Create a line at viewport center (L)"
      >
        ➖ Line
      </button>
      <button 
        type="button" 
        className="toolbar-btn" 
        onClick={handleAddOval}
        title="Create an oval at viewport center (O)"
      >
        ⭕ Oval
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
