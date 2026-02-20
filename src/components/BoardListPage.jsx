import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { database } from '../lib/firebase';
import { showToast } from './Toast';
import TemplatePickerModal from './TemplatePickerModal';

export default function BoardListPage({ onSelectBoard }) {
  const { user } = useUser();
  const [ownedBoards, setOwnedBoards] = useState([]);
  const [sharedBoards, setSharedBoards] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pendingBoardName, setPendingBoardName] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    if (!user) return;

    const boardsRef = ref(database, 'boardsMeta');
    const unsubscribe = onValue(boardsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setOwnedBoards([]);
        setSharedBoards([]);
        return;
      }

      const owned = [];
      const shared = [];

      Object.entries(data).forEach(([boardId, board]) => {
        const boardData = { id: boardId, ...board };
        if (board.ownerId === user.id) {
          owned.push(boardData);
        } else if (board.sharedWith) {
          const sharedById = board.sharedWith[user.id];
          const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase();
          const sanitizedEmail = userEmail ? userEmail
            .replace(/\./g, ',')
            .replace(/@/g, '_at_')
            .replace(/#/g, '_hash_')
            .replace(/\$/g, '_dollar_')
            .replace(/\[/g, '_lbracket_')
            .replace(/\]/g, '_rbracket_') : null;
          const sharedByEmail = sanitizedEmail && board.sharedWith[sanitizedEmail];
          if (sharedById || sharedByEmail) shared.push(boardData);
        }
      });

      owned.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
      shared.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

      setOwnedBoards(owned);
      setSharedBoards(shared);
    });

    return () => unsubscribe();
  }, [user]);

  // boards filtered by status — no status field means "active"
  const myBoards = ownedBoards.filter((b) => !b.status || b.status === 'active');
  const archivedBoards = ownedBoards.filter((b) => b.status === 'archived');
  const trashedBoards = ownedBoards.filter((b) => b.status === 'trashed');

  const setStatus = async (boardId, boardName, status, e) => {
    e.stopPropagation();
    try {
      await update(ref(database, `boardsMeta/${boardId}`), { status, statusChangedAt: Date.now() });
      const labels = { archived: '📦 Archived', active: '↩ Restored', trashed: '🗑 Moved to Trash' };
      showToast(`${labels[status]} "${boardName}"`, 'success');
    } catch (err) {
      console.error('Board status update error:', err);
      showToast('❌ Failed to update board', 'error');
    }
  };

  const handlePermanentDelete = async (boardId, boardName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete "${boardName}"?\n\nAll content will be gone forever. This cannot be undone.`)) return;
    try {
      await Promise.all([
        remove(ref(database, `boardsMeta/${boardId}`)),
        remove(ref(database, `boards/${boardId}`)),
      ]);
      showToast(`🔥 "${boardName}" permanently deleted`, 'success');
    } catch (err) {
      console.error('Permanent delete error:', err);
      showToast('❌ Failed to delete board', 'error');
    }
  };

  const handleCreateBoard = () => {
    if (!newBoardName.trim()) {
      showToast('⚠️ Board name cannot be empty', 'warning');
      return;
    }
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

  const tabs = [
    { id: 'active', label: 'My Boards', count: myBoards.length },
    { id: 'archived', label: 'Archived', count: archivedBoards.length },
    { id: 'trashed', label: 'Recently Deleted', count: trashedBoards.length },
  ];

  const cardHover = (e) => {
    e.currentTarget.style.transform = 'translateY(-4px)';
    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
  };
  const cardUnhover = (e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  };

  const ActionBtn = ({ onClick, color, hoverBg, bg, children, title }) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: bg,
        border: `1px solid ${color}`,
        borderRadius: 6,
        color,
        fontSize: '0.72rem',
        padding: '4px 8px',
        cursor: 'pointer',
        fontWeight: 600,
        lineHeight: 1,
        flexShrink: 0,
      }}
      onMouseOver={(e) => { e.stopPropagation(); e.currentTarget.style.background = hoverBg; }}
      onMouseOut={(e) => { e.currentTarget.style.background = bg; }}
    >
      {children}
    </button>
  );

  const renderBoardCard = (board, actions, clickable = true) => (
    <div
      key={board.id}
      onClick={clickable ? () => onSelectBoard(board.id) : undefined}
      style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: 12,
        padding: 24,
        cursor: clickable ? 'pointer' : 'default',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'all 0.2s',
        position: 'relative',
      }}
      onMouseOver={clickable ? cardHover : undefined}
      onMouseOut={clickable ? cardUnhover : undefined}
    >
      <div style={{ display: 'flex', gap: 6, position: 'absolute', top: 12, right: 12 }}>
        {actions}
      </div>
      <h3 style={{
        margin: '0 0 10px 0',
        fontSize: '1.1rem',
        color: '#1e293b',
        fontWeight: 600,
        paddingRight: 110,
        lineHeight: 1.3,
      }}>
        {board.name}
      </h3>
      <p style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: '#64748b' }}>
        Last modified: {formatDate(board.lastModified)}
      </p>
      <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
        Created: {formatDate(board.createdAt)}
      </p>
    </div>
  );

  const EmptyState = ({ message, icon }) => (
    <div style={{
      gridColumn: '1 / -1',
      background: 'rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: 48,
      textAlign: 'center',
      border: '2px dashed rgba(255,255,255,0.3)',
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{icon}</div>
      <p style={{ color: 'white', fontSize: '1rem', margin: 0, opacity: 0.85 }}>{message}</p>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
        }}>
          <h1 style={{ fontSize: '2.5rem', color: 'white', fontWeight: 700, margin: 0 }}>
            Boards
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
            onMouseOver={(e) => { e.target.style.background = 'rgba(255,255,255,0.3)'; }}
            onMouseOut={(e) => { e.target.style.background = 'rgba(255,255,255,0.2)'; }}
          >
            + New Board
          </button>
        </header>

        {/* Create board form */}
        {isCreating && (
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 28,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: '#1e293b' }}>Create New Board</h3>
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateBoard();
                if (e.key === 'Escape') { setIsCreating(false); setNewBoardName(''); }
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
              <button onClick={handleCreateBoard} style={{ padding: '10px 20px', background: '#667eea', border: 'none', borderRadius: 6, color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                Create Board
              </button>
              <button onClick={() => { setIsCreating(false); setNewBoardName(''); }} style={{ padding: '10px 20px', background: '#e2e8f0', border: 'none', borderRadius: 6, color: '#1e293b', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 4,
          marginBottom: 28,
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 10,
          padding: 4,
          alignSelf: 'flex-start',
          width: 'fit-content',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 18px',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                transition: 'all 0.15s',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.95)' : 'transparent',
                color: activeTab === tab.id ? '#1e293b' : 'rgba(255,255,255,0.75)',
                boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  marginLeft: 7,
                  background: activeTab === tab.id ? '#667eea' : 'rgba(255,255,255,0.25)',
                  color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.9)',
                  borderRadius: 10,
                  padding: '1px 7px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: My Boards */}
        {activeTab === 'active' && (
          <section style={{ marginBottom: 40 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 20,
            }}>
              {myBoards.map((board) => renderBoardCard(board, [
                <ActionBtn
                  key="archive"
                  onClick={(e) => setStatus(board.id, board.name, 'archived', e)}
                  color="rgba(99,102,241,0.9)"
                  bg="rgba(99,102,241,0.1)"
                  hoverBg="rgba(99,102,241,0.2)"
                  title="Archive board"
                >
                  📦 Archive
                </ActionBtn>,
                <ActionBtn
                  key="trash"
                  onClick={(e) => setStatus(board.id, board.name, 'trashed', e)}
                  color="rgba(239,68,68,0.9)"
                  bg="rgba(239,68,68,0.08)"
                  hoverBg="rgba(239,68,68,0.18)"
                  title="Move to trash"
                >
                  🗑 Trash
                </ActionBtn>,
              ]))}
              {myBoards.length === 0 && !isCreating && (
                <EmptyState icon="📋" message="No boards yet. Create your first board!" />
              )}
            </div>
          </section>
        )}

        {/* Tab: Archived */}
        {activeTab === 'archived' && (
          <section style={{ marginBottom: 40 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 20,
            }}>
              {archivedBoards.map((board) => renderBoardCard(board, [
                <ActionBtn
                  key="restore"
                  onClick={(e) => setStatus(board.id, board.name, 'active', e)}
                  color="rgba(34,197,94,0.9)"
                  bg="rgba(34,197,94,0.08)"
                  hoverBg="rgba(34,197,94,0.18)"
                  title="Restore board"
                >
                  ↩ Restore
                </ActionBtn>,
                <ActionBtn
                  key="trash"
                  onClick={(e) => setStatus(board.id, board.name, 'trashed', e)}
                  color="rgba(239,68,68,0.9)"
                  bg="rgba(239,68,68,0.08)"
                  hoverBg="rgba(239,68,68,0.18)"
                  title="Move to trash"
                >
                  🗑 Trash
                </ActionBtn>,
              ], false))}
              {archivedBoards.length === 0 && (
                <EmptyState icon="📦" message="No archived boards. Archive boards to keep them out of the main view." />
              )}
            </div>
          </section>
        )}

        {/* Tab: Recently Deleted */}
        {activeTab === 'trashed' && (
          <section style={{ marginBottom: 40 }}>
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10,
              padding: '10px 16px',
              marginBottom: 20,
              color: 'rgba(255,255,255,0.9)',
              fontSize: '0.85rem',
            }}>
              ⚠️ Boards in this folder can be permanently deleted. This action cannot be undone.
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 20,
            }}>
              {trashedBoards.map((board) => renderBoardCard(board, [
                <ActionBtn
                  key="restore"
                  onClick={(e) => setStatus(board.id, board.name, 'active', e)}
                  color="rgba(34,197,94,0.9)"
                  bg="rgba(34,197,94,0.08)"
                  hoverBg="rgba(34,197,94,0.18)"
                  title="Restore board"
                >
                  ↩ Restore
                </ActionBtn>,
                <ActionBtn
                  key="delete"
                  onClick={(e) => handlePermanentDelete(board.id, board.name, e)}
                  color="rgba(239,68,68,0.9)"
                  bg="rgba(239,68,68,0.08)"
                  hoverBg="rgba(239,68,68,0.22)"
                  title="Permanently delete"
                >
                  🔥 Delete
                </ActionBtn>,
              ], false))}
              {trashedBoards.length === 0 && (
                <EmptyState icon="🗑" message="Trash is empty." />
              )}
            </div>
          </section>
        )}

        {/* Shared with Me (always shown below) */}
        {sharedBoards.length > 0 && activeTab === 'active' && (
          <section>
            <h2 style={{ color: 'white', fontSize: '1.4rem', marginBottom: 20 }}>
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
                  onMouseOver={cardHover}
                  onMouseOut={cardUnhover}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: '1.25rem' }}>🔗</span>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', fontWeight: 600 }}>
                      {board.name}
                    </h3>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem', color: '#64748b' }}>
                    Owner: {board.ownerName}
                  </p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem', color: '#64748b' }}>
                    Last modified: {formatDate(board.lastModified)}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>
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
