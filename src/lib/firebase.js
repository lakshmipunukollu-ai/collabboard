import { initializeApp } from 'firebase/app';
import { getDatabase, goOnline, ref, onValue } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDc23VpqvGcf3MFJKcYvQqZjMB6hOXw0gU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'collabboard-d900c.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://collabboard-d900c-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'collabboard-d900c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'collabboard-d900c.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '583378121574',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:583378121574:web:672075c4e552f4138ecea7',
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

goOnline(database);

// Log connection state only when it changes (avoids console spam and false "DISCONNECTED" on load)
const testRef = ref(database, '.info/connected');
let lastConnected = null;
onValue(testRef, (snap) => {
  const connected = !!snap.val();
  if (lastConnected === connected) return;
  lastConnected = connected;
  if (connected) {
    console.log('🔌 Firebase connected');
  } else {
    console.warn('🔌 Firebase disconnected – check network');
  }
});

export { database };
