import { useBoard } from '../context/BoardContext';

export default function TableObject({ id, data, scale, stagePos }) {
  const { updateObject, deleteObject, selectedIds, toggleSelection } = useBoard();

  const {
    x = 0, y = 0, width = 480, height = 280,
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
        width: screenW, height: screenH,
        border: isSelected ? '2px solid #667eea' : '1px solid #334155',
        borderRadius: 8, background: '#0f172a',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        zIndex: 20, overflow: 'hidden', pointerEvents: 'all',
      }}
      onClick={(e) => { e.stopPropagation(); toggleSelection(id, e.shiftKey); }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', gap: 6, padding: '5px 8px',
          background: '#1e293b', borderBottom: '1px solid #334155',
          alignItems: 'center',
        }}>
          <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, flex: 1 }}>📊 Table</span>
          <button onClick={(e) => { e.stopPropagation(); addRow(); }}
            style={{ padding: '2px 7px', fontSize: 10, background: '#334155', border: 'none', borderRadius: 4, color: '#e2e8f0', cursor: 'pointer' }}>
            + Row
          </button>
          <button onClick={(e) => { e.stopPropagation(); addCol(); }}
            style={{ padding: '2px 7px', fontSize: 10, background: '#334155', border: 'none', borderRadius: 4, color: '#e2e8f0', cursor: 'pointer' }}>
            + Col
          </button>
          <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete table?')) deleteObject(id); }}
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>×</button>
        </div>
        {/* Table */}
        <div style={{ overflowAuto: 'auto', padding: 6 }}>
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
  );
}
