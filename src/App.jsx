import { useUser, useClerk, SignedIn, SignedOut } from '@clerk/clerk-react';
import { BoardProvider } from './context/BoardContext';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import PresencePanel from './components/PresencePanel';
import SignInPage from './components/SignInPage';
import SignUpPage from './components/SignUpPage';
import ConnectionStatus from './components/ConnectionStatus';
import './App.css';

function BoardLayout() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

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
      <header className="app-header">
        <h1 className="app-title">CollabBoard</h1>
        <div className="header-actions">
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
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const currentPath = window.location.pathname;

  // Handle sign-up page routing
  if (currentPath === '/sign-up') {
    return (
      <>
        <SignedIn>
          <BoardProvider>
            <BoardLayout />
          </BoardProvider>
        </SignedIn>
        <SignedOut>
          <SignUpPage />
        </SignedOut>
      </>
    );
  }

  // Default: sign-in page or board
  return (
    <>
      <SignedIn>
        <BoardProvider>
          <BoardLayout />
        </BoardProvider>
      </SignedIn>
      <SignedOut>
        <SignInPage />
      </SignedOut>
    </>
  );
}
