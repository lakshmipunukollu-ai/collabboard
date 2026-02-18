# CollabBoard - Quick Start Guide

## 🎨 **Creating Objects**

| Button | Shortcut | What It Does |
|--------|----------|--------------|
| 📝 Sticky Note | - | Creates note at viewport center |
| ◻️ Rectangle | - | Creates rectangle at viewport center |
| ⭕ Circle | - | Creates circle at viewport center |
| ➖ Line | - | Creates line at viewport center |
| ⭕ Oval | - | Creates oval at viewport center |

**Tip:** All new objects auto-select with blue glow - ready to drag/resize immediately!

---

## 🔍 **Zoom & Navigation**

| Shortcut | Action |
|----------|--------|
| `1` | Jump to 100% zoom |
| `2` | Jump to 200% zoom |
| `0` | Fit all objects in view |
| `+` | Zoom in 25% |
| `-` | Zoom out 25% |
| Scroll | Zoom in/out (2x faster now!) |
| Drag | Pan the canvas |

**UI:** Click zoom buttons (top-right) if you prefer mouse over keyboard.

---

## ✨ **Selection & Editing**

| Action | How |
|--------|-----|
| **Select** | Click object |
| **Multi-select** | Shift + Click multiple objects |
| **Area select** | Shift + Drag rectangle |
| **Select all** | Ctrl/Cmd + A |
| **Edit text** | Double-click sticky note |
| **Customize** | Select → Properties panel (right side) opens |

**Properties you can change:**
- Colors (background, text, fill)
- Fonts (family, size)
- Opacity
- Position (X, Y)
- Size (Width, Height)

---

## 🛠️ **Object Operations**

| Shortcut | Action |
|----------|--------|
| Delete/Backspace | Delete selected |
| Ctrl+D | Duplicate selected |
| Ctrl+C | Copy selected |
| Ctrl+V | Paste |
| Ctrl+Shift+Delete | Clear entire board |

**Visual feedback:** Toast notification appears for every action!

---

## 👥 **Collaboration**

### See Who's Online:
- Click **"👥 X online"** in header
- See all users with:
  - Activity status ("Editing object" / "Viewing")
  - Last seen time ("Active now" / "2m ago")
  - Colored dot (matches their cursor)

### Concurrent Edits:
- **Orange dashed border** = someone else is editing
- **Warning toast** if you try to drag their object
- **Last-write-wins** = whoever releases drag last wins

### Track Changes:
- Click **"📜 History"** button
- See all creates/deletes with:
  - Who did it
  - When (time ago)
  - What object type
- Filter by action type

---

## 💾 **Auto-Save**

Look at header (top-left) for status:
- ✅ **"Saved Xs ago"** (green) = all changes synced
- 💾 **"Saving..."** (yellow) = writes in progress
- ⚠️ **"Changes not saved"** (red) = error (check connection)

**Everything auto-saves!** No manual save button needed.

---

## 🧭 **Always Know Where You Are**

### Mode Indicator (Bottom-Left)
Shows:
- Current mode (Select, Editing, Panning, X Selected)
- Zoom percentage
- Quick tips
- Objects rendered count (with viewport culling)

---

## ⚡ **Pro Tips**

1. **Lost on the board?** Press `0` to fit all objects in view
2. **Need to select many objects?** Shift+drag a rectangle around them
3. **Want to customize?** Select any object → properties panel appears
4. **Dragging feels fast?** That's the 50ms throttling + optimistic updates!
5. **Board has 1000 objects but still smooth?** That's viewport culling!
6. **Wondering what changed?** Click History to see full audit log

---

## 🎯 **Performance**

- **Object creation:** Instant (0ms) with optimistic updates
- **Real-time sync:** 300-1000ms to other clients
- **Cursor sync:** ~50-100ms (60fps throttled)
- **Drag operations:** Smooth 60 FPS
- **Large boards:** 1000+ objects supported with viewport culling

---

## 🐛 **Troubleshooting**

### "Reconnecting..." shows:
- Check your internet connection
- Firebase may be temporarily down
- Will auto-reconnect when back online

### "Changes not saved" (red):
- Check Firebase console for errors
- Verify database rules allow writes
- Check browser console for detailed errors

### Objects not syncing:
- Open browser console (F12)
- Look for `🔌 Firebase connection: CONNECTED ✅`
- Check `📥 Firebase objects sync` logs

---

## 🚀 **Ready to Use!**

**Live URL:** https://collabboard-lakshmi.web.app

**Local dev:** http://localhost:5173/

**Invite others** to collaborate in real-time! 🎨✨

---

*Updated: Feb 18, 2026*
