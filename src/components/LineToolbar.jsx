import { useState, useEffect, useRef } from 'react';

const TOOLBAR_HEIGHT = 44;
const TOOLBAR_MIN_WIDTH = 290;

const THICKNESSES = [
  { value: 1,  label: 'Thin',   icon: <span style={{ display:'inline-block', width:16, height:1,  background:'currentColor', verticalAlign:'middle' }} /> },
  { value: 2,  label: 'Normal', icon: <span style={{ display:'inline-block', width:16, height:2,  background:'currentColor', verticalAlign:'middle' }} /> },
  { value: 4,  label: 'Thick',  icon: <span style={{ display:'inline-block', width:16, height:4,  background:'currentColor', verticalAlign:'middle' }} /> },
  { value: 6,  label: 'Bold',   icon: <span style={{ display:'inline-block', width:16, height:6,  background:'currentColor', verticalAlign:'middle' }} /> },
  { value: 10, label: 'Heavy',  icon: <span style={{ display:'inline-block', width:16, height:10, background:'currentColor', verticalAlign:'middle' }} /> },
];

const LINE_DASHES = [
  { value: 'solid',  label: 'Solid',  icon: '━' },
  { value: 'dashed', label: 'Dashed', icon: '╌' },
  { value: 'dotted', label: 'Dotted', icon: '┈' },
];

const LINE_COLORS = [
  { value: '#ffffff', label: 'White' },
  { value: '#94a3b8', label: 'Light Grey' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#ef4444', label: 'Red' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#0f172a', label: 'Black' },
];

export default function LineToolbar({
  data,
  screenX,
  screenY,
  containerWidth,
  containerHeight,
  onUpdate,
  onDelete,
}) {
  const {
    strokeWidth: sw = 4,
    lineDash = 'solid',
    color = '#F59E0B',
  } = data;

  const [showColors, setShowColors] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteTimerRef = useRef(null);
  const toolbarRef = useRef(null);

  useEffect(() => {
    if (deleteArmed) {
      deleteTimerRef.current = setTimeout(() => setDeleteArmed(false), 2500);
    }
    return () => clearTimeout(deleteTimerRef.current);
  }, [deleteArmed]);

  useEffect(() => {
    if (!showColors) return;
    const handler = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setShowColors(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColors]);

  const handleDelete = () => {
    if (!deleteArmed) { setDeleteArmed(true); return; }
    clearTimeout(deleteTimerRef.current);
    onDelete();
  };

  // Position — centered above the line, clamped inside container
  const HALF_W = TOOLBAR_MIN_WIDTH / 2;
  const aboveY = screenY - TOOLBAR_HEIGHT - 12;
  const belowY = screenY + 12;
  const showBelow = aboveY < 8;
  const top = showBelow ? belowY : aboveY;
  const rawLeft = screenX - HALF_W;
  const left = Math.max(8, Math.min(rawLeft, containerWidth - TOOLBAR_MIN_WIDTH - 8));

  const base = { position: 'absolute', zIndex: 50, pointerEvents: 'all' };

  const toolbarStyle = {
    ...base, top, left,
    minWidth: TOOLBAR_MIN_WIDTH,
    height: TOOLBAR_HEIGHT,
    background: '#1e293b',
    border: '1px solid rgba(100,116,139,0.4)',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: '0 8px',
    userSelect: 'none',
  };

  const colorPickerStyle = {
    ...base,
    top: showBelow ? top + TOOLBAR_HEIGHT + 4 : top - 52,
    left,
    background: '#1e293b',
    border: '1px solid rgba(100,116,139,0.4)',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
  };

  const divider = (
    <div style={{ width: 1, height: 22, background: 'rgba(100,116,139,0.3)', margin: '0 4px', flexShrink: 0 }} />
  );

  const makeBtn = (active) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 30, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
    background: active ? '#3b82f6' : 'transparent',
    color:      active ? '#fff'    : '#94a3b8',
    transition: 'background 0.15s, color 0.15s',
    padding: '0 4px',
  });

  return (
    <div ref={toolbarRef}>
      {/* Color picker panel */}
      {showColors && (
        <div style={colorPickerStyle} onMouseDown={(e) => e.stopPropagation()}>
          {LINE_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => { onUpdate({ color: c.value }); setShowColors(false); }}
              style={{
                width: 22, height: 22, borderRadius: '50%',
                background: c.value,
                border: color === c.value ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
                boxShadow: color === c.value ? '0 0 0 2px #3b82f6' : 'none',
                flexShrink: 0, padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Main toolbar */}
      <div style={toolbarStyle} onMouseDown={(e) => e.stopPropagation()}>

        {/* Thickness label */}
        <span style={{ fontSize: 10, color: '#64748b', paddingRight: 2, whiteSpace: 'nowrap' }}>
          ══
        </span>

        {/* Thickness presets */}
        {THICKNESSES.map(({ value, label, icon }) => (
          <button
            key={value}
            title={label}
            onClick={() => onUpdate({ strokeWidth: value })}
            style={{ ...makeBtn(sw === value), color: sw === value ? '#fff' : '#94a3b8' }}
          >
            {icon}
          </button>
        ))}

        {divider}

        {/* Dash style */}
        {LINE_DASHES.map(({ value, label, icon }) => (
          <button
            key={value}
            title={label}
            onClick={() => onUpdate({ lineDash: value })}
            style={makeBtn(lineDash === value)}
          >
            {icon}
          </button>
        ))}

        {divider}

        {/* Color swatch */}
        <button
          title="Line color"
          onClick={() => setShowColors((v) => !v)}
          style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: color,
            border: '2px solid rgba(255,255,255,0.25)',
            boxShadow: '0 0 0 2px rgba(0,0,0,0.3)',
          }} />
        </button>

        {divider}

        {/* Delete */}
        <button
          title={deleteArmed ? 'Click again to confirm delete' : 'Delete line'}
          onClick={handleDelete}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: deleteArmed ? 'auto' : 30,
            padding: deleteArmed ? '0 10px' : 0,
            height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: deleteArmed ? 11 : 14,
            fontFamily: 'Inter, sans-serif',
            fontWeight: deleteArmed ? 600 : 400,
            background: deleteArmed ? '#ef4444' : 'transparent',
            color: deleteArmed ? '#fff' : '#ef4444',
            transition: 'background 0.15s, width 0.15s',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {deleteArmed ? '✓ Delete?' : '🗑'}
        </button>
      </div>
    </div>
  );
}
