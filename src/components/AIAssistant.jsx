import { useState, useRef, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { showToast } from './Toast';

export default function AIAssistant() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Get Firebase project ID from environment
  const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'collabboard-lakshmi';
  
  // Use local emulator if in development, otherwise use production URL
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const functionUrl = isDev 
    ? 'http://localhost:5002/collabboard-lakshmi/us-central1/aiChat'
    : `https://us-central1-${firebaseProjectId}.cloudfunctions.net/aiChat`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    if (!user) {
      showToast('⚠️ Please sign in to use the AI Assistant', 'warning');
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get Clerk session token for authentication
      const token = await getToken();
      
      // Call our Firebase Function instead of OpenAI directly
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          model: 'gpt-4',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.message.content,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Assistant error:', error);
      const isConnectionError = error?.message === 'Failed to fetch' || (error?.name === 'TypeError' && String(error?.message || '').toLowerCase().includes('fetch'));
      const userMessage = isConnectionError
        ? 'AI Assistant is unavailable. Make sure the backend is running (e.g. Firebase Functions emulator).'
        : 'Sorry, I encountered an error. Please try again.';
      showToast(isConnectionError ? `❌ ${userMessage}` : '❌ Failed to get response. Please try again.', 'error');
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: userMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="AI Assistant"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
          cursor: 'pointer',
          fontSize: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          transition: 'transform 0.2s',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        🤖
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 380,
        height: 500,
        background: '#1e293b',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: 16,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.5rem' }}>🤖</span>
          <span style={{ fontWeight: 600 }}>AI Assistant</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1.5rem',
            padding: 4,
          }}
        >
          ×
        </button>
      </div>

      {/* Chat Panel */}
      {(
        <div style={{
          padding: 16,
          background: '#0f172a',
          borderBottom: '1px solid #334155',
          color: '#94a3b8',
          fontSize: '0.75rem',
          textAlign: 'center',
        }}>
          ✨ AI Assistant Ready
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#64748b',
            padding: '40px 20px',
          }}>
            <p style={{ fontSize: '1.25rem', marginBottom: 8 }}>👋</p>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>
              Hi! I'm your AI assistant. Ask me anything about brainstorming,
              organizing ideas, or using CollabBoard!
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
            }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: msg.role === 'user' ? '#667eea' : '#334155',
                color: 'white',
                fontSize: '0.875rem',
                lineHeight: 1.5,
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start' }}>
            <div style={{
              padding: 12,
              borderRadius: 12,
              background: '#334155',
              color: '#94A3B8',
              fontSize: '0.875rem',
            }}>
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 16,
        borderTop: '1px solid #334155',
        display: 'flex',
        gap: 8,
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask me anything..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: 10,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            color: 'white',
            fontSize: '0.875rem',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '10px 16px',
            background: isLoading || !input.trim() ? '#334155' : '#667eea',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
