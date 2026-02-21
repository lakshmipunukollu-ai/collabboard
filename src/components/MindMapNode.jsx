import { useEffect, useRef, useState } from 'react';
import { Group, Circle, Text, Transformer } from 'react-konva';
import { useBoard } from '../context/BoardContext';

export default function MindMapNode({ id, data }) {
  const {
    moveObjectLocal,
    moveObject, moveObjectGroup, deleteObject, updateObject,
    selectedIds, toggleSelection, startEditing, stopEditing,
  } = useBoard();

  const {
    x = 0, y = 0, width = 120, height = 120,
    text = 'Idea', color = '#667eea',
  } = data;

  const radius = Math.min(width, height) / 2;
  const cx = radius;
  const cy = radius;

  const groupRef = useRef(null);
  const transformerRef = useRef(null);
  const dragThrottleRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const isSelected = selectedIds.has(id);

  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

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

  const handleDragStart = () => { setIsDragging(true); startEditing(id); };
  const handleDragMove = (e) => {
    moveObjectLocal(id, e.target.x(), e.target.y());
    if (!dragThrottleRef.current) {
      dragThrottleRef.current = setTimeout(() => {
        moveObject(id, e.target.x(), e.target.y());
        dragThrottleRef.current = null;
      }, 50);
    }
  };
  const handleDragEnd = (e) => {
    clearTimeout(dragThrottleRef.current);
    dragThrottleRef.current = null;
    moveObjectGroup(id, e.target.x(), e.target.y());
    setIsDragging(false);
    stopEditing(id);
  };

  const handleDblClick = () => {
    const newText = window.prompt('Node label:', text);
    if (newText !== null) updateObject(id, { text: newText });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={x} y={y}
        draggable
        opacity={isDragging ? 0.8 : 1}
        onClick={(e) => { e.cancelBubble = true; toggleSelection(id, e.evt.shiftKey); }}
        onTap={(e) => { e.cancelBubble = true; toggleSelection(id, false); }}
        onDblClick={handleDblClick}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <Circle
          x={cx} y={cy}
          radius={radius}
          fill={color}
          stroke={isSelected ? '#93C5FD' : 'rgba(255,255,255,0.2)'}
          strokeWidth={isSelected ? 2.5 : 1}
          shadowBlur={isSelected ? 12 : 4}
          shadowColor={color}
          shadowOpacity={0.4}
        />
        <Text
          x={0} y={cy - 12}
          width={width}
          text={text}
          fontSize={13}
          fontStyle="bold"
          fontFamily="Inter, sans-serif"
          fill="white"
          align="center"
          wrap="word"
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          keepRatio
          rotateEnabled={false}
          enabledAnchors={['bottom-right']}
          boundBoxFunc={(_, nb) => ({
            ...nb,
            width: Math.max(60, nb.width),
            height: Math.max(60, nb.height),
          })}
        />
      )}
    </>
  );
}
