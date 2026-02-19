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

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  const boardRef = useMemo(() => ref(database, `boards/${boardId}`), [boardId]);
  const firebaseObjectsRef = useMemo(() => ref(database, `boards/${boardId}/objects`), [boardId]);
  const cursorsRef = useMemo(() => ref(database, `boards/${boardId}/cursors`), [boardId]);
  const presenceRef = useMemo(() => ref(database, `boards/${boardId}/presence`), [boardId]);

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
              console.log(`🔧 Setting parentFrameId for object ${objId} -> frame ${frameId}`);
              updates[`${objId}/parentFrameId`] = frameId;
              break;
            }
          }
        }
      });
      
      if (Object.keys(updates).length > 0) {
        console.log(`🔧 Fixing ${Object.keys(updates).length} objects with missing parentFrameId`);
        await update(ref(database, `boards/${boardId}/objects`), updates);
      }
    };
    
    // Run once after a short delay to let Firebase load
    const timer = setTimeout(fixParentIds, 1000);
    return () => clearTimeout(timer);
  }, [boardId, user]);

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
    set(ref(database, `boards/${boardId}/objects/${id}`), {
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
    
    console.log(`🔷 Creating ${type} ${id} at (${newObj.x}, ${newObj.y})`);
    
    // Optimistic: add to local state immediately
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newObj }));
    
    // Auto-select the newly created object
    setSelectedIds(new Set([id]));
    
    // Log to history
    const displayName = user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Anonymous';
    logHistory('created', id, type, user.id, displayName);
    
    // Then sync to Firebase
    set(ref(database, `boards/${boardId}/objects/${id}`), {
      ...newObj,
      updatedAt: serverTimestamp(),
    }).then(() => {
      console.log(`✅ ${type} ${id} synced to Firebase`);
    });
    
    return id;
  }, [user, userPermission, boardId, logHistory]);

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
    if (userPermission !== 'edit' && userPermission !== 'owner') {
      return;
    }
    const currentObj = objectsRef.current[objectId] || {};
    
    // Check if object is being placed inside a frame
    let parentFrameId = currentObj.parentFrameId || null;
    const allObjects = objectsRef.current;
    
    // Only check frame relationship if this isn't a frame itself
    if (currentObj.type !== 'frame') {
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

  const updateObject = useCallback((objectId, payload) => {
    if (userPermission !== 'edit' && userPermission !== 'owner') {
      return;
    }
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
    const objRef = ref(database, `boards/${boardId}/objects/${objectId}`);
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
  }, [userPermission, boardId]);

  const resizeObject = useCallback((objectId, width, height) => {
    if (userPermission !== 'edit' && userPermission !== 'owner') {
      return;
    }
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
    const objRef = ref(database, `boards/${boardId}/objects/${objectId}`);
    update(objRef, {
      width: Number(width),
      height: Number(height),
      updatedAt: serverTimestamp(),
    });
  }, []);

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
          console.log(`🔗 Clearing parentFrameId from orphaned child ${childId}`);
          const childRef = ref(database, `boards/${boardId}/objects/${childId}`);
          update(childRef, { parentFrameId: null });
        }
      });
    }
    
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
    remove(ref(database, `boards/${boardId}/objects/${objectId}`));
  }, [user, userPermission, boardId, logHistory, stopEditing]);

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

  const createConnector = useCallback((startObjectId, endObjectId, arrowStyle = 'straight', color = '#64748b') => {
    if (!user) return;
    if (userPermission !== 'edit' && userPermission !== 'owner') {
      return;
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
      createdAt: Date.now(),
      createdBy: user.id,
      createdByName: displayName,
    };

    // Optimistic create
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newConnector }));
    
    // Log history
    logHistory('created', id, 'connector', user.id, displayName);
    
    // Sync to Firebase
    set(ref(database, `boards/${boardId}/objects/${id}`), {
      ...newConnector,
      updatedAt: serverTimestamp(),
    }).then(() => {
      console.log(`✅ Connector ${id} synced`);
      setOptimisticUpdates((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    }).catch(err => {
      console.error('Failed to create connector:', err);
    });
  }, [user, userPermission, boardId, logHistory]);

  const createFrame = useCallback((x, y, width = 600, height = 400, title = 'Frame') => {
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
      backgroundColor: 'rgba(100, 116, 139, 0.1)',
      borderColor: '#64748b',
      createdAt: Date.now(),
      createdBy: user.id,
      createdByName: displayName,
    };

    // Optimistic create
    setOptimisticUpdates((prev) => ({ ...prev, [id]: newFrame }));
    
    // Log history
    logHistory('created', id, 'frame', user.id, displayName);
    
    // Sync to Firebase
    set(ref(database, `boards/${boardId}/objects/${id}`), {
      ...newFrame,
      updatedAt: serverTimestamp(),
    }).then(() => {
      console.log(`✅ Frame ${id} synced`);
      setOptimisticUpdates((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      setSaveStatus('saved');
    }).catch((err) => {
      console.error('❌ Failed to create frame:', err);
      setSaveStatus('error');
    });
    
    return id;
  }, [user, userPermission, boardId, logHistory]);

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
    createConnector,
    createFrame,
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
    userPermission,
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
