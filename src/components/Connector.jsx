import { useMemo } from 'react';
import { Arrow, Text, Rect, Group } from 'react-konva';
import { useBoard } from '../context/BoardContext';

export default function Connector({ id, data }) {
  const { objects, selectedIds, toggleSelection, deleteObject, updateObject } = useBoard();
  const isSelected = selectedIds.has(id);

  const {
    startObjectId,
    endObjectId,
    color = '#64748b',
    strokeWidth = 2,
    arrowStyle = 'straight',
    label = '',
    labelColor = '#e2e8f0',
  } = data;

  const startObj = objects[startObjectId];
  const endObj = objects[endObjectId];

  const points = useMemo(() => {
    if (!startObj || !endObj) return null;

    const startX = startObj.x + (startObj.width || 100) / 2;
    const startY = startObj.y + (startObj.height || 100) / 2;
    const endX = endObj.x + (endObj.width || 100) / 2;
    const endY = endObj.y + (endObj.height || 100) / 2;

    if (arrowStyle === 'curved') {
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const offsetX = (endY - startY) * 0.2;
      const offsetY = (startX - endX) * 0.2;
      return [startX, startY, midX + offsetX, midY + offsetY, endX, endY];
    }
    if (arrowStyle === 'elbowed') {
      const midX = (startX + endX) / 2;
      return [startX, startY, midX, startY, midX, endY, endX, endY];
    }
    return [startX, startY, endX, endY];
  }, [startObj, endObj, arrowStyle]);

  if (!points) return null;

  const midX = (points[0] + points[points.length - 2]) / 2;
  const midY = (points[1] + points[points.length - 1]) / 2;

  const showArrowhead = arrowStyle !== 'line';

  const handleClick = (e) => {
    e.cancelBubble = true;
    toggleSelection(id, e.evt.shiftKey);
  };

  const handleDblClick = (e) => {
    e.cancelBubble = true;
    const newLabel = window.prompt('Connector label:', label);
    if (newLabel !== null) updateObject(id, { label: newLabel });
  };

  return (
    <Group onDblClick={handleDblClick}>
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
        hitStrokeWidth={12}
        shadowColor={isSelected ? 'rgba(59,130,246,0.6)' : 'rgba(0,0,0,0.2)'}
        shadowBlur={isSelected ? 15 : 5}
        listening
      />
      {/* Label at midpoint */}
      {label ? (
        <>
          <Rect
            x={midX - label.length * 3.6 - 6}
            y={midY - 10}
            width={label.length * 7.2 + 12}
            height={20}
            fill="#1e293b"
            cornerRadius={4}
            listening={false}
          />
          <Text
            x={midX - label.length * 3.6 - 3}
            y={midY - 7}
            text={label}
            fontSize={11}
            fontFamily="Inter, sans-serif"
            fill={labelColor}
            listening={false}
          />
        </>
      ) : null}
    </Group>
  );
}
