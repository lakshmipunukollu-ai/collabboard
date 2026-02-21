import { useState, useEffect, useRef } from 'react';
import { Group, Text, Rect, Transformer } from 'react-konva';
import { useBoard } from '../context/BoardContext';

export default function TextBox({ id, data }) {
  const {
    moveObjectLocal,
    moveObject, moveObjectGroup, deleteObject, resizeObject, updateObject,
    selectedIds, toggleSelection, startEditing, stopEditing,
  } = useBoard();

  const {
    x = 0, y = 0, width = 200, height = 60,
    text = 'Text', fontSize = 16,
    fontFamily = 'Inter, sans-serif',
    color = '#f1f5f9',
    rotation = 0,
  } = data;

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
  }, [isSelected, width, height]);

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
  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    resizeObject(id, Math.max(40, width * scaleX), Math.max(20, height * scaleY));
  };

  // Double-click: open native prompt for text editing
  const handleDblClick = () => {
    const newText = window.prompt('Edit text:', text);
    if (newText !== null) updateObject(id, { text: newText });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={x} y={y}
        rotation={rotation}
        draggable
        onClick={(e) => { e.cancelBubble = true; toggleSelection(id, e.evt.shiftKey); }}
        onTap={(e) => { e.cancelBubble = true; toggleSelection(id, false); }}
        onDblClick={handleDblClick}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        opacity={isDragging ? 0.8 : 1}
      >
        {/* Transparent hit area */}
        <Rect width={width} height={height} fill="transparent" />
        <Text
          text={text}
          width={width}
          height={height}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill={color}
          wrap="word"
          align="left"
          verticalAlign="top"
          padding={4}
        />
        {/* Selection outline */}
        {isSelected && (
          <Rect
            width={width} height={height}
            stroke="#667eea" strokeWidth={1}
            dash={[4, 3]} fill="transparent"
            listening={false}
          />
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          keepRatio={false}
          enabledAnchors={['middle-right', 'bottom-center', 'bottom-right']}
          boundBoxFunc={(_, newBox) => ({
            ...newBox,
            width: Math.max(40, newBox.width),
            height: Math.max(20, newBox.height),
          })}
        />
      )}
    </>
  );
}
