import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Stage, Layer, Rect, Line, Arrow } from 'react-konva';
import { useBoard } from '../context/BoardContext';

// Stable per-user color derived from userId — matches CursorOverlay and EnhancedPresence
function getUserColor(userId) {
  const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
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
import LineToolbar from './LineToolbar';
import { showToast } from './Toast';

const MIN_SCALE = 0.001; // Nearly infinite zoom out
const MAX_SCALE = 4;

const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#FDE68A'];

export default function Canvas() {
  const {
    boardId,
    stageRef,
    viewportCenterRef,
    objects,
    objectsLoaded,
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
    duplicateObject,
    copySelectedObjects,
    pasteObjects,
    editingNoteId,
    requestCenterView,
    setRequestCenterView,
    createStickyNote,
    createShape,
    createTextBox,
    createFrame,
    createArrow,
    createConnector,
    userPermission,
    groupObjects,
    ungroupObjects,
    setSnapToGrid,
    connectorStyle,
    activeTool,
    setActiveTool,
    undo,
    redo,
    canUndo,
    canRedo,
    bringToFront,
    sendToBack,
    presence,
    aiLock,
    updatePresenceField,
  } = useBoard();
  const { user } = useUser();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [boardLoading, setBoardLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, objectId? }
  const [clipboard, setClipboard] = useState(null);
  const [showGrid, setShowGrid] = useState(false);
  const [hoveredObjectId, setHoveredObjectId] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null); // { objectId, portSide }
  // One-time connector tip: shown the first time port dots appear, then never again
  const [showConnectorTip, setShowConnectorTip] = useState(false);
  const connectorTipTimerRef = useRef(null);
  // First-time "connect objects" discovery tip (different from the hover port tip)
  const [showConnectionTip, setShowConnectionTip] = useState(false);
  const connectionTipTimerRef = useRef(null);
  const connectionTipShownRef = useRef(false);
  const [tempConnectorEnd, setTempConnectorEnd] = useState(null); // { x, y } world coords
  const hasInitializedViewRef = useRef(false);
  const lastPointerRef = useRef(null);
  const cursorPosRef = useRef(null);
  const selectionStartRef = useRef(null);
  const pendingMarqueeRef = useRef(false); // true after pointerDown on empty canvas; promoted to isSelecting once pointer moves >4px
  const spaceDownRef = useRef(false); // space+drag panning
  const [spaceDown, setSpaceDown] = useState(false); // reactive mirror of spaceDownRef for cursor updates
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  // Stable ref to objects so pointer-move handlers don't need objects as dep
  const canvasObjectsRef = useRef(objects);
  canvasObjectsRef.current = objects;

  // Broadcast our selection to Firebase presence so collaborators see colored outlines (throttled 1s)
  const selectionSyncTimerRef = useRef(null);
  useEffect(() => {
    if (!updatePresenceField) return;
    clearTimeout(selectionSyncTimerRef.current);
    selectionSyncTimerRef.current = setTimeout(() => {
      updatePresenceField({ selectedObjectIds: Array.from(selectedIds).slice(0, 20) });
    }, 800);
    return () => clearTimeout(selectionSyncTimerRef.current);
  }, [selectedIds, updatePresenceField]);

  // Listen for right-click context menu events dispatched by DOM-based rich objects
  // (KanbanObject, TableObject, CodeBlock, EmbedObject) which live outside the Konva Stage
  useEffect(() => {
    const handler = (e) => {
      setContextMenu({ x: e.detail.screenX, y: e.detail.screenY, objectId: e.detail.objectId });
    };
    window.addEventListener('richobject:contextmenu', handler);
    return () => window.removeEventListener('richobject:contextmenu', handler);
  }, []);

  // Show the one-time "drag from a dot" tip the first time ports become visible
  useEffect(() => {
    if (!hoveredObjectId || connectingFrom) return;
    if (localStorage.getItem('shownConnectorTip')) return;
    setShowConnectorTip(true);
    clearTimeout(connectorTipTimerRef.current);
    connectorTipTimerRef.current = setTimeout(() => {
      setShowConnectorTip(false);
      localStorage.setItem('shownConnectorTip', '1');
    }, 3000);
    return () => clearTimeout(connectorTipTimerRef.current);
  }, [hoveredObjectId, connectingFrom]);

  // FIX 5 — First-time connection discovery tip.
  // Fires once when ≥2 placeable objects exist and no connector has been made yet.
  useEffect(() => {
    if (connectionTipShownRef.current) return;
    if (localStorage.getItem('shownConnectionTip')) {
      connectionTipShownRef.current = true;
      return;
    }
    const allObjs = Object.values(objects);
    const validObjs = allObjs.filter((o) => o && !['connector', 'arrow'].includes(o.type));
    const hasConnections = allObjs.some((o) => o && o.type === 'connector');
    if (validObjs.length >= 2 && !hasConnections) {
      connectionTipShownRef.current = true;
      setShowConnectionTip(true);
      connectionTipTimerRef.current = setTimeout(() => {
        setShowConnectionTip(false);
        localStorage.setItem('shownConnectionTip', '1');
      }, 5000);
    }
    return () => clearTimeout(connectionTipTimerRef.current);
  }, [objects]);

  // Dismiss the connection discovery tip as soon as the user hovers over an object
  useEffect(() => {
    if (hoveredObjectId && showConnectionTip) {
      clearTimeout(connectionTipTimerRef.current);
      setShowConnectionTip(false);
      localStorage.setItem('shownConnectionTip', '1');
    }
  }, [hoveredObjectId, showConnectionTip]);

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

  // Fit all objects in view.  silent=true suppresses toasts (used for auto-fit on page load).
  const fitAllObjects = useCallback((silent = false) => {
    // Always read from the ref — never from the stale closure — so we get the
    // latest objects even if this callback was cached before a state update.
    const allObjects = canvasObjectsRef.current;

    if (!allObjects || Object.keys(allObjects).length === 0) {
      if (!silent) showToast('ℹ️ No objects to fit', 'info');
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let foundAny = false;

    Object.values(allObjects).forEach((obj) => {
      if (!obj) return;
      // Connectors have no independent position — skip them
      if (obj.type === 'connector') return;
      // Arrow objects use x1/y1/x2/y2 instead of x/y/width/height
      if (obj.type === 'arrow' && obj.x1 != null) {
        minX = Math.min(minX, obj.x1, obj.x2 ?? obj.x1);
        minY = Math.min(minY, obj.y1, obj.y2 ?? obj.y1);
        maxX = Math.max(maxX, obj.x1, obj.x2 ?? obj.x1);
        maxY = Math.max(maxY, obj.y1, obj.y2 ?? obj.y1);
        foundAny = true;
        return;
      }
      // All other types: sticky, shape, frame, textbox, image, kanban, table,
      // code, embed, mindmap — all use x/y/width/height
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      const w = obj.width ?? 100;
      const h = obj.height ?? 100;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
      foundAny = true;
    });

    if (!foundAny) {
      if (!silent) showToast('ℹ️ No objects to fit', 'info');
      return;
    }

    const PAD = 50;
    const contentW = Math.max(maxX - minX, 1); // guard against zero-width
    const contentH = Math.max(maxY - minY, 1); // guard against zero-height

    // Scale to fit the bounding box inside the viewport with padding on all sides
    const scaleToFitX = (dimensions.width  - 2 * PAD) / contentW;
    const scaleToFitY = (dimensions.height - 2 * PAD) / contentH;
    const newScale = Math.min(scaleToFitX, scaleToFitY, 2.0); // cap at 200%
    const clampedScale = Math.max(0.05, newScale);             // floor at 5%

    // Center the bounding box in the viewport
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const newPos = {
      x: dimensions.width  / 2 - centerX * clampedScale,
      y: dimensions.height / 2 - centerY * clampedScale,
    };

    setScale(clampedScale);
    setStagePos(newPos);
    if (!silent) showToast(`🔍 Fit ${Object.keys(allObjects).length} objects`, 'success');
  }, [dimensions.width, dimensions.height]);

  // ── On first load: restore saved viewport OR auto-fit all objects ──────────
  // Waits for objectsLoaded (Firebase first snapshot) before doing anything so
  // we never read stale/empty state.  Runs exactly once per page load.
  useEffect(() => {
    if (hasInitializedViewRef.current) return;
    if (!objectsLoaded) return;              // wait for Firebase first snapshot
    if (dimensions.width <= 0 || dimensions.height <= 0) return;

    hasInitializedViewRef.current = true;
    setBoardLoading(false);

    // Try to restore the saved viewport for this board
    const savedKey = `viewport_${boardId}`;
    const saved = savedKey ? localStorage.getItem(savedKey) : null;
    if (saved) {
      try {
        const { x, y, scale: savedScale } = JSON.parse(saved);
        if (typeof x === 'number' && typeof y === 'number' && typeof savedScale === 'number') {
          setStagePos({ x, y });
          setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale)));
          return; // viewport restored — done
        }
      } catch {
        // Ignore corrupt localStorage data, fall through to auto-fit
      }
    }

    // No saved viewport — fit all objects in view (silent, no toast on auto-load)
    const hasObjects = Object.values(canvasObjectsRef.current).some(
      (o) => o && o.type !== 'connector',
    );
    if (hasObjects) {
      // Brief delay so Konva has rendered all objects before we measure them
      setTimeout(() => fitAllObjects(true), 400);
    }
  }, [objectsLoaded, boardId, dimensions.width, dimensions.height, fitAllObjects]);

  // ── Save viewport to localStorage (debounced 1s) so it can be restored ────
  useEffect(() => {
    if (!boardId || !hasInitializedViewRef.current) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`viewport_${boardId}`, JSON.stringify({
          x: stagePos.x,
          y: stagePos.y,
          scale,
        }));
      } catch { /* quota exceeded — ignore */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, [boardId, stagePos.x, stagePos.y, scale]);

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

  // Space key for pan mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        const active = document.activeElement;
        const isInputFocused = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (!isInputFocused) {
          e.preventDefault();
          spaceDownRef.current = true;
          setSpaceDown(true); // triggers cursor re-render
        }
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        setSpaceDown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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

      // Undo: Cmd/Ctrl+Z
      if (cmdOrCtrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      // Redo: Cmd/Ctrl+Y or Cmd/Ctrl+Shift+Z
      if ((cmdOrCtrl && e.key === 'y') || (cmdOrCtrl && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
        return;
      }

      // Escape: cancel active tool
      if (e.key === 'Escape') {
        if (activeToolRef.current !== 'select') {
          setActiveTool('select');
          return;
        }
      }
      
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
      // H → hand / pan tool (toggle back to select if already active)
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setActiveTool((prev) => (prev === 'hand' ? 'select' : 'hand'));
        showToast('✋ Hand tool (H) — drag to pan', 'info');
      }
      // V / Escape → select tool
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setActiveTool('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, deleteSelectedObjects, duplicateSelectedObjects, copySelectedObjects, pasteObjects, editingNoteId, scale, zoomToScale, fitAllObjects, objects, deleteObject, setClipboard, userPermission, createStickyNote, createShape, createFrame, stageRef, groupObjects, ungroupObjects, handlePrint, undo, redo, setActiveTool]);

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

  // Place the active tool's object at given world coordinates
  const placeActiveTool = useCallback((worldX, worldY) => {
    const tool = activeToolRef.current;
    const canEdit = userPermission === 'edit' || userPermission === 'owner';
    if (!canEdit) return;
    const s = stageRef.current ? stageRef.current.scaleX() : 1;
    const scale = (base) => Math.min(Math.max(1, (150 / s) / base), 200);
    switch (tool) {
      case 'sticky': {
        const sf = scale(160);
        createStickyNote('New note', worldX - 80 * sf, worldY - 60 * sf,
          STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)], 160 * sf, 120 * sf);
        showToast('📝 Sticky note placed', 'success');
        break;
      }
      case 'rect': {
        const sf = scale(100);
        createShape('rectangle', worldX - 50 * sf, worldY - 40 * sf, 100 * sf, 80 * sf);
        showToast('◻ Rectangle placed', 'success');
        break;
      }
      case 'square': {
        const sf = scale(120);
        createShape('rectangle', worldX - 60 * sf, worldY - 60 * sf, 120 * sf, 120 * sf);
        showToast('⬛ Square placed', 'success');
        break;
      }
      case 'circle': {
        const sf = scale(100);
        createShape('circle', worldX - 50 * sf, worldY - 50 * sf, 100 * sf, 100 * sf, '#10B981');
        showToast('⭕ Circle placed', 'success');
        break;
      }
      case 'oval': {
        const sf = scale(120);
        createShape('oval', worldX - 60 * sf, worldY - 40 * sf, 120 * sf, 80 * sf, '#8B5CF6');
        showToast('⭕ Oval placed', 'success');
        break;
      }
      case 'line': {
        const sf = scale(150);
        createShape('line', worldX - 75 * sf, worldY - 10 * sf, 150 * sf, 20 * sf, '#F59E0B');
        showToast('➖ Line placed', 'success');
        break;
      }
      case 'frame': {
        createFrame(worldX - 300, worldY - 200, 600, 400, 'Frame');
        showToast('📦 Frame placed', 'success');
        break;
      }
      case 'text': {
        createTextBox('Text', worldX - 100, worldY - 30, 200, 60);
        showToast('T Text box placed', 'success');
        break;
      }
      case 'arrow': {
        createArrow(worldX - 75, worldY, worldX + 75, worldY);
        showToast('→ Arrow placed', 'success');
        break;
      }
      default:
        break;
    }
    // The create* functions set requestCenterView to pan the canvas to the new object.
    // For user-placed objects the click position is already in view, so we cancel it
    // here to prevent the stage from jumping after placement.
    setRequestCenterView(null);
    setActiveTool('select');
  }, [userPermission, createStickyNote, createShape, createFrame, createTextBox, createArrow, setActiveTool, setRequestCenterView]);

  const handlePointerDown = useCallback(
    (e) => {
      if (e.target === e.target.getStage()) {
        // Space or middle mouse = pan mode
        const isMiddleMouse = e.evt.button === 1;
        if (spaceDownRef.current || isMiddleMouse) {
          setIsDragging(true);
          lastPointerRef.current = { x: e.evt.clientX, y: e.evt.clientY };
          return;
        }

        // Cancel any in-progress connection attempt
        if (connectingFrom) {
          setConnectingFrom(null);
          setTempConnectorEnd(null);
          return;
        }

        setFollowUserId(null);

        // Click-to-place: if a tool is active, place it at the click position
        const currentTool = activeToolRef.current;
        if (currentTool && currentTool !== 'select' && currentTool !== 'hand') {
          const stage = stageRef.current;
          if (stage) {
            const pos = stage.getPointerPosition();
            const transform = stage.getAbsoluteTransform().copy().invert();
            const worldPos = transform.point(pos);
            placeActiveTool(worldPos.x, worldPos.y);
          }
          return;
        }
        
        // Select tool: drag on empty canvas = marquee (Miro / Figma standard).
        // Space+drag and middle-mouse are already caught above and return early,
        // so panning is still available; we only change the plain-drag behavior.
        if (activeToolRef.current === 'select' || !activeToolRef.current) {
          // Clear existing selection unless shift is held (allows extending later)
          if (!e.evt.shiftKey) clearSelection();
          const stage = stageRef.current;
          if (stage) {
            const pos = stage.getPointerPosition();
            selectionStartRef.current = pos;
            pendingMarqueeRef.current = true; // will promote to isSelecting once pointer moves
          }
        } else {
          // Hand tool or any other tool → pan
          setIsDragging(true);
          clearSelection();
          lastPointerRef.current = { x: e.evt.clientX, y: e.evt.clientY };
        }
      }
    },
    [setFollowUserId, clearSelection, connectingFrom, placeActiveTool]
  );

  // Send cursor position at ~30fps (33ms) — halves Firebase presence writes
  // vs the previous 60fps without any noticeable visual degradation
  useEffect(() => {
    const interval = setInterval(() => {
      const pos = cursorPosRef.current;
      if (pos != null) {
        updateCursor(pos.x, pos.y);
        cursorPosRef.current = null;
      }
    }, 33);
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
      
      // Promote pending marquee → active selection once pointer moves > 4 px.
      // This distinguishes a plain click (should deselect) from a drag (should select).
      if (pendingMarqueeRef.current && selectionStartRef.current && pos) {
        const dx = pos.x - selectionStartRef.current.x;
        const dy = pos.y - selectionStartRef.current.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          pendingMarqueeRef.current = false;
          setIsSelecting(true);
          setSelectionBox({
            x: Math.min(selectionStartRef.current.x, pos.x),
            y: Math.min(selectionStartRef.current.y, pos.y),
            width: Math.abs(dx),
            height: Math.abs(dy),
          });
        }
      }

      // Area selection — update box while marquee is active
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

  const handlePointerUp = useCallback((e) => {
    // Always clean up pending-marquee state regardless of outcome
    pendingMarqueeRef.current = false;
    selectionStartRef.current = null;

    // ── Body-drop: if a connection drag is in progress and the pointer landed on
    //    an object body (not a port dot — port dots handle their own onMouseUp),
    //    snap to the nearest port and create the connector.
    //    We guard on `e` because onPointerLeave calls handlePointerUp() with no arg.
    if (connectingFrom && e) {
      const stage = stageRef.current;
      if (stage) {
        const pos = stage.getPointerPosition();
        if (pos) {
          const transform = stage.getAbsoluteTransform().copy().invert();
          const worldPos = transform.point(pos);
          for (const [id, obj] of Object.entries(objects)) {
            if (id === connectingFrom.objectId) continue;
            if (['connector', 'arrow', 'frame'].includes(obj.type)) continue;
            const { x = 0, y = 0, width = 100, height = 100 } = obj;
            if (worldPos.x >= x && worldPos.x <= x + width &&
                worldPos.y >= y && worldPos.y <= y + height) {
              // Choose the best end-port based on relative object positions — same
              // algorithm as getBestPorts in Connector.jsx so the line looks clean.
              const srcObj = canvasObjectsRef.current[connectingFrom.objectId];
              const srcCx = (srcObj?.x ?? 0) + (srcObj?.width ?? 100) / 2;
              const srcCy = (srcObj?.y ?? 0) + (srcObj?.height ?? 100) / 2;
              const tgtCx = x + width / 2;
              const tgtCy = y + height / 2;
              const ddx = tgtCx - srcCx;
              const ddy = tgtCy - srcCy;
              let bestEndPort;
              if (Math.abs(ddx) >= Math.abs(ddy)) {
                bestEndPort = ddx >= 0 ? 'left' : 'right';
              } else {
                bestEndPort = ddy >= 0 ? 'top' : 'bottom';
              }
              handlePortMouseUp(id, bestEndPort);
              break;
            }
          }
        }
      }
    }

    // ── Complete marquee / area selection
    if (isSelecting && selectionBox) {
      const stage = stageRef.current;
      if (stage && selectionBox.width > 5 && selectionBox.height > 5) {
        const transform = stage.getAbsoluteTransform().copy().invert();
        const topLeft = transform.point({ x: selectionBox.x, y: selectionBox.y });
        const bottomRight = transform.point({
          x: selectionBox.x + selectionBox.width,
          y: selectionBox.y + selectionBox.height,
        });

        // Pass 1: select all non-connector objects that intersect the rectangle
        const selected = new Set();
        Object.entries(objects).forEach(([id, obj]) => {
          if (obj.type === 'connector') return; // handled in pass 2
          const { x = 0, y = 0, width = 100, height = 100 } = obj;
          if (x < bottomRight.x && x + width > topLeft.x &&
              y < bottomRight.y && y + height > topLeft.y) {
            selected.add(id);
          }
        });

        // Pass 2: include connectors whose BOTH endpoints are already selected
        Object.entries(objects).forEach(([id, obj]) => {
          if (obj.type !== 'connector') return;
          if (selected.has(obj.startObjectId) && selected.has(obj.endObjectId)) {
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
    }

    setIsDragging(false);
    lastPointerRef.current = null;

    // Cancel any in-progress connection if released on empty canvas
    // (port-drop and body-drop already called setConnectingFrom(null) via handlePortMouseUp,
    //  but that's React state so the closure still sees the old value — idempotent to call again)
    if (connectingFrom) {
      setConnectingFrom(null);
      setTempConnectorEnd(null);
    }
  }, [isSelecting, selectionBox, objects, connectingFrom, handlePortMouseUp]);

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
    // Detect if right-click was on a specific object
    const stage = stageRef.current;
    let objectId = null;
    if (stage) {
      const pos = stage.getPointerPosition();
      if (pos) {
        const transform = stage.getAbsoluteTransform().copy().invert();
        const worldPos = transform.point(pos);
        for (const [id, obj] of Object.entries(canvasObjectsRef.current)) {
          if (obj.type === 'connector' || obj.type === 'arrow') continue;
          const { x = 0, y = 0, width = 100, height = 100 } = obj;
          if (worldPos.x >= x && worldPos.x <= x + width && worldPos.y >= y && worldPos.y <= y + height) {
            objectId = id;
            break;
          }
        }
      }
    }
    let worldCoords = null;
    if (stage) {
      const pos = stage.getPointerPosition();
      if (pos) {
        const t = stage.getAbsoluteTransform().copy().invert();
        worldCoords = t.point(pos);
      }
    }
    setContextMenu({
      x: e.evt.clientX - containerPos.left,
      y: e.evt.clientY - containerPos.top,
      objectId,
      worldX: worldCoords?.x,
      worldY: worldCoords?.y,
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
        style={{ cursor: connectingFrom ? 'crosshair' : activeTool && activeTool !== 'select' && activeTool !== 'hand' ? 'crosshair' : activeTool === 'hand' || spaceDown ? (isDragging ? 'grabbing' : 'grab') : isSelecting ? 'crosshair' : isDragging ? 'grabbing' : 'default' }}
      >
        <Layer>
          {/* Grid lines (behind everything) */}
          {gridLines}
          {/* Frames — behind objects */}
          {frames.map(([id, obj]) => (
            <Frame key={id} id={id} data={obj} />
          ))}
          {/* Objects */}
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
          {/* Connectors render on top of all shapes so they are always visible */}
          {connectors.map(([id, obj]) => (
            <Connector key={id} id={id} data={obj} />
          ))}

          {/* Connection ports — shown on hover (idle state) */}
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

          {/* FIX 3 — While connecting: show ports on ALL valid objects so landing spots are obvious */}
          {connectingFrom && Object.entries(objects)
            .filter(([id, obj]) => {
              if (!obj || id === connectingFrom.objectId) return false;
              return !['connector', 'arrow', 'kanban', 'table', 'code', 'embed'].includes(obj.type);
            })
            .map(([id, obj]) => {
              const { x = 0, y = 0, width = 100, height = 100 } = obj;
              return (
                <ConnectionPorts
                  key={`all-ports-${id}`}
                  x={x} y={y}
                  width={width} height={height}
                  onPortMouseDown={() => {}}
                  onPortMouseUp={(side) => handlePortMouseUp(id, side)}
                  isConnecting={id === hoveredObjectId}
                  animated={false}
                />
              );
            })
          }

          {/* FIX 3 — Blue glow highlight on the object being hovered as a connection target */}
          {connectingFrom && hoveredObjectId && hoveredObjectId !== connectingFrom.objectId && (() => {
            const obj = objects[hoveredObjectId];
            if (!obj || obj.type === 'connector') return null;
            return (
              <Rect
                key={`target-hl-${hoveredObjectId}`}
                x={(obj.x ?? 0) - 5}
                y={(obj.y ?? 0) - 5}
                width={(obj.width ?? 100) + 10}
                height={(obj.height ?? 100) + 10}
                fill="transparent"
                stroke="#4A90E2"
                strokeWidth={2}
                cornerRadius={6}
                shadowBlur={20}
                shadowColor="#4A90E2"
                shadowOpacity={0.85}
                listening={false}
              />
            );
          })()}

          {/* FIX 2 — Rubber-band dashed preview line while connecting */}
          {connectingFrom && tempConnectorEnd && (() => {
            const startObj = objects[connectingFrom.objectId];
            if (!startObj) return null;
            const start = getObjectPortPos(startObj, connectingFrom.portSide);
            return (
              <Arrow
                points={[start.x, start.y, tempConnectorEnd.x, tempConnectorEnd.y]}
                stroke="#4A90E2"
                strokeWidth={2}
                fill="#4A90E2"
                dash={[8, 4]}
                pointerLength={10}
                pointerWidth={10}
                listening={false}
                opacity={0.85}
              />
            );
          })()}

          {/* ── Other users' selection outlines (colored dashed rectangles) ── */}
          {presence && user && Object.entries(presence)
            .filter(([uid, p]) => uid !== user.id && p?.selectedObjectIds?.length)
            .map(([uid, p]) => {
              const color = getUserColor(uid);
              return (p.selectedObjectIds || []).map((objId) => {
                const obj = objects[objId];
                if (!obj || obj.type === 'connector') return null;
                return (
                  <Rect
                    key={`sel-${uid}-${objId}`}
                    x={(obj.x ?? 0) - 5}
                    y={(obj.y ?? 0) - 5}
                    width={(obj.width ?? 100) + 10}
                    height={(obj.height ?? 100) + 10}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={2}
                    cornerRadius={5}
                    dash={[6, 4]}
                    listening={false}
                    opacity={0.75}
                  />
                );
              });
            })}

          {/* ── Other users' editing-in-progress indicators (solid colored border) ── */}
          {presence && user && Object.entries(presence)
            .filter(([uid, p]) => uid !== user.id && p?.editingObjectId)
            .map(([uid, p]) => {
              const color = getUserColor(uid);
              const obj = objects[p.editingObjectId];
              if (!obj || obj.type === 'connector') return null;
              const name = p.displayName || 'Someone';
              return (
                <Rect
                  key={`edit-${uid}`}
                  x={(obj.x ?? 0) - 4}
                  y={(obj.y ?? 0) - 4}
                  width={(obj.width ?? 100) + 8}
                  height={(obj.height ?? 100) + 8}
                  fill="transparent"
                  stroke={color}
                  strokeWidth={3}
                  cornerRadius={5}
                  listening={false}
                  shadowBlur={10}
                  shadowColor={color}
                  shadowOpacity={0.6}
                  name={`editing-indicator-${name}`}
                />
              );
            })}

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
            border: '1.5px solid #3B82F6',
            background: 'rgba(59,130,246,0.13)',
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

      {/* Floating toolbar for selected line object */}
      {(() => {
        if (selectedIds.size !== 1) return null;
        const [selId] = selectedIds;
        const selObj = objects[selId];
        if (!selObj || selObj.type !== 'line') return null;
        // Center of the line in world space
        const wx = (selObj.x ?? 0) + (selObj.width ?? 100) / 2;
        const wy = (selObj.y ?? 0) + (selObj.height ?? 20) / 2;
        // Convert to screen (container-relative) coordinates
        const screenX = wx * scale + stagePos.x;
        const screenY = wy * scale + stagePos.y;
        return (
          <LineToolbar
            key={selId}
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
      {/* Undo / Redo buttons */}
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 100 }}>
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
          style={{ padding: '6px 12px', background: canUndo ? '#1e293b' : '#0f172a', border: `1px solid ${canUndo ? '#3b82f6' : '#334155'}`, borderRadius: 6, color: canUndo ? '#e2e8f0' : '#475569', cursor: canUndo ? 'pointer' : 'not-allowed', fontSize: '0.8rem', fontWeight: 600 }}
        >
          ↩ Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Cmd+Y)"
          style={{ padding: '6px 12px', background: canRedo ? '#1e293b' : '#0f172a', border: `1px solid ${canRedo ? '#3b82f6' : '#334155'}`, borderRadius: 6, color: canRedo ? '#e2e8f0' : '#475569', cursor: canRedo ? 'pointer' : 'not-allowed', fontSize: '0.8rem', fontWeight: 600 }}
        >
          ↪ Redo
        </button>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          objectId={contextMenu.objectId}
          worldX={contextMenu.worldX}
          worldY={contextMenu.worldY}
          onClose={() => setContextMenu(null)}
          onCopy={handleCopyFromMenu}
          onPaste={handlePasteFromMenu}
          onDuplicate={handleDuplicateFromMenu}
          onDelete={handleDeleteFromMenu}
          onBringToFront={contextMenu.objectId ? () => { bringToFront(contextMenu.objectId); setContextMenu(null); } : null}
          onSendToBack={contextMenu.objectId ? () => { sendToBack(contextMenu.objectId); setContextMenu(null); } : null}
          onDuplicateObject={contextMenu.objectId ? () => { duplicateObject(contextMenu.objectId); setContextMenu(null); } : null}
          hasSelection={selectedIds.size > 0}
          hasClipboard={clipboard}
          onAddStickyNote={contextMenu.worldX != null ? (wx, wy) => {
            const sf = stageRef.current ? Math.min(Math.max(1, (150 / stageRef.current.scaleX()) / 160), 4) : 1;
            createStickyNote('New note', wx - 80 * sf, wy - 60 * sf, STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)], 160 * sf, 120 * sf);
            setContextMenu(null);
          } : null}
          onAddShape={contextMenu.worldX != null ? (wx, wy) => {
            const sf = stageRef.current ? Math.min(Math.max(1, (150 / stageRef.current.scaleX()) / 100), 4) : 1;
            createShape('rectangle', wx - 50 * sf, wy - 40 * sf, 100 * sf, 80 * sf);
            setContextMenu(null);
          } : null}
        />
      )}
      {/* One-time connector tip — shows first time port dots appear, dismisses after 3s */}
      {showConnectorTip && (() => {
        const obj = objects[hoveredObjectId];
        if (!obj || !stageRef.current) return null;
        const stage = stageRef.current;
        const container = stage.container().getBoundingClientRect();
        // Position the tip just below the hovered object's bottom-center port
        const screenX = container.left + stage.x() + (obj.x + (obj.width || 100) / 2) * stage.scaleX();
        const screenY = container.top  + stage.y() + (obj.y + (obj.height || 100)) * stage.scaleY() + 16;
        return (
          <div
            style={{
              position: 'fixed',
              left: screenX,
              top: screenY,
              transform: 'translateX(-50%)',
              background: 'rgba(15,23,42,0.9)',
              color: '#e2e8f0',
              fontSize: '0.72rem',
              padding: '5px 10px',
              borderRadius: 6,
              pointerEvents: 'none',
              zIndex: 2500,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              animation: 'fadeInOut 3s ease forwards',
            }}
          >
            🔗 Drag from a dot to connect
          </div>
        );
      })()}
      {/* FIX 4 — 4 directional quick-connect buttons on all edges of the selected object */}
      {(() => {
        if (selectedIds.size !== 1 || connectingFrom) return null;
        const [selId] = selectedIds;
        const selObj = objects[selId];
        if (!selObj || ['connector', 'arrow', 'kanban', 'table', 'code', 'embed'].includes(selObj.type)) return null;
        const ox = selObj.x ?? 0;
        const oy = selObj.y ?? 0;
        const ow = selObj.width ?? 100;
        const oh = selObj.height ?? 100;
        const OFFSET = 18; // px outside the object edge (world units * scale added below)
        const BTN = 22;    // button diameter px

        const sides = [
          { side: 'top',    arrow: '↑', wx: ox + ow / 2, wy: oy },
          { side: 'bottom', arrow: '↓', wx: ox + ow / 2, wy: oy + oh },
          { side: 'left',   arrow: '←', wx: ox,           wy: oy + oh / 2 },
          { side: 'right',  arrow: '→', wx: ox + ow,       wy: oy + oh / 2 },
        ];

        // Direction offsets so each button sits just outside its edge
        const nudge = { top: [0, -OFFSET], bottom: [0, OFFSET], left: [-OFFSET, 0], right: [OFFSET, 0] };

        return sides.map(({ side, arrow, wx, wy }) => {
          const [ndx, ndy] = nudge[side];
          const screenX = wx * scale + stagePos.x + ndx;
          const screenY = wy * scale + stagePos.y + ndy;
          return (
            <button
              key={`qc-${selId}-${side}`}
              title={`Connect from ${side}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePortMouseDown(selId, side);
              }}
              style={{
                position: 'absolute',
                left: screenX - BTN / 2,
                top: screenY - BTN / 2,
                width: BTN,
                height: BTN,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4A90E2, #667eea)',
                border: '1.5px solid white',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'crosshair',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 120,
                boxShadow: '0 2px 8px rgba(74,144,226,0.5)',
                transition: 'transform 0.1s, box-shadow 0.1s',
                userSelect: 'none',
                lineHeight: 1,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.25)';
                e.currentTarget.style.boxShadow = '0 3px 14px rgba(74,144,226,0.75)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(74,144,226,0.5)';
              }}
            >
              {arrow}
            </button>
          );
        });
      })()}

      {/* FIX 5 — First-time connection discovery tip */}
      {showConnectionTip && (() => {
        const firstObj = Object.values(objects).find(
          (o) => o && !['connector', 'arrow'].includes(o.type),
        );
        if (!firstObj) return null;
        const screenX = ((firstObj.x ?? 0) + (firstObj.width ?? 100) / 2) * scale + stagePos.x;
        const screenY = ((firstObj.y ?? 0) - 16) * scale + stagePos.y;
        return (
          <div
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              transform: 'translate(-50%, -100%)',
              background: 'rgba(15,23,42,0.97)',
              border: '1px solid #4A90E2',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#e2e8f0',
              fontSize: '0.78rem',
              lineHeight: 1.6,
              zIndex: 400,
              pointerEvents: 'none',
              maxWidth: 260,
              boxShadow: '0 4px 20px rgba(74,144,226,0.35)',
              whiteSpace: 'normal',
            }}
          >
            💡 <strong>Connect objects!</strong><br />
            Hover over any object to see blue connection dots. Drag from a dot to connect two objects.
            {/* Arrow pointing down */}
            <div style={{
              position: 'absolute',
              bottom: -7,
              left: '50%',
              width: 12,
              height: 12,
              background: 'rgba(15,23,42,0.97)',
              border: '1px solid #4A90E2',
              borderTop: 'none',
              borderLeft: 'none',
              transform: 'translateX(-50%) rotate(45deg)',
            }} />
          </div>
        );
      })()}

      {/* ── Collaborator AI generating banner — visible to everyone except the generator ── */}
      {aiLock && user && aiLock.userId !== user.id && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(102, 126, 234, 0.5)',
            borderRadius: 24,
            padding: '8px 18px',
            color: '#e2e8f0',
            fontSize: '0.8rem',
            fontWeight: 500,
            zIndex: 600,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 16px rgba(102,126,234,0.2)',
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block', fontSize: '0.9rem' }}>✨</span>
          <span>
            <strong style={{ color: getUserColor(aiLock.userId) }}>{aiLock.userName || 'Someone'}</strong>
            {' '}is using the AI assistant…
          </span>
        </div>
      )}

      {/* ── Board loading overlay — shown until first Firebase snapshot ── */}
      {boardLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary, #0f172a)',
            zIndex: 500,
            gap: 16,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '3px solid #1e293b',
            borderTop: '3px solid #667eea',
            animation: 'spin 0.9s linear infinite',
          }} />
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>
            Loading your board…
          </p>
        </div>
      )}

      <CursorOverlay stageRef={stageRef} scale={scale} stagePos={stagePos} />
      <ErrorBoundary>
        <StickyNoteEditOverlay />
      </ErrorBoundary>
    </div>
  );
}
