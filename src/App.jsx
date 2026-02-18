import { useState, useEffect } from 'react';
import { useUser, useClerk, SignedIn, SignedOut } from '@clerk/clerk-react';
import { ref, onValue, update } from 'firebase/database';
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
import AIAssistant from './components/AIAssistant';
import './App.css';

function BoardLayout({ boardId, onBackToList }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [boardName, setBoardName] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (!boardId) return;

    // Listen to board metadata for the name
    const boardMetaRef = ref(database, `boardsMeta/${boardId}`);
    const unsubscribe = onValue(boardMetaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBoardName(data.name || 'Untitled Board');
      }
    });

    // Update lastModified when user opens the board
    update(ref(database, `boardsMeta/${boardId}`), {
      lastModified: Date.now(),
    });

    return () => unsubscribe();
  }, [boardId]);

  if (!isLoaded) {
    return (
      <div className="app-loading">
        <p>Loading...</p>
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
