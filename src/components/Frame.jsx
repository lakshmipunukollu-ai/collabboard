import { useState, useEffect, useRef } from 'react';
import { Group, Rect, Text, Transformer } from 'react-konva';
import { useBoard } from '../context/BoardContext';
import { useUser } from '@clerk/clerk-react';

export default function Frame({ id, data }) {
  const { 
    moveObject, 
    updateObject,
    resizeObject,
    deleteObject,
    selectedIds, 
    toggleSelection,
    activeEdits,
    startEditing,
    stopEditing,
    objects,
  } = useBoard();
  const { user } = useUser();
  const [isDragging, setIsDragging] = useState(false);
  const isSelected = selectedIds.has(id);
  const groupRef = useRef(null);
  const transformerRef = useRef(null);
  const dragThrottleRef = useRef(null);
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  
  const activeEdit = activeEdits[id];
  const isBeingEditedByOther = activeEdit && activeEdit.userId !== user?.id;

  const { 
    x, 
    y, 
    width = 600, 
    height = 400,
    title = 'Frame',
    backgroundColor = 'rgba(100, 116, 139, 0.1)',
    borderColor = '#64748b',
  } = data;

  // Attach transformer when selected
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
    setIsDragging(true);
    startEditing(id);
    lastDragPosRef.current = { x, y };
  };

  const handleDragMove = (e) => {
    const newX = e.target.x();
    const newY = e.target.y();
    
    lastDragPosRef.current = { x: newX, y: newY };
    
    // Throttle Firebase writes
    if (!dragThrottleRef.current) {
      dragThrottleRef.current = setTimeout(() => {
        // Move children with the frame
        const deltaX = newX - x;
        const deltaY = newY - y;
        
        Object.entries(objects).forEach(([childId, child]) => {
          if (child.parentFrameId === id) {
            moveObject(childId, child.x + deltaX, child.y + deltaY);
          }
        });
        
        moveObject(id, lastDragPosRef.current.x, lastDragPosRef.current.y);
        dragThrottleRef.current = null;
      }, 50);
    }
  };

  const handleDragEnd = (e) => {
    if (dragThrottleRef.current) {
      clearTimeout(dragThrottleRef.current);
      dragThrottleRef.current = null;
    }
    
    let finalX = e.target.x();
    let finalY = e.target.y();
    
    // Move children with frame
    const deltaX = finalX - x;
    const deltaY = finalY - y;
    
    Object.entries(objects).forEach(([childId, child]) => {
      if (child.parentFrameId === id) {
        moveObject(childId, child.x + deltaX, child.y + deltaY);
      }
    });
    
    moveObject(id, finalX, finalY);
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

    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(200, width * scaleX);
    const newHeight = Math.max(150, height * scaleY);

    resizeObject(id, newWidth, newHeight);
    moveObject(id, node.x(), node.y());
    
    stopEditing(id);
  };

  const handleTitleDblClick = () => {
    const newTitle = prompt('Frame Title:', title);
    if (newTitle !== null && newTitle.trim()) {
      updateObject(id, { title: newTitle.trim() });
    }
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={x}
        y={y}
        draggable
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onTransformStart={handleTransformStart}
        onTransformEnd={handleTransformEnd}
      >
        {/* Frame background */}
        <Rect
          width={width}
          height={height}
          fill={backgroundColor}
          stroke={isBeingEditedByOther ? '#F59E0B' : isSelected ? '#3B82F6' : borderColor}
          strokeWidth={isBeingEditedByOther ? 3 : isSelected ? 3 : 2}
          dash={[15, 10]}
          cornerRadius={8}
          shadowColor="rgba(0,0,0,0.1)"
          shadowBlur={8}
          shadowOffsetY={2}
        />
        
        {/* Title bar */}
        <Rect
          y={0}
          width={width}
          height={40}
          fill="rgba(15, 23, 42, 0.8)"
          cornerRadius={[8, 8, 0, 0]}
        />
        
        {/* Title text */}
        <Text
          text={title}
          x={16}
          y={12}
          fontSize={16}
          fontFamily="Inter, sans-serif"
          fill="white"
          fontStyle="bold"
          width={width - 32}
          ellipsis={true}
          onDblClick={handleTitleDblClick}
        />
      </Group>
      
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Minimum size constraints
            if (newBox.width < 200 || newBox.height < 150) {
              return oldBox;
            }
            return newBox;
          }}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
        />
      )}
    </>
  );
}
