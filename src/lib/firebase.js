import { initializeApp } from 'firebase/app';
import { getDatabase, goOnline, ref, onValue } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://YOUR_PROJECT.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'YOUR_PROJECT.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'YOUR_APP_ID',
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

// Check connection status
const testRef = ref(database, '.info/connected');
onValue(testRef, (snap) => {
  const connected = snap.val();
  const elapsed = Date.now() - startTest;
  console.log(`🔌 Firebase connection: ${connected ? 'CONNECTED ✅' : 'DISCONNECTED ❌'} (${elapsed}ms)`);
  if (!connected) {
    console.error('⚠️ Firebase NOT connected! Check network/firewall.');
  } else if (elapsed > 1000) {
    console.warn(`⚠️ Connection took ${elapsed}ms - very slow! Check Firebase region.`);
  }
});

console.log('✅ Firebase initialized and going online');

export { database };
