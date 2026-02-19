import { useEffect } from 'react';

export default function ContextMenu({ x, y, onClose, onCopy, onPaste, onDuplicate, onDelete, hasSelection, hasClipboard }) {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuItems = [
    {
      label: 'Copy',
      shortcut: '⌘C',
      action: onCopy,
      disabled: !hasSelection,
      icon: '📋',
    },
    {
      label: 'Paste',
      shortcut: '⌘V',
      action: onPaste,
      disabled: !hasClipboard,
      icon: '📋',
    },
    {
      label: 'Duplicate',
      shortcut: '⌘D',
      action: onDuplicate,
      disabled: !hasSelection,
      icon: '📑',
    },
    {
      label: 'Delete',
      shortcut: 'Del',
      action: onDelete,
      disabled: !hasSelection,
      icon: '🗑️',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 8,
        padding: '4px 0',
        minWidth: 180,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 10000,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={(e) => {
            e.stopPropagation();
            if (!item.disabled) {
              item.action();
              onClose();
            }
          }}
          disabled={item.disabled}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            color: item.disabled ? '#64748b' : 'white',
            fontSize: '0.875rem',
            textAlign: 'left',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'background 0.15s',
          }}
          onMouseOver={(e) => {
            if (!item.disabled) {
              e.currentTarget.style.background = '#334155';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </span>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
            {item.shortcut}
          </span>
        </button>
      ))}
    </div>
  );
}
