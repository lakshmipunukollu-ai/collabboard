import { useMemo } from 'react';
import { Arrow } from 'react-konva';
import { useBoard } from '../context/BoardContext';

export default function Connector({ id, data }) {
  const { objects, selectedIds, toggleSelection, deleteObject } = useBoard();
  const isSelected = selectedIds.has(id);

  const {
    startObjectId,
    endObjectId,
    color = '#64748b',
    strokeWidth = 2,
    arrowStyle = 'straight', // 'straight', 'curved'
  } = data;

  // Get start and end object positions
  const startObj = objects[startObjectId];
  const endObj = objects[endObjectId];

  // Calculate connection points (center of each object)
  const points = useMemo(() => {
    if (!startObj || !endObj) return null;

    const startX = startObj.x + (startObj.width || 100) / 2;
    const startY = startObj.y + (startObj.height || 100) / 2;
    const endX = endObj.x + (endObj.width || 100) / 2;
    const endY = endObj.y + (endObj.height || 100) / 2;

    if (arrowStyle === 'curved') {
      // Curved path (quadratic bezier)
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const offsetX = (endY - startY) * 0.2;
      const offsetY = (startX - endX) * 0.2;
      return [startX, startY, midX + offsetX, midY + offsetY, endX, endY];
    }

    if (arrowStyle === 'elbowed') {
      // Elbowed/orthogonal path (right-angle)
      const midX = (startX + endX) / 2;
      return [startX, startY, midX, startY, midX, endY, endX, endY];
    }

    // Straight line (default for both 'arrow' and 'line')
    return [startX, startY, endX, endY];
  }, [startObj, endObj, arrowStyle]);

  if (!points) return null; // One or both objects don't exist

  const handleClick = (e) => {
    e.cancelBubble = true;
    toggleSelection(id, e.evt.shiftKey);
  };

  const handleKeyDown = (e) => {
    if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      deleteObject(id);
    }
  };

  // For 'line' style, don't show arrowhead
  const showArrowhead = arrowStyle !== 'line';

  return (
    <Arrow
      points={points}
      stroke={isSelected ? '#3B82F6' : color}
      strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
      fill={isSelected ? '#3B82F6' : color}
      pointerLength={showArrowhead ? 10 : 0}
      pointerWidth={showArrowhead ? 10 : 0}
      tension={arrowStyle === 'curved' ? 0.5 : 0}
      bezier={arrowStyle === 'curved'}
      onClick={handleClick}
      onTap={handleClick}
      shadowColor={isSelected ? "rgba(59, 130, 246, 0.6)" : "rgba(0,0,0,0.2)"}
      shadowBlur={isSelected ? 15 : 5}
      listening
      onKeyDown={handleKeyDown}
    />
  );
}
