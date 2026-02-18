import { useState, useRef, useEffect } from 'react';
import { showToast } from './Toast';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Load API key from localStorage
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveApiKey = () => {
    localStorage.setItem('openai_api_key', apiKey);
    setShowSettings(false);
    showToast('✅ API key saved', 'success');
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    if (!apiKey) {
      showToast('⚠️ Please add your OpenAI API key in settings', 'warning');
      setShowSettings(true);
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant for CollabBoard, a collaborative whiteboard app. Help users with brainstorming, organizing ideas, project planning, and any questions about using the app. Be concise and friendly.',
            },
            ...messages.slice(-10), // Last 10 messages for context
            userMessage,
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.choices[0].message.content,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Assistant error:', error);
      showToast('❌ Failed to get response. Check your API key.', 'error');
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please check your API key and try again.',
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: 4,
            }}
          >
            ⚙️
          </button>
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
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          padding: 16,
          background: '#0f172a',
          borderBottom: '1px solid #334155',
        }}>
          <label style={{
            display: 'block',
            color: '#CBD5E1',
            fontSize: '0.875rem',
            marginBottom: 8,
          }}>
            OpenAI API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={{
              width: '100%',
              padding: 8,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 6,
              color: 'white',
              fontSize: '0.875rem',
              marginBottom: 8,
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={saveApiKey}
            style={{
              width: '100%',
              padding: 8,
              background: '#667eea',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save Key
          </button>
          <p style={{
            marginTop: 8,
            fontSize: '0.75rem',
            color: '#64748b',
            marginBottom: 0,
          }}>
            Get your API key from{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#667eea' }}
            >
              OpenAI
            </a>
          </p>
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
