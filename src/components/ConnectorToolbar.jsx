import { useState, useEffect, useRef } from 'react';

const TOOLBAR_HEIGHT = 44;
const TOOLBAR_MIN_WIDTH = 320;

const COLORS = [
  { value: '#64748b', label: 'Slate' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
];

const STYLES = [
  { value: 'straight', label: 'Straight', icon: '—' },
  { value: 'curved',   label: 'Curved',   icon: '⌒' },
  { value: 'elbowed',  label: 'Elbow',    icon: '⌐' },
];

const ARROWHEADS = [
  { value: 'end',  label: 'Arrow at end',       icon: '→' },
  { value: 'both', label: 'Arrow at both ends', icon: '↔' },
  { value: 'none', label: 'No arrowhead',       icon: '—' },
];

const STROKES = [
  { value: 'solid',  label: 'Solid',  icon: '━' },
  { value: 'dashed', label: 'Dashed', icon: '╌' },
  { value: 'dotted', label: 'Dotted', icon: '┈' },
];

export default function ConnectorToolbar({
  connectorId,
  data,
  screenX,
  screenY,
  containerWidth,
  containerHeight,
  onUpdate,
  onDelete,
}) {
  const {
    arrowStyle = 'straight',
    arrowHead = 'end',
    strokeDash = 'solid',
    color = '#64748b',
    label = '',
  } = data;

  const [showColors, setShowColors] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteTimerRef = useRef(null);
  const labelInputRef = useRef(null);
  const toolbarRef = useRef(null);

  // Sync draft when label changes externally
  useEffect(() => {
    setLabelDraft(label);
  }, [label]);

  // Auto-focus label input when editing opens
  useEffect(() => {
    if (editingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [editingLabel]);

  // Disarm delete after 2.5 s of inactivity
  useEffect(() => {
    if (deleteArmed) {
      deleteTimerRef.current = setTimeout(() => setDeleteArmed(false), 2500);
    }
    return () => clearTimeout(deleteTimerRef.current);
  }, [deleteArmed]);

  // Close color picker when clicking outside
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

  const saveLabel = () => {
    setEditingLabel(false);
    if (labelDraft !== label) {
      onUpdate({ label: labelDraft });
    }
  };

  const handleDelete = () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    clearTimeout(deleteTimerRef.current);
    onDelete();
  };

  // Position: centered on screenX, above screenY by default
  const HALF_W = TOOLBAR_MIN_WIDTH / 2;
  const aboveY = screenY - TOOLBAR_HEIGHT - 10;
  const belowY = screenY + 10;
  const showBelow = aboveY < 8;
  const top = showBelow ? belowY : aboveY;

  // Clamp horizontal so toolbar never leaves the container
  const rawLeft = screenX - HALF_W;
  const left = Math.max(8, Math.min(rawLeft, containerWidth - TOOLBAR_MIN_WIDTH - 8));

  const base = {
    position: 'absolute',
    zIndex: 50,
    pointerEvents: 'all',
  };

  const toolbarStyle = {
    ...base,
    top,
    left,
    minWidth: TOOLBAR_MIN_WIDTH,
    height: 'auto',
    minHeight: TOOLBAR_HEIGHT,
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

  const divider = (
    <div style={{ width: 1, height: 22, background: 'rgba(100,116,139,0.3)', margin: '0 4px', flexShrink: 0 }} />
  );

  const makeBtn = (activeValue, itemValue) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 28,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    background: activeValue === itemValue ? '#3b82f6' : 'transparent',
    color: activeValue === itemValue ? '#fff' : '#94a3b8',
    transition: 'background 0.15s, color 0.15s',
  });

  const styleBtn = (s) => makeBtn(arrowStyle, s.value);

  const colorSwatch = {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: color,
    border: '2px solid rgba(255,255,255,0.25)',
    cursor: 'pointer',
    flexShrink: 0,
    boxShadow: `0 0 0 2px rgba(0,0,0,0.3)`,
  };

  const labelBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 8px',
    height: 28,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    background: 'transparent',
    color: label ? '#e2e8f0' : '#64748b',
    whiteSpace: 'nowrap',
    maxWidth: 90,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const deleteBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: deleteArmed ? 'auto' : 30,
    padding: deleteArmed ? '0 10px' : 0,
    height: 28,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: deleteArmed ? 11 : 14,
    fontFamily: 'Inter, sans-serif',
    fontWeight: deleteArmed ? 600 : 400,
    background: deleteArmed ? '#ef4444' : 'transparent',
    color: deleteArmed ? '#fff' : '#ef4444',
    transition: 'background 0.15s, color 0.15s, width 0.15s',
    whiteSpace: 'nowrap',
    flexShrink: 0,
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

  return (
    <div ref={toolbarRef}>
      {/* Color picker panel — floats above/below toolbar */}
      {showColors && (
        <div style={colorPickerStyle} onMouseDown={(e) => e.stopPropagation()}>
          {COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => { onUpdate({ color: c.value }); setShowColors(false); }}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: c.value,
                border: color === c.value ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
                boxShadow: color === c.value ? '0 0 0 2px #3b82f6' : 'none',
                flexShrink: 0,
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Main toolbar */}
      <div style={{ ...toolbarStyle, flexWrap: 'wrap', paddingTop: 4, paddingBottom: 4 }} onMouseDown={(e) => e.stopPropagation()}>
        {/* Line style buttons */}
        {STYLES.map((s) => (
          <button
            key={s.value}
            title={s.label}
            onClick={() => onUpdate({ arrowStyle: s.value })}
            style={styleBtn(s)}
          >
            {s.icon}
          </button>
        ))}

        {divider}

        {/* Arrowhead buttons */}
        {ARROWHEADS.map((a) => (
          <button
            key={a.value}
            title={a.label}
            onClick={() => onUpdate({ arrowHead: a.value })}
            style={makeBtn(arrowHead, a.value)}
          >
            {a.icon}
          </button>
        ))}

        {divider}

        {/* Stroke style buttons */}
        {STROKES.map((s) => (
          <button
            key={s.value}
            title={s.label}
            onClick={() => onUpdate({ strokeDash: s.value })}
            style={makeBtn(strokeDash, s.value)}
          >
            {s.icon}
          </button>
        ))}

        {divider}

        {/* Color swatch */}
        <button
          title="Color"
          onClick={() => { setShowColors((v) => !v); setEditingLabel(false); }}
          style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <div style={colorSwatch} />
        </button>

        {divider}

        {/* Label button / inline edit */}
        {editingLabel ? (
          <input
            ref={labelInputRef}
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveLabel();
              if (e.key === 'Escape') { setEditingLabel(false); setLabelDraft(label); }
              e.stopPropagation();
            }}
            placeholder="Label…"
            style={{
              width: 88,
              height: 26,
              borderRadius: 5,
              border: '1px solid #3b82f6',
              background: '#0f172a',
              color: '#e2e8f0',
              fontSize: 11,
              fontFamily: 'Inter, sans-serif',
              padding: '0 6px',
              outline: 'none',
            }}
          />
        ) : (
          <button
            title={label ? 'Edit label' : 'Add label'}
            onClick={() => { setEditingLabel(true); setShowColors(false); setLabelDraft(label); }}
            style={labelBtnStyle}
          >
            ✏ {label || '+ Label'}
          </button>
        )}

        {divider}

        {/* Delete */}
        <button
          title={deleteArmed ? 'Click again to confirm delete' : 'Delete connector'}
          onClick={handleDelete}
          style={deleteBtnStyle}
        >
          {deleteArmed ? '✓ Delete?' : '🗑'}
        </button>
      </div>
    </div>
  );
}
