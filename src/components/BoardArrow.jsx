import { useEffect } from 'react';
import { Group, Arrow, Circle } from 'react-konva';
import { useBoard } from '../context/BoardContext';

export default function BoardArrow({ id, data }) {
  const { deleteObject, updateObject, objects, selectedIds, toggleSelection } = useBoard();

  const {
    x1 = 0, y1 = 0, x2 = 150, y2 = 0,
    color = '#667eea',
    strokeWidth = 2,
  } = data;

  const isSelected = selectedIds.has(id);

  useEffect(() => {
    const handleKey = (e) => {
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteObject(id);
      }
    };
    if (isSelected) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isSelected, id, deleteObject]);

  const handleDragStart = (endpoint) => (e) => { e.cancelBubble = true; };
  const handleDragMove = (endpoint) => (e) => {
    const nx1 = endpoint === 'start' ? e.target.x() : x1;
    const ny1 = endpoint === 'start' ? e.target.y() : y1;
    const nx2 = endpoint === 'end' ? e.target.x() : x2;
    const ny2 = endpoint === 'end' ? e.target.y() : y2;
    const centerX = (nx1 + nx2) / 2;
    const centerY = (ny1 + ny2) / 2;

    let parentFrameId = null;
    for (const [objId, obj] of Object.entries(objects)) {
      if (obj.type !== 'frame') continue;
      const fx = obj.x || 0;
      const fy = obj.y || 0;
      const fw = obj.width || 600;
      const fh = obj.height || 400;
      if (centerX >= fx && centerX <= fx + fw && centerY >= fy && centerY <= fy + fh) {
        parentFrameId = objId;
        break;
      }
    }

    if (endpoint === 'start') {
      updateObject(id, { x1: nx1, y1: ny1, parentFrameId });
    } else {
      updateObject(id, { x2: nx2, y2: ny2, parentFrameId });
    }
  };

  const hitPad = 8;

  return (
    <Group onClick={(e) => { e.cancelBubble = true; toggleSelection(id, e.evt.shiftKey); }}>
      <Arrow
        points={[x1, y1, x2, y2]}
        stroke={isSelected ? '#93C5FD' : color}
        strokeWidth={strokeWidth}
        fill={isSelected ? '#93C5FD' : color}
        pointerLength={10}
        pointerWidth={8}
        hitStrokeWidth={hitPad}
        listening
      />
      {/* Draggable endpoints when selected */}
      {isSelected && (
        <>
          <Circle
            x={x1} y={y1} radius={6}
            fill="#fff" stroke="#667eea" strokeWidth={2}
            draggable
            onDragMove={handleDragMove('start')}
          />
          <Circle
            x={x2} y={y2} radius={6}
            fill="#fff" stroke="#667eea" strokeWidth={2}
            draggable
            onDragMove={handleDragMove('end')}
          />
        </>
      )}
    </Group>
  );
}
