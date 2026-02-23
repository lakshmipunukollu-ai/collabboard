import { useState, useEffect, useRef } from 'react';
import { Group, Rect, Text, Transformer } from 'react-konva';
import { useBoard } from '../context/BoardContext';
import { useUser } from '@clerk/clerk-react';
import { showToast } from './Toast';

export default function StickyNote({ id, data }) {
  const { 
    moveObjectLocal,
    moveObjectGroupLocal,
    moveObject,
    moveObjectGroup,
    setEditingNoteId, 
    deleteObject, 
    editingNoteId, 
    resizeObject,
    updateObject,
    selectedIds,
    toggleSelection,
    activeEdits,
    startEditing,
    stopEditing,
    presence,
    beginMoveUndo,
  } = useBoard();
  const { user } = useUser();
  const [isDragging, setIsDragging] = useState(false);
  const isSelected = selectedIds.has(id);
  const groupRef = useRef(null);
  const transformerRef = useRef(null);
  const dragThrottleRef = useRef(null);
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  
  // Check if someone else is editing this object
  const activeEdit = activeEdits[id];
  const isBeingEditedByOther = activeEdit && activeEdit.userId !== user?.id;

  const { 
    x, 
    y, 
    width = 160, 
    height = 120, 
    color = '#FEF08A', 
    text = '',
    textColor = '#374151',
    fontFamily = 'Inter',
    fontSize = 14,
    rotation = 0,
  } = data;

  // Attach transformer to this group when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, width, height]);

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

  const handleDragStart = () => {
    if (isBeingEditedByOther) {
      const editorName = presence[activeEdit.userId]?.displayName || 'Another user';
      showToast(`⚠️ ${editorName} is editing this`, 'warning');
    }
    setIsDragging(true);
    startEditing(id);
    beginMoveUndo(id);
  };

  const handleDragMove = (e) => {
    const newX = e.target.x();
    const newY = e.target.y();
    lastDragPosRef.current = { x: newX, y: newY };
    // Local-only update during drag — Firebase write happens on dragEnd as a batch
    moveObjectGroupLocal(id, newX, newY);
  };

  const handleDragEnd = (e) => {
    // Clear any pending throttled update
    if (dragThrottleRef.current) {
      clearTimeout(dragThrottleRef.current);
      dragThrottleRef.current = null;
    }
    
    // Snap to 20px grid (hold Shift to disable snapping)
    let finalX = e.target.x();
    let finalY = e.target.y();
    
    if (!e.evt.shiftKey) {
      const gridSize = 20;
      finalX = Math.round(finalX / gridSize) * gridSize;
      finalY = Math.round(finalY / gridSize) * gridSize;
      e.target.x(finalX);
      e.target.y(finalY);
    }
    
    // Final position update — moves all selected objects if multi-select is active
    moveObjectGroup(id, finalX, finalY);
    setIsDragging(false);
    stopEditing(id);
  };

  const handleClick = (e) => {
    // If already editing, do nothing
    if (editingNoteId === id) return;
    
    // If shift-clicking, toggle selection only (don't start editing)
    if (e.evt.shiftKey) {
      toggleSelection(id, true);
      return;
    }
    
    // Single click: select AND start editing immediately
    toggleSelection(id, false);
    // Small delay to ensure selection state updates first
    setTimeout(() => {
      setEditingNoteId(id);
    }, 0);
  };

  const handleTransformStart = () => {
    startEditing(id);
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const newRotation = node.rotation();

    // Reset scale and apply to width/height instead
    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(80, width * scaleX);
    const newHeight = Math.max(60, height * scaleY);

    // Optimistic resize
    resizeObject(id, newWidth, newHeight);
    
    // Update position if node was moved
    moveObject(id, node.x(), node.y());
    
    // Save rotation if it changed
    if (Math.abs(newRotation - rotation) > 0.1) {
      updateObject(id, { rotation: newRotation });
    }
    
    stopEditing(id);
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={x}
        y={y}
        rotation={rotation}
        draggable
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onTransformStart={handleTransformStart}
        onTransformEnd={handleTransformEnd}
      >
        <Rect
          width={width}
          height={height}
          fill={color}
          shadowColor={isSelected ? "rgba(59, 130, 246, 0.6)" : "rgba(0,0,0,0.2)"}
          shadowBlur={isSelected ? 20 : 8}
          shadowOffset={{ x: 2, y: 2 }}
          cornerRadius={4}
          stroke={isBeingEditedByOther ? '#F59E0B' : isSelected ? '#3B82F6' : '#E5E7EB'}
          strokeWidth={isBeingEditedByOther ? 3 : isSelected ? 4 : 1}
          dash={isBeingEditedByOther ? [10, 5] : undefined}
        />
        <Text
          text={text || 'Double-click to edit'}
          x={8}
          y={8}
          width={width - 16}
          height={height - 16}
          fontSize={fontSize}
          fontFamily={`${fontFamily}, sans-serif`}
          fill={textColor}
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
