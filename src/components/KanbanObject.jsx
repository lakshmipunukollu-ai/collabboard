import { useBoard } from '../context/BoardContext';

const COLUMN_COLORS = {
  'To Do': '#FEF08A',
  'In Progress': '#BFDBFE',
  'Done': '#BBF7D0',
};

export default function KanbanObject({ id, data, scale, stagePos }) {
  const { updateObject, deleteObject, selectedIds, toggleSelection } = useBoard();

  const {
    x = 0, y = 0, width = 760, height = 480,
    columns = [
      { title: 'To Do', cards: ['Task 1', 'Task 2'] },
      { title: 'In Progress', cards: ['Task 3'] },
      { title: 'Done', cards: ['Task 4'] },
    ],
  } = data;

  const isSelected = selectedIds.has(id);
  const screenX = stagePos.x + x * scale;
  const screenY = stagePos.y + y * scale;
  const screenW = width * scale;
  const screenH = height * scale;

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
        width: screenW, height: screenH,
        border: isSelected ? '2px solid #667eea' : '1px solid #334155',
        borderRadius: 10,
        background: '#0f172a',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        zIndex: 20,
        overflow: 'hidden',
        pointerEvents: 'all',
      }}
      onClick={(e) => { e.stopPropagation(); toggleSelection(id, e.shiftKey); }}
    >
      {/* Scale inner content */}
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: '1px solid #1e293b',
          background: '#1e293b',
        }}>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>📋 Kanban Board</span>
          <button
            onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete kanban board?')) deleteObject(id); }}
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
  );
}
