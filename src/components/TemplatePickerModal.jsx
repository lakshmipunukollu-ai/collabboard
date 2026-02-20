import { useState } from 'react';
import { templates } from '../lib/templates';

export default function TemplatePickerModal({ onSelect, onCancel }) {
  const [selected, setSelected] = useState('blank');

  const handleConfirm = () => {
    const tpl = templates.find((t) => t.id === selected) || templates[0];
    onSelect(tpl);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 4000, padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          width: '100%', maxWidth: 700,
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #334155',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h2 style={{ color: '#f1f5f9', margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
              Choose a template
            </h2>
            <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '0.8rem' }}>
              Select a starting point for your board
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent', border: 'none',
              color: '#64748b', fontSize: '1.4rem', cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Template grid */}
        <div style={{
          padding: 20, overflowY: 'auto', flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}>
          {templates.map((tpl) => {
            const isActive = selected === tpl.id;
            return (
              <button
                key={tpl.id}
                onClick={() => setSelected(tpl.id)}
                style={{
                  background: isActive ? 'rgba(102,126,234,0.15)' : '#0f172a',
                  border: `2px solid ${isActive ? '#667eea' : '#334155'}`,
                  borderRadius: 10,
                  padding: '16px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: '2rem', lineHeight: 1 }}>{tpl.emoji}</span>
                <div style={{
                  color: isActive ? '#93C5FD' : '#e2e8f0',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}>
                  {tpl.name}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', lineHeight: 1.4 }}>
                  {tpl.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #334155',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              background: '#334155', border: 'none',
              borderRadius: 8, color: '#e2e8f0',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '8px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none', borderRadius: 8,
              color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Use Template →
          </button>
        </div>
      </div>
    </div>
  );
}
