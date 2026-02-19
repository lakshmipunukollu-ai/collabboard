import { useState, useEffect } from 'react';
import { useUser, useClerk, SignedIn, SignedOut } from '@clerk/clerk-react';
import { ref, onValue, update, set } from 'firebase/database';
import { database } from './lib/firebase';
import { BoardProvider } from './context/BoardContext';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import PresencePanel from './components/PresencePanel';
import SignInPage from './components/SignInPage';
import SignUpPage from './components/SignUpPage';
import BoardListPage from './components/BoardListPage';
import BoardShareModal from './components/BoardShareModal';
import ConnectionStatus from './components/ConnectionStatus';
import Toast from './components/Toast';
import HelpPanel from './components/HelpPanel';
import AutoSaveIndicator from './components/AutoSaveIndicator';
import EnhancedPresence from './components/EnhancedPresence';
import PropertiesPanel from './components/PropertiesPanel';
import AlignmentTools from './components/AlignmentTools';
import AIAssistant from './components/AIAssistant';
import './App.css';

function BoardLayout({ boardId, onBackToList }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [boardName, setBoardName] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [hasAccess, setHasAccess] = useState(null); // null = checking, true = has access, false = no access
  const [userPermission, setUserPermission] = useState('view'); // 'view', 'edit', or 'owner'

  useEffect(() => {
    if (!boardId || !user) return;

    // Listen to board metadata to check access and get board name
    const boardMetaRef = ref(database, `boardsMeta/${boardId}`);
    const unsubscribe = onValue(boardMetaRef, (snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        // Board metadata doesn't exist - create it (for legacy boards or 'default' board)
        console.log('Creating missing boardsMeta for:', boardId);
        set(ref(database, `boardsMeta/${boardId}`), {
          name: boardId === 'default' ? 'Board 2' : 'Untitled Board',
          ownerId: user.id,
          ownerName: user.firstName || user.emailAddresses[0]?.emailAddress || 'User',
          createdAt: Date.now(),
          lastModified: Date.now(),
          sharedWith: {},
        }).then(() => {
          console.log('✅ Board metadata created');
        }).catch(err => {
          console.error('Failed to create board metadata:', err);
          setHasAccess(false);
          setBoardName('Board Not Found');
        });
        
        // Assume ownership for now
        setHasAccess(true);
        setUserPermission('owner');
        setBoardName(boardId === 'default' ? 'Board 2' : 'Untitled Board');
        return;
      }

      // Check if user is owner or has shared access
      const isOwner = data.ownerId === user.id;
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

      if (isOwner) {
        setHasAccess(true);
        setUserPermission('owner');
        setBoardName(data.name || 'Untitled Board');
      } else if (sharedAccessById) {
        setHasAccess(true);
        setUserPermission(sharedAccessById.permission || 'view');
        setBoardName(data.name || 'Untitled Board');
      } else if (sharedAccessByEmail) {
        setHasAccess(true);
        setUserPermission(sharedAccessByEmail.permission || 'view');
        setBoardName(data.name || 'Untitled Board');
      } else {
        setHasAccess(false);
        setUserPermission('view');
        setBoardName('Access Denied');
      }

      // Update lastModified when user opens the board (only if they have access)
      if (isOwner || sharedAccessById || sharedAccessByEmail) {
        update(ref(database, `boardsMeta/${boardId}`), {
          lastModified: Date.now(),
        }).catch(err => console.error('Failed to update lastModified:', err));
      }
    });

    return () => unsubscribe();
  }, [boardId, user]);

  if (!isLoaded || hasAccess === null) {
    return (
      <div className="app-loading">
        <p>Loading...</p>
      </div>
    );
  }

  // Show access denied message if user doesn't have permission
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
            padding: '12px 24px',
            background: '#667eea',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Back to My Boards
        </button>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <ConnectionStatus />
      <Toast />
      <HelpPanel />
      <BoardShareModal 
        boardId={boardId} 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
      />
      {userPermission === 'view' && (
        <div style={{
          position: 'fixed',
          top: 60,
          left: 0,
          right: 0,
          background: '#fbbf24',
          color: '#92400e',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '0.875rem',
          fontWeight: 600,
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          👁️ View-only access. Contact the board owner to request edit permissions.
        </div>
      )}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBackToList}
            title="Back to board list"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ←
          </button>
          <h1 className="app-title">{boardName || 'CollabBoard'}</h1>
        </div>
        <div className="header-actions">
          <AutoSaveIndicator />
          <EnhancedPresence />
          <button
            onClick={() => setIsShareModalOpen(true)}
            title="Share board"
            style={{
              padding: '8px 16px',
              background: '#667eea',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginRight: 16,
            }}
          >
            🔗 Share
          </button>
          <span className="user-name">
            {user?.firstName || user?.emailAddresses[0]?.emailAddress || 'User'}
          </span>
          <button 
            type="button" 
            className="signout-btn" 
            onClick={() => signOut()}
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="main-content">
        <aside className="sidebar">
          <Toolbar />
          <PresencePanel />
        </aside>
        <main className="canvas-wrapper">
          <Canvas />
          <PropertiesPanel />
        </main>
      </div>
      <AlignmentTools />
      <AIAssistant />
    </div>
  );
}

export default function App() {
  const currentPath = window.location.pathname;
  const [selectedBoardId, setSelectedBoardId] = useState(null);

  // Parse board ID from URL (/board/:boardId)
  useEffect(() => {
    const match = currentPath.match(/^\/board\/([^/]+)/);
    if (match) {
      setSelectedBoardId(match[1]);
    } else {
      setSelectedBoardId(null);
    }
  }, [currentPath]);

  const handleSelectBoard = (boardId) => {
    window.history.pushState({}, '', `/board/${boardId}`);
    setSelectedBoardId(boardId);
  };

  const handleBackToList = () => {
    window.history.pushState({}, '', '/');
    setSelectedBoardId(null);
  };

  // Handle sign-up page routing
  if (currentPath === '/sign-up') {
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
        <SignedOut>
          <SignUpPage />
        </SignedOut>
      </>
    );
  }

  // Default: sign-in page or board list/board
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
      <SignedOut>
        <SignInPage />
      </SignedOut>
    </>
  );
}
