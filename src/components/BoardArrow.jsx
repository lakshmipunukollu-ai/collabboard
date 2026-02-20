import { useEffect } from 'react';
import { Group, Arrow, Circle } from 'react-konva';
import { useBoard } from '../context/BoardContext';

export default function BoardArrow({ id, data }) {
  const { deleteObject, updateObject, selectedIds, toggleSelection } = useBoard();

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
    if (endpoint === 'start') {
      updateObject(id, { x1: e.target.x(), y1: e.target.y() });
    } else {
      updateObject(id, { x2: e.target.x(), y2: e.target.y() });
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
