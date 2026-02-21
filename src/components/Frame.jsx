import { useState, useEffect, useRef } from 'react';
import { Group, Rect, Text, Transformer } from 'react-konva';
import { useBoard } from '../context/BoardContext';
import { useUser } from '@clerk/clerk-react';

export default function Frame({ id, data }) {
  const { 
    moveObjectLocal,
    updateObjectLocal,
    moveObject,
    moveObjectGroup,
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
  // Snapshot of frame + all children positions taken at dragStart.
  // Every throttle tick uses totalDelta from this snapshot — immune to stale closures.
  const dragStartRef = useRef(null);
  
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

  // Attach transformer when selected and bring it to the top of the layer
  // so its handles are never hidden under sticky notes or other objects inside the frame
  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.moveToTop();
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

    // Snapshot frame origin + all children positions at drag start.
    // Using objects from context here is fine — this runs once synchronously.
    const isInsideFrame = (obj) => {
      const frameLeft = x;
      const frameTop = y;
      const frameRight = x + width;
      const frameBottom = y + height;

      if (obj.type === 'arrow') {
        const cx = ((obj.x1 ?? 0) + (obj.x2 ?? 0)) / 2;
        const cy = ((obj.y1 ?? 0) + (obj.y2 ?? 0)) / 2;
        return cx >= frameLeft && cx <= frameRight && cy >= frameTop && cy <= frameBottom;
      }

      const objW = obj.width || 100;
      const objH = obj.height || 100;
      const cx = (obj.x ?? 0) + objW / 2;
      const cy = (obj.y ?? 0) + objH / 2;
      return cx >= frameLeft && cx <= frameRight && cy >= frameTop && cy <= frameBottom;
    };

    const children = {};
    Object.entries(objects).forEach(([childId, child]) => {
      if (childId === id || child.type === 'frame' || child.type === 'connector') return;
      if (child.parentFrameId === id || isInsideFrame(child)) {
        if (child.type === 'arrow') {
          children[childId] = {
            type: 'arrow',
            x1: child.x1 ?? 0,
            y1: child.y1 ?? 0,
            x2: child.x2 ?? 0,
            y2: child.y2 ?? 0,
          };
        } else {
          children[childId] = { type: 'default', x: child.x ?? 0, y: child.y ?? 0 };
        }
      }
    });
    dragStartRef.current = { frameX: x, frameY: y, children };
  };

  const handleDragMove = (e) => {
    const newX = e.target.x();
    const newY = e.target.y();
    lastDragPosRef.current = { x: newX, y: newY };

    // Update local state on every frame for smooth connector tracking while dragging.
    const start = dragStartRef.current;
    if (start) {
      const totalDX = newX - start.frameX;
      const totalDY = newY - start.frameY;
      Object.entries(start.children).forEach(([childId, childStart]) => {
        if (childStart.type === 'arrow') {
          updateObjectLocal(childId, {
            x1: childStart.x1 + totalDX,
            y1: childStart.y1 + totalDY,
            x2: childStart.x2 + totalDX,
            y2: childStart.y2 + totalDY,
            parentFrameId: id,
          });
        } else {
          moveObjectLocal(childId, childStart.x + totalDX, childStart.y + totalDY);
        }
      });
    }
    moveObjectLocal(id, newX, newY);

    // Throttle Firebase writes to once per 50 ms
    if (!dragThrottleRef.current) {
      dragThrottleRef.current = setTimeout(() => {
        const latestX = lastDragPosRef.current.x;
        const latestY = lastDragPosRef.current.y;
        const dragStart = dragStartRef.current;
        if (dragStart) {
          // Total delta from drag-start — idempotent, no stale-closure drift
          const totalDX = latestX - dragStart.frameX;
          const totalDY = latestY - dragStart.frameY;
          Object.entries(dragStart.children).forEach(([childId, childStart]) => {
            if (childStart.type === 'arrow') {
              updateObject(childId, {
                x1: childStart.x1 + totalDX,
                y1: childStart.y1 + totalDY,
                x2: childStart.x2 + totalDX,
                y2: childStart.y2 + totalDY,
                parentFrameId: id,
              });
            } else {
              moveObject(childId, childStart.x + totalDX, childStart.y + totalDY, { skipFrameDetection: true });
            }
          });
        }
        moveObject(id, latestX, latestY);
        dragThrottleRef.current = null;
      }, 50);
    }
  };

  const handleDragEnd = (e) => {
    if (dragThrottleRef.current) {
      clearTimeout(dragThrottleRef.current);
      dragThrottleRef.current = null;
    }

    const finalX = e.target.x();
    const finalY = e.target.y();
    const start = dragStartRef.current;

    if (start) {
      const totalDX = finalX - start.frameX;
      const totalDY = finalY - start.frameY;
      Object.entries(start.children).forEach(([childId, childStart]) => {
        if (childStart.type === 'arrow') {
          updateObject(childId, {
            x1: childStart.x1 + totalDX,
            y1: childStart.y1 + totalDY,
            x2: childStart.x2 + totalDX,
            y2: childStart.y2 + totalDY,
            parentFrameId: id,
          });
        } else {
          moveObject(childId, childStart.x + totalDX, childStart.y + totalDY, { skipFrameDetection: true });
        }
      });
    }

    moveObjectGroup(id, finalX, finalY);
    dragStartRef.current = null;
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

    // node.width() returns 0 for a Konva Group (no explicit width attribute).
    // Use the stored width/height from data props instead — they are the actual dimensions.
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const newWidth = Math.max(200, width * scaleX);
    const newHeight = Math.max(150, height * scaleY);
    const newX = node.x();
    const newY = node.y();

    node.scaleX(1);
    node.scaleY(1);

    resizeObject(id, newWidth, newHeight);
    moveObject(id, newX, newY);

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
            if (newBox.width < 200 || newBox.height < 150) {
              return oldBox;
            }
            return newBox;
          }}
          enabledAnchors={[
            'top-left', 'top-center', 'top-right',
            'middle-left',            'middle-right',
            'bottom-left', 'bottom-center', 'bottom-right',
          ]}
          rotateEnabled={false}
        />
      )}
    </>
  );
}
