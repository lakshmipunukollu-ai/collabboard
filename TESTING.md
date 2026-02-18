# CollabBoard Testing Guide

This document outlines manual testing procedures to verify optimistic updates and real-time collaboration features.

## Prerequisites

- Dev server running (`npm run dev`)
- 2-5 browser windows/tabs open (use incognito for different accounts)
- Each session signed in with a different Google account

---

## Test 1: Optimistic Sticky Note Creation

**Goal:** Verify that the creator sees their sticky note instantly, while others see it within 1-2 seconds.

### Steps:
1. Open **Window A** and **Window B** with different accounts
2. In **Window A**: Click "New Sticky Note" button in toolbar
3. **Expected in A:** Sticky note appears **immediately** (< 50ms)
4. **Expected in B:** Sticky note appears within **1-2 seconds**
5. **Verify:** Both windows show the sticky in the same position

### Pass Criteria:
- ✅ A sees instant feedback
- ✅ B receives update within 2 seconds
- ✅ Both show identical sticky note

---

## Test 2: Optimistic Move (Drag)

**Goal:** Verify that dragging feels instant for the user performing the action.

### Steps:
1. With both windows open, in **Window A**: drag a sticky note to a new position
2. **Expected in A:** Sticky follows cursor smoothly with **no lag**
3. **Expected in B:** Sticky updates to new position within **1-2 seconds**
4. **Verify:** Final position is the same in both windows

### Pass Criteria:
- ✅ A experiences smooth, instant drag (no waiting for server)
- ✅ B sees position update within 2 seconds
- ✅ Final positions match

---

## Test 3: Optimistic Text Editing

**Goal:** Verify that typing in a sticky note feels instant for the typist.

### Steps:
1. In **Window A**: double-click a sticky note to edit
2. In **Window A**: Type "Hello World" character by character
3. **Expected in A:** Each character appears **immediately** as you type
4. **Expected in B:** Text updates appear progressively as Firebase delivers them (may lag by 1-2 seconds)
5. Press Escape or click away to close editor
6. **Verify:** Both windows show "Hello World" as final text

### Pass Criteria:
- ✅ A sees every keystroke instantly (no input lag)
- ✅ B eventually receives all text updates
- ✅ Final text matches in both windows

---

## Test 4: Optimistic Delete

**Goal:** Verify that deleting an object feels instant for the user.

### Steps:
1. In **Window A**: click a sticky note to select (blue border)
2. In **Window A**: Press **Delete** or **Backspace**
3. **Expected in A:** Sticky disappears **immediately**
4. **Expected in B:** Sticky disappears within **1-2 seconds**
5. **Verify:** Sticky is gone from both windows

### Pass Criteria:
- ✅ A sees instant removal
- ✅ B sees removal within 2 seconds
- ✅ Object fully removed from board

---

## Test 5: Cursor Update Rate

**Goal:** Verify that cursor updates are smooth but not overwhelming (10 updates/sec).

### Steps:
1. In **Window A**: move mouse around the canvas in circles
2. In **Window B**: observe A's cursor (the purple pointer with name label)
3. **Expected:** 
   - Cursor moves smoothly (not jittery)
   - Updates happen ~10 times per second (not instant pixel-perfect, slight smoothing is expected)
   - No console errors about rate limiting
4. Open DevTools → Console in both windows
5. **Verify:** No Firebase errors or warnings

### Pass Criteria:
- ✅ Cursor movement looks smooth
- ✅ No excessive jitter or lag (should feel natural)
- ✅ No rate limit errors in console
- ✅ Cursor updates feel responsive but not overwhelming

---

## Test 6: Multi-User Stress Test (3-5 Users)

**Goal:** Verify that the board works correctly with 5-10 concurrent users.

### Steps:
1. Open **5 browser tabs** (use different browsers or incognito to get 5 different accounts)
2. Sign in to each with a different Google account
3. In the "Who's online" panel, verify **all 5 users appear**
4. Move mouse in each tab and verify **all 5 cursors are visible** and updating
5. In **Tab 1**: create a sticky note
6. **Expected:** All tabs show the new sticky within 2 seconds
7. In **Tab 2**: drag that sticky to a new position
8. **Expected:** All tabs update to new position within 2 seconds
9. In **Tab 3**: delete the sticky
10. **Expected:** All tabs see deletion within 2 seconds
11. In **Tab 4**: create a shape (rectangle)
12. **Expected:** All tabs show the shape within 2 seconds
13. Repeat creates, moves, deletes across different tabs
14. **Verify:** 
    - All cursors visible and moving
    - All object operations sync correctly
    - No crashes or freezes
    - Console has no errors

### Pass Criteria:
- ✅ All 5 users visible in presence panel
- ✅ All 5 cursors rendering and moving
- ✅ Create/move/delete operations sync to all tabs
- ✅ No JavaScript errors in console
- ✅ Board remains responsive throughout

---

## Test 7: Optimistic Shape Creation

**Goal:** Verify that creating rectangles also has optimistic updates.

### Steps:
1. In **Window A**: Click "New Rectangle" button
2. **Expected in A:** Rectangle appears **immediately**
3. **Expected in B:** Rectangle appears within **1-2 seconds**
4. **Verify:** Both show same rectangle

### Pass Criteria:
- ✅ A sees instant shape creation
- ✅ B receives shape within 2 seconds

---

## Test 8: Follow User Feature

**Goal:** Verify that following a user works correctly and doesn't interfere with optimistic updates.

### Steps:
1. In **Window B**: Click on user A's name (in "Who's online" or on their cursor label)
2. **Expected:** "Following: [User A]" appears with a Stop button
3. In **Window A**: move mouse around
4. **Expected in B:** Canvas pans to keep A's cursor centered
5. In **Window A**: create and move a sticky note
6. **Expected in B:** 
   - View follows A's cursor
   - Sticky note appears and moves (optimistic for A, delayed for B)
7. In **Window B**: drag the canvas (manual pan)
8. **Expected:** Follow mode automatically stops
9. **Verify:** No conflicts between follow mode and object sync

### Pass Criteria:
- ✅ Follow mode centers on user's cursor
- ✅ Object updates still sync correctly during follow
- ✅ Manual pan stops follow mode
- ✅ No visual glitches or stuttering

---

## Performance Checks

### Console Monitoring
Open DevTools → Console in all windows and watch for:
- ❌ No Firebase rate limit errors
- ❌ No React errors or warnings
- ❌ No "Maximum update depth exceeded" errors

### Network Tab
Open DevTools → Network → WS (WebSocket):
- ✅ Verify cursor writes happen ~10 times per second (100ms intervals)
- ✅ Verify object creates/moves/deletes trigger immediate writes
- ✅ WebSocket connection stays open (reconnects if needed)

### Visual Performance
- ✅ No jank or stuttering when dragging objects
- ✅ Typing in sticky notes feels responsive (no input lag)
- ✅ Cursor movements are smooth (not jumpy)

---

## Known Expected Behaviors

1. **Slight delay for remote users:** Users see their own actions instantly, but others see updates with 1-2 second network delay (this is expected)

2. **Cursor smoothing:** Cursors update 10 times per second, so there's slight interpolation between positions (this is intentional to reduce load)

3. **Last-write-wins:** If two users edit the same object simultaneously, the last edit wins (no complex merge logic)

4. **Optimistic correction:** If Firebase write fails or conflicts, the next snapshot from Firebase will correct the local state

---

## Troubleshooting

### Issue: Updates take 5-7 seconds instead of 1-2 seconds
**Check:**
1. Firebase region in Console (should be close to your location)
2. Both tabs in **foreground** (background tabs are throttled by browser)
3. Network tab: when do WebSocket messages arrive?

### Issue: Optimistic update disappears then reappears
**Cause:** Firebase write succeeded but took longer than expected  
**Solution:** This is expected; the optimistic update is replaced by server state

### Issue: Cursor not visible for other user
**Check:**
1. User moved their mouse recently (cursors only show after movement)
2. Cursor hasn't been idle for 20+ seconds (stale cursors are hidden)
3. No console errors

### Issue: Rate limit errors in console
**Cause:** Too many writes (shouldn't happen with 100ms cursor throttle)  
**Solution:** Check if multiple tabs open for same user

---

## Success Criteria Summary

All tests should pass with:
- ✅ Local user sees actions instantly (< 50ms perceived lag)
- ✅ Remote users see updates within 1-2 seconds
- ✅ Cursor writes at 10/sec (not 60/sec)
- ✅ No linter errors
- ✅ No console errors during normal operation
- ✅ Board works smoothly with 5 concurrent users
