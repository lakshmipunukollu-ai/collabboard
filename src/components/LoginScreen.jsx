import { useState } from 'react';
import { signInWithGoogle } from '../lib/firebase';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>CollabBoard</h1>
        <p className="login-subtitle">Real-time collaborative whiteboard</p>
        <button
          type="button"
          className="login-btn"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
}
