import { useCallback } from 'react';
import { useBoard } from '../context/BoardContext';

export default function TableObject({ id, data, scale, stagePos }) {
  const {
    updateObject, deleteObject, selectedIds, toggleSelection,
    moveObjectGroupLocal, moveObjectGroup, beginMoveUndo, resizeObject,
  } = useBoard();

  const {
    x = 0, y = 0, width = 480, height = 280,
    color = '#1e293b',
    rows = [
      ['Column 1', 'Column 2', 'Column 3'],
      ['Row 1 A', 'Row 1 B', 'Row 1 C'],
      ['Row 2 A', 'Row 2 B', 'Row 2 C'],
    ],
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
      const nh = Math.max(150, startH + (me.clientY - startY) / s);
      updateObject(id, { width: nw, height: nh });
    };
    const onUp = (me) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const nw = Math.max(200, startW + (me.clientX - startX) / s);
      const nh = Math.max(150, startH + (me.clientY - startY) / s);
      resizeObject(id, x, y, nw, nh);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [id, x, y, width, height, scale, updateObject, resizeObject]);

  const updateCell = (ri, ci, val) => {
    const newRows = rows.map((row, r) =>
      r === ri ? row.map((cell, c) => (c === ci ? val : cell)) : row
    );
    updateObject(id, { rows: newRows });
  };

  const addRow = () => {
    const newRow = rows[0].map(() => '');
    updateObject(id, { rows: [...rows, newRow] });
  };

  const addCol = () => {
    const newRows = rows.map((row) => [...row, '']);
    updateObject(id, { rows: newRows });
  };

  const isHeader = (ri) => ri === 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX, top: screenY,
        width: screenW, height: screenH + 28,
        border: isSelected ? '2px solid #667eea' : '1px solid #334155',
        borderRadius: 8, background: '#0f172a',
        boxShadow: isSelected ? '0 4px 24px rgba(102,126,234,0.3)' : '0 4px 16px rgba(0,0,0,0.4)',
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
          background: 'rgba(15,23,42,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          cursor: 'grab', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6, userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 13, color: '#475569', letterSpacing: 3 }}>⠿⠿</span>
        <span style={{ fontSize: 9, color: '#334155', letterSpacing: 0.5 }}>drag to move</span>
      </div>

      {/* ── Scaled content ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height }}>
          {/* Toolbar — also draggable */}
          <div
            onMouseDown={handleDragMouseDown}
            style={{
              display: 'flex', gap: 6, padding: '5px 8px',
              background: color, borderBottom: '1px solid #334155',
              alignItems: 'center', cursor: 'grab', userSelect: 'none',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, flex: 1 }}>📊 Table</span>
            <button onClick={(e) => { e.stopPropagation(); addRow(); }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{ padding: '2px 7px', fontSize: 10, background: '#334155', border: 'none', borderRadius: 4, color: '#e2e8f0', cursor: 'pointer' }}>
              + Row
            </button>
            <button onClick={(e) => { e.stopPropagation(); addCol(); }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{ padding: '2px 7px', fontSize: 10, background: '#334155', border: 'none', borderRadius: 4, color: '#e2e8f0', cursor: 'pointer' }}>
              + Col
            </button>
            <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete table?')) deleteObject(id); }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>×</button>
          </div>
          {/* Table */}
          <div style={{ overflow: 'auto', padding: 6 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{
                        border: '1px solid #334155',
                        padding: 0,
                        background: isHeader(ri) ? '#1e293b' : 'transparent',
                      }}>
                        <input
                          value={cell}
                          onChange={(e) => updateCell(ri, ci, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{
                            width: '100%', border: 'none',
                            background: 'transparent',
                            color: isHeader(ri) ? '#e2e8f0' : '#94a3b8',
                            fontWeight: isHeader(ri) ? 700 : 400,
                            fontSize: 11, padding: '4px 6px',
                            outline: 'none', fontFamily: 'inherit',
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
