# CollabBoard

A real-time collaborative whiteboard application built with React, Firebase Realtime Database, Clerk Authentication, and Konva.

## ✨ Features

### Core Functionality
- 🎨 **Infinite Canvas** - Pan and zoom (0.1% to 400%)
- 📝 **Sticky Notes** - Create, edit, move, resize, and delete
- 🔷 **Shapes** - Rectangles, circles, and lines
- 🎯 **Multi-Select** - Shift+click to select multiple objects
- 📋 **Copy/Paste** - Cmd/Ctrl+C and Cmd/Ctrl+V
- 🔄 **Duplicate** - Cmd/Ctrl+D to duplicate selection
- ⌨️ **Keyboard Shortcuts** - Delete/Backspace to remove objects

### Real-Time Collaboration
- 👥 **Multiplayer Cursors** - See other users' cursors in real-time (60fps)
- 🎨 **Unique Colors** - Each user gets a unique cursor color
- 👁️ **Follow Mode** - Click a user's name to follow their cursor
- 📡 **Live Presence** - See who's online in the sidebar
- ⚡ **Optimistic Updates** - Instant local feedback
- 🔄 **Real-Time Sync** - Changes sync across all users

### Performance
- 🚀 **60 FPS** cursor tracking
- ⚡ **Sub-100ms** object updates (local)
- 📝 **300ms debounce** for text editing (reduces server load)
- 🎯 **Optimistic rendering** for instant feedback
- 🔌 **Connection indicator** shows when reconnecting

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
- `Delete` or `Backspace` - Delete selected objects
- `Cmd/Ctrl+D` - Duplicate selection
- `Cmd/Ctrl+C` - Copy selection
- `Cmd/Ctrl+V` - Paste
- `Escape` - Exit text editing

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

- **Viewport culling** not implemented (all objects render)
- **Rotation** not implemented
- **Connectors/arrows** not implemented
- **Frames/grouping** not implemented
- **Undo/redo** not implemented

See [AUDIT_REPORT.md](./AUDIT_REPORT.md) for full feature status.

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
