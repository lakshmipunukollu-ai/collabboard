import { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../lib/firebase';
import { setSaveStatus } from './AutoSaveIndicator';

export default function ConnectionStatus() {
  const [status, setStatus] = useState('connected'); // 'connected' | 'offline' | 'reconnected'
  const reconnectedTimerRef = useRef(null);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    const connectedRef = ref(database, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val() === true;

      if (firstLoadRef.current) {
        // Don't flash "reconnected" on initial load
        firstLoadRef.current = false;
        setStatus(connected ? 'connected' : 'offline');
        if (!connected) setSaveStatus('error');
        return;
      }

      if (connected) {
        // Brief "Reconnected" flash before hiding
        setStatus('reconnected');
        setSaveStatus('saved');
        if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
        reconnectedTimerRef.current = setTimeout(() => setStatus('connected'), 2500);
      } else {
        setStatus('offline');
        setSaveStatus('error');
      }
    });

    return () => {
      unsubscribe();
      if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
    };
  }, []);

  if (status === 'connected') return null;

  const isOffline = status === 'offline';

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        background: isOffline ? '#EF4444' : '#10B981',
        color: 'white',
        padding: '8px 20px',
        borderRadius: 8,
        fontSize: '0.82rem',
        fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
      }}
    >
      {isOffline ? (
        <>
          <span style={{ fontSize: '1rem' }}>⚡</span>
          You are offline — changes will sync when reconnected
        </>
      ) : (
        <>
          <span style={{ fontSize: '1rem' }}>✓</span>
          Reconnected
        </>
      )}
    </div>
  );
}
