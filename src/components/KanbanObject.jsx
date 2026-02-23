import { useCallback } from 'react';
import { useBoard } from '../context/BoardContext';

const COLUMN_COLORS = {
  'To Do': '#FEF08A',
  'In Progress': '#BFDBFE',
  'Done': '#BBF7D0',
};

export default function KanbanObject({ id, data, scale, stagePos }) {
  const {
    updateObject, deleteObject, selectedIds, toggleSelection,
    moveObjectGroupLocal, moveObjectGroup, beginMoveUndo, resizeObject,
  } = useBoard();

  const {
    x = 0, y = 0, width = 760, height = 480,
    color = '#1e293b',
    columns: rawColumns = [
      { title: 'To Do', cards: ['Task 1', 'Task 2'] },
      { title: 'In Progress', cards: ['Task 3'] },
      { title: 'Done', cards: ['Task 4'] },
    ],
  } = data;

  // Normalize: Firebase may store cards as an object {0:'a',1:'b'} or omit it entirely
  const columns = (Array.isArray(rawColumns) ? rawColumns : Object.values(rawColumns || {})).map(
    (col) => ({
      ...col,
      cards: Array.isArray(col?.cards)
        ? col.cards
        : Object.values(col?.cards || {}),
    }),
  );

  const isSelected = selectedIds.has(id);
  const screenX = stagePos.x + x * scale;
  const screenY = stagePos.y + y * scale;
  const screenW = width * scale;
  const screenH = height * scale;

  // ── Drag to move ─────────────────────────────────────────────────────────
  // Uses window listeners (not document) and e.preventDefault() so the browser
  // doesn't interfere with text selection or native element dragging.
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
      const nw = Math.max(400, startW + (me.clientX - startX) / s);
      const nh = Math.max(300, startH + (me.clientY - startY) / s);
      updateObject(id, { width: nw, height: nh });
    };
    const onUp = (me) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const nw = Math.max(400, startW + (me.clientX - startX) / s);
      const nh = Math.max(300, startH + (me.clientY - startY) / s);
      resizeObject(id, x, y, nw, nh);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [id, x, y, width, height, scale, updateObject, resizeObject]);

  const addCard = (colIdx) => {
    const text = window.prompt('Card text:');
    if (!text) return;
    const newCols = columns.map((col, i) =>
      i === colIdx ? { ...col, cards: [...col.cards, text] } : col
    );
    updateObject(id, { columns: newCols });
  };

  const removeCard = (colIdx, cardIdx) => {
    const newCols = columns.map((col, i) =>
      i === colIdx ? { ...col, cards: col.cards.filter((_, j) => j !== cardIdx) } : col
    );
    updateObject(id, { columns: newCols });
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX, top: screenY,
        width: screenW,
        // Extra 28px for the drag handle strip that sits outside the scaled content
        height: screenH + 28,
        border: isSelected ? '2px solid #667eea' : '1px solid #334155',
        borderRadius: 10,
        background: '#0f172a',
        boxShadow: isSelected ? '0 4px 24px rgba(102,126,234,0.3)' : '0 4px 16px rgba(0,0,0,0.4)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'all',
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
      {/* ── Drag handle strip — OUTSIDE the transform:scale div ── */}
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          height: 28,
          flexShrink: 0,
          background: 'rgba(15,23,42,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 13, color: '#475569', letterSpacing: 3 }}>⠿⠿</span>
        <span style={{ fontSize: 9, color: '#334155', letterSpacing: 0.5 }}>drag to move</span>
      </div>

      {/* ── Scaled content (columns, header etc.) ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height }}>
          {/* Header — also draggable */}
          <div
            onMouseDown={handleDragMouseDown}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderBottom: '1px solid #1e293b',
              background: color,
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>📋 Kanban Board</span>
            <button
              onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete kanban board?')) deleteObject(id); }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}
            >×</button>
          </div>

          {/* Columns */}
          <div style={{ display: 'flex', gap: 8, padding: 10, height: height - 40, overflow: 'hidden' }}>
            {columns.map((col, ci) => (
              <div key={ci} style={{
                flex: 1, background: '#1e293b', borderRadius: 8,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
                <div style={{
                  padding: '6px 10px', fontWeight: 700, fontSize: 11,
                  color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderBottom: '1px solid #334155',
                }}>
                  {col.title} ({col.cards.length})
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {col.cards.map((card, ki) => (
                    <div key={ki} style={{
                      background: COLUMN_COLORS[col.title] || '#FEF08A',
                      borderRadius: 6, padding: '6px 8px',
                      fontSize: 12, color: '#1e293b', fontWeight: 500,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      cursor: 'default',
                    }}>
                      <span>{card}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeCard(ci, ki); }}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, padding: '0 0 0 4px', flexShrink: 0 }}
                      >×</button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); addCard(ci); }}
                  style={{
                    margin: '0 8px 8px', padding: '4px 8px', background: 'rgba(255,255,255,0.05)',
                    border: '1px dashed #334155', borderRadius: 6, color: '#64748b',
                    fontSize: 11, cursor: 'pointer',
                  }}
                >
                  + Add card
                </button>
              </div>
            ))}
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
