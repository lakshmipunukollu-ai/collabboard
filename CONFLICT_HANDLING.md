# Conflict Handling Strategy

## Overview
CollabBoard uses a **Last-Write-Wins** (LWW) strategy for handling concurrent edits in real-time collaboration. This is a simple, effective approach that prioritizes real-time responsiveness over complex conflict resolution.

## Strategy: Last-Write-Wins

### How It Works
When multiple users edit the same object simultaneously:
1. Each user's changes are immediately reflected in their local UI (optimistic updates)
2. Changes are written to Firebase Realtime Database
3. The last write to Firebase becomes the source of truth
4. All users receive the final state through Firebase's real-time sync

### Visual Feedback
When a user attempts to edit an object that another user is actively editing:

**Visual Indicators:**
- **Orange Border** (`#F59E0B`) appears around the object
- **Dashed Border** pattern (10px dash, 5px gap) for clear distinction
- **Increased Stroke Width** (3px) makes the conflict state highly visible
- **Toast Notification** displays: "⚠️ [User Name] is editing this"

**Implementation:**
```javascript
// Conflict detection
const activeEdit = activeEdits[id];
const isBeingEditedByOther = activeEdit && activeEdit.userId !== user?.id;

// Visual styling
stroke={isBeingEditedByOther ? '#F59E0B' : normalStroke}
strokeWidth={isBeingEditedByOther ? 3 : normalWidth}
dash={isBeingEditedByOther ? [10, 5] : undefined}
```

## Edit Tracking

### activeEdits State
The `BoardContext` maintains an `activeEdits` state object:
```javascript
activeEdits = {
  [objectId]: {
    userId: 'user-123',
    timestamp: Date.now()
  }
}
```

### Edit Lifecycle
1. **Start Editing** (`onDragStart`, `onTransformStart`):
   - Call `startEditing(objectId)`
   - Adds entry to `activeEdits` with current user ID

2. **During Editing**:
   - Throttled position/size updates (50ms intervals)
   - Optimistic local updates for instant feedback
   - Background sync to Firebase

3. **Stop Editing** (`onDragEnd`, `onTransformEnd`):
   - Call `stopEditing(objectId)`
   - Removes entry from `activeEdits`

## Edge Cases & Handling

### 1. Object Deleted During Edit
**Scenario:** User A is editing an object, User B deletes it.

**Handling:**
- Firebase removes the object
- User A's edit attempts fail silently (object no longer exists)
- User A sees object disappear in real-time via Firebase sync
- No error shown (intentional - deletion takes precedence)

**Code:**
```javascript
// Delete operations don't check for active edits
const deleteObject = (objectId) => {
  remove(ref(database, `boards/${boardId}/objects/${objectId}`));
  stopEditing(objectId); // Clean up edit state
};
```

### 2. Concurrent Object Creation
**Scenario:** Multiple users create objects at the same position/time.

**Handling:**
- Each object gets a unique ID: `${Date.now()}-${Math.random()}`
- All objects persist (no conflict)
- Users can manually move/delete overlapping objects
- This is **acceptable** for collaborative whiteboards

### 3. Network Reconnection
**Scenario:** User loses connection, makes edits offline, then reconnects.

**Handling:**
- **Optimistic updates** remain in local state during disconnection
- On reconnection, Firebase syncs latest server state
- User's offline changes are **lost** (last-write-wins)
- Firebase's `onDisconnect()` cleans up presence/cursor data

**Code:**
```javascript
useEffect(() => {
  // Presence cleanup on disconnect
  onDisconnect(userPresenceRef).update({
    online: false,
    lastSeen: serverTimestamp()
  });

  // Remove cursor when user disconnects
  if (cursorRef) {
    onDisconnect(cursorRef).remove();
  }
}, []);
```

### 4. Text Editing Conflicts (Sticky Notes)
**Scenario:** Two users edit text in the same sticky note.

**Handling:**
- **300ms debounce** on text changes before Firebase write
- Last user to finish typing (stop editing) wins
- No character-level merge (not a text editor)
- Visual feedback shows who is editing

**Code:**
```javascript
// In StickyNoteEditOverlay.jsx
const debouncedUpdate = useCallback(
  debounce((newText) => {
    updateObject(noteId, { text: newText });
  }, 300),
  [noteId, updateObject]
);
```

### 5. Transform Conflicts (Resize/Rotate)
**Scenario:** Multiple users resize or rotate the same object.

**Handling:**
- Last transform to complete wins
- Final position/size/rotation sync from Firebase
- Optimistic updates prevent visual lag during transform
- Toast notification alerts users to concurrent edits

## Performance Considerations

### Throttling Strategy
**Drag/Move Operations:** 50ms throttle
- Reduces Firebase writes during continuous drag
- Final position always synced on drag end

**Cursor Broadcasting:** 16ms throttle (60fps)
- Smooth cursor movement for other users
- Minimal Firebase bandwidth usage

**Text Changes:** 300ms debounce
- Prevents excessive writes during typing
- Last typed value always saved

### Optimistic Updates
All CRUD operations use optimistic updates:
```javascript
// 1. Update local state immediately
setOptimisticUpdates(prev => ({ ...prev, [id]: newObject }));

// 2. Sync to Firebase in background
set(ref(database, path), newObject);

// 3. Firebase sync clears optimistic state
```

**Benefits:**
- Zero perceived latency for local user
- Responsive UI even with slow network
- Firebase sync ensures consistency

## Testing Conflict Scenarios

### Manual Testing Procedure
1. Open board in 2+ browser windows (different users)
2. **Test 1:** Both users drag the same sticky note
   - ✓ Orange border appears
   - ✓ Toast shows other user's name
   - ✓ Last user to release drag wins

3. **Test 2:** User A edits text, User B deletes note
   - ✓ Note disappears for User A
   - ✓ User A's text changes are lost

4. **Test 3:** Users create notes at same position
   - ✓ Both notes appear (stacked)
   - ✓ No conflict error

5. **Test 4:** User disconnects, edits, reconnects
   - ✓ Offline edits are discarded
   - ✓ Firebase state restored

## Future Enhancements (Not Implemented)

### Potential Improvements:
1. **Object Locking:** First user to start editing locks object
2. **Operational Transform:** Merge text edits character-by-character
3. **Undo/Redo:** Version history with rollback
4. **Conflict Resolution UI:** Show diff view, let user choose version
5. **Offline Queue:** Persist changes during disconnect, sync on reconnect

### Why Not Implemented Now:
- **Simplicity:** LWW is easy to understand and debug
- **MVP Scope:** Complex conflict resolution not required for whiteboard
- **Performance:** LWW has minimal overhead
- **User Behavior:** Users naturally coordinate ("I'll move this, you move that")

## Related Components

### Files Implementing Conflict Handling:
- `src/context/BoardContext.jsx` - Edit tracking (`activeEdits` state)
- `src/components/StickyNote.jsx` - Visual feedback, drag handlers
- `src/components/BoardShape.jsx` - Visual feedback, transform handlers
- `src/components/Toast.jsx` - Conflict notifications

### Key Functions:
- `startEditing(objectId)` - Mark object as being edited
- `stopEditing(objectId)` - Release editing lock
- `isBeingEditedByOther` - Boolean check for conflict state

## Conclusion

CollabBoard's Last-Write-Wins strategy provides:
✅ Real-time collaboration without blocking
✅ Clear visual feedback for concurrent edits
✅ Simple, predictable behavior
✅ High performance (optimistic updates + throttling)

The approach is **appropriate for a collaborative whiteboard** where:
- Users can see each other's actions in real-time
- Object-level conflicts are rare (large canvas, many objects)
- Text edits are short-lived (sticky notes, not documents)
- Losing an edit is recoverable (just redo it)

For text-heavy or mission-critical applications, consider implementing Operational Transform (OT) or Conflict-free Replicated Data Types (CRDTs) instead.
