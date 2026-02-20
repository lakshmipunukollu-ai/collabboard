import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { ref, onValue, set, push } from 'firebase/database';
import { database } from '../lib/firebase';
import { showToast } from './Toast';
import TemplatePickerModal from './TemplatePickerModal';

export default function BoardListPage({ onSelectBoard }) {
  const { user } = useUser();
  const [myBoards, setMyBoards] = useState([]);
  const [sharedBoards, setSharedBoards] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pendingBoardName, setPendingBoardName] = useState('');

  useEffect(() => {
    if (!user) return;

    // Listen to boards metadata
    const boardsRef = ref(database, 'boardsMeta');
    const unsubscribe = onValue(boardsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMyBoards([]);
        setSharedBoards([]);
        return;
      }

      const ownedBoards = [];
      const shared = [];

      Object.entries(data).forEach(([boardId, board]) => {
        const boardData = { id: boardId, ...board };
        
        if (board.ownerId === user.id) {
          ownedBoards.push(boardData);
        } else if (board.sharedWith) {
          // Check if shared with user ID
          const sharedById = board.sharedWith[user.id];
          
          // Check if shared with sanitized email
          const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase();
          const sanitizedEmail = userEmail ? userEmail
            .replace(/\./g, ',')
            .replace(/@/g, '_at_')
            .replace(/#/g, '_hash_')
            .replace(/\$/g, '_dollar_')
            .replace(/\[/g, '_lbracket_')
            .replace(/\]/g, '_rbracket_') : null;
          const sharedByEmail = sanitizedEmail && board.sharedWith[sanitizedEmail];
          
          if (sharedById || sharedByEmail) {
            shared.push(boardData);
          }
        }
      });

      // Sort by lastModified descending
      ownedBoards.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
      shared.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

      setMyBoards(ownedBoards);
      setSharedBoards(shared);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateBoard = () => {
    if (!newBoardName.trim()) {
      showToast('⚠️ Board name cannot be empty', 'warning');
      return;
    }
    // Show template picker before creating
    setPendingBoardName(newBoardName.trim());
    setShowTemplatePicker(true);
  };

  const handleTemplateSelected = async (template) => {
    setShowTemplatePicker(false);
    const name = pendingBoardName || newBoardName.trim() || 'Untitled Board';
    try {
      const boardsMetaRef = ref(database, 'boardsMeta');
      const newBoardRef = push(boardsMetaRef);
      const boardId = newBoardRef.key;

      await set(newBoardRef, {
        name,
        ownerId: user.id,
        ownerName: user.firstName || user.emailAddresses[0]?.emailAddress || 'User',
        createdAt: Date.now(),
        lastModified: Date.now(),
        sharedWith: {},
      });

      // Write template objects if any
      if (template.objects && template.objects.length > 0) {
        const updates = {};
        template.objects.forEach((obj) => {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          updates[id] = { ...obj, updatedAt: Date.now() };
        });
        await set(ref(database, `boards/${boardId}/objects`), updates);
      }

      showToast('✅ Board created', 'success');
      setNewBoardName('');
      setPendingBoardName('');
      setIsCreating(false);
      onSelectBoard(boardId);
    } catch (error) {
      console.error('Error creating board:', error);
      showToast('❌ Failed to create board', 'error');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 40,
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            color: 'white',
            fontWeight: 700,
          }}>
            My Boards
          </h1>
          <button
            onClick={() => setIsCreating(true)}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.2)',
              border: '2px solid white',
              borderRadius: 8,
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(255,255,255,0.3)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'rgba(255,255,255,0.2)';
            }}
          >
            + New Board
          </button>
        </header>

        {isCreating && (
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 32,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: '#1e293b' }}>
              Create New Board
            </h3>
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateBoard();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewBoardName('');
                }
              }}
              placeholder="Board name (e.g., Project Planning)"
              autoFocus
              style={{
                width: '100%',
                padding: 12,
                fontSize: '1rem',
                border: '2px solid #e2e8f0',
                borderRadius: 8,
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleCreateBoard}
                style={{
                  padding: '10px 20px',
                  background: '#667eea',
                  border: 'none',
                  borderRadius: 6,
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Create Board
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewBoardName('');
                }}
                style={{
                  padding: '10px 20px',
                  background: '#e2e8f0',
                  border: 'none',
                  borderRadius: 6,
                  color: '#1e293b',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ color: 'white', fontSize: '1.5rem', marginBottom: 20 }}>
            My Boards ({myBoards.length})
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20,
          }}>
            {myBoards.map((board) => (
              <div
                key={board.id}
                onClick={() => onSelectBoard(board.id)}
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  borderRadius: 12,
                  padding: 24,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
              >
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '1.25rem',
                  color: '#1e293b',
                  fontWeight: 600,
                }}>
                  {board.name}
                </h3>
                <p style={{
                  margin: '0 0 8px 0',
                  fontSize: '0.875rem',
                  color: '#64748b',
                }}>
                  Last modified: {formatDate(board.lastModified)}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                }}>
                  Created: {formatDate(board.createdAt)}
                </p>
              </div>
            ))}
            {myBoards.length === 0 && !isCreating && (
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: 40,
                textAlign: 'center',
                border: '2px dashed rgba(255,255,255,0.3)',
              }}>
                <p style={{ color: 'white', fontSize: '1.125rem', margin: 0 }}>
                  No boards yet. Create your first board!
                </p>
              </div>
            )}
          </div>
        </section>

        {sharedBoards.length > 0 && (
          <section>
            <h2 style={{ color: 'white', fontSize: '1.5rem', marginBottom: 20 }}>
              Shared with Me ({sharedBoards.length})
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 20,
            }}>
              {sharedBoards.map((board) => (
                <div
                  key={board.id}
                  onClick={() => onSelectBoard(board.id)}
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    borderRadius: 12,
                    padding: 24,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s',
                    border: '2px solid #fbbf24',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: '1.25rem' }}>🔗</span>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.25rem',
                      color: '#1e293b',
                      fontWeight: 600,
                    }}>
                      {board.name}
                    </h3>
                  </div>
                  <p style={{
                    margin: '0 0 8px 0',
                    fontSize: '0.875rem',
                    color: '#64748b',
                  }}>
                    Owner: {board.ownerName}
                  </p>
                  <p style={{
                    margin: '0 0 8px 0',
                    fontSize: '0.875rem',
                    color: '#64748b',
                  }}>
                    Last modified: {formatDate(board.lastModified)}
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    color: '#f59e0b',
                    fontWeight: 600,
                  }}>
                    {board.sharedWith?.[user.id]?.permission || 'view'} access
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {showTemplatePicker && (
        <TemplatePickerModal
          onSelect={handleTemplateSelected}
          onCancel={() => setShowTemplatePicker(false)}
        />
      )}
    </div>
  );
}
