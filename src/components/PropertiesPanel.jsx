import { useState, useEffect } from 'react';
import { useBoard } from '../context/BoardContext';

export default function PropertiesPanel() {
  const { objects, selectedIds, updateObject, deleteSelectedObjects } = useBoard();
  const [isOpen, setIsOpen] = useState(false);

  const selectedObjects = Array.from(selectedIds).map(id => ({
    id,
    ...objects[id]
  })).filter(obj => obj.type);

  useEffect(() => {
    setIsOpen(selectedObjects.length > 0);
  }, [selectedObjects.length]);

  if (selectedObjects.length === 0 || !isOpen) return null;

  const isSingleSelect = selectedObjects.length === 1;
  const obj = selectedObjects[0];

  const handleColorChange = (e) => {
    selectedIds.forEach(id => {
      updateObject(id, { color: e.target.value });
    });
  };

  const handleSizeChange = (prop, value) => {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 10) return;
    selectedIds.forEach(id => {
      updateObject(id, { [prop]: numValue });
    });
  };

  const handlePositionChange = (prop, value) => {
    if (!isSingleSelect) return;
    const numValue = Number(value);
    if (isNaN(numValue)) return;
    updateObject(obj.id, { [prop]: numValue });
  };

  const handleFontChange = (prop, value) => {
    if (obj.type !== 'sticky') return;
    selectedIds.forEach(id => {
      if (objects[id].type === 'sticky') {
        updateObject(id, { [prop]: value });
      }
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        right: 20,
        width: 280,
        maxHeight: 'calc(100vh - 140px)',
        overflowY: 'auto',
        background: 'rgba(15, 23, 42, 0.98)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        zIndex: 1500,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <h3 style={{ color: '#E2E8F0', margin: 0, fontSize: '1rem' }}>
          {isSingleSelect ? 'Properties' : `${selectedObjects.length} Objects`}
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94A3B8',
            fontSize: '1.25rem',
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
          }}
          title="Close properties panel (Esc)"
        >
          ×
        </button>
      </div>

      {/* Position (single select only) */}
      {isSingleSelect && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Position</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                value={Math.round(obj.x || 0)}
                onChange={(e) => handlePositionChange('x', e.target.value)}
                style={inputStyle}
                placeholder="X"
              />
              <div style={hintStyle}>X</div>
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                value={Math.round(obj.y || 0)}
                onChange={(e) => handlePositionChange('y', e.target.value)}
                style={inputStyle}
                placeholder="Y"
              />
              <div style={hintStyle}>Y</div>
            </div>
          </div>
        </div>
      )}

      {/* Size */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Size</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <input
              type="number"
              value={isSingleSelect ? Math.round(obj.width || 100) : ''}
              onChange={(e) => handleSizeChange('width', e.target.value)}
              style={inputStyle}
              placeholder={isSingleSelect ? 'Width' : 'Mixed'}
              disabled={!isSingleSelect}
            />
            <div style={hintStyle}>W</div>
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="number"
              value={isSingleSelect ? Math.round(obj.height || 100) : ''}
              onChange={(e) => handleSizeChange('height', e.target.value)}
              style={inputStyle}
              placeholder={isSingleSelect ? 'Height' : 'Mixed'}
              disabled={!isSingleSelect}
            />
            <div style={hintStyle}>H</div>
          </div>
        </div>
      </div>

      {/* Color */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>
          {obj.type === 'sticky' ? 'Background Color' : 'Fill Color'}
        </label>
        <input
          type="color"
          value={isSingleSelect ? (obj.color || '#6366F1') : '#6366F1'}
          onChange={handleColorChange}
          style={{
            width: '100%',
            height: 40,
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            cursor: 'pointer',
            background: 'transparent',
          }}
        />
      </div>

      {/* Font options for sticky notes */}
      {isSingleSelect && obj.type === 'sticky' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Text Color</label>
            <input
              type="color"
              value={obj.textColor || '#374151'}
              onChange={(e) => handleFontChange('textColor', e.target.value)}
              style={{
                width: '100%',
                height: 40,
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Font Family</label>
            <select
              value={obj.fontFamily || 'Inter'}
              onChange={(e) => handleFontChange('fontFamily', e.target.value)}
              style={inputStyle}
            >
              <option value="Inter">Inter</option>
              <option value="Arial">Arial</option>
              <option value="Comic Sans MS">Comic Sans</option>
              <option value="Courier New">Courier</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Font Size: {obj.fontSize || 14}px</label>
            <input
              type="range"
              min="10"
              max="32"
              value={obj.fontSize || 14}
              onChange={(e) => handleFontChange('fontSize', Number(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer',
              }}
            />
          </div>
        </>
      )}

      {/* Opacity for shapes */}
      {isSingleSelect && obj.type !== 'sticky' && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Opacity: {Math.round((obj.opacity || 0.9) * 100)}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={(obj.opacity || 0.9) * 100}
            onChange={(e) => {
              selectedIds.forEach(id => {
                updateObject(id, { opacity: Number(e.target.value) / 100 });
              });
            }}
            style={{
              width: '100%',
              cursor: 'pointer',
            }}
          />
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={deleteSelectedObjects}
        style={{
          width: '100%',
          padding: '10px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          color: '#FCA5A5',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        🗑️ Delete {selectedObjects.length > 1 ? `${selectedObjects.length} Objects` : 'Object'}
      </button>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  color: '#94A3B8',
  fontSize: '0.75rem',
  fontWeight: 600,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle = {
  width: '100%',
  padding: '8px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: '#E2E8F0',
  fontSize: '0.875rem',
  outline: 'none',
};

const hintStyle = {
  color: '#64748B',
  fontSize: '0.7rem',
  marginTop: 2,
  textAlign: 'center',
};
