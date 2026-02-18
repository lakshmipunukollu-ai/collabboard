import { useCallback } from 'react';
import { useBoard } from '../context/BoardContext';

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
    const minScaleFactor = minScreenSize / baseSize;
    // Scale objects inversely to zoom - more zoomed out = bigger objects
    // Ensure at least minScaleFactor, cap at 20x to prevent massive objects
    const scaleFactor = Math.max(minScaleFactor, Math.min(1 / scale, 20));
    return scaleFactor;
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
  }, [createStickyNote, getBoardCenter, getScaledSize]);

  const handleAddRectangle = useCallback(() => {
    const { x, y } = getBoardCenter();
    const baseWidth = 100;
    const baseHeight = 80;
    const scaleFactor = getScaledSize(baseWidth);
    const width = baseWidth * scaleFactor;
    const height = baseHeight * scaleFactor;
    createShape('rectangle', x - width / 2, y - height / 2, width, height);
  }, [createShape, getBoardCenter, getScaledSize]);

  const handleAddCircle = useCallback(() => {
    const { x, y } = getBoardCenter();
    const baseDiameter = 100;
    const scaleFactor = getScaledSize(baseDiameter);
    const diameter = baseDiameter * scaleFactor;
    createShape('circle', x - diameter / 2, y - diameter / 2, diameter, diameter, '#10B981');
  }, [createShape, getBoardCenter, getScaledSize]);

  const handleAddLine = useCallback(() => {
    const { x, y } = getBoardCenter();
    const baseWidth = 150;
    const baseHeight = 20;
    const scaleFactor = getScaledSize(baseWidth);
    const width = baseWidth * scaleFactor;
    const height = baseHeight * scaleFactor;
    createShape('line', x - width / 2, y - height / 2, width, height, '#F59E0B');
  }, [createShape, getBoardCenter, getScaledSize]);

  return (
    <div className="toolbar">
      <button type="button" className="toolbar-btn" onClick={handleAddSticky}>
        + Sticky Note
      </button>
      <button type="button" className="toolbar-btn" onClick={handleAddRectangle}>
        + Rectangle
      </button>
      <button type="button" className="toolbar-btn" onClick={handleAddCircle}>
        + Circle
      </button>
      <button type="button" className="toolbar-btn" onClick={handleAddLine}>
        + Line
      </button>
    </div>
  );
}
