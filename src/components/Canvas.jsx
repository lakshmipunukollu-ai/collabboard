import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import { useBoard } from '../context/BoardContext';
import StickyNote from './StickyNote';
import BoardShape from './BoardShape';
import CursorOverlay from './CursorOverlay';
import StickyNoteEditOverlay from './StickyNoteEditOverlay';
import ErrorBoundary from './ErrorBoundary';

const MIN_SCALE = 0.001; // Nearly infinite zoom out
const MAX_SCALE = 4;

export default function Canvas() {
  const {
    stageRef,
    objects,
    cursors,
    updateCursor,
    setOnline,
    followUserId,
    setFollowUserId,
    selectedIds,
    clearSelection,
    deleteSelectedObjects,
    duplicateSelectedObjects,
    copySelectedObjects,
    pasteObjects,
    editingNoteId,
  } = useBoard();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const lastPointerRef = useRef(null);
  const cursorPosRef = useRef(null);

  const handleResize = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    // Only update if dimensions actually changed to avoid unnecessary re-renders
    setDimensions((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    setOnline();
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize, setOnline]);

  // Global keyboard handlers for selection operations
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle shortcuts if user is editing text
      if (editingNoteId) return;
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      // Delete selected objects
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault();
        deleteSelectedObjects();
      }
      
      // Duplicate: Cmd/Ctrl+D
      if (cmdOrCtrl && e.key === 'd' && selectedIds.size > 0) {
        e.preventDefault();
        duplicateSelectedObjects();
      }
      
      // Copy: Cmd/Ctrl+C
      if (cmdOrCtrl && e.key === 'c' && selectedIds.size > 0) {
        e.preventDefault();
        copySelectedObjects();
      }
      
      // Paste: Cmd/Ctrl+V
      if (cmdOrCtrl && e.key === 'v') {
        e.preventDefault();
        pasteObjects();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, deleteSelectedObjects, duplicateSelectedObjects, copySelectedObjects, pasteObjects, editingNoteId]);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, oldScale * (scaleBy ** direction))
    );
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setScale(newScale);
    setStagePos(newPos);
  }, []);

  const handlePointerDown = useCallback(
    (e) => {
      if (e.target === e.target.getStage()) {
        setIsDragging(true);
        setFollowUserId(null);
        clearSelection(); // Clear selection when clicking on stage
        lastPointerRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      }
    },
    [setFollowUserId, clearSelection]
  );

  // Send cursor position at 16ms intervals (60fps)
  // Smooth real-time feel without overwhelming Firebase
  useEffect(() => {
    const interval = setInterval(() => {
      const pos = cursorPosRef.current;
      if (pos != null) {
        updateCursor(pos.x, pos.y);
        cursorPosRef.current = null;
      }
    }, 16); // 60fps for smooth cursor tracking
    return () => clearInterval(interval);
  }, [updateCursor]);

  const handlePointerMove = useCallback(
    (e) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (pos) {
        const transform = stage.getAbsoluteTransform().copy().invert();
        const boardPoint = transform.point(pos);
        cursorPosRef.current = { x: boardPoint.x, y: boardPoint.y };
      }
      if (isDragging && lastPointerRef.current) {
        const dx = e.evt.clientX - lastPointerRef.current.x;
        const dy = e.evt.clientY - lastPointerRef.current.y;
        const newPos = { x: stagePos.x + dx, y: stagePos.y + dy };
        setStagePos(newPos);
        lastPointerRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      }
    },
    [isDragging, stagePos]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    lastPointerRef.current = null;
  }, []);

  // When following a user, pan the stage so their cursor stays centered
  useEffect(() => {
    if (!followUserId || isDragging) return;
    const c = cursors?.[followUserId];
    if (c?.x == null || c?.y == null) return;
    const W = dimensions.width;
    const H = dimensions.height;
    const newPos = {
      x: W / 2 - c.x * scale,
      y: H / 2 - c.y * scale,
    };
    setStagePos(newPos);
  }, [followUserId, cursors, scale, dimensions.width, dimensions.height, isDragging]);

  const stickyNotes = Object.entries(objects).filter(([, obj]) => obj.type === 'sticky');
  const shapes = Object.entries(objects).filter(([, obj]) => 
    obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'line'
  );

  return (
    <div ref={containerRef} className="canvas-container" id="canvas-overlay-root">
      <Stage
        ref={(node) => {
          stageRef.current = node;
        }}
        width={dimensions.width}
        height={dimensions.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        draggable={false}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <Layer>
          {stickyNotes.map(([id, obj]) => (
            <StickyNote key={id} id={id} data={obj} />
          ))}
          {shapes.map(([id, obj]) => (
            <BoardShape key={id} id={id} data={obj} />
          ))}
        </Layer>
      </Stage>
      <CursorOverlay stageRef={stageRef} scale={scale} stagePos={stagePos} />
      <ErrorBoundary>
        <StickyNoteEditOverlay />
      </ErrorBoundary>
    </div>
  );
}
