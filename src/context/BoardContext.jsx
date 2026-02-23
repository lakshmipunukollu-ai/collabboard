import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  ref,
  onValue,
  get,
  set,
  update,
  remove,
  serverTimestamp,
  onDisconnect,
} from 'firebase/database';
import { database } from '../lib/firebase';
import { setSaveStatus } from '../components/AutoSaveIndicator';
import { showToast } from '../components/Toast';

const BoardContext = createContext(null);

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

let _idCounter = 0;
function generateId() {
  return `${Date.now()}-${(++_idCounter).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BoardProvider({ children, boardId = 'default' }) {
  const { user } = useUser();
  const [userPermission, setUserPermission] = useState('view'); // 'view', 'edit', or 'owner'
  
  // Fetch user's permission level for this board
  useEffect(() => {
    if (!boardId || !user) return;

    const boardMetaRef = ref(database, `boardsMeta/${boardId}`);
    const unsubscribe = onValue(boardMetaRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setUserPermission('view');
        return;
      }

      // Check if user is owner
      const isOwner = data.ownerId === user.id;
      if (isOwner) {
        setUserPermission('owner');
        return;
      }

      // Check shared access by user ID
      const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase();
      
      // Sanitize email for Firebase key lookup (same as in BoardShareModal)
      const sanitizedEmail = userEmail ? userEmail
        .replace(/\./g, ',')
        .replace(/@/g, '_at_')
        .replace(/#/g, '_hash_')
        .replace(/\$/g, '_dollar_')
        .replace(/\[/g, '_lbracket_')
        .replace(/\]/g, '_rbracket_') : null;
      
      const sharedAccessById = data.sharedWith && data.sharedWith[user.id];
      const sharedAccessByEmail = data.sharedWith && sanitizedEmail && data.sharedWith[sanitizedEmail];

      if (sharedAccessById) {
        setUserPermission(sharedAccessById.permission || 'view');
      } else if (sharedAccessByEmail) {
        setUserPermission(sharedAccessByEmail.permission || 'view');
      } else {
        setUserPermission('view');
      }
    });

    return () => unsubscribe();
  }, [boardId, user]);
  
  // Helper to check if user can edit
  const canEdit = useCallback(() => {
    return userPermission === 'edit' || userPermission === 'owner';
  }, [userPermission]);

  // Helper to check if user is owner
  const isOwner = useCallback(() => {
    return userPermission === 'owner';
  }, [userPermission]);

  // Helper to log history with dynamic boardId
  const logHistory = useCallback((action, objectId, objectType, userId, displayName) => {
    const timestamp = Date.now();
    const historyEntry = {
      action,
      objectId,
      objectType,
      userId,
      displayName,
      timestamp,
    };
    set(ref(database, `boards/${boardId}/history/${timestamp}`), historyEntry).catch(err => {
      console.error('Failed to log history:', err);
    });
  }, [boardId]);
  
  // Keep a ref to user so callbacks with [] deps can read the current user
  const userRef = useRef(user);
  userRef.current = user;
  // Keep a ref to logHistory so zero-dep callbacks can use it without re-creating
  const logHistoryRef = useRef(logHistory);
  logHistoryRef.current = logHistory;

  // Raw create / delete — used by undo machinery, do NOT push to undo stack
  const rawCreate = useCallback((id, data) => {
    setOptimisticUpdates((prev) => ({ ...prev, [id]: { ...data } }));
    set(ref(database, `boards/${boardId}/objects/${id}`), {
      ...data,
      updatedAt: serverTimestamp(),
    }).catch((err) => console.error('rawCreate failed:', err));
  }, [boardId]);

  const rawDelete = useCallback((id) => {
    setOptimisticUpdates((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setFirebaseObjects((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    remove(ref(database, `boards/${boardId}/objects/${id}`)).catch(() => {});
  }, [boardId]);

  const stageRef = useRef(null);
  /** World coords of viewport center; Canvas updates this on pan/zoom so AI can place objects visibly when stage ref is unavailable. */
  const viewportCenterRef = useRef(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  // Firebase state: what the server has
  const [firebaseObjects, setFirebaseObjects] = useState({});
  // Optimistic updates: local pending changes
  const [optimisticUpdates, setOptimisticUpdates] = useState({});
  const [cursors, setCursors] = useState({});
  const [presence, setPresence] = useState({});
  const [followUserId, setFollowUserId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [connectorStyle, setConnectorStyle] = useState('straight');
  const [snapToGrid, setSnapToGridState] = useState(false);
  const snapToGridRef = useRef(false);
  const setSnapToGrid = useCallback((v) => {
    snapToGridRef.current = v;
    setSnapToGridState(v);
  }, []);
  // Track which objects are being edited by which user
  const [activeEdits, setActiveEdits] = useState({}); // { objectId: { userId, timestamp } }
  const [history, setHistory] = useState([]); // Change history
  // AI lock state — who is currently running AI on this board
  const [aiLock, setAiLock] = useState(null); // { userId, userName, timestamp } | null
  const [requestCenterView, setRequestCenterView] = useState(null); // { x, y } world coords to pan into view after create
  const deferPanRef = useRef(false); // when true, create* skip pan (so batch create can pan once to first)
  // When not null, create* functions queue Firebase writes here instead of calling set() individually.
  // Call flushBatch() to emit a single multi-path update() and reset to null.
  const pendingBatchWritesRef = useRef(null);

  // Set to true as soon as Firebase delivers the first objects snapshot (even if empty board)
  const [objectsLoaded, setObjectsLoaded] = useState(false);

  // --- Active tool (for click-to-place) ---
  const [activeTool, setActiveTool] = useState('select');

  // --- Undo / Redo ---
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [, setUndoTick] = useState(0); // force re-render when stack changes

  const pushUndoEntry = useCallback((undoFn, redoFn) => {
    undoStackRef.current.push({ undo: undoFn, redo: redoFn });
    redoStackRef.current = [];
    setUndoTick((t) => t + 1);
  }, []);

  const undo = useCallback(() => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    redoStackRef.current.push(entry);
    setUndoTick((t) => t + 1);
    entry.undo();
  }, []);

  const redo = useCallback(() => {
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    undoStackRef.current.push(entry);
    setUndoTick((t) => t + 1);
    entry.redo();
  }, []);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  // Pre-drag position snapshot for move undo
  const preDragPositionsRef = useRef(null);
  const beginMoveUndo = useCallback((primaryId) => {
    const ids = selectedIdsRef.current.size > 0 ? selectedIdsRef.current : new Set([primaryId]);
    const positions = {};
    ids.forEach((id) => {
      const obj = objectsRef.current[id];
      if (obj) positions[id] = { x: obj.x, y: obj.y };
    });
    preDragPositionsRef.current = positions;
  }, []);

  const setDeferPan = useCallback((defer) => {
    deferPanRef.current = !!defer;
  }, []);

  // Merge Firebase state with optimistic updates
  // Firebase always wins when it has an object; optimistic only for pending creates
  const objects = useMemo(() => {
    return { ...optimisticUpdates, ...firebaseObjects };
  }, [firebaseObjects, optimisticUpdates]);

  // Keep a ref to merged objects for use in callbacks without triggering re-renders
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  // Keep a ref to selectedIds so callbacks don't need it as a dependency
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // Keep a ref to userPermission so moveObject / resizeObject (which use [] deps) always
  // read the current permission without recreating on every permission change.
  const userPermissionRef = useRef(userPermission);
  userPermissionRef.current = userPermission;

  /** Serialized board state (id, type, x, y, width, height, color, text) for view/export and for AI (boardState in API). */
  const getBoardState = useCallback(() => {
    return Object.entries(objects).map(([id, obj]) => {
      const base = { id, type: obj.type || 'unknown', x: obj.x ?? 0, y: obj.y ?? 0 };
      if (obj.width != null) base.width = obj.width;
      if (obj.height != null) base.height = obj.height;
      if (obj.color != null) base.color = obj.color;
      if (obj.text != null) base.text = obj.text;
      if (obj.title != null) base.text = obj.title;
      return base;
    });
  }, [objects]);

  // Memoize Firebase refs so they're stable across renders
  const boardRef = useMemo(() => ref(database, `boards/${boardId}`), [boardId]);
  const firebaseObjectsRef = useMemo(() => ref(database, `boards/${boardId}/objects`), [boardId]);
  const cursorsRef = useMemo(() => ref(database, `boards/${boardId}/cursors`), [boardId]);
  const presenceRef = useMemo(() => ref(database, `boards/${boardId}/presence`), [boardId]);
  const aiLockRef = useMemo(() => ref(database, `boards/${boardId}/aiLock`), [boardId]);

  const cursorRef = useMemo(
    () => (user ? ref(database, `boards/${boardId}/cursors/${user.id}`) : null),
    [user, boardId]
  );
  const userPresenceRef = useMemo(
    () => (user ? ref(database, `boards/${boardId}/presence/${user.id}`) : null),
    [user, boardId]
  );
  const historyRef = useMemo(() => ref(database, `boards/${boardId}/history`), [boardId]);

  // One-time fix: Set parentFrameId for existing objects inside frames
  useEffect(() => {
    if (!boardId || !user) return;
    
    const fixParentIds = async () => {
      const snapshot = await get(firebaseObjectsRef);
      const val = snapshot.val() || {};
      
      const frames = Object.entries(val).filter(([, obj]) => obj.type === 'frame');
      if (frames.length === 0) return;
      
      const updates = {};
      Object.entries(val).forEach(([objId, obj]) => {
        if (obj.type !== 'frame' && !obj.parentFrameId) {
          // Check if this object is inside any frame
          for (const [frameId, frame] of frames) {
            const frameX = frame.x || 0;
            const frameY = frame.y || 0;
            const frameW = frame.width || 600;
            const frameH = frame.height || 400;
            
            const objW = obj.width || 100;
            const objH = obj.height || 100;
            const objCenterX = obj.x + objW / 2;
            const objCenterY = obj.y + objH / 2;
            
            if (objCenterX >= frameX && objCenterX <= frameX + frameW &&
                objCenterY >= frameY && objCenterY <= frameY + frameH) {
              updates[`${objId}/parentFrameId`] = frameId;
              break;
            }
          }
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await update(ref(database, `boards/${boardId}/objects`), updates);
      }
    };
    
    // Run once after a short delay to let Firebase load
    const timer = setTimeout(fixParentIds, 1000);
    return () => clearTimeout(timer);
  }, [boardId, user]);

  useEffect(() => {
    const unsubObjects = onValue(firebaseObjectsRef, (snapshot) => {
      const val = snapshot.val() ?? {};
      // Firebase is source of truth
      setFirebaseObjects(val);
      // Signal that the first snapshot has arrived (even if the board is empty)
      setObjectsLoaded(true);
      // Only clear optimistic updates for objects that Firebase now has
      setOptimisticUpdates((prev) => {
        // If no optimistic updates, don't create a new object
        if (Object.keys(prev).length === 0) return prev;
        
        const next = {};
        let hasChanges = false;
        Object.keys(prev).forEach((id) => {
          // If Firebase doesn't have this object yet, keep our optimistic version
          if (!val[id]) {
            next[id] = prev[id];
          } else {
            hasChanges = true; // Firebase has this object, so we're removing it from optimistic
          }
        });
        
        // Only return new object if something actually changed
        return hasChanges ? next : prev;
      });
    });
    
    const unsubCursors = onValue(cursorsRef, (snapshot) => {
      const val = snapshot.val() || {};
      setCursors(val);
    });
    
    const unsubPresence = onValue(presenceRef, (snapshot) => {
      const val = snapshot.val() || {};
      setPresence(val);
    });
    
    const unsubHistory = onValue(historyRef, (snapshot) => {
      const val = snapshot.val() || {};
      const historyArray = Object.entries(val)
        .map(([timestamp, entry]) => ({ ...entry, timestamp: Number(timestamp) }))
        .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
        .slice(0, 500); // Keep last 500 entries
      setHistory(historyArray);
    });

    const unsubAiLock = onValue(aiLockRef, (snapshot) => {
      setAiLock(snapshot.val() ?? null);
    });

    return () => {
      unsubObjects();
      unsubCursors();
      unsubPresence();
      unsubHistory();
      unsubAiLock();
    };
  }, [firebaseObjectsRef, cursorsRef, presenceRef, historyRef, aiLockRef]); // Refs are memoized so this only runs once

  useEffect(() => {
    if (!user) return;
    return () => {
      if (cursorRef) {
        remove(cursorRef).catch(() => {});
      }
      if (userPresenceRef) {
        remove(userPresenceRef).catch(() => {});
      }
    };
  }, [user, cursorRef, userPresenceRef]);

  const updateCursor = useCallback(
    (x, y) => {
      if (!cursorRef || !user) return;
      const displayName = user.firstName || 
                         user.emailAddresses?.[0]?.emailAddress || 
                         'Anonymous';
      set(cursorRef, {
        x,
        y,
        displayName,
        updatedAt: serverTimestamp(),
      });
    },
    [user, cursorRef]
  );

  const setOnline = useCallback(() => {
    if (!userPresenceRef || !user) return;
    const displayName = user.firstName || 
                       user.emailAddresses?.[0]?.emailAddress || 
                       'Anonymous';
    const presenceData = {
      displayName,
      online: true,
      lastSeen: serverTimestamp(),
    };
    set(userPresenceRef, presenceData);
    onDisconnect(userPresenceRef).update({ online: false, lastSeen: serverTimestamp() });
    // When this client disconnects (tab close, network drop), remove their cursor so it doesn't stick around
    if (cursorRef) {
      onDisconnect(cursorRef).remove();
    }
  }, [user, userPresenceRef, cursorRef]);

  const createStickyNote = useCallback((text, x, y, color = '#FEF08A', width = 160, height = 120) => {
    if (!user) return null;
    if (userPermission !== 'edit' && userPermission !== 'owner') {
      return null;
    }
    
    const id = generateId();
    const safeText = escapeHtml(String(text || 'New note'));
    const newObj = {
      type: 'sticky',
      text: safeText,
      x: Number(x) || 0,
      y: Number(y) || 0,
      width: Number(width) || 160,
      height: Number(height) || 120,
      color: String(color).slice(0, 20),
      updatedAt: Date.now(),
    };
    
    // Optimistic: add to local state immediately
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    
    // Auto-select the newly created object
    setSelectedIds(new Set([id]));
    
    if (!deferPanRef.current) setRequestCenterView({ x: newObj.x + newObj.width / 2, y: newObj.y + newObj.height / 2 });
    
    // Log to history
    const displayName = user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Anonymous';
    logHistory('created', id, 'sticky note', user.id, displayName);
    
    // Record undo entry
    const savedObj = { ...newObj };
    pushUndoEntry(
      () => rawDelete(id),
      () => rawCreate(id, savedObj),
    );

    // Sync to Firebase — queue in batch if active, else write immediately
    const fbObj = { ...newObj, updatedAt: serverTimestamp() };
    if (pendingBatchWritesRef.current !== null) {
      pendingBatchWritesRef.current[id] = fbObj;
    } else {
      setSaveStatus('saving');
      set(ref(database, `boards/${boardId}/objects/${id}`), fbObj)
        .then(() => setSaveStatus('saved'))
        .catch((err) => { console.error('❌ Failed to create sticky note:', err); setSaveStatus('error'); });
    }

    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const createTextBox = useCallback((text = 'Text', x = 0, y = 0, width = 200, height = 60, color = '#f1f5f9') => {
    if (!user || (userPermission !== 'edit' && userPermission !== 'owner')) return null;
    const id = generateId();
    const newObj = { type: 'textbox', text, x: Number(x), y: Number(y), width: Number(width), height: Number(height), color, updatedAt: Date.now() };
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    setSelectedIds(new Set([id]));
    if (!deferPanRef.current) setRequestCenterView({ x: newObj.x + newObj.width / 2, y: newObj.y + newObj.height / 2 });
    const displayName = user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Anonymous';
    logHistory('created', id, 'text box', user.id, displayName);
    const savedObj = { ...newObj };
    pushUndoEntry(() => rawDelete(id), () => rawCreate(id, savedObj));
    set(ref(database, `boards/${boardId}/objects/${id}`), { ...newObj, updatedAt: serverTimestamp() }).catch(() => {});
    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const createArrow = useCallback((x1 = 0, y1 = 0, x2 = 150, y2 = 0, color = '#667eea') => {
    if (!user || (userPermission !== 'edit' && userPermission !== 'owner')) return null;
    const id = generateId();
    const newObj = { type: 'arrow', x1: Number(x1), y1: Number(y1), x2: Number(x2), y2: Number(y2), color, strokeWidth: 2, updatedAt: Date.now() };
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    setSelectedIds(new Set([id]));
    const displayName = user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Anonymous';
    logHistory('created', id, 'arrow', user.id, displayName);
    const savedObj = { ...newObj };
    pushUndoEntry(() => rawDelete(id), () => rawCreate(id, savedObj));
    set(ref(database, `boards/${boardId}/objects/${id}`), { ...newObj, updatedAt: serverTimestamp() }).catch(() => {});
    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const createImage = useCallback((dataUrl, x = 0, y = 0, width = 240, height = 160) => {
    if (!user || (userPermission !== 'edit' && userPermission !== 'owner')) return null;
    const id = generateId();
    const newObj = { type: 'image', dataUrl, x: Number(x), y: Number(y), width: Number(width), height: Number(height), updatedAt: Date.now() };
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    setSelectedIds(new Set([id]));
    if (!deferPanRef.current) setRequestCenterView({ x: newObj.x + newObj.width / 2, y: newObj.y + newObj.height / 2 });
    const displayName = user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Anonymous';
    logHistory('created', id, 'image', user.id, displayName);
    const savedObj = { ...newObj };
    pushUndoEntry(() => rawDelete(id), () => rawCreate(id, savedObj));
    set(ref(database, `boards/${boardId}/objects/${id}`), { ...newObj, updatedAt: serverTimestamp() }).catch(() => {});
    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const createKanban = useCallback((x = 0, y = 0) => {
    if (!user || (userPermission !== 'edit' && userPermission !== 'owner')) return null;
    const id = generateId();
    const newObj = {
      type: 'kanban', x: Number(x), y: Number(y), width: 760, height: 480,
      columns: [
        { title: 'To Do', cards: ['Add your tasks here'] },
        { title: 'In Progress', cards: [] },
        { title: 'Done', cards: [] },
      ],
      updatedAt: Date.now(),
    };
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    setSelectedIds(new Set([id]));
    if (!deferPanRef.current) setRequestCenterView({ x: newObj.x + 380, y: newObj.y + 240 });
    logHistory('created', id, 'kanban', user.id, user.firstName || 'Anonymous');
    const savedKanban = { ...newObj };
    pushUndoEntry(() => rawDelete(id), () => rawCreate(id, savedKanban));
    set(ref(database, `boards/${boardId}/objects/${id}`), { ...newObj, updatedAt: serverTimestamp() }).catch(() => {});
    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const createTable = useCallback((x = 0, y = 0) => {
    if (!user || (userPermission !== 'edit' && userPermission !== 'owner')) return null;
    const id = generateId();
    const newObj = {
      type: 'table', x: Number(x), y: Number(y), width: 480, height: 280,
      rows: [['Column 1', 'Column 2', 'Column 3'], ['', '', ''], ['', '', '']],
      updatedAt: Date.now(),
    };
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    setSelectedIds(new Set([id]));
    if (!deferPanRef.current) setRequestCenterView({ x: newObj.x + 240, y: newObj.y + 140 });
    logHistory('created', id, 'table', user.id, user.firstName || 'Anonymous');
    const savedTable = { ...newObj };
    pushUndoEntry(() => rawDelete(id), () => rawCreate(id, savedTable));
    set(ref(database, `boards/${boardId}/objects/${id}`), { ...newObj, updatedAt: serverTimestamp() }).catch(() => {});
    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const createCodeBlock = useCallback((x = 0, y = 0) => {
    if (!user || (userPermission !== 'edit' && userPermission !== 'owner')) return null;
    const id = generateId();
    const newObj = {
      type: 'code', x: Number(x), y: Number(y), width: 420, height: 240,
      code: '// Write your code here\n', language: 'javascript',
      updatedAt: Date.now(),
    };
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    setSelectedIds(new Set([id]));
    if (!deferPanRef.current) setRequestCenterView({ x: newObj.x + 210, y: newObj.y + 120 });
    logHistory('created', id, 'code block', user.id, user.firstName || 'Anonymous');
    const savedCode = { ...newObj };
    pushUndoEntry(() => rawDelete(id), () => rawCreate(id, savedCode));
    set(ref(database, `boards/${boardId}/objects/${id}`), { ...newObj, updatedAt: serverTimestamp() }).catch(() => {});
    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const createEmbed = useCallback((url = '', x = 0, y = 0) => {
    if (!user || (userPermission !== 'edit' && userPermission !== 'owner')) return null;
    const id = generateId();
    const newObj = {
      type: 'embed', url, x: Number(x), y: Number(y), width: 480, height: 320,
      updatedAt: Date.now(),
    };
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    setSelectedIds(new Set([id]));
    if (!deferPanRef.current) setRequestCenterView({ x: newObj.x + 240, y: newObj.y + 160 });
    logHistory('created', id, 'embed', user.id, user.firstName || 'Anonymous');
    const savedEmbed = { ...newObj };
    pushUndoEntry(() => rawDelete(id), () => rawCreate(id, savedEmbed));
    set(ref(database, `boards/${boardId}/objects/${id}`), { ...newObj, updatedAt: serverTimestamp() }).catch(() => {});
    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const createMindMapNode = useCallback((text = 'Idea', x = 0, y = 0, color = '#667eea') => {
    if (!user || (userPermission !== 'edit' && userPermission !== 'owner')) return null;
    const id = generateId();
    const newObj = {
      type: 'mindmap', text, x: Number(x), y: Number(y), width: 120, height: 120, color,
      updatedAt: Date.now(),
    };
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    setSelectedIds(new Set([id]));
    if (!deferPanRef.current) setRequestCenterView({ x: newObj.x + 60, y: newObj.y + 60 });
    logHistory('created', id, 'mind map node', user.id, user.firstName || 'Anonymous');
    const savedMind = { ...newObj };
    pushUndoEntry(() => rawDelete(id), () => rawCreate(id, savedMind));
    set(ref(database, `boards/${boardId}/objects/${id}`), { ...newObj, updatedAt: serverTimestamp() }).catch(() => {});
    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const createShape = useCallback((type, x, y, width, height, color = '#6366F1') => {
    if (!user) return null;
    if (userPermission !== 'edit' && userPermission !== 'owner') {
      return null;
    }
    
    const id = generateId();
    const newObj = {
      type: type || 'rectangle',
      x: Number(x) || 0,
      y: Number(y) || 0,
      width: Number(width) || 100,
      height: Number(height) || 80,
      color: String(color).slice(0, 20),
      updatedAt: Date.now(),
    };
    
    // Optimistic: add to local state immediately
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    
    // Auto-select the newly created object
    setSelectedIds(new Set([id]));
    
    if (!deferPanRef.current) setRequestCenterView({ x: newObj.x + newObj.width / 2, y: newObj.y + newObj.height / 2 });
    
    // Log to history
    const displayName = user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Anonymous';
    logHistory('created', id, type, user.id, displayName);
    
    // Record undo entry
    const savedShape = { ...newObj };
    pushUndoEntry(
      () => rawDelete(id),
      () => rawCreate(id, savedShape),
    );

    // Sync to Firebase — queue in batch if active, else write immediately
    const fbShape = { ...newObj, updatedAt: serverTimestamp() };
    if (pendingBatchWritesRef.current !== null) {
      pendingBatchWritesRef.current[id] = fbShape;
    } else {
      set(ref(database, `boards/${boardId}/objects/${id}`), fbShape).then(() => {});
    }

    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const startEditing = useCallback((objectId) => {
    if (!user) return;
    setActiveEdits((prev) => ({
      ...prev,
      [objectId]: { userId: user.id, timestamp: Date.now() },
    }));
    // Broadcast to collaborators which object this user is editing
    if (userPresenceRef) {
      update(userPresenceRef, { editingObjectId: objectId });
    }
  }, [user, userPresenceRef]);

  const stopEditing = useCallback((objectId) => {
    setActiveEdits((prev) => {
      const next = { ...prev };
      delete next[objectId];
      return next;
    });
    // Clear editing indicator in Firebase
    if (userPresenceRef) {
      update(userPresenceRef, { editingObjectId: null });
    }
  }, [userPresenceRef]);

  // Update arbitrary fields on the current user's presence entry (throttled by callers)
  const updatePresenceField = useCallback((fields) => {
    if (!userPresenceRef) return;
    update(userPresenceRef, fields);
  }, [userPresenceRef]);

  // Local-only move used during drag for smooth connector updates (no Firebase writes).
  const moveObjectLocal = useCallback((objectId, x, y) => {
    const currentObj = objectsRef.current[objectId] || {};
    setOptimisticUpdates((prev) => ({
      ...prev,
      [objectId]: {
        ...currentObj,
        x: Number(x),
        y: Number(y),
        updatedAt: Date.now(),
      },
    }));
  }, []);

  // Like moveObjectLocal but moves ALL objects in the current selection together.
  // Called on every drag-move event so the whole group follows the pointer in real time.
  // Uses preDragPositionsRef (snapshotted at drag-start) for a stable total-delta calculation.
  const moveObjectGroupLocal = useCallback((primaryId, newX, newY) => {
    const currentIds = selectedIdsRef.current;
    if (currentIds.size <= 1) {
      moveObjectLocal(primaryId, newX, newY);
      return;
    }
    const prevPositions = preDragPositionsRef.current;
    const startPrimary = prevPositions?.[primaryId];
    if (!startPrimary) {
      // Snapshot missing — fall back to single-object update
      moveObjectLocal(primaryId, newX, newY);
      return;
    }
    const dx = newX - startPrimary.x;
    const dy = newY - startPrimary.y;
    setOptimisticUpdates((prev) => {
      const next = { ...prev };
      currentIds.forEach((sid) => {
        const sp = prevPositions[sid];
        if (!sp) return;
        const base = objectsRef.current[sid] || {};
        next[sid] = { ...base, x: sp.x + dx, y: sp.y + dy, updatedAt: Date.now() };
      });
      return next;
    });
  }, [moveObjectLocal]);

  // Local-only partial update (no Firebase write), useful for smooth drag previews.
  const updateObjectLocal = useCallback((objectId, payload) => {
    const currentObj = objectsRef.current[objectId] || {};
    setOptimisticUpdates((prev) => ({
      ...prev,
      [objectId]: {
        ...currentObj,
        ...payload,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const moveObject = useCallback((objectId, x, y, options = {}) => {
    if (userPermissionRef.current !== 'edit' && userPermissionRef.current !== 'owner') {
      return;
    }
    const snap = (v) => snapToGridRef.current ? Math.round(v / 40) * 40 : v;
    x = snap(x);
    y = snap(y);
    const currentObj = objectsRef.current[objectId] || {};
    
    // Check if object is being placed inside a frame
    let parentFrameId = currentObj.parentFrameId || null;
    const allObjects = objectsRef.current;
    
    // Only check frame relationship if this isn't a frame itself.
    // During frame drag we can skip this check to avoid detaching children from their frame.
    if (!options.skipFrameDetection && currentObj.type !== 'frame') {
      // Find if this object is now inside a frame
      let foundFrame = null;
      for (const [frameId, frameObj] of Object.entries(allObjects)) {
        if (frameObj.type === 'frame' && frameId !== objectId) {
          const frameX = frameObj.x || 0;
          const frameY = frameObj.y || 0;
          const frameW = frameObj.width || 600;
          const frameH = frameObj.height || 400;
          
          // Check if object center is inside frame
          const objW = currentObj.width || 100;
          const objH = currentObj.height || 100;
          const objCenterX = x + objW / 2;
          const objCenterY = y + objH / 2;
          
          if (objCenterX >= frameX && objCenterX <= frameX + frameW &&
              objCenterY >= frameY && objCenterY <= frameY + frameH) {
            foundFrame = frameId;
            break;
          }
        }
      }
      parentFrameId = foundFrame;
    }
    
    // Optimistic: update position immediately in local state
    setOptimisticUpdates((prev) => ({
      ...prev,
      [objectId]: {
        ...currentObj,
        x: Number(x),
        y: Number(y),
        parentFrameId,
        updatedAt: Date.now(),
      },
    }));
    
    // Then sync to Firebase
    const objRef = ref(database, `boards/${boardId}/objects/${objectId}`);
    update(objRef, {
      x: Number(x),
      y: Number(y),
      parentFrameId,
      updatedAt: serverTimestamp(),
    });
  }, []);

  // Moves a dragged object; if multiple objects are selected, moves all of them by the same delta
  const moveObjectGroup = useCallback((objectId, x, y) => {
    const currentIds = selectedIdsRef.current;
    const obj = objectsRef.current[objectId];
    if (!obj) return;

    // Capture pre-drag snapshot before any writes so both the move and undo code use it.
    const prevPositions = preDragPositionsRef.current;

    if (currentIds.size <= 1) {
      moveObject(objectId, x, y);
    } else {
      // IMPORTANT: do NOT use obj.x/obj.y as the delta base here.
      // moveObjectLocal is called throughout the drag and updates obj.x to the current
      // drag position, so (x - obj.x) ≈ 0 by drag-end.  Use the pre-drag snapshot instead.
      const startX = prevPositions?.[objectId]?.x ?? obj.x;
      const startY = prevPositions?.[objectId]?.y ?? obj.y;
      const dx = x - startX;
      const dy = y - startY;

      // Collect final positions for every non-connector object in the selection
      const movedItems = [];
      currentIds.forEach((sid) => {
        const s = objectsRef.current[sid];
        // Connectors have no x/y — they follow their endpoint objects automatically.
        if (s && s.type !== 'connector') {
          const sp = prevPositions?.[sid];
          movedItems.push({ id: sid, nx: (sp ? sp.x : s.x) + dx, ny: (sp ? sp.y : s.y) + dy, s });
        }
      });

      // One optimistic state update covers all objects — avoids cascading re-renders
      setOptimisticUpdates((prev) => {
        const next = { ...prev };
        movedItems.forEach(({ id, nx, ny, s }) => {
          next[id] = { ...s, x: nx, y: ny, updatedAt: Date.now() };
        });
        return next;
      });

      // Single batched Firebase write for ALL selected objects — critical for large groups
      const fbUpdates = {};
      movedItems.forEach(({ id, nx, ny, s }) => {
        fbUpdates[`${id}/x`] = Number(nx);
        fbUpdates[`${id}/y`] = Number(ny);
        fbUpdates[`${id}/parentFrameId`] = s.parentFrameId ?? null;
        fbUpdates[`${id}/updatedAt`] = Date.now();
      });
      setSaveStatus('saving');
      update(ref(database, `boards/${boardId}/objects`), fbUpdates)
        .then(() => setSaveStatus('saved'))
        .catch((err) => { console.error('Batch group move failed:', err); setSaveStatus('error'); });
    }

    // Push undo entry for the move using pre-drag snapshot
    if (prevPositions) {
      const prevPrimary = prevPositions[objectId];
      if (prevPrimary) {
        const dx = x - prevPrimary.x;
        const dy = y - prevPrimary.y;
        // Compute new positions for all objects in the group
        const newPositions = {};
        Object.entries(prevPositions).forEach(([sid, pos]) => {
          newPositions[sid] = { x: pos.x + dx, y: pos.y + dy };
        });
        const prevSnap = { ...prevPositions };
        pushUndoEntry(
          () => { Object.entries(prevSnap).forEach(([sid, pos]) => moveObject(sid, pos.x, pos.y)); },
          () => { Object.entries(newPositions).forEach(([sid, pos]) => moveObject(sid, pos.x, pos.y)); },
        );
      }
      preDragPositionsRef.current = null;
    }

    // Log move to history (once per drag end)
    const u = userRef.current;
    if (u) {
      const displayName = u.firstName || u.emailAddresses?.[0]?.emailAddress || 'Anonymous';
      logHistoryRef.current('moved', objectId, obj.type || 'object', u.id, displayName);
    }
  }, [moveObject, pushUndoEntry, boardId]);

  const groupObjects = useCallback((objectIds) => {
    if (!user || (userPermission !== 'edit' && userPermission !== 'owner')) return;
    if (!objectIds || objectIds.length < 2) return;
    const groupId = generateId();
    const allObjs = objectsRef.current;
    const updates = {};
    objectIds.forEach((oid) => {
      if (allObjs[oid]) {
        updates[`${oid}/groupId`] = groupId;
        updates[`${oid}/updatedAt`] = Date.now();
      }
    });
    if (Object.keys(updates).length > 0) {
      update(ref(database, `boards/${boardId}/objects`), updates).catch(() => {});
    }
    return groupId;
  }, [user, userPermission, boardId]);

  const ungroupObjects = useCallback((objectIds) => {
    if (!user || (userPermission !== 'edit' && userPermission !== 'owner')) return;
    const allObjs = objectsRef.current;
    const updates = {};
    objectIds.forEach((oid) => {
      if (allObjs[oid]) {
        updates[`${oid}/groupId`] = null;
        updates[`${oid}/updatedAt`] = Date.now();
      }
    });
    if (Object.keys(updates).length > 0) {
      update(ref(database, `boards/${boardId}/objects`), updates).catch(() => {});
    }
  }, [user, userPermission, boardId]);

  const updateObject = useCallback((objectId, payload) => {
    if (userPermission !== 'edit' && userPermission !== 'owner') {
      return;
    }
    const safePayload = { ...payload };
    if (safePayload.text !== undefined) {
      safePayload.text = escapeHtml(String(safePayload.text));
    }
    
    const currentObj = objectsRef.current[objectId] || {};

    // Push undo for text changes so users can revert edits
    if (safePayload.text !== undefined && currentObj.text !== undefined && currentObj.text !== safePayload.text) {
      const prevText = currentObj.text;
      const nextText = safePayload.text;
      pushUndoEntry(
        () => {
          setOptimisticUpdates((prev) => ({
            ...prev,
            [objectId]: { ...(objectsRef.current[objectId] || {}), text: prevText },
          }));
          update(ref(database, `boards/${boardId}/objects/${objectId}`), {
            text: prevText, updatedAt: serverTimestamp(),
          });
        },
        () => {
          setOptimisticUpdates((prev) => ({
            ...prev,
            [objectId]: { ...(objectsRef.current[objectId] || {}), text: nextText },
          }));
          update(ref(database, `boards/${boardId}/objects/${objectId}`), {
            text: nextText, updatedAt: serverTimestamp(),
          });
        },
      );
    }

    // OPTIMISTIC: Update local state immediately for instant UI response
    setOptimisticUpdates((prev) => ({
      ...prev,
      [objectId]: {
        ...currentObj,
        ...safePayload,
        updatedAt: Date.now(),
      },
    }));
    
    // Log update to history for meaningful changes
    if (safePayload.text !== undefined || safePayload.color !== undefined || safePayload.arrowStyle !== undefined) {
      const u = userRef.current;
      if (u) {
        const displayName = u.firstName || u.emailAddresses?.[0]?.emailAddress || 'Anonymous';
        logHistoryRef.current('updated', objectId, currentObj.type || 'object', u.id, displayName);
      }
    }

    // Then sync to Firebase in the background
    setSaveStatus('saving');
    const objRef = ref(database, `boards/${boardId}/objects/${objectId}`);
    update(objRef, {
      ...safePayload,
      updatedAt: serverTimestamp(),
    })
      .then(() => {
        setSaveStatus('saved');
      })
      .catch((err) => {
        console.error('❌ Update failed:', err);
        setSaveStatus('error');
      });
  }, [userPermission, boardId, pushUndoEntry]);

  const resizeObject = useCallback((objectId, width, height) => {
    if (userPermissionRef.current !== 'edit' && userPermissionRef.current !== 'owner') {
      return;
    }
    const currentObj = objectsRef.current[objectId] || {};
    const prevW = currentObj.width;
    const prevH = currentObj.height;
    const prevX = currentObj.x;
    const prevY = currentObj.y;

    // Optimistic: update size immediately in local state
    setOptimisticUpdates((prev) => ({
      ...prev,
      [objectId]: {
        ...currentObj,
        width: Number(width),
        height: Number(height),
        updatedAt: Date.now(),
      },
    }));

    // Undo: restore previous x/y/width/height
    if (prevW != null && prevH != null) {
      pushUndoEntry(
        () => {
          const restorePayload = { width: prevW, height: prevH };
          if (prevX != null) restorePayload.x = prevX;
          if (prevY != null) restorePayload.y = prevY;
          setOptimisticUpdates((prev) => ({
            ...prev,
            [objectId]: { ...(objectsRef.current[objectId] || {}), ...restorePayload },
          }));
          update(ref(database, `boards/${boardId}/objects/${objectId}`), {
            ...restorePayload,
            updatedAt: serverTimestamp(),
          });
        },
        () => {
          setOptimisticUpdates((prev) => ({
            ...prev,
            [objectId]: { ...(objectsRef.current[objectId] || {}), width: Number(width), height: Number(height) },
          }));
          update(ref(database, `boards/${boardId}/objects/${objectId}`), {
            width: Number(width),
            height: Number(height),
            updatedAt: serverTimestamp(),
          });
        },
      );
    }

    // Then sync to Firebase
    const objRef = ref(database, `boards/${boardId}/objects/${objectId}`);
    update(objRef, {
      width: Number(width),
      height: Number(height),
      updatedAt: serverTimestamp(),
    });
  }, [boardId, pushUndoEntry]);

  const deleteObject = useCallback((objectId) => {
    if (!user) return;
    if (userPermission !== 'edit' && userPermission !== 'owner') {
      return;
    }
    
    const obj = objectsRef.current[objectId];
    
    // If deleting a frame, clear parentFrameId from all children
    if (obj && obj.type === 'frame') {
      Object.entries(objectsRef.current).forEach(([childId, childObj]) => {
        if (childObj.parentFrameId === objectId) {
          const childRef = ref(database, `boards/${boardId}/objects/${childId}`);
          update(childRef, { parentFrameId: null });
        }
      });
    }

    // Cascade-delete any connectors attached to this object
    Object.entries(objectsRef.current).forEach(([cId, cObj]) => {
      if (
        cObj.type === 'connector' &&
        (cObj.startObjectId === objectId || cObj.endObjectId === objectId)
      ) {
        setOptimisticUpdates((prev) => { const n = { ...prev }; delete n[cId]; return n; });
        setFirebaseObjects((prev) => { const n = { ...prev }; delete n[cId]; return n; });
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(cId); return n; });
        remove(ref(database, `boards/${boardId}/objects/${cId}`));
      }
    });
    
    // Optimistic: remove from local state immediately
    setOptimisticUpdates((prev) => {
      const next = { ...prev };
      delete next[objectId];
      return next;
    });
    
    // Also remove from firebase objects view if it exists
    setFirebaseObjects((prev) => {
      const next = { ...prev };
      delete next[objectId];
      return next;
    });
    
    // Remove from selection
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(objectId);
      return next;
    });
    
    // Log to history + push undo entry
    if (obj) {
      const displayName = user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Anonymous';
      logHistory('deleted', objectId, obj.type, user.id, displayName);
      const snapshotData = { ...obj };
      const deletedId = objectId;
      pushUndoEntry(
        () => rawCreate(deletedId, snapshotData),
        () => rawDelete(deletedId),
      );
    }
    
    // Then sync to Firebase
    remove(ref(database, `boards/${boardId}/objects/${objectId}`));
  }, [user, userPermission, boardId, logHistory, stopEditing, pushUndoEntry, rawCreate, rawDelete]);

  const deleteSelectedObjects = useCallback(() => {
    selectedIds.forEach((id) => {
      deleteObject(id);
    });
    setSelectedIds(new Set());
  }, [selectedIds, deleteObject]);

  const clearBoard = useCallback(() => {
    if (!user) return;
    if (userPermission !== 'edit' && userPermission !== 'owner') return;
    setOptimisticUpdates({});
    setFirebaseObjects({});
    setSelectedIds(new Set());
    set(ref(database, `boards/${boardId}/objects`), null)
      .then(() => {
        // Re-clear after Firebase confirms, in case optimistic state re-populated
        setOptimisticUpdates({});
        setFirebaseObjects({});
      })
      .catch((err) => console.error('❌ clearBoard failed:', err));
  }, [user, userPermission, boardId]);

  const toggleSelection = useCallback((objectId, isShiftKey) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isShiftKey) {
        // Shift-click: toggle in selection
        if (next.has(objectId)) {
          next.delete(objectId);
        } else {
          next.add(objectId);
        }
      } else {
        // Regular click: single select
        next.clear();
        next.add(objectId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const duplicateSelectedObjects = useCallback(() => {
    const newIds = [];
    selectedIds.forEach((oldId) => {
      const obj = objects[oldId];
      if (!obj) return;
      
      const newId = generateId();
      const offset = 20; // Offset duplicate slightly
      const newObj = {
        ...obj,
        x: obj.x + offset,
        y: obj.y + offset,
        updatedAt: Date.now(),
      };
      
      // Optimistic: add to local state immediately
      setOptimisticUpdates((prev) => ({ ...prev, [newId]: newObj }));
      
      // Then sync to Firebase
      set(ref(database, `boards/${boardId}/objects/${newId}`), {
        ...newObj,
        updatedAt: serverTimestamp(),
      });
      
      newIds.push(newId);
    });
    
    // Select the newly duplicated objects
    setSelectedIds(new Set(newIds));
  }, [selectedIds, objects]);

  const clipboard = useRef(null);

  const copySelectedObjects = useCallback(() => {
    const objectsToCopy = [];
    selectedIds.forEach((id) => {
      const obj = objects[id];
      if (obj) {
        objectsToCopy.push(obj);
      }
    });
    clipboard.current = objectsToCopy;
  }, [selectedIds, objects]);

  const pasteObjects = useCallback(() => {
    if (!clipboard.current || clipboard.current.length === 0) return;
    
    const newIds = [];
    const offset = 30; // Offset paste slightly
    
    clipboard.current.forEach((obj) => {
      const newId = generateId();
      const newObj = {
        ...obj,
        x: obj.x + offset,
        y: obj.y + offset,
        updatedAt: Date.now(),
      };
      
      // Optimistic: add to local state immediately
      setOptimisticUpdates((prev) => ({ ...prev, [newId]: newObj }));
      
      // Then sync to Firebase
      set(ref(database, `boards/${boardId}/objects/${newId}`), {
        ...newObj,
        updatedAt: serverTimestamp(),
      });
      
      newIds.push(newId);
    });
    
    // Select the newly pasted objects
    setSelectedIds(new Set(newIds));
  }, []);

  const createConnector = useCallback((startObjectId, endObjectId, arrowStyle = 'straight', color = '#64748b', startPort = null, endPort = null) => {
    if (!user) return null;
    if (userPermission !== 'edit' && userPermission !== 'owner') {
      return null;
    }
    
    const id = generateId();
    const displayName = user.firstName || user.emailAddresses[0]?.emailAddress || 'User';
    
    const newConnector = {
      type: 'connector',
      startObjectId,
      endObjectId,
      color,
      strokeWidth: 2,
      arrowStyle,
      startPort,
      endPort,
      createdAt: Date.now(),
      createdBy: user.id,
      createdByName: displayName,
    };

    // Optimistic create
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newConnector }));
    
    // Log history
    logHistory('created', id, 'connector', user.id, displayName);

    // Record undo entry
    const savedConnector = { ...newConnector };
    pushUndoEntry(() => rawDelete(id), () => rawCreate(id, savedConnector));
    
    // Sync to Firebase
    set(ref(database, `boards/${boardId}/objects/${id}`), {
      ...newConnector,
      updatedAt: serverTimestamp(),
    }).then(() => {
      setOptimisticUpdates((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    }).catch(err => {
      console.error('Failed to create connector:', err);
    });

    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  const createFrame = useCallback((x, y, width = 600, height = 400, title = 'Frame', backgroundColor = null, borderColor = null) => {
    if (!user) return null;
    if (userPermission !== 'edit' && userPermission !== 'owner') {
      return null;
    }
    
    const id = generateId();
    const displayName = user.firstName || user.emailAddresses[0]?.emailAddress || 'User';
    
    const newFrame = {
      type: 'frame',
      x: Number(x) || 0,
      y: Number(y) || 0,
      width: Number(width),
      height: Number(height),
      title,
      backgroundColor: backgroundColor || 'rgba(100, 116, 139, 0.1)',
      borderColor: borderColor || '#64748b',
      createdAt: Date.now(),
      createdBy: user.id,
      createdByName: displayName,
    };

    // Optimistic create
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newFrame }));
    
    if (!deferPanRef.current) setRequestCenterView({ x: newFrame.x + newFrame.width / 2, y: newFrame.y + newFrame.height / 2 });
    
    // Log history
    logHistory('created', id, 'frame', user.id, displayName);

    // Record undo entry
    const savedFrame = { ...newFrame };
    pushUndoEntry(() => rawDelete(id), () => rawCreate(id, savedFrame));
    
    // Sync to Firebase
    // Sync to Firebase — queue in batch if active, else write immediately
    const fbFrame = { ...newFrame, updatedAt: serverTimestamp() };
    if (pendingBatchWritesRef.current !== null) {
      pendingBatchWritesRef.current[id] = fbFrame;
    } else {
      setSaveStatus('saving');
      set(ref(database, `boards/${boardId}/objects/${id}`), fbFrame).then(() => {
        setOptimisticUpdates((prev) => { const { [id]: _, ...rest } = prev; return rest; });
        setSaveStatus('saved');
      }).catch((err) => { console.error('❌ Failed to create frame:', err); setSaveStatus('error'); });
    }

    return id;
  }, [user, userPermission, boardId, logHistory, pushUndoEntry, rawDelete, rawCreate]);

  // Bring to front / send to back (by zIndex field)
  const bringToFront = useCallback((objectId) => {
    if (userPermission !== 'edit' && userPermission !== 'owner') return;
    const allObjs = objectsRef.current;
    const maxZ = Object.values(allObjs).reduce((m, o) => Math.max(m, o.zIndex || 0), 0);
    const newZ = maxZ + 1;
    setOptimisticUpdates((prev) => ({
      ...prev,
      [objectId]: { ...(allObjs[objectId] || {}), zIndex: newZ },
    }));
    update(ref(database, `boards/${boardId}/objects/${objectId}`), { zIndex: newZ }).catch(() => {});
  }, [userPermission, boardId]);

  const sendToBack = useCallback((objectId) => {
    if (userPermission !== 'edit' && userPermission !== 'owner') return;
    const allObjs = objectsRef.current;
    const minZ = Object.values(allObjs).reduce((m, o) => Math.min(m, o.zIndex || 0), 0);
    const newZ = minZ - 1;
    setOptimisticUpdates((prev) => ({
      ...prev,
      [objectId]: { ...(allObjs[objectId] || {}), zIndex: newZ },
    }));
    update(ref(database, `boards/${boardId}/objects/${objectId}`), { zIndex: newZ }).catch(() => {});
  }, [userPermission, boardId]);

  // Duplicate a single object (for context menu)
  const duplicateObject = useCallback((objectId) => {
    const obj = objectsRef.current[objectId];
    if (!obj || userPermission === 'view') return null;
    const newId = generateId();
    const newObj = { ...obj, x: obj.x + 20, y: obj.y + 20, updatedAt: Date.now() };
    setOptimisticUpdates((prev) => ({ ...prev, [newId]: newObj }));
    setSelectedIds(new Set([newId]));
    const savedObj = { ...newObj };
    pushUndoEntry(() => rawDelete(newId), () => rawCreate(newId, savedObj));
    set(ref(database, `boards/${boardId}/objects/${newId}`), { ...newObj, updatedAt: serverTimestamp() }).catch(() => {});
    return newId;
  }, [userPermission, boardId, pushUndoEntry, rawDelete, rawCreate]);

  // Dev-only: window.devAddObjects(n) to add n random objects scattered around viewport center
  useEffect(() => {
    const SHAPE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
    const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#FDE68A'];
    const SHAPE_TYPES = ['rectangle', 'circle', 'oval', 'line'];
    const SPACING = 100;

    window.devAddObjects = function devAddObjects(n) {
      const count = Math.max(0, Math.min(Number(n) || 10, 500));
      if (count === 0) {
        console.warn('devAddObjects: count 0, no objects added.');
        return;
      }
      const center = viewportCenterRef.current || { x: 0, y: 0 };
      const spread = Math.sqrt(count) * SPACING;
      let created = 0;
      setDeferPan(true);
      for (let i = 0; i < count; i++) {
        const x = center.x + (Math.random() - 0.5) * 2 * spread;
        const y = center.y + (Math.random() - 0.5) * 2 * spread;
        const isSticky = Math.random() < 0.25;
        if (isSticky) {
          const w = 120 + Math.random() * 60;
          const h = 90 + Math.random() * 50;
          const color = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
          if (createStickyNote(`Note ${i + 1}`, x, y, color, w, h)) created++;
        } else {
          const type = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
          const w = type === 'line' ? 80 + Math.random() * 80 : 60 + Math.random() * 60;
          const h = type === 'line' ? 12 : 60 + Math.random() * 40;
          const color = SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)];
          if (createShape(type, x, y, w, h, color)) created++;
        }
      }
      setDeferPan(false);
      if (created === 0) {
        console.warn('devAddObjects: 0 objects created. Sign in and ensure you have edit/owner access on this board.');
      } else {
        console.log(`devAddObjects: created ${created} objects around (${Math.round(center.x)}, ${Math.round(center.y)}).`);
      }
    };

    return () => {
      delete window.devAddObjects;
    };
  }, [createShape, createStickyNote, setDeferPan]);

  // ── Batch write helpers ────────────────────────────────────────────────────
  // Call startBatch() before a sequence of creates, then flushBatch() after.
  // All create* calls between them emit a single multi-path Firebase update()
  // instead of N individual set() calls — significantly fewer round trips.
  const startBatch = useCallback(() => {
    pendingBatchWritesRef.current = {};
  }, []);

  const flushBatch = useCallback(() => {
    const writes = pendingBatchWritesRef.current;
    pendingBatchWritesRef.current = null;
    if (!writes || Object.keys(writes).length === 0) return;
    setSaveStatus('saving');
    update(ref(database, `boards/${boardId}/objects`), writes)
      .then(() => setSaveStatus('saved'))
      .catch((err) => { console.error('Batch write failed:', err); setSaveStatus('error'); });
  }, [boardId]);

  const value = {
    boardId,
    objects,
    getBoardState,
    cursors,
    presence,
    stageRef,
    editingNoteId,
    setEditingNoteId,
    followUserId,
    setFollowUserId,
    selectedIds,
    setSelectedIds,
    toggleSelection,
    clearSelection,
    deleteSelectedObjects,
    duplicateSelectedObjects,
    duplicateObject,
    copySelectedObjects,
    pasteObjects,
    createStickyNote,
    createShape,
    createTextBox,
    createArrow,
    createImage,
    createKanban,
    createTable,
    createCodeBlock,
    createEmbed,
    createMindMapNode,
    createConnector,
    createFrame,
    connectorStyle,
    setConnectorStyle,
    snapToGrid,
    setSnapToGrid,
    moveObjectLocal,
    moveObjectGroupLocal,
    updateObjectLocal,
    moveObject,
    moveObjectGroup,
    updateObject,
    resizeObject,
    deleteObject,
    clearBoard,
    groupObjects,
    ungroupObjects,
    updateCursor,
    setOnline,
    activeEdits,
    startEditing,
    stopEditing,
    history,
    userPermission,
    requestCenterView,
    setRequestCenterView,
    setDeferPan,
    viewportCenterRef,
    // New: active tool for click-to-place
    activeTool,
    setActiveTool,
    // New: undo / redo
    undo,
    redo,
    canUndo,
    canRedo,
    beginMoveUndo,
    // New: z-order
    bringToFront,
    sendToBack,
    // Batch write helpers for AI bulk creation
    startBatch,
    flushBatch,
    // True once the first Firebase objects snapshot has arrived
    objectsLoaded,
    // AI lock — who is currently generating AI content on this board
    aiLock,
    // Update arbitrary fields on the current user's presence entry
    updatePresenceField,
  };

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard() {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error('useBoard must be used within BoardProvider');
  }
  return context;
}
