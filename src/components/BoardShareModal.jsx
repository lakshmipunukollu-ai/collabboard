import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { ref, onValue, update, remove } from 'firebase/database';
import { database } from '../lib/firebase';
import { showToast } from './Toast';

export default function BoardShareModal({ boardId, isOpen, onClose }) {
  const { user } = useUser();
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('edit');
  const [sharedUsers, setSharedUsers] = useState([]);
  const [boardOwner, setBoardOwner] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!isOpen || !boardId || !user) return;

    console.log('Loading board metadata for:', boardId, 'user:', user.id);

    const boardMetaRef = ref(database, `boardsMeta/${boardId}`);
    const unsubscribe = onValue(boardMetaRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Board metadata:', data);
      
      if (data) {
        setBoardOwner(data.ownerName || 'Unknown');
        const ownerCheck = data.ownerId === user.id;
        console.log('Owner check:', { boardOwnerId: data.ownerId, userId: user.id, isOwner: ownerCheck });
        setIsOwner(ownerCheck);
        const shared = data.sharedWith || {};
        const users = Object.entries(shared).map(([userId, userData]) => ({
          userId,
          ...userData,
        }));
        setSharedUsers(users);
      } else {
        console.warn('No board metadata found for:', boardId);
        setIsOwner(false);
      }
    });

    return () => unsubscribe();
  }, [isOpen, boardId, user]);

  // Sanitize email for use as Firebase key (Firebase doesn't allow . # $ [ ] in keys)
  const sanitizeEmailForKey = (email) => {
    return email
      .toLowerCase()
      .replace(/\./g, ',')
      .replace(/@/g, '_at_')
      .replace(/#/g, '_hash_')
      .replace(/\$/g, '_dollar_')
      .replace(/\[/g, '_lbracket_')
      .replace(/\]/g, '_rbracket_');
  };

  const handleShare = async () => {
    if (!email.trim()) {
      showToast('⚠️ Please enter an email address', 'warning');
      return;
    }

    if (!isOwner) {
      showToast('⚠️ Only the board owner can share', 'warning');
      return;
    }

    if (!boardId) {
      console.error('No boardId provided to share modal');
      showToast('❌ Invalid board ID', 'error');
      return;
    }

    // Sanitize email to make it Firebase-safe
    const sanitizedEmail = sanitizeEmailForKey(email.trim());

    console.log('Attempting to share board:', { boardId, originalEmail: email.trim(), sanitizedEmail, permission });

    try {
      const shareRef = ref(database, `boardsMeta/${boardId}/sharedWith/${sanitizedEmail}`);
      await update(shareRef, {
        email: email.trim(),
        permission,
        sharedAt: Date.now(),
        sharedBy: user.id,
        sharedByName: user.firstName || user.emailAddresses[0]?.emailAddress || 'User',
      });

      console.log('✅ Board shared successfully');
      showToast('✅ Board shared successfully! User can access via link.', 'success');
      setEmail('');
    } catch (error) {
      console.error('Error sharing board:', error);
      console.error('Share details:', { boardId, email: email.trim(), sanitizedEmail, permission, isOwner });
      showToast(`❌ Failed to share board: ${error.message}`, 'error');
    }
  };

  const handleRemoveAccess = async (userId) => {
    if (!isOwner) {
      showToast('⚠️ Only the board owner can remove access', 'warning');
      return;
    }

    try {
      const userRef = ref(database, `boardsMeta/${boardId}/sharedWith/${userId}`);
      await remove(userRef);
      showToast('✅ Access removed', 'success');
    } catch (error) {
      console.error('Error removing access:', error);
      console.error('Remove details:', { boardId, userId });
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
              <option value="view">View Only</option>
              <option value="edit">Can Edit</option>
              <option value="owner">Owner</option>
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
