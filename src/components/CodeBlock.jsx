import { useCallback } from 'react';
import { useBoard } from '../context/BoardContext';

export default function CodeBlock({ id, data, scale, stagePos }) {
  const {
    updateObject, deleteObject, selectedIds, toggleSelection,
    moveObjectGroupLocal, moveObjectGroup, beginMoveUndo, resizeObject,
  } = useBoard();

  const {
    x = 0, y = 0, width = 420, height = 240,
    code = '// Write your code here\nconst hello = "world";',
    language = 'javascript',
  } = data;

  const isSelected = selectedIds.has(id);
  const screenX = stagePos.x + x * scale;
  const screenY = stagePos.y + y * scale;
  const screenW = width * scale;
  const screenH = height * scale;

  // ── Drag to move ─────────────────────────────────────────────────────────
  const handleDragMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    beginMoveUndo(id);
    const startX = e.clientX, startY = e.clientY;
    const startWX = x, startWY = y, s = scale;
    let moved = false;
    const onMove = (me) => {
      const dx = me.clientX - startX, dy = me.clientY - startY;
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      moved = true;
      moveObjectGroupLocal(id, startWX + dx / s, startWY + dy / s);
    };
    const onUp = (me) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!moved) return;
      const dx = me.clientX - startX, dy = me.clientY - startY;
      moveObjectGroup(id, startWX + dx / s, startWY + dy / s);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [id, x, y, scale, beginMoveUndo, moveObjectGroupLocal, moveObjectGroup]);

  // ── Resize from bottom-right corner ──────────────────────────────────────
  const handleResizeMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = width, startH = height, s = scale;
    const onMove = (me) => {
      const nw = Math.max(200, startW + (me.clientX - startX) / s);
      const nh = Math.max(120, startH + (me.clientY - startY) / s);
      updateObject(id, { width: nw, height: nh });
    };
    const onUp = (me) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const nw = Math.max(200, startW + (me.clientX - startX) / s);
      const nh = Math.max(120, startH + (me.clientY - startY) / s);
      resizeObject(id, x, y, nw, nh);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [id, x, y, width, height, scale, updateObject, resizeObject]);

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX, top: screenY,
        width: screenW, height: screenH + 28,
        border: isSelected ? '2px solid #667eea' : '1px solid #30363d',
        borderRadius: 8, background: '#0d1117',
        boxShadow: isSelected ? '0 4px 24px rgba(102,126,234,0.3)' : '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 20, overflow: 'hidden', pointerEvents: 'all',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={(e) => { e.stopPropagation(); toggleSelection(id, e.shiftKey); }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedIds.has(id)) toggleSelection(id, false);
        window.dispatchEvent(new CustomEvent('richobject:contextmenu', {
          detail: { objectId: id, screenX: e.clientX, screenY: e.clientY },
        }));
      }}
    >
      {/* ── Drag handle strip — OUTSIDE transform:scale ── */}
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          height: 28, flexShrink: 0,
          background: '#0d1117',
          borderBottom: '1px solid #30363d',
          cursor: 'grab', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6, userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 13, color: '#30363d', letterSpacing: 3 }}>⠿⠿</span>
        <span style={{ fontSize: 9, color: '#30363d', letterSpacing: 0.5 }}>drag to move</span>
      </div>

      {/* ── Scaled content ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height, display: 'flex', flexDirection: 'column' }}>
          {/* Tab bar — also draggable */}
          <div
            onMouseDown={handleDragMouseDown}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', background: '#161b22',
              borderBottom: '1px solid #30363d',
              cursor: 'grab', userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', gap: 5 }}>
              {['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => (
                <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <select
              value={language}
              onChange={(e) => updateObject(id, { language: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'transparent', border: 'none',
                color: '#8b949e', fontSize: 10, cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {['javascript', 'typescript', 'python', 'sql', 'bash', 'json', 'html', 'css'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <div style={{ flex: 1 }} />
            <button
              onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete code block?')) deleteObject(id); }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{ background: 'transparent', border: 'none', color: '#6e7681', cursor: 'pointer', fontSize: 13 }}
            >×</button>
          </div>

          {/* Code editor */}
          <textarea
            value={code}
            onChange={(e) => updateObject(id, { code: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            spellCheck={false}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: '#e6edf3', fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
              fontSize: 11, lineHeight: 1.6,
              padding: '8px 12px', resize: 'none', outline: 'none',
            }}
          />
        </div>
      </div>
      {/* Resize handle — bottom-right corner */}
      {isSelected && (
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute', bottom: 3, right: 3,
            width: 12, height: 12, borderRadius: '50%',
            background: '#667eea', cursor: 'se-resize', zIndex: 30,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.6)',
          }}
        />
      )}
    </div>
  );
}
