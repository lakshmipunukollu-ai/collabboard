import { useState, useEffect, useRef } from 'react';
import { Group, Rect, Circle, Line, Transformer } from 'react-konva';
import { useBoard } from '../context/BoardContext';

export default function BoardShape({ id, data }) {
  const { moveObject, deleteObject, resizeObject, selectedIds, toggleSelection } = useBoard();
  const [isDragging, setIsDragging] = useState(false);
  const isSelected = selectedIds.has(id);
  const groupRef = useRef(null);
  const transformerRef = useRef(null);

  const { type = 'rectangle', x, y, width = 100, height = 80, color = '#6366F1' } = data;

  // Attach transformer to this group when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteObject(id);
      }
    };

    if (isSelected) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSelected, id, deleteObject]);

  const handleDragEnd = (e) => {
    moveObject(id, e.target.x(), e.target.y());
    setIsDragging(false);
  };

  const handleClick = (e) => {
    toggleSelection(id, e.evt.shiftKey);
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and apply to width/height instead
    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(40, width * scaleX);
    const newHeight = Math.max(40, height * scaleY);

    // Optimistic resize
    resizeObject(id, newWidth, newHeight);
    
    // Also update position if node was moved
    moveObject(id, node.x(), node.y());
  };

  const renderShape = () => {
    switch (type) {
      case 'circle':
        const radius = Math.min(width, height) / 2;
        return (
          <Circle
            x={width / 2}
            y={height / 2}
            radius={radius}
            fill={color}
            stroke={isSelected ? "#3B82F6" : "#4F46E5"}
            strokeWidth={isSelected ? 4 : 2}
            opacity={0.9}
          />
        );
      case 'line':
        return (
          <Line
            points={[0, height / 2, width, height / 2]}
            stroke={color}
            strokeWidth={isSelected ? 6 : 4}
            lineCap="round"
            lineJoin="round"
          />
        );
      case 'rectangle':
      default:
        return (
          <Rect
            width={width}
            height={height}
            fill={color}
            stroke={isSelected ? "#3B82F6" : "#4F46E5"}
            strokeWidth={isSelected ? 4 : 2}
            cornerRadius={4}
            opacity={0.9}
          />
        );
    }
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={x}
        y={y}
        draggable
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onTransformEnd={handleTransformEnd}
      >
        {renderShape()}
      </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Min size constraints
            if (newBox.width < 40 || newBox.height < 40) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}
