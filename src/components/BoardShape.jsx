import { useState, useEffect, useRef } from 'react';
import { Group, Rect, Circle, Line, Ellipse, Transformer } from 'react-konva';
import { useBoard } from '../context/BoardContext';
import { useUser } from '@clerk/clerk-react';
import { showToast } from './Toast';

export default function BoardShape({ id, data }) {
  const { 
    moveObjectLocal,
    moveObject,
    moveObjectGroup,
    deleteObject, 
    resizeObject,
    updateObject,
    selectedIds, 
    toggleSelection,
    activeEdits,
    startEditing,
    stopEditing,
    presence,
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
    type = 'rectangle', 
    x, 
    y, 
    width = 100, 
    height = 80, 
    color = '#6366F1',
    opacity = 0.9,
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

  const handleDragStart = () => {
    if (isBeingEditedByOther) {
      const editorName = presence[activeEdit.userId]?.displayName || 'Another user';
      showToast(`⚠️ ${editorName} is editing this`, 'warning');
    }
    setIsDragging(true);
    startEditing(id);
  };

  const handleDragMove = (e) => {
    const newX = e.target.x();
    const newY = e.target.y();
    lastDragPosRef.current = { x: newX, y: newY };
    moveObjectLocal(id, newX, newY);
    
    // Throttle Firebase writes to every 50ms during drag
    if (!dragThrottleRef.current) {
      dragThrottleRef.current = setTimeout(() => {
        moveObject(id, lastDragPosRef.current.x, lastDragPosRef.current.y);
        dragThrottleRef.current = null;
      }, 50);
    }
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
    toggleSelection(id, e.evt.shiftKey);
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

    const newWidth = Math.max(40, width * scaleX);
    const newHeight = Math.max(40, height * scaleY);

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

  const renderShape = () => {
    const getStroke = () => {
      if (isBeingEditedByOther) return '#F59E0B';
      if (isSelected) return '#3B82F6';
      return '#4F46E5';
    };

    switch (type) {
      case 'circle':
        const radius = Math.min(width, height) / 2;
        return (
          <Circle
            x={width / 2}
            y={height / 2}
            radius={radius}
            fill={color}
            stroke={getStroke()}
            strokeWidth={isBeingEditedByOther ? 3 : isSelected ? 4 : 2}
            dash={isBeingEditedByOther ? [10, 5] : undefined}
            shadowColor={isSelected ? "rgba(59, 130, 246, 0.6)" : "rgba(0,0,0,0.2)"}
            shadowBlur={isSelected ? 20 : 8}
            shadowOffset={{ x: 2, y: 2 }}
            opacity={0.9}
          />
        );
      case 'oval':
        return (
          <Ellipse
            x={width / 2}
            y={height / 2}
            radiusX={width / 2}
            radiusY={height / 2}
            fill={color}
            stroke={getStroke()}
            strokeWidth={isBeingEditedByOther ? 3 : isSelected ? 4 : 2}
            dash={isBeingEditedByOther ? [10, 5] : undefined}
            shadowColor={isSelected ? "rgba(59, 130, 246, 0.6)" : "rgba(0,0,0,0.2)"}
            shadowBlur={isSelected ? 20 : 8}
            shadowOffset={{ x: 2, y: 2 }}
            opacity={opacity}
          />
        );
      case 'line':
        return (
          <Line
            points={[0, height / 2, width, height / 2]}
            stroke={isBeingEditedByOther ? '#F59E0B' : isSelected ? "#3B82F6" : color}
            strokeWidth={isBeingEditedByOther ? 5 : isSelected ? 6 : 4}
            dash={isBeingEditedByOther ? [10, 5] : undefined}
            lineCap="round"
            lineJoin="round"
            shadowColor={isSelected ? "rgba(59, 130, 246, 0.6)" : "rgba(0,0,0,0.2)"}
            shadowBlur={isSelected ? 15 : 5}
          />
        );
      case 'rectangle':
      default:
        return (
          <Rect
            width={width}
            height={height}
            fill={color}
            stroke={getStroke()}
            strokeWidth={isBeingEditedByOther ? 3 : isSelected ? 4 : 2}
            dash={isBeingEditedByOther ? [10, 5] : undefined}
            cornerRadius={4}
            shadowColor={isSelected ? "rgba(59, 130, 246, 0.6)" : "rgba(0,0,0,0.2)"}
            shadowBlur={isSelected ? 20 : 8}
            shadowOffset={{ x: 2, y: 2 }}
            opacity={opacity}
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
        rotation={rotation}
        draggable
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onTransformStart={handleTransformStart}
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
