import { useState, useEffect } from 'react';

let saveStatusListeners = [];
let currentStatus = 'saved'; // 'saved', 'saving', 'error'
let lastSavedTime = Date.now();

export function setSaveStatus(status) {
  currentStatus = status;
  if (status === 'saved') {
    lastSavedTime = Date.now();
  }
  saveStatusListeners.forEach(listener => listener());
}

export default function AutoSaveIndicator() {
  const [status, setStatus] = useState('saved');
  const [lastSaved, setLastSaved] = useState(Date.now());

  useEffect(() => {
    const listener = () => {
      setStatus(currentStatus);
      setLastSaved(lastSavedTime);
    };
    saveStatusListeners.push(listener);
    
    // Update time display every 10 seconds
    const interval = setInterval(() => {
      setLastSaved(lastSavedTime);
    }, 10000);
    
    return () => {
      saveStatusListeners = saveStatusListeners.filter(l => l !== listener);
      clearInterval(interval);
    };
  }, []);

  const getTimeSince = () => {
    const seconds = Math.floor((Date.now() - lastSaved) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getDisplay = () => {
    switch (status) {
      case 'saving':
        return {
          icon: '💾',
          text: 'Saving...',
          color: '#F59E0B',
        };
      case 'error':
        return {
          icon: '⚠️',
          text: 'Changes not saved',
          color: '#EF4444',
        };
      case 'saved':
      default:
        return {
          icon: '✓',
          text: `Saved ${getTimeSince()}`,
          color: '#10B981',
        };
    }
  };

  const display = getDisplay();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.05)',
        fontSize: '0.75rem',
        fontWeight: 500,
      }}
      title={`Last saved at ${new Date(lastSaved).toLocaleTimeString()}`}
    >
      <span style={{ color: display.color, fontSize: '1rem' }}>{display.icon}</span>
      <span style={{ color: display.color }}>{display.text}</span>
    </div>
  );
}
