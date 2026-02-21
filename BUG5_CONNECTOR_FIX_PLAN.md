# BUG 5 — Connector / Connection System Fix Plan

## Current State Analysis

### What exists today

| File | Role | Status |
|------|------|--------|
| `src/components/Connector.jsx` | Renders the Konva `<Arrow>` between two objects | Partially working |
| `src/components/ConnectionPorts.jsx` | Renders 4 blue port circles on hover | Working |
| `src/components/ConnectorToolbar.jsx` | Floating DOM toolbar for style/color/label/delete | Working |
| `src/components/Canvas.jsx` | Hover detection, port handlers, rubber-band preview, toolbar positioning | Partially working |
| `src/context/BoardContext.jsx` | `createConnector`, `deleteObject` (cascade), `moveObject` | Partially working |

### What already works correctly

1. **Data model** — Connectors store `startObjectId` + `endObjectId` (object IDs, not raw coordinates). This is the correct architecture.
2. **Cascade delete** — `deleteObject` in BoardContext already removes all connectors attached to a deleted object.
3. **Connection ports** — Hovering an object shows 4 blue port circles. Dragging from one port to another creates a connector.
4. **Rubber-band preview** — While dragging from a port, a dashed arrow follows the cursor.
5. **Floating toolbar** — Clicking a connector shows a toolbar with style, color, label, and delete buttons.
6. **Connector rendering** — `Connector.jsx` reads live `objects[startObjectId]` and `objects[endObjectId]` from context on every render, so points are recalculated when state changes.
7. **Viewport culling** — Connectors are exempt from culling (`if (obj.type === 'connector') return true`).

### What is broken

#### Bug A — Connectors don't follow objects during frame drag (lag/float)

**Root cause:** `Frame.jsx` throttles `moveObject` calls for children to every 50ms. Between throttle ticks, the Konva `<Group>` node moves visually but the React state positions of children haven't updated yet. Since `Connector.jsx` reads positions from React state (not from Konva nodes), the connector lags 0-50ms behind during drag and appears to "float" or "disconnect".

**Why it looks completely broken:** During a frame drag, the connector visually stays at the old position for up to 50ms at a time, creating a jarring rubber-banding effect. On slow machines or with many objects, this is even worse.

#### Bug B — `parentFrameId` gets corrupted during frame drag

**Root cause:** When `moveObject` is called for frame children during drag, it re-evaluates which frame contains them using the frame's *current React state position* — which hasn't been updated yet (the frame Konva node moved, but `moveObject` for the frame fires in the same throttle batch or later). So the children's new positions appear to be *outside* the old frame boundary, and `parentFrameId` is set to `null`. On the next frame drag, those children are no longer detected as frame children.

#### Bug C — Fixed port orientation after creation

**Root cause:** Connectors store `startPort: 'right'` and `endPort: 'left'` at creation time. After objects move to different relative positions (e.g., object A moves below object B), those ports don't update. The connector draws from the wrong edge, making it look disconnected or crossing through the object.

---

## Fix Plan — Step by Step

### Step 1: Add auto-port selection to `Connector.jsx`

**File:** `src/components/Connector.jsx`

**What:** Replace the fixed `startPort`/`endPort` lookup with a dynamic `getBestPort(startObj, endObj)` function that picks the optimal port pair on every render based on the relative positions of the two objects.

**Algorithm:**
```
1. Compute center of startObj and center of endObj
2. Calculate angle between centers
3. If |dx| > |dy| (horizontal dominant):
   - If endObj is to the right: startPort = 'right', endPort = 'left'
   - If endObj is to the left: startPort = 'left', endPort = 'right'
4. If |dy| >= |dx| (vertical dominant):
   - If endObj is below: startPort = 'bottom', endPort = 'top'
   - If endObj is above: startPort = 'top', endPort = 'bottom'
```

**Why:** This makes the connector always anchor to the closest edge, just like Miro. The stored `startPort`/`endPort` values are ignored in favor of dynamic calculation. The `useMemo` dependency changes from `[startObj, endObj, arrowStyle, startPort, endPort]` to `[startObj, endObj, arrowStyle]` — it recomputes whenever either object's position/size changes.

**Risk:** Low. This is a pure rendering change — no data model change needed. Existing connectors in Firebase still work because we're just ignoring the stored port values.

---

### Step 2: Add `moveObjectLocal` to BoardContext for real-time local updates

**File:** `src/context/BoardContext.jsx`

**What:** Add a new function `moveObjectLocal(objectId, x, y)` that:
- Only updates `optimisticUpdates` (local React state)
- Does NOT write to Firebase
- Does NOT apply snap-to-grid
- Does NOT recalculate `parentFrameId`
- Is extremely cheap to call on every drag frame

**Why:** This gives Frame's `handleDragMove` a way to update children positions in React state on *every* Konva drag event (60fps), so connectors re-render in real-time. The actual Firebase write + frame detection still happens in the throttled `moveObject` call.

**Signature:**
```js
const moveObjectLocal = useCallback((objectId, x, y) => {
  setOptimisticUpdates((prev) => ({
    ...prev,
    [objectId]: {
      ...(objectsRef.current[objectId] || {}),
      x: Number(x),
      y: Number(y),
      updatedAt: Date.now(),
    },
  }));
}, []);
```

Expose it in the context `value` object.

---

### Step 3: Update Frame drag to use `moveObjectLocal` for real-time feedback

**File:** `src/components/Frame.jsx`

**What:** Change `handleDragMove` so that:
1. On *every* Konva drag event (not just throttle ticks): call `moveObjectLocal` for the frame and all its children. This updates React state immediately, so connectors re-render on the same frame.
2. Keep the existing 50ms throttle for `moveObject` (Firebase writes), but pass `{ skipFrameDetection: true }` (Step 4) so `parentFrameId` isn't corrupted mid-drag.
3. `handleDragEnd` still calls `moveObject` for the final position (with `skipFrameDetection: true` for children).

**Changes to `handleDragMove`:**
```js
const handleDragMove = (e) => {
  const newX = e.target.x();
  const newY = e.target.y();
  lastDragPosRef.current = { x: newX, y: newY };

  // Update local state immediately for EVERY drag event (connectors re-render in real-time)
  const start = dragStartRef.current;
  if (start) {
    const totalDX = newX - start.frameX;
    const totalDY = newY - start.frameY;
    Object.entries(start.children).forEach(([childId, childStart]) => {
      moveObjectLocal(childId, childStart.x + totalDX, childStart.y + totalDY);
    });
  }
  moveObjectLocal(id, newX, newY);

  // Throttle Firebase writes to once per 50ms
  if (!dragThrottleRef.current) {
    dragThrottleRef.current = setTimeout(() => {
      const latestX = lastDragPosRef.current.x;
      const latestY = lastDragPosRef.current.y;
      const s = dragStartRef.current;
      if (s) {
        const dx = latestX - s.frameX;
        const dy = latestY - s.frameY;
        Object.entries(s.children).forEach(([childId, childStart]) => {
          moveObject(childId, childStart.x + dx, childStart.y + dy, { skipFrameDetection: true });
        });
      }
      moveObject(id, latestX, latestY);
      dragThrottleRef.current = null;
    }, 50);
  }
};
```

---

### Step 4: Add `skipFrameDetection` option to `moveObject`

**File:** `src/context/BoardContext.jsx`

**What:** Change `moveObject` signature to accept an optional 4th argument `options = {}`. When `options.skipFrameDetection` is `true`, skip the entire "check if object is inside a frame" block. This prevents `parentFrameId` from being corrupted during frame drag.

**Change:**
```js
const moveObject = useCallback((objectId, x, y, options = {}) => {
  // ... permission check, snap ...

  let parentFrameId = currentObj.parentFrameId || null;

  if (!options.skipFrameDetection && currentObj.type !== 'frame') {
    // ... existing frame detection logic ...
  }

  // ... rest unchanged ...
}, []);
```

**Why:** When Frame is dragging its children, we already know they belong to this frame. Re-evaluating frame membership against stale frame positions corrupts the relationship.

---

### Step 5: Update individual object components to use `moveObjectLocal` during drag

**Files:** `StickyNote.jsx`, `BoardShape.jsx`, `TextBox.jsx`, `BoardImage.jsx`, `MindMapNode.jsx`

**What:** In each component's `handleDragMove` (if it exists) or add one:
- Call `moveObjectLocal(id, node.x(), node.y())` on every Konva drag event
- Keep `moveObjectGroup` in `handleDragEnd` for the Firebase write

**Why:** When a user drags a sticky note that has a connector, the connector should follow in real-time during drag, not just after the drag ends.

**Example pattern (for each component):**
```js
const handleDragMove = (e) => {
  moveObjectLocal(id, e.target.x(), e.target.y());
};
```

Add `moveObjectLocal` to the `useBoard()` destructure in each component.

---

### Step 6: Verify and test

**Test matrix:**

| Scenario | Expected behavior |
|----------|-------------------|
| Drag object A (connected to B) | Arrow follows A in real-time, stays anchored to closest edges |
| Drag object B (connected to A) | Arrow follows B in real-time |
| Move frame containing A and B (connected) | Arrow follows both objects, stays connected |
| Move frame containing A (connected to B outside frame) | Arrow stretches from A (inside frame) to B (outside) |
| Delete object A (connected to B) | Arrow is deleted automatically |
| Click connector to select | Floating toolbar appears above midpoint |
| Change connector style via toolbar | Arrow re-renders with new style immediately |
| Change connector color via toolbar | Arrow re-renders with new color |
| Add label via toolbar | Label appears at arrow midpoint |
| Delete connector via toolbar | Connector removed after 2-click confirm |
| Hover object → see 4 port circles | Ports appear on all 4 edges |
| Drag from port on A to port on B | Rubber-band preview, then permanent connector |
| Pan/zoom canvas | Connector stays anchored correctly |
| Multi-user: user B sees user A's moves | Connector updates in real-time via Firebase |

---

## Files Changed Summary

| File | Change type | Risk |
|------|-------------|------|
| `src/components/Connector.jsx` | Modify: add auto-port selection | Low |
| `src/context/BoardContext.jsx` | Modify: add `moveObjectLocal`, add `skipFrameDetection` to `moveObject` | Medium |
| `src/components/Frame.jsx` | Modify: use `moveObjectLocal` in `handleDragMove` | Medium |
| `src/components/StickyNote.jsx` | Modify: add `handleDragMove` with `moveObjectLocal` | Low |
| `src/components/BoardShape.jsx` | Modify: add `handleDragMove` with `moveObjectLocal` | Low |
| `src/components/TextBox.jsx` | Modify: add `handleDragMove` with `moveObjectLocal` | Low |
| `src/components/BoardImage.jsx` | Modify: add `handleDragMove` with `moveObjectLocal` | Low |
| `src/components/MindMapNode.jsx` | Modify: add `handleDragMove` with `moveObjectLocal` | Low |

**No new files needed. No Firebase data model changes. No migration needed.**

---

## Implementation Order

1. Step 1 — Auto-port in Connector.jsx (standalone, no dependencies)
2. Step 2 — Add moveObjectLocal to BoardContext
3. Step 4 — Add skipFrameDetection to moveObject (combined with Step 2 in the same file)
4. Step 3 — Update Frame.jsx to use moveObjectLocal
5. Step 5 — Update all object components to use moveObjectLocal during drag
6. Step 6 — Build, lint, test locally

Total estimated changes: ~80 lines modified across 8 files. No deletions of working code.
