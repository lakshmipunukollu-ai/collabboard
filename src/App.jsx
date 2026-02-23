import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useClerk, SignedIn, SignedOut } from '@clerk/clerk-react';
import { ref, onValue, update, set } from 'firebase/database';
import { database } from './lib/firebase';
import { BoardProvider } from './context/BoardContext';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import SignInPage from './components/SignInPage';
import SignUpPage from './components/SignUpPage';
import BoardListPage from './components/BoardListPage';
import BoardShareModal from './components/BoardShareModal';
import ConnectionStatus from './components/ConnectionStatus';
import Toast from './components/Toast';
import HelpPanel from './components/HelpPanel';
import AutoSaveIndicator from './components/AutoSaveIndicator';
import EnhancedPresence from './components/EnhancedPresence';
import AlignmentTools from './components/AlignmentTools';
import RightPanel from './components/RightPanel';
import NotificationBell from './components/NotificationBell';
import ActivityFeed from './components/ActivityFeed';
import './App.css';

// ─── Editable board title ─────────────────────────────────────────────────
function EditableTitle({ boardId, boardName, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(boardName);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(boardName); }, [boardName]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== boardName && boardId) {
      update(ref(database, `boardsMeta/${boardId}`), { name: trimmed })
        .catch(() => {});
    }
    setEditing(false);
  }, [draft, boardName, boardId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setDraft(boardName); setEditing(false); }
  };

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  if (editing && canEdit) {
    return (
      <input
        ref={inputRef}
        className="app-title-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        maxLength={60}
      />
    );
  }

  return (
    <h1
      className="app-title"
      onClick={() => canEdit && setEditing(true)}
      title={canEdit ? 'Click to rename' : boardName}
    >
      {boardName || 'CollabBoard'}
    </h1>
  );
}

// ─── Board layout ─────────────────────────────────────────────────────────
function BoardLayout({ boardId, onBackToList }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [boardName, setBoardName] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [hasAccess, setHasAccess] = useState(null);
  const [userPermission, setUserPermission] = useState('view');
  const [sidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try { return localStorage.getItem('theme') !== 'light'; }
    catch { return true; }
  });

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    try { localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); } catch {}
  }, [isDarkMode]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (!boardId || !user) return;

    const boardMetaRef = ref(database, `boardsMeta/${boardId}`);
    const unsubscribe = onValue(boardMetaRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        set(ref(database, `boardsMeta/${boardId}`), {
          name: boardId === 'default' ? 'Board 2' : 'Untitled Board',
          ownerId: user.id,
          ownerName: user.firstName || user.emailAddresses[0]?.emailAddress || 'User',
          createdAt: Date.now(),
          lastModified: Date.now(),
          sharedWith: {},
        }).catch((err) => {
          console.error('Failed to create board metadata:', err);
          setHasAccess(false);
          setBoardName('Board Not Found');
        });
        setHasAccess(true);
        setUserPermission('owner');
        setBoardName(boardId === 'default' ? 'Board 2' : 'Untitled Board');
        return;
      }

      const isOwner = data.ownerId === user.id;
      const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase();
      const sanitizedEmail = userEmail ? userEmail
        .replace(/\./g, ',').replace(/@/g, '_at_').replace(/#/g, '_hash_')
        .replace(/\$/g, '_dollar_').replace(/\[/g, '_lbracket_').replace(/\]/g, '_rbracket_')
        : null;

      const sharedById = data.sharedWith && data.sharedWith[user.id];
      const sharedByEmail = data.sharedWith && sanitizedEmail && data.sharedWith[sanitizedEmail];

      if (isOwner) {
        setHasAccess(true); setUserPermission('owner');
        setBoardName(data.name || 'Untitled Board');
      } else if (sharedById) {
        setHasAccess(true); setUserPermission(sharedById.permission || 'view');
        setBoardName(data.name || 'Untitled Board');
      } else if (sharedByEmail) {
        setHasAccess(true); setUserPermission(sharedByEmail.permission || 'view');
        setBoardName(data.name || 'Untitled Board');
      } else {
        setHasAccess(false); setUserPermission('view');
        setBoardName('Access Denied');
      }

      if (isOwner || sharedById || sharedByEmail) {
        update(ref(database, `boardsMeta/${boardId}`), { lastModified: Date.now() }).catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [boardId, user]);

  if (!isLoaded || hasAccess === null) {
    return (
      <div className="app-loading"><p>Loading…</p></div>
    );
  }

  if (hasAccess === false) {
    return (
      <div className="app-loading" style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: 16 }}>🔒 Access Denied</h2>
        <p style={{ color: '#94A3B8', marginBottom: 24 }}>
          You don't have permission to view this board.
        </p>
        <button
          onClick={onBackToList}
          style={{
            padding: '12px 24px', background: '#667eea', border: 'none',
            borderRadius: 8, color: 'white', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          ← Back to My Boards
        </button>
      </div>
    );
  }

  const canEdit = userPermission === 'edit' || userPermission === 'owner';

  return (
    <div className="app-layout">
      <ConnectionStatus />
      <Toast />
      <HelpPanel />
      <BoardShareModal boardId={boardId} isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} />

      {userPermission === 'view' && (
        <div style={{
          position: 'fixed', top: 52, left: 0, right: 0,
          background: '#fbbf24', color: '#92400e',
          padding: '8px 16px', textAlign: 'center',
          fontSize: '0.8rem', fontWeight: 600, zIndex: 1000,
        }}>
          👁️ View-only access. Contact the board owner to request edit permissions.
        </div>
      )}

      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onBackToList}
            title="Back to boards"
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', fontSize: '1.3rem',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
            }}
          >
            ←
          </button>
          <EditableTitle boardId={boardId} boardName={boardName} canEdit={canEdit} />
        </div>

        <div className="header-actions">
          <AutoSaveIndicator />
          <EnhancedPresence />
          <NotificationBell />

          {/* Dark / light mode toggle */}
          <button
            className="theme-toggle-btn"
            onClick={() => setIsDarkMode((v) => !v)}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>

          <button
            onClick={() => setIsShareModalOpen(true)}
            title="Share board"
            style={{
              padding: '6px 14px', background: '#667eea', border: 'none',
              borderRadius: 6, color: 'white', fontSize: '0.8rem',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            🔗 Share
          </button>
          <span className="user-name">
            {user?.firstName || user?.emailAddresses[0]?.emailAddress || 'User'}
          </span>
          <button type="button" className="signout-btn" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="main-content">
        <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
          <Toolbar isCollapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
        </aside>
        <main className="canvas-wrapper">
          <Canvas />
        </main>
      </div>

      <AlignmentTools />
      <RightPanel />
      <ActivityFeed />
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────
function getBoardIdFromPath(pathname) {
  const match = pathname.match(/^\/board\/([^/]+)/);
  return match ? match[1] : null;
}

export default function App() {
  // Lazy initializer reads URL once at mount — no flash to board list on hard refresh
  const [selectedBoardId, setSelectedBoardId] = useState(() =>
    getBoardIdFromPath(window.location.pathname)
  );

  // Handle browser back / forward navigation
  useEffect(() => {
    const onPopState = () => {
      setSelectedBoardId(getBoardIdFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleSelectBoard = (boardId) => {
    window.history.pushState({}, '', `/board/${boardId}`);
    setSelectedBoardId(boardId);
  };

  const handleBackToList = () => {
    window.history.pushState({}, '', '/');
    setSelectedBoardId(null);
  };

  if (window.location.pathname === '/sign-up') {
    return (
      <>
        <SignedIn>
          {selectedBoardId ? (
            <BoardProvider boardId={selectedBoardId}>
              <BoardLayout boardId={selectedBoardId} onBackToList={handleBackToList} />
            </BoardProvider>
          ) : (
            <BoardListPage onSelectBoard={handleSelectBoard} />
          )}
        </SignedIn>
        <SignedOut><SignUpPage /></SignedOut>
      </>
    );
  }

  return (
    <>
      <SignedIn>
        {selectedBoardId ? (
          <BoardProvider boardId={selectedBoardId}>
            <BoardLayout boardId={selectedBoardId} onBackToList={handleBackToList} />
          </BoardProvider>
        ) : (
          <BoardListPage onSelectBoard={handleSelectBoard} />
        )}
      </SignedIn>
      <SignedOut><SignInPage /></SignedOut>
    </>
  );
}
