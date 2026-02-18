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
  set,
  update,
  remove,
  serverTimestamp,
  onDisconnect,
} from 'firebase/database';
import { database } from '../lib/firebase';
import { setSaveStatus } from '../components/AutoSaveIndicator';

const BoardContext = createContext(null);

const BOARD_ID = 'default';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function logHistory(action, objectId, objectType, userId, displayName) {
  const timestamp = Date.now();
  const historyEntry = {
    action, // 'created', 'updated', 'deleted', 'moved', 'resized'
    objectId,
    objectType,
    userId,
    displayName,
    timestamp,
  };
  
  set(ref(database, `boards/${BOARD_ID}/history/${timestamp}`), historyEntry).catch(err => {
    console.error('Failed to log history:', err);
  });
}

export function BoardProvider({ children }) {
  const { user } = useUser();
  const stageRef = useRef(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  // Firebase state: what the server has
  const [firebaseObjects, setFirebaseObjects] = useState({});
  // Optimistic updates: local pending changes
  const [optimisticUpdates, setOptimisticUpdates] = useState({});
  const [cursors, setCursors] = useState({});
  const [presence, setPresence] = useState({});
  const [followUserId, setFollowUserId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Track which objects are being edited by which user
  const [activeEdits, setActiveEdits] = useState({}); // { objectId: { userId, timestamp } }
  const [history, setHistory] = useState([]); // Change history

  // Merge Firebase state with optimistic updates
  // Firebase always wins when it has an object; optimistic only for pending creates
  const objects = useMemo(() => {
    return { ...optimisticUpdates, ...firebaseObjects };
  }, [firebaseObjects, optimisticUpdates]);

  // Keep a ref to merged objects for use in callbacks without triggering re-renders
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  // Memoize Firebase refs so they're stable across renders
  const boardRef = useMemo(() => ref(database, `boards/${BOARD_ID}`), []);
  const firebaseObjectsRef = useMemo(() => ref(database, `boards/${BOARD_ID}/objects`), []);
  const cursorsRef = useMemo(() => ref(database, `boards/${BOARD_ID}/cursors`), []);
  const presenceRef = useMemo(() => ref(database, `boards/${BOARD_ID}/presence`), []);

  const cursorRef = useMemo(
    () => (user ? ref(database, `boards/${BOARD_ID}/cursors/${user.id}`) : null),
    [user]
  );
  const userPresenceRef = useMemo(
    () => (user ? ref(database, `boards/${BOARD_ID}/presence/${user.id}`) : null),
    [user]
  );
  const historyRef = useMemo(() => ref(database, `boards/${BOARD_ID}/history`), []);

  useEffect(() => {
    console.log('🔥 Firebase: Setting up real-time listeners...');
    
    let lastLogTime = 0;
    const unsubObjects = onValue(firebaseObjectsRef, (snapshot) => {
      const val = snapshot.val() ?? {};
      
      // Only log occasionally to avoid console spam
      const now = Date.now();
      if (now - lastLogTime > 1000) {
        console.log(`📥 Firebase objects sync (${Object.keys(val).length} objects)`);
        lastLogTime = now;
      }
      
      // Firebase is source of truth
      setFirebaseObjects(val);
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
      console.log(`🖱️ Firebase cursors update (${Object.keys(val).length} cursors)`);
      setCursors(val);
    });
    
    const unsubPresence = onValue(presenceRef, (snapshot) => {
      const val = snapshot.val() || {};
      console.log(`👥 Firebase presence update (${Object.keys(val).length} users online)`);
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
    
    console.log('✅ Firebase: All listeners active');
    
    return () => {
      console.log('🔌 Firebase: Cleaning up listeners');
      unsubObjects();
      unsubCursors();
      unsubPresence();
      unsubHistory();
    };
  }, [firebaseObjectsRef, cursorsRef, presenceRef, historyRef]); // Refs are memoized so this only runs once

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
    
    console.log(`📝 Creating sticky note ${id} at (${newObj.x}, ${newObj.y})`);
    
    // Optimistic: add to local state immediately
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    
    // Auto-select the newly created object
    setSelectedIds(new Set([id]));
    
    // Log to history
    const displayName = user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Anonymous';
    logHistory('created', id, 'sticky note', user.id, displayName);
    
    // Then sync to Firebase
    setSaveStatus('saving');
    set(ref(database, `boards/${BOARD_ID}/objects/${id}`), {
      ...newObj,
      updatedAt: serverTimestamp(),
    })
      .then(() => {
        console.log(`✅ Sticky note ${id} synced to Firebase`);
        setSaveStatus('saved');
      })
      .catch((err) => {
        console.error('❌ Failed to create sticky note:', err);
        setSaveStatus('error');
      });
    
    return id;
  }, [user]);

  const createShape = useCallback((type, x, y, width, height, color = '#6366F1') => {
    if (!user) return null;
    
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
    
    console.log(`🔷 Creating ${type} ${id} at (${newObj.x}, ${newObj.y})`);
    
    // Optimistic: add to local state immediately
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    
    // Auto-select the newly created object
    setSelectedIds(new Set([id]));
    
    // Log to history
    const displayName = user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Anonymous';
    logHistory('created', id, type, user.id, displayName);
    
    // Then sync to Firebase
    set(ref(database, `boards/${BOARD_ID}/objects/${id}`), {
      ...newObj,
      updatedAt: serverTimestamp(),
    }).then(() => {
      console.log(`✅ ${type} ${id} synced to Firebase`);
    });
    
    return id;
  }, [user]);

  const startEditing = useCallback((objectId) => {
    if (!user) return;
    setActiveEdits((prev) => ({
      ...prev,
      [objectId]: { userId: user.id, timestamp: Date.now() },
    }));
  }, [user]);

  const stopEditing = useCallback((objectId) => {
    setActiveEdits((prev) => {
      const next = { ...prev };
      delete next[objectId];
      return next;
    });
  }, []);

  const moveObject = useCallback((objectId, x, y) => {
    const currentObj = objectsRef.current[objectId] || {};
    
    // Optimistic: update position immediately in local state
    setOptimisticUpdates((prev) => ({
      ...prev,
      [objectId]: {
        ...currentObj,
        x: Number(x),
        y: Number(y),
        updatedAt: Date.now(),
      },
    }));
    
    // Then sync to Firebase
    const objRef = ref(database, `boards/${BOARD_ID}/objects/${objectId}`);
    update(objRef, {
      x: Number(x),
      y: Number(y),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const updateObject = useCallback((objectId, payload) => {
    const safePayload = { ...payload };
    if (safePayload.text !== undefined) {
      safePayload.text = escapeHtml(String(safePayload.text));
    }
    
    const currentObj = objectsRef.current[objectId] || {};
    
    console.log(`✏️ Updating object ${objectId}:`, safePayload);
    
    // OPTIMISTIC: Update local state immediately for instant UI response
    setOptimisticUpdates((prev) => ({
      ...prev,
      [objectId]: {
        ...currentObj,
        ...safePayload,
        updatedAt: Date.now(),
      },
    }));
    
    // Then sync to Firebase in the background
    setSaveStatus('saving');
    const objRef = ref(database, `boards/${BOARD_ID}/objects/${objectId}`);
    const startTime = Date.now();
    update(objRef, {
      ...safePayload,
      updatedAt: serverTimestamp(),
    })
      .then(() => {
        console.log(`✅ Update synced to Firebase (${Date.now() - startTime}ms)`);
        setSaveStatus('saved');
      })
      .catch((err) => {
        console.error('❌ Update failed:', err);
        setSaveStatus('error');
      });
  }, []);

  const resizeObject = useCallback((objectId, width, height) => {
    const currentObj = objectsRef.current[objectId] || {};
    
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
    
    // Then sync to Firebase
    const objRef = ref(database, `boards/${BOARD_ID}/objects/${objectId}`);
    update(objRef, {
      width: Number(width),
      height: Number(height),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteObject = useCallback((objectId) => {
    if (!user) return;
    
    const obj = objectsRef.current[objectId];
    
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
    
    // Log to history
    if (obj) {
      const displayName = user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Anonymous';
      logHistory('deleted', objectId, obj.type, user.id, displayName);
    }
    
    // Then sync to Firebase
    remove(ref(database, `boards/${BOARD_ID}/objects/${objectId}`));
  }, [user]);

  const deleteSelectedObjects = useCallback(() => {
    selectedIds.forEach((id) => {
      deleteObject(id);
    });
    setSelectedIds(new Set());
  }, [selectedIds, deleteObject]);

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
      set(ref(database, `boards/${BOARD_ID}/objects/${newId}`), {
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
      set(ref(database, `boards/${BOARD_ID}/objects/${newId}`), {
        ...newObj,
        updatedAt: serverTimestamp(),
      });
      
      newIds.push(newId);
    });
    
    // Select the newly pasted objects
    setSelectedIds(new Set(newIds));
  }, []);

  const value = {
    objects,
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
    copySelectedObjects,
    pasteObjects,
    createStickyNote,
    createShape,
    moveObject,
    updateObject,
    resizeObject,
    deleteObject,
    updateCursor,
    setOnline,
    activeEdits,
    startEditing,
    stopEditing,
    history,
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
