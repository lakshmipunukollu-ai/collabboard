import { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../lib/firebase';
import { showToast } from './Toast';

export default function BoardShareModal({ boardId, isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('edit');
  const [sharedUsers, setSharedUsers] = useState([]);
  const [boardOwner, setBoardOwner] = useState('');

  useEffect(() => {
    if (!isOpen || !boardId) return;

    const boardMetaRef = ref(database, `boardsMeta/${boardId}`);
    const unsubscribe = onValue(boardMetaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBoardOwner(data.ownerName || 'Unknown');
        const shared = data.sharedWith || {};
        const users = Object.entries(shared).map(([userId, userData]) => ({
          userId,
          ...userData,
        }));
        setSharedUsers(users);
      }
    });

    return () => unsubscribe();
  }, [isOpen, boardId]);

  const handleShare = async () => {
    if (!email.trim()) {
      showToast('⚠️ Please enter an email address', 'warning');
      return;
    }

    // In a real app, you'd look up the user ID by email
    // For now, we'll use email as the user ID (simplified)
    const userId = email.trim();

    try {
      await update(ref(database, `boardsMeta/${boardId}/sharedWith/${userId}`), {
        email: email.trim(),
        permission,
        sharedAt: Date.now(),
      });

      showToast('✅ Board shared successfully', 'success');
      setEmail('');
    } catch (error) {
      console.error('Error sharing board:', error);
      showToast('❌ Failed to share board', 'error');
    }
  };

  const handleRemoveAccess = async (userId) => {
    try {
      await update(ref(database, `boardsMeta/${boardId}/sharedWith/${userId}`), null);
      showToast('✅ Access removed', 'success');
    } catch (error) {
      console.error('Error removing access:', error);
      showToast('❌ Failed to remove access', 'error');
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/board/${boardId}`;
    navigator.clipboard.writeText(link);
    showToast('📋 Link copied to clipboard', 'success');
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e293b',
          borderRadius: 16,
          padding: 32,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem' }}>
            Share Board
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', color: '#CBD5E1', marginBottom: 8, fontSize: '0.875rem' }}>
            Share with email
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleShare();
                if (e.key === 'Escape') onClose();
              }}
              placeholder="user@example.com"
              style={{
                flex: 1,
                padding: 10,
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 6,
                color: 'white',
                fontSize: '0.875rem',
              }}
            />
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
              style={{
                padding: '10px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 6,
                color: 'white',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <option value="view">View</option>
              <option value="edit">Edit</option>
            </select>
          </div>
          <button
            onClick={handleShare}
            style={{
              width: '100%',
              padding: 12,
              background: '#667eea',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Share
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <button
            onClick={copyShareLink}
            style={{
              width: '100%',
              padding: 12,
              background: '#334155',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📋 Copy board link
          </button>
        </div>

        <div>
          <h3 style={{ color: '#CBD5E1', fontSize: '1rem', marginBottom: 16 }}>
            Who has access
          </h3>
          <div style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 12,
              background: '#0f172a',
              borderRadius: 6,
              marginBottom: 8,
            }}>
              <div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem' }}>
                  {boardOwner}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                  Owner
                </div>
              </div>
            </div>
          </div>
          {sharedUsers.map((user) => (
            <div
              key={user.userId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 12,
                background: '#0f172a',
                borderRadius: 6,
                marginBottom: 8,
              }}
            >
              <div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem' }}>
                  {user.email || user.userId}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                  {user.permission} access
                </div>
              </div>
              <button
                onClick={() => handleRemoveAccess(user.userId)}
                style={{
                  padding: '6px 12px',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          ))}
          {sharedUsers.length === 0 && (
            <div style={{
              padding: 24,
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.875rem',
            }}>
              Not shared with anyone yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
