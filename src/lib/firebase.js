import { initializeApp } from 'firebase/app';
import { getDatabase, goOnline, ref, onValue } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDc23VpqvGcf3MFJKcYvQqZjMB6hOXw0gU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'collabboard-lakshmi.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://collabboard-lakshmi-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'collabboard-lakshmi',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'collabboard-lakshmi.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '583378121574',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:583378121574:web:672075c4e552f4138ecea7',
};

console.log('🔥 Firebase Config:', {
  projectId: firebaseConfig.projectId,
  databaseURL: firebaseConfig.databaseURL,
});

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Force real-time connection and log connection status
goOnline(database);

// Test connection speed
const startTest = Date.now();
console.log('⏱️ Testing Firebase connection speed...');

// Check connection status and log all changes
const testRef = ref(database, '.info/connected');
let connectionCount = 0;
onValue(testRef, (snap) => {
  const connected = snap.val();
  const elapsed = Date.now() - startTest;
  connectionCount++;
  
  console.log(`🔌 Firebase connection #${connectionCount}: ${connected ? 'CONNECTED ✅' : 'DISCONNECTED ❌'} (${elapsed}ms)`);
  
  if (!connected) {
    console.error('⚠️ Firebase NOT connected! Check network/firewall.');
  } else if (elapsed > 1000 && connectionCount === 1) {
    console.warn(`⚠️ Initial connection took ${elapsed}ms - check Firebase region.`);
  }
  
  if (connectionCount > 1) {
    console.warn(`🔄 Firebase reconnection detected (count: ${connectionCount})`);
  }
});

console.log('✅ Firebase initialized and going online');

export { database };
