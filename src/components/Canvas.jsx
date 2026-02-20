import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { useBoard } from '../context/BoardContext';
import StickyNote from './StickyNote';
import BoardShape from './BoardShape';
import Connector from './Connector';
import Frame from './Frame';
import CursorOverlay from './CursorOverlay';
import StickyNoteEditOverlay from './StickyNoteEditOverlay';
import BoardControlBar from './BoardControlBar';
import ContextMenu from './ContextMenu';
import ErrorBoundary from './ErrorBoundary';
import { showToast } from './Toast';

const MIN_SCALE = 0.001; // Nearly infinite zoom out
const MAX_SCALE = 4;

export default function Canvas() {
  const {
    stageRef,
    viewportCenterRef,
    objects,
    cursors,
    updateCursor,
    setOnline,
    followUserId,
    setFollowUserId,
    selectedIds,
    setSelectedIds,
    clearSelection,
    deleteSelectedObjects,
    deleteObject,
    duplicateSelectedObjects,
    copySelectedObjects,
    pasteObjects,
    editingNoteId,
    requestCenterView,
    setRequestCenterView,
  } = useBoard();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const lastPointerRef = useRef(null);
  const cursorPosRef = useRef(null);
  const selectionStartRef = useRef(null);

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

  // Keep viewport center in world coords updated so AI can place objects visibly (e.g. when stage ref is briefly unavailable).
  useEffect(() => {
    if (!viewportCenterRef) return;
    const cx = (dimensions.width / 2 - stagePos.x) / scale;
    const cy = (dimensions.height / 2 - stagePos.y) / scale;
    viewportCenterRef.current = { x: cx, y: cy };
  }, [viewportCenterRef, dimensions.width, dimensions.height, stagePos.x, stagePos.y, scale]);

  // Pan so a world point is at viewport center (e.g. after creating an object)
  useEffect(() => {
    if (!requestCenterView || !setRequestCenterView) return;
    const { x: wx, y: wy } = requestCenterView;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    setStagePos({
      x: centerX - wx * scale,
      y: centerY - wy * scale,
    });
    setRequestCenterView(null);
  }, [requestCenterView, setRequestCenterView, dimensions.width, dimensions.height, scale]);

  // Zoom to specific scale, centered on viewport
  const zoomToScale = useCallback((targetScale) => {
    const stage = stageRef.current;
    if (!stage) return;
    
    const oldScale = stage.scaleX();
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    
    // Calculate the board point that's currently at center
    const transform = stage.getAbsoluteTransform().copy().invert();
    const centerPoint = transform.point({ x: centerX, y: centerY });
    
    // Calculate new position to keep that board point at center
    const newPos = {
      x: centerX - centerPoint.x * targetScale,
      y: centerY - centerPoint.y * targetScale,
    };
    
    setScale(targetScale);
    setStagePos(newPos);
    showToast(`🔍 Zoom: ${Math.round(targetScale * 100)}%`, 'info');
  }, [dimensions.width, dimensions.height]);

  // Fit all objects in view
  const fitAllObjects = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || Object.keys(objects).length === 0) {
      showToast('ℹ️ No objects to fit', 'info');
      return;
    }
    
    // Calculate bounding box of all objects
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    Object.values(objects).forEach(obj => {
      const { x = 0, y = 0, width = 100, height = 100 } = obj;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const padding = 100;
    
    // Calculate scale to fit content with padding
    const scaleX = (dimensions.width - padding * 2) / contentWidth;
    const scaleY = (dimensions.height - padding * 2) / contentHeight;
    const newScale = Math.min(scaleX, scaleY, MAX_SCALE);
    
    // Center the content
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const newPos = {
      x: dimensions.width / 2 - centerX * newScale,
      y: dimensions.height / 2 - centerY * newScale,
    };
    
    setScale(newScale);
    setStagePos(newPos);
    showToast(`🔍 Fit ${Object.keys(objects).length} objects`, 'success');
  }, [objects, dimensions.width, dimensions.height]);

  // Global keyboard handlers for selection operations and zoom
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle shortcuts if user is editing text
      if (editingNoteId) return;

      // Don't handle shortcuts when focus is in an input/textarea (e.g. AI Assistant):
      // allows paste (Cmd+V), Backspace, etc. in the AI input and prevents deleting
      // the newly created object when the user is still focused in the chat.
      const active = document.activeElement;
      const isInputFocused = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        (typeof active.isContentEditable === 'boolean' && active.isContentEditable)
      );
      if (isInputFocused) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      // Zoom shortcuts (number keys)
      if (e.key === '1' && !cmdOrCtrl) {
        e.preventDefault();
        zoomToScale(1); // 100%
        return;
      }
      if (e.key === '2' && !cmdOrCtrl) {
        e.preventDefault();
        zoomToScale(2); // 200%
        return;
      }
      if (e.key === '0' && !cmdOrCtrl) {
        e.preventDefault();
        fitAllObjects();
        return;
      }
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        const newScale = Math.min(MAX_SCALE, scale * 1.25);
        zoomToScale(newScale);
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const newScale = Math.max(MIN_SCALE, scale / 1.25);
        zoomToScale(newScale);
        return;
      }
      
      // Delete selected objects
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault();
        const count = selectedIds.size;
        deleteSelectedObjects();
        showToast(`🗑️ Deleted ${count} object${count > 1 ? 's' : ''}`, 'info');
      }
      
      // Duplicate: Cmd/Ctrl+D
      if (cmdOrCtrl && e.key === 'd' && selectedIds.size > 0) {
        e.preventDefault();
        duplicateSelectedObjects();
        showToast(`📋 Duplicated ${selectedIds.size} object${selectedIds.size > 1 ? 's' : ''}`, 'success');
      }
      
      // Copy: Cmd/Ctrl+C
      if (cmdOrCtrl && e.key === 'c' && selectedIds.size > 0) {
        e.preventDefault();
        copySelectedObjects();
        setClipboard(true);
        showToast(`📋 Copied ${selectedIds.size} object${selectedIds.size > 1 ? 's' : ''}`, 'info');
      }
      
      // Paste: Cmd/Ctrl+V
      if (cmdOrCtrl && e.key === 'v') {
        e.preventDefault();
        pasteObjects();
        showToast('📋 Pasted objects', 'success');
      }
      
      // Select All: Cmd/Ctrl+A
      if (cmdOrCtrl && e.key === 'a') {
        e.preventDefault();
        const allIds = new Set(Object.keys(objects));
        setSelectedIds(allIds);
        showToast(`✓ Selected all ${allIds.size} objects`, 'info');
      }
      
      // Clear Board: Cmd/Ctrl+Shift+Delete
      if (cmdOrCtrl && e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        const count = Object.keys(objects).length;
        if (count === 0) {
          showToast('ℹ️ Board is already empty', 'info');
          return;
        }
        if (window.confirm(`Delete all ${count} objects? This cannot be undone.`)) {
          Object.keys(objects).forEach(id => deleteObject(id));
          showToast(`🗑️ Cleared ${count} objects`, 'success');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, deleteSelectedObjects, duplicateSelectedObjects, copySelectedObjects, pasteObjects, editingNoteId, scale, zoomToScale, fitAllObjects, objects, deleteObject, setClipboard]);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1; // Increased from 1.05 to 1.1 for 2x faster zooming
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
        setFollowUserId(null);
        
        // Shift+drag = area selection
        if (e.evt.shiftKey) {
          setIsSelecting(true);
          const stage = stageRef.current;
          if (stage) {
            const pos = stage.getPointerPosition();
            selectionStartRef.current = pos;
            setSelectionBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
          }
        } else {
          // Regular drag = pan
          setIsDragging(true);
          clearSelection();
          lastPointerRef.current = { x: e.evt.clientX, y: e.evt.clientY };
        }
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
      
      // Area selection
      if (isSelecting && selectionStartRef.current && pos) {
        const x = Math.min(selectionStartRef.current.x, pos.x);
        const y = Math.min(selectionStartRef.current.y, pos.y);
        const width = Math.abs(pos.x - selectionStartRef.current.x);
        const height = Math.abs(pos.y - selectionStartRef.current.y);
        setSelectionBox({ x, y, width, height });
      }
      
      // Pan canvas
      if (isDragging && lastPointerRef.current) {
        const dx = e.evt.clientX - lastPointerRef.current.x;
        const dy = e.evt.clientY - lastPointerRef.current.y;
        const newPos = { x: stagePos.x + dx, y: stagePos.y + dy };
        setStagePos(newPos);
        lastPointerRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      }
    },
    [isDragging, stagePos, isSelecting]
  );

  const handlePointerUp = useCallback(() => {
    // Complete area selection
    if (isSelecting && selectionBox) {
      const stage = stageRef.current;
      if (stage && selectionBox.width > 5 && selectionBox.height > 5) {
        // Convert screen selection box to board coordinates
        const transform = stage.getAbsoluteTransform().copy().invert();
        const topLeft = transform.point({ x: selectionBox.x, y: selectionBox.y });
        const bottomRight = transform.point({ 
          x: selectionBox.x + selectionBox.width, 
          y: selectionBox.y + selectionBox.height 
        });
        
        // Find all objects intersecting the selection box
        const selected = new Set();
        Object.entries(objects).forEach(([id, obj]) => {
          const { x = 0, y = 0, width = 100, height = 100 } = obj;
          const objRight = x + width;
          const objBottom = y + height;
          
          // Check intersection
          if (x < bottomRight.x && objRight > topLeft.x &&
              y < bottomRight.y && objBottom > topLeft.y) {
            selected.add(id);
          }
        });
        
        setSelectedIds(selected);
        if (selected.size > 0) {
          showToast(`✓ Selected ${selected.size} object${selected.size > 1 ? 's' : ''}`, 'success');
        }
      }
      setIsSelecting(false);
      setSelectionBox(null);
      selectionStartRef.current = null;
    }
    
    setIsDragging(false);
    lastPointerRef.current = null;
  }, [isSelecting, selectionBox, objects]);

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

  // Viewport culling: only render objects within visible area (with padding)
  const getVisibleObjects = useCallback((allObjects) => {
    const stage = stageRef.current;
    if (!stage) return Object.entries(allObjects);
    
    // Calculate visible board area in world coordinates
    const transform = stage.getAbsoluteTransform().copy().invert();
    const padding = 200; // Render objects slightly outside viewport for smooth scrolling
    const topLeft = transform.point({ x: -padding, y: -padding });
    const bottomRight = transform.point({ 
      x: dimensions.width + padding, 
      y: dimensions.height + padding 
    });
    
    return Object.entries(allObjects).filter(([, obj]) => {
      const { x = 0, y = 0, width = 100, height = 100 } = obj;
      const objRight = x + width;
      const objBottom = y + height;
      
      // Check if object intersects viewport
      return x < bottomRight.x && objRight > topLeft.x &&
             y < bottomRight.y && objBottom > topLeft.y;
    });
  }, [dimensions.width, dimensions.height]);

  const visibleObjects = getVisibleObjects(objects);
  const stickyNotes = visibleObjects.filter(([, obj]) => obj.type === 'sticky');
  const shapes = visibleObjects.filter(([, obj]) => 
    obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'line' || obj.type === 'oval'
  );
  const connectors = visibleObjects.filter(([, obj]) => obj.type === 'connector');
  const frames = visibleObjects.filter(([, obj]) => obj.type === 'frame');
  
  const totalCount = Object.keys(objects).length;
  const visibleCount = visibleObjects.length;

  const handleContextMenu = useCallback((e) => {
    e.evt.preventDefault();
    const containerPos = containerRef.current?.getBoundingClientRect();
    if (!containerPos) return;

    setContextMenu({
      x: e.evt.clientX - containerPos.left,
      y: e.evt.clientY - containerPos.top,
    });
  }, []);

  const handleCopyFromMenu = useCallback(() => {
    if (selectedIds.size > 0) {
      copySelectedObjects();
      setClipboard(true);
      showToast(`📋 Copied ${selectedIds.size} object${selectedIds.size > 1 ? 's' : ''}`, 'info');
    }
  }, [selectedIds, copySelectedObjects]);

  const handlePasteFromMenu = useCallback(() => {
    pasteObjects();
    showToast('📋 Pasted objects', 'success');
  }, [pasteObjects]);

  const handleDuplicateFromMenu = useCallback(() => {
    if (selectedIds.size > 0) {
      duplicateSelectedObjects();
      showToast(`📑 Duplicated ${selectedIds.size} object${selectedIds.size > 1 ? 's' : ''}`, 'success');
    }
  }, [selectedIds, duplicateSelectedObjects]);

  const handleDeleteFromMenu = useCallback(() => {
    if (selectedIds.size > 0) {
      const count = selectedIds.size;
      deleteSelectedObjects();
      showToast(`🗑️ Deleted ${count} object${count > 1 ? 's' : ''}`, 'info');
    }
  }, [selectedIds, deleteSelectedObjects]);

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
        onContextMenu={handleContextMenu}
        draggable={false}
        style={{ cursor: isSelecting ? 'crosshair' : isDragging ? 'grabbing' : 'grab' }}
      >
        <Layer>
          {/* Render connectors first (behind everything) */}
          {connectors.map(([id, obj]) => (
            <Connector key={id} id={id} data={obj} />
          ))}
          {/* Render frames (behind objects but in front of connectors) */}
          {frames.map(([id, obj]) => (
            <Frame key={id} id={id} data={obj} />
          ))}
          {/* Render objects */}
          {stickyNotes.map(([id, obj]) => (
            <StickyNote key={id} id={id} data={obj} />
          ))}
          {shapes.map(([id, obj]) => (
            <BoardShape key={id} id={id} data={obj} />
          ))}
          {/* Selection box overlay */}
          {isSelecting && selectionBox && (
            <Rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3B82F6"
              strokeWidth={2 / scale}
              dash={[10 / scale, 5 / scale]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
      <BoardControlBar
        scale={scale}
        onZoomChange={zoomToScale}
        onFitAll={fitAllObjects}
        isDragging={isDragging}
        totalObjects={totalCount}
        visibleObjects={visibleCount}
        stageRef={stageRef}
      />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCopy={handleCopyFromMenu}
          onPaste={handlePasteFromMenu}
          onDuplicate={handleDuplicateFromMenu}
          onDelete={handleDeleteFromMenu}
          hasSelection={selectedIds.size > 0}
          hasClipboard={clipboard}
        />
      )}
      <CursorOverlay stageRef={stageRef} scale={scale} stagePos={stagePos} />
      <ErrorBoundary>
        <StickyNoteEditOverlay />
      </ErrorBoundary>
    </div>
  );
}
