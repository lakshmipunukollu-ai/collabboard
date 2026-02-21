import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Arrow } from 'react-konva';
import { useBoard } from '../context/BoardContext';
import StickyNote from './StickyNote';
import BoardShape from './BoardShape';
import Connector from './Connector';
import Frame from './Frame';
import TextBox from './TextBox';
import BoardArrow from './BoardArrow';
import BoardImage from './BoardImage';
import KanbanObject from './KanbanObject';
import TableObject from './TableObject';
import CodeBlock from './CodeBlock';
import EmbedObject from './EmbedObject';
import MindMapNode from './MindMapNode';
import CursorOverlay from './CursorOverlay';
import StickyNoteEditOverlay from './StickyNoteEditOverlay';
import BoardControlBar from './BoardControlBar';
import ContextMenu from './ContextMenu';
import ErrorBoundary from './ErrorBoundary';
import ConnectionPorts, { getObjectPortPos } from './ConnectionPorts';
import ConnectorToolbar from './ConnectorToolbar';
import { showToast } from './Toast';

const MIN_SCALE = 0.001; // Nearly infinite zoom out
const MAX_SCALE = 4;

const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#FDE68A'];

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
    updateObject,
    duplicateSelectedObjects,
    copySelectedObjects,
    pasteObjects,
    editingNoteId,
    requestCenterView,
    setRequestCenterView,
    createStickyNote,
    createShape,
    createFrame,
    createConnector,
    userPermission,
    groupObjects,
    ungroupObjects,
    setSnapToGrid,
    connectorStyle,
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
  const [showGrid, setShowGrid] = useState(false);
  const [hoveredObjectId, setHoveredObjectId] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null); // { objectId, portSide }
  const [tempConnectorEnd, setTempConnectorEnd] = useState(null); // { x, y } world coords
  const lastPointerRef = useRef(null);
  const cursorPosRef = useRef(null);
  const selectionStartRef = useRef(null);
  // Stable ref to objects so pointer-move handlers don't need objects as dep
  const canvasObjectsRef = useRef(objects);
  canvasObjectsRef.current = objects;

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
    // zoom level is shown in the control bar slider — no toast needed
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

  const handlePrint = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) { showToast('Canvas not ready', 'error'); return; }
    try {
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      const win = window.open('', '_blank');
      if (!win) { showToast('Allow pop-ups to print', 'warning'); return; }
      win.document.write(`<!DOCTYPE html><html><head><title>Board Print</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff}
        img{width:100%;height:auto;display:block}
        @media print{img{width:100%;page-break-inside:avoid}}</style></head>
        <body><img src="${dataUrl}" onload="window.print();window.close()"/></body></html>`);
      win.document.close();
    } catch (err) {
      console.error('Print error:', err);
      showToast('Print failed', 'error');
    }
  }, [stageRef]);

  // Connection port handlers
  const handlePortMouseDown = useCallback((objectId, portSide) => {
    setConnectingFrom({ objectId, portSide });
    const obj = canvasObjectsRef.current[objectId];
    if (obj) setTempConnectorEnd(getObjectPortPos(obj, portSide));
  }, []);

  const handlePortMouseUp = useCallback((targetObjectId, targetPortSide) => {
    if (!connectingFrom || connectingFrom.objectId === targetObjectId) {
      setConnectingFrom(null);
      setTempConnectorEnd(null);
      return;
    }
    const canEdit = userPermission === 'edit' || userPermission === 'owner';
    if (canEdit) {
      const newId = createConnector(connectingFrom.objectId, targetObjectId, connectorStyle, '#64748b', connectingFrom.portSide, targetPortSide);
      // Auto-select the new connector so the toolbar appears immediately
      if (newId) setSelectedIds(new Set([newId]));
      showToast('🔗 Connected!', 'success');
    }
    setConnectingFrom(null);
    setTempConnectorEnd(null);
  }, [connectingFrom, connectorStyle, createConnector, userPermission, setSelectedIds]);

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

      // Group: Cmd/Ctrl+G
      if (cmdOrCtrl && !e.shiftKey && e.key === 'g' && selectedIds.size > 1) {
        e.preventDefault();
        groupObjects(Array.from(selectedIds));
        showToast(`🔗 Grouped ${selectedIds.size} objects`, 'success');
      }

      // Ungroup: Cmd/Ctrl+Shift+G
      if (cmdOrCtrl && e.shiftKey && e.key === 'g' && selectedIds.size > 0) {
        e.preventDefault();
        ungroupObjects(Array.from(selectedIds));
        showToast('Ungrouped objects', 'info');
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

      // Print: Cmd/Ctrl+P
      if (cmdOrCtrl && e.key === 'p') {
        e.preventDefault();
        handlePrint();
        return;
      }

      // Tool shortcuts (only when canEdit and no modifier key)
      const canEdit = userPermission === 'edit' || userPermission === 'owner';
      if (!canEdit || cmdOrCtrl || e.shiftKey || e.altKey) return;

      const getCenter = () => {
        const stage = stageRef.current;
        if (!stage) return { x: 200, y: 200 };
        const t = stage.getAbsoluteTransform().copy().invert();
        return t.point({ x: stage.width() / 2, y: stage.height() / 2 });
      };
      const getScaled = (base) => {
        const stage = stageRef.current;
        const s = stage ? stage.scaleX() : 1;
        return Math.min(Math.max(1, (150 / s) / base), 200);
      };

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const { x, y } = getCenter();
        const sf = getScaled(160);
        createStickyNote('New note', x - 80 * sf, y - 60 * sf,
          STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)], 160 * sf, 120 * sf);
        showToast('📝 Sticky note (N)', 'success');
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        const { x, y } = getCenter();
        const sf = getScaled(100);
        createShape('rectangle', x - 50 * sf, y - 40 * sf, 100 * sf, 80 * sf);
        showToast('◻️ Rectangle (R)', 'success');
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const { x, y } = getCenter();
        const sf = getScaled(100);
        createShape('circle', x - 50 * sf, y - 50 * sf, 100 * sf, 100 * sf, '#10B981');
        showToast('⭕ Circle (C)', 'success');
      }
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        const { x, y } = getCenter();
        const sf = getScaled(150);
        createShape('line', x - 75 * sf, y - 10 * sf, 150 * sf, 20 * sf, '#F59E0B');
        showToast('➖ Line (L)', 'success');
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const { x, y } = getCenter();
        createFrame(x - 300, y - 200, 600, 400, 'Frame');
        showToast('📦 Frame (F)', 'success');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, deleteSelectedObjects, duplicateSelectedObjects, copySelectedObjects, pasteObjects, editingNoteId, scale, zoomToScale, fitAllObjects, objects, deleteObject, setClipboard, userPermission, createStickyNote, createShape, createFrame, stageRef, groupObjects, ungroupObjects, handlePrint]);

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
        // Cancel any in-progress connection attempt
        if (connectingFrom) {
          setConnectingFrom(null);
          setTempConnectorEnd(null);
          return;
        }

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
    [setFollowUserId, clearSelection, connectingFrom]
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
      let boardPoint = null;
      if (pos) {
        const transform = stage.getAbsoluteTransform().copy().invert();
        boardPoint = transform.point(pos);
        cursorPosRef.current = { x: boardPoint.x, y: boardPoint.y };
      }

      // Update hover object (for connection ports)
      if (boardPoint && !isDragging && !isSelecting) {
        let found = null;
        const skip = new Set(['connector', 'arrow', 'kanban', 'table', 'code', 'embed']);
        for (const [objId, obj] of Object.entries(canvasObjectsRef.current)) {
          if (skip.has(obj.type)) continue;
          const { x = 0, y = 0, width = 100, height = 100 } = obj;
          if (boardPoint.x >= x && boardPoint.x <= x + width &&
              boardPoint.y >= y && boardPoint.y <= y + height) {
            found = objId;
            break;
          }
        }
        setHoveredObjectId(found);
      }

      // Update rubber-band endpoint when drawing a connection
      if (boardPoint && connectingFrom) {
        setTempConnectorEnd({ x: boardPoint.x, y: boardPoint.y });
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
    [isDragging, stagePos, isSelecting, connectingFrom]
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

    // Cancel any in-progress connection if released on empty canvas
    if (connectingFrom) {
      setConnectingFrom(null);
      setTempConnectorEnd(null);
    }
  }, [isSelecting, selectionBox, objects, connectingFrom]);

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
      // Connectors have no position of their own — they span between objects, so never cull them
      if (obj.type === 'connector') return true;

      // Arrow objects use x1/y1/x2/y2 instead of x/y/width/height
      let bx, by, bRight, bBottom;
      if (obj.type === 'arrow' && obj.x1 != null) {
        bx = Math.min(obj.x1, obj.x2 ?? obj.x1);
        by = Math.min(obj.y1, obj.y2 ?? obj.y1);
        bRight = Math.max(obj.x1, obj.x2 ?? obj.x1);
        bBottom = Math.max(obj.y1, obj.y2 ?? obj.y1);
      } else {
        const { x = 0, y = 0, width = 100, height = 100 } = obj;
        bx = x; by = y; bRight = x + width; bBottom = y + height;
      }
      return bx < bottomRight.x && bRight > topLeft.x &&
             by < bottomRight.y && bBottom > topLeft.y;
    });
  }, [dimensions.width, dimensions.height]);

  const visibleObjects = getVisibleObjects(objects);
  const stickyNotes = visibleObjects.filter(([, obj]) => obj.type === 'sticky');
  const shapes = visibleObjects.filter(([, obj]) =>
    obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'line' || obj.type === 'oval'
  );
  const connectors = visibleObjects.filter(([, obj]) => obj.type === 'connector');
  const frames = visibleObjects.filter(([, obj]) => obj.type === 'frame');
  const textBoxes = visibleObjects.filter(([, obj]) => obj.type === 'textbox');
  const arrows = visibleObjects.filter(([, obj]) => obj.type === 'arrow');
  const images = visibleObjects.filter(([, obj]) => obj.type === 'image');
  const mindMapNodes = visibleObjects.filter(([, obj]) => obj.type === 'mindmap');
  // HTML overlay objects
  const kanbans = visibleObjects.filter(([, obj]) => obj.type === 'kanban');
  const tables = visibleObjects.filter(([, obj]) => obj.type === 'table');
  const codeBlocks = visibleObjects.filter(([, obj]) => obj.type === 'code');
  const embeds = visibleObjects.filter(([, obj]) => obj.type === 'embed');
  
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

  // Grid lines for snap-to-grid visual guide
  const GRID_SIZE = 40; // world units
  const gridLines = showGrid ? (() => {
    const lines = [];
    const transform = stageRef.current?.getAbsoluteTransform().copy().invert();
    if (!transform) return lines;
    const tl = transform.point({ x: 0, y: 0 });
    const br = transform.point({ x: dimensions.width, y: dimensions.height });
    const startX = Math.floor(tl.x / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(tl.y / GRID_SIZE) * GRID_SIZE;
    for (let gx = startX; gx < br.x + GRID_SIZE; gx += GRID_SIZE) {
      lines.push(<Line key={`v${gx}`} points={[gx, tl.y - GRID_SIZE, gx, br.y + GRID_SIZE]} stroke="rgba(255,255,255,0.06)" strokeWidth={1 / scale} listening={false} />);
    }
    for (let gy = startY; gy < br.y + GRID_SIZE; gy += GRID_SIZE) {
      lines.push(<Line key={`h${gy}`} points={[tl.x - GRID_SIZE, gy, br.x + GRID_SIZE, gy]} stroke="rgba(255,255,255,0.06)" strokeWidth={1 / scale} listening={false} />);
    }
    return lines;
  })() : [];

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
        onPointerLeave={() => { handlePointerUp(); setHoveredObjectId(null); }}
        onContextMenu={handleContextMenu}
        draggable={false}
        style={{ cursor: connectingFrom ? 'crosshair' : isSelecting ? 'crosshair' : isDragging ? 'grabbing' : 'grab' }}
      >
        <Layer>
          {/* Grid lines (behind everything) */}
          {gridLines}
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
          {textBoxes.map(([id, obj]) => (
            <TextBox key={id} id={id} data={obj} />
          ))}
          {arrows.map(([id, obj]) => (
            <BoardArrow key={id} id={id} data={obj} />
          ))}
          {images.map(([id, obj]) => (
            <BoardImage key={id} id={id} data={obj} />
          ))}
          {mindMapNodes.map(([id, obj]) => (
            <MindMapNode key={id} id={id} data={obj} />
          ))}

          {/* Connection ports — shown on hover */}
          {hoveredObjectId && !connectingFrom && (() => {
            const obj = objects[hoveredObjectId];
            if (!obj) return null;
            const { x = 0, y = 0, width = 100, height = 100 } = obj;
            return (
              <ConnectionPorts
                key={`ports-${hoveredObjectId}`}
                x={x} y={y}
                width={width} height={height}
                onPortMouseDown={(side) => handlePortMouseDown(hoveredObjectId, side)}
                onPortMouseUp={(side) => handlePortMouseUp(hoveredObjectId, side)}
                isConnecting={false}
              />
            );
          })()}

          {/* Show target ports on hovered object while connecting */}
          {connectingFrom && hoveredObjectId && hoveredObjectId !== connectingFrom.objectId && (() => {
            const obj = objects[hoveredObjectId];
            if (!obj) return null;
            const { x = 0, y = 0, width = 100, height = 100 } = obj;
            return (
              <ConnectionPorts
                key={`target-ports-${hoveredObjectId}`}
                x={x} y={y}
                width={width} height={height}
                onPortMouseDown={() => {}}
                onPortMouseUp={(side) => handlePortMouseUp(hoveredObjectId, side)}
                isConnecting
              />
            );
          })()}

          {/* Rubber-band preview arrow while connecting */}
          {connectingFrom && tempConnectorEnd && (() => {
            const startObj = objects[connectingFrom.objectId];
            if (!startObj) return null;
            const start = getObjectPortPos(startObj, connectingFrom.portSide);
            return (
              <Arrow
                points={[start.x, start.y, tempConnectorEnd.x, tempConnectorEnd.y]}
                stroke="#3B82F6"
                strokeWidth={2}
                fill="#3B82F6"
                dash={[8, 4]}
                pointerLength={10}
                pointerWidth={10}
                listening={false}
                opacity={0.8}
              />
            );
          })()}

          {/* (selection box drawn as DOM div below, outside Konva stage) */}
        </Layer>
      </Stage>
      {/* HTML overlay objects — rendered as DOM elements synced to canvas coordinates */}
      {kanbans.map(([id, obj]) => (
        <KanbanObject key={id} id={id} data={obj} scale={scale} stagePos={stagePos} />
      ))}
      {tables.map(([id, obj]) => (
        <TableObject key={id} id={id} data={obj} scale={scale} stagePos={stagePos} />
      ))}
      {codeBlocks.map(([id, obj]) => (
        <CodeBlock key={id} id={id} data={obj} scale={scale} stagePos={stagePos} />
      ))}
      {embeds.map(([id, obj]) => (
        <EmbedObject key={id} id={id} data={obj} scale={scale} stagePos={stagePos} />
      ))}

      {/* Selection box — rendered as DOM div so it stays in screen coordinates */}
      {isSelecting && selectionBox && selectionBox.width > 0 && (
        <div
          style={{
            position: 'absolute',
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
            border: '2px dashed #3B82F6',
            background: 'rgba(59,130,246,0.08)',
            pointerEvents: 'none',
            zIndex: 5,
            borderRadius: 2,
          }}
        />
      )}

      {/* Floating toolbar for selected connector */}
      {(() => {
        if (selectedIds.size !== 1) return null;
        const [selId] = selectedIds;
        const selObj = objects[selId];
        if (!selObj || selObj.type !== 'connector') return null;
        const sObj = objects[selObj.startObjectId];
        const eObj = objects[selObj.endObjectId];
        if (!sObj || !eObj) return null;
        // World-space midpoint between the two object centers
        const wx = ((sObj.x + (sObj.width || 100) / 2) + (eObj.x + (eObj.width || 100) / 2)) / 2;
        const wy = ((sObj.y + (sObj.height || 100) / 2) + (eObj.y + (eObj.height || 100) / 2)) / 2;
        // Convert to screen (container-relative) coordinates
        const screenX = wx * scale + stagePos.x;
        const screenY = wy * scale + stagePos.y;
        return (
          <ConnectorToolbar
            key={selId}
            connectorId={selId}
            data={selObj}
            screenX={screenX}
            screenY={screenY}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
            onUpdate={(patch) => updateObject(selId, patch)}
            onDelete={() => { deleteObject(selId); clearSelection(); }}
          />
        );
      })()}

      <BoardControlBar
        scale={scale}
        onZoomChange={zoomToScale}
        onFitAll={fitAllObjects}
        isDragging={isDragging}
        totalObjects={totalCount}
        visibleObjects={visibleCount}
        stageRef={stageRef}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => { setSnapToGrid(!v); return !v; })}
        onPrint={handlePrint}
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
