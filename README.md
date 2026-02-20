# CollabBoard

A real-time collaborative whiteboard application built with React, Firebase Realtime Database, Clerk Authentication, and Konva.

## ✨ Features

### Core Functionality
- 🎨 **Infinite Canvas** - Pan and zoom (0.1% to 400%)
- 📝 **Sticky Notes** - Create, edit, move, resize, and delete with custom fonts/colors
- 🔷 **Shapes** - Rectangles, circles, ovals, and lines
- 🎯 **Smart Selection** - Click, Shift+click, or Shift+drag area to select
- 📋 **Copy/Paste** - Cmd/Ctrl+C and Cmd/Ctrl+V
- 🔄 **Duplicate** - Cmd/Ctrl+D to duplicate selection
- ⌨️ **Rich Keyboard Shortcuts** - 15+ shortcuts for everything
- 🎨 **Properties Panel** - Customize colors, fonts, sizes, opacity

### Real-Time Collaboration
- 👥 **Multiplayer Cursors** - See other users' cursors in real-time (60fps)
- 🎨 **Unique Colors** - Each user gets a unique cursor color
- 👁️ **Follow Mode** - Click a user's name to follow their cursor
- 📡 **Live Presence** - See who's online in the sidebar
- ⚡ **Optimistic Updates** - Instant local feedback
- 🔄 **Real-Time Sync** - Changes sync across all users

### Performance
- 🚀 **60 FPS** on boards with 1000+ objects
- ⚡ **Viewport Culling** - Only renders visible objects (10-20x FPS boost)
- 📝 **Drag Throttling** - 50ms Firebase writes (95% reduction)
- 🎯 **Optimistic Updates** - 0ms perceived latency
- 🔍 **2x Faster Zoom** - Scroll speed increased
- 🔌 **Connection Monitoring** - Shows reconnecting status
- 💾 **Auto-Save Indicator** - "Saved" / "Saving..." status

### Authentication
- 🔐 **Clerk Authentication** - Secure, modern auth
- 📧 **Email/Password** login
- 🔗 **Google OAuth** integration
- 🐙 **GitHub OAuth** integration
- 🎨 **Beautiful auth UI** with dark theme

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Firebase account (for Realtime Database)
- Clerk account (for Authentication)

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd collabboard
   npm install
   ```

2. **Set up Firebase** (for Realtime Database):
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project or use existing one
   - Enable **Realtime Database**
   - Copy your Firebase config
   - Update `.env.local` with your Firebase credentials

3. **Set up Clerk** (for Authentication):
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Create a new application
   - Enable email/password, Google, and GitHub providers
   - Copy your Publishable Key
   - Update `.env.local`:
     ```
     VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
     ```
   - See [CLERK_SETUP_GUIDE.md](./CLERK_SETUP_GUIDE.md) for detailed instructions

4. **Start development server**:
   ```bash
   npm run dev
   ```
   To use the **AI Assistant** locally: run `cd functions && npm install` once from the project root, then start with `npm run dev:all` instead of `npm run dev` so the Firebase Functions emulator runs. See [AI_ASSISTANT_SETUP.md](./AI_ASSISTANT_SETUP.md) for details.

5. **Open in browser**:
   ```
   http://localhost:5173
   ```

---

## 🔧 Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Firebase Configuration (Realtime Database)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Clerk Configuration (Authentication)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
```

---

## 📦 Tech Stack

- **Frontend**: React 18, Vite
- **Canvas**: Konva, React-Konva
- **Authentication**: Clerk
- **Database**: Firebase Realtime Database
- **Styling**: CSS (custom dark theme)
- **Deployment**: Firebase Hosting

---

## 🎮 Usage

### Creating Objects
- Click **+ Sticky Note** to create a sticky note
- Click **+ Rectangle** to create a rectangle
- Click **+ Circle** to create a circle
- Click **+ Line** to create a line

### Editing
- **Double-click** a sticky note to edit text
- **Drag** to move objects
- **Click** to select (shows resize handles)
- **Shift+click** to multi-select

### Keyboard Shortcuts
**Zoom & Navigation:**
- `1` - Jump to 100% zoom
- `2` - Jump to 200% zoom
- `0` - Fit all objects in view
- `+` / `-` - Zoom in/out 25%

**Selection & Editing:**
- Click - Select object
- `Shift+Click` - Multi-select
- `Shift+Drag` - Area selection rectangle
- `Cmd/Ctrl+A` - Select all
- Double-click - Edit text (sticky notes)

**Operations:**
- `Delete` or `Backspace` - Delete selected
- `Cmd/Ctrl+D` - Duplicate
- `Cmd/Ctrl+C` / `V` - Copy/Paste
- `Cmd/Ctrl+Shift+Delete` - Clear entire board
- `Escape` - Exit editing

### Navigation
- **Drag canvas** to pan
- **Mouse wheel** to zoom
- **Click user name** in presence panel to follow their cursor

---

## 🏗️ Project Structure

```
collabboard/
├── src/
│   ├── components/
│   │   ├── Canvas.jsx              # Main canvas with Konva Stage
│   │   ├── StickyNote.jsx          # Sticky note component
│   │   ├── BoardShape.jsx          # Shape component (rect/circle/line)
│   │   ├── CursorOverlay.jsx       # Multiplayer cursors
│   │   ├── PresencePanel.jsx       # Online users list
│   │   ├── Toolbar.jsx             # Create object buttons
│   │   ├── SignInPage.jsx          # Clerk sign-in page
│   │   ├── SignUpPage.jsx          # Clerk sign-up page
│   │   ├── ConnectionStatus.jsx    # Network status indicator
│   │   └── ErrorBoundary.jsx       # Error handling
│   ├── context/
│   │   └── BoardContext.jsx        # Board state management
│   ├── lib/
│   │   └── firebase.js             # Firebase configuration
│   ├── App.jsx                     # Main app component
│   ├── main.jsx                    # Entry point with ClerkProvider
│   └── App.css                     # Styles
├── .env.local                      # Environment variables
├── firebase.json                   # Firebase hosting config
├── database.rules.json             # Firebase database rules
├── CLERK_SETUP_GUIDE.md           # Detailed Clerk setup instructions
└── AUDIT_REPORT.md                # Feature audit report
```

---

## 🚀 Deployment

### Build for production:
```bash
npm run build
```

### Deploy to Firebase:
```bash
firebase login
firebase deploy
```

Your app will be live at:
- `https://your-project.web.app`
- `https://your-project.firebaseapp.com`

---

## 🔒 Security

### Firebase Database Rules
The app uses simple authentication rules:
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

For production, consider more granular rules.

### Clerk Security Features
- Secure session management
- OAuth integration
- Automatic HTTPS
- CSRF protection
- See [Clerk Security Docs](https://clerk.com/docs/security/overview)

---

## 📈 Performance Optimizations

- ✅ Optimistic updates for instant UI feedback
- ✅ Throttled cursor updates (60fps)
- ✅ Debounced text updates (300ms)
- ✅ Memoized Firebase refs
- ✅ Efficient re-render prevention
- ✅ Konva canvas rendering

---

## 🐛 Known Limitations

- **Multi-board support** not implemented (single board only)
- **Rotation** not implemented
- **Connectors/arrows** not implemented  
- **Frames/grouping** not implemented
- **Undo/redo** not implemented
- **Export** (PDF, PNG) not implemented

See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for full feature status.

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - User guide with all shortcuts
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Feature completion status
- **[PERFORMANCE.md](./PERFORMANCE.md)** - Benchmarks and optimization details
- **[CLERK_SETUP_GUIDE.md](./CLERK_SETUP_GUIDE.md)** - Clerk authentication setup
- **[AUDIT_REPORT.md](./AUDIT_REPORT.md)** - Initial feature audit
- **[LATEST_CHANGES.md](./LATEST_CHANGES.md)** - Recent changes log

---

## 📝 License

MIT

---

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

---

## 📞 Support

For issues or questions:
- Check [CLERK_SETUP_GUIDE.md](./CLERK_SETUP_GUIDE.md) for auth setup
- Check [AUDIT_REPORT.md](./AUDIT_REPORT.md) for feature details
- Open an issue on GitHub

---

**Built with ❤️ using React, Firebase, Clerk, and Konva**
