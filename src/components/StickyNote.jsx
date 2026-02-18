import { useState, useEffect, useRef } from 'react';
import { Group, Rect, Text, Transformer } from 'react-konva';
import { useBoard } from '../context/BoardContext';

export default function StickyNote({ id, data }) {
  const { 
    moveObject, 
    setEditingNoteId, 
    deleteObject, 
    editingNoteId, 
    resizeObject,
    selectedIds,
    toggleSelection,
  } = useBoard();
  const [isDragging, setIsDragging] = useState(false);
  const isSelected = selectedIds.has(id);
  const groupRef = useRef(null);
  const transformerRef = useRef(null);

  const { x, y, width = 160, height = 120, color = '#FEF08A', text = '' } = data;

  // Attach transformer to this group when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Never delete the note when user is editing its text (Backspace should delete characters)
      if (editingNoteId === id) return;
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteObject(id);
      }
    };

    if (isSelected) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSelected, id, deleteObject, editingNoteId]);

  const handleDragEnd = (e) => {
    moveObject(id, e.target.x(), e.target.y());
    setIsDragging(false);
  };

  const handleDblClick = (e) => {
    e.cancelBubble = true;
    setEditingNoteId(id);
  };

  const handleClick = (e) => {
    if (editingNoteId === id) return; // don't toggle selection while editing
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

    const newWidth = Math.max(80, width * scaleX);
    const newHeight = Math.max(60, height * scaleY);

    // Optimistic resize
    resizeObject(id, newWidth, newHeight);
    
    // Also update position if node was moved
    moveObject(id, node.x(), node.y());
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
        onDblClick={handleDblClick}
        onTransformEnd={handleTransformEnd}
      >
        <Rect
          width={width}
          height={height}
          fill={color}
          shadowColor="rgba(0,0,0,0.2)"
          shadowBlur={8}
          shadowOffset={{ x: 2, y: 2 }}
          cornerRadius={4}
          stroke={isSelected ? '#3B82F6' : '#E5E7EB'}
          strokeWidth={isSelected ? 4 : 1}
        />
        <Text
          text={text || 'Double-click to edit'}
          x={8}
          y={8}
          width={width - 16}
          height={height - 16}
          fontSize={14}
          fontFamily="Inter, sans-serif"
          fill="#374151"
          wrap="word"
          listening={false}
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Min size constraints
            if (newBox.width < 80 || newBox.height < 60) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}
