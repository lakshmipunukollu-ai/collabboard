import { useBoard } from '../context/BoardContext';

export default function CodeBlock({ id, data, scale, stagePos }) {
  const { updateObject, deleteObject, selectedIds, toggleSelection } = useBoard();

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

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX, top: screenY,
        width: screenW, height: screenH,
        border: isSelected ? '2px solid #667eea' : '1px solid #334155',
        borderRadius: 8, background: '#0d1117',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 20, overflow: 'hidden', pointerEvents: 'all',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={(e) => { e.stopPropagation(); toggleSelection(id, e.shiftKey); }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height, display: 'flex', flexDirection: 'column' }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', background: '#161b22',
          borderBottom: '1px solid #30363d',
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => (
              <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <select
            value={language}
            onChange={(e) => updateObject(id, { language: e.target.value })}
            onClick={(e) => e.stopPropagation()}
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
            style={{ background: 'transparent', border: 'none', color: '#6e7681', cursor: 'pointer', fontSize: 13 }}
          >×</button>
        </div>

        {/* Code editor */}
        <textarea
          value={code}
          onChange={(e) => updateObject(id, { code: e.target.value })}
          onClick={(e) => e.stopPropagation()}
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
  );
}
