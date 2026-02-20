import { useCallback, useState, useEffect, useRef } from 'react';
import { useBoard } from '../context/BoardContext';
import { showToast } from './Toast';
import ClearBoardButton from './ClearBoardButton';
import HistoryPanel from './HistoryPanel';
import BoardStateModal from './BoardStateModal';

const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#FDE68A'];

export default function Toolbar({ isCollapsed, onToggleCollapse }) {
  const {
    createStickyNote, createShape, createConnector, createFrame,
    createTextBox, createArrow, createImage,
    createKanban, createTable, createCodeBlock, createEmbed, createMindMapNode,
    getBoardState, stageRef, selectedIds, userPermission,
  } = useBoard();
  const imageInputRef = useRef(null);
  const [connectorMode, setConnectorMode] = useState(false);
  const [boardStateModalOpen, setBoardStateModalOpen] = useState(false);
  const [connectorStyle, setConnectorStyle] = useState('arrow');
  const [firstSelectedForConnector, setFirstSelectedForConnector] = useState(null);

  const canEdit = userPermission === 'edit' || userPermission === 'owner';

  const getBoardCenter = useCallback(() => {
    const stage = stageRef?.current;
    if (!stage) return { x: 200, y: 200 };
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point({ x: stage.width() / 2, y: stage.height() / 2 });
  }, [stageRef]);

  const getScaledSize = useCallback((baseSize) => {
    const stage = stageRef?.current;
    const scale = stage ? stage.scaleX() : 1;
    const minWorldSize = 150 / scale;
    const scaleFactor = Math.max(1, minWorldSize / baseSize);
    return Math.min(scaleFactor, 200);
  }, [stageRef]);

  const handleAddSticky = useCallback(() => {
    const { x, y } = getBoardCenter();
    const sf = getScaledSize(160);
    createStickyNote('New note', x - 80 * sf, y - 60 * sf,
      STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)], 160 * sf, 120 * sf);
    showToast('📝 Sticky note created', 'success');
  }, [createStickyNote, getBoardCenter, getScaledSize]);

  const handleAddRectangle = useCallback(() => {
    const { x, y } = getBoardCenter();
    const sf = getScaledSize(100);
    createShape('rectangle', x - 50 * sf, y - 40 * sf, 100 * sf, 80 * sf);
    showToast('◻️ Rectangle created', 'success');
  }, [createShape, getBoardCenter, getScaledSize]);

  const handleAddCircle = useCallback(() => {
    const { x, y } = getBoardCenter();
    const sf = getScaledSize(100);
    createShape('circle', x - 50 * sf, y - 50 * sf, 100 * sf, 100 * sf, '#10B981');
    showToast('⭕ Circle created', 'success');
  }, [createShape, getBoardCenter, getScaledSize]);

  const handleAddLine = useCallback(() => {
    const { x, y } = getBoardCenter();
    const sf = getScaledSize(150);
    createShape('line', x - 75 * sf, y - 10 * sf, 150 * sf, 20 * sf, '#F59E0B');
    showToast('➖ Line created', 'success');
  }, [createShape, getBoardCenter, getScaledSize]);

  const handleAddOval = useCallback(() => {
    const { x, y } = getBoardCenter();
    const sf = getScaledSize(120);
    createShape('oval', x - 60 * sf, y - 40 * sf, 120 * sf, 80 * sf, '#8B5CF6');
    showToast('⭕ Oval created', 'success');
  }, [createShape, getBoardCenter, getScaledSize]);

  const handleAddFrame = useCallback(() => {
    const { x, y } = getBoardCenter();
    createFrame(x - 300, y - 200, 600, 400, 'Frame');
    showToast('📦 Frame created', 'success');
  }, [createFrame, getBoardCenter]);

  const handleAddTextBox = useCallback(() => {
    const { x, y } = getBoardCenter();
    createTextBox('Text', x - 100, y - 30, 200, 60);
    showToast('T Text box created', 'success');
  }, [createTextBox, getBoardCenter]);

  const handleAddArrow = useCallback(() => {
    const { x, y } = getBoardCenter();
    createArrow(x - 75, y, x + 75, y);
    showToast('→ Arrow created', 'success');
  }, [createArrow, getBoardCenter]);

  const handleAddKanban = useCallback(() => {
    const { x, y } = getBoardCenter();
    createKanban(x - 380, y - 240);
    showToast('📋 Kanban board created', 'success');
  }, [createKanban, getBoardCenter]);

  const handleAddTable = useCallback(() => {
    const { x, y } = getBoardCenter();
    createTable(x - 240, y - 140);
    showToast('📊 Table created', 'success');
  }, [createTable, getBoardCenter]);

  const handleAddCodeBlock = useCallback(() => {
    const { x, y } = getBoardCenter();
    createCodeBlock(x - 210, y - 120);
    showToast('💻 Code block created', 'success');
  }, [createCodeBlock, getBoardCenter]);

  const handleAddEmbed = useCallback(() => {
    const url = window.prompt('URL to embed (https://…):');
    if (url === null) return;
    const { x, y } = getBoardCenter();
    createEmbed(url, x - 240, y - 160);
    showToast('🔗 Embed created', 'success');
  }, [createEmbed, getBoardCenter]);

  const handleAddMindMapNode = useCallback(() => {
    const { x, y } = getBoardCenter();
    createMindMapNode('Idea', x - 60, y - 60);
    showToast('🧠 Mind map node created', 'success');
  }, [createMindMapNode, getBoardCenter]);

  const handleImageFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { x, y } = getBoardCenter();
      createImage(ev.target.result, x - 120, y - 80, 240, 160);
      showToast('🖼 Image placed', 'success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [createImage, getBoardCenter]);

  const toggleConnectorMode = useCallback(() => {
    const newMode = !connectorMode;
    setConnectorMode(newMode);
    setFirstSelectedForConnector(null);
    showToast(newMode ? '🔗 Click 2 objects to connect' : '✓ Connector mode off', 'info');
  }, [connectorMode]);

  useEffect(() => {
    if (!connectorMode) return;
    const selectedArray = Array.from(selectedIds);
    if (selectedArray.length === 1 && !firstSelectedForConnector) {
      setFirstSelectedForConnector(selectedArray[0]);
      showToast('✓ First selected. Click another to connect.', 'info');
    } else if (
      selectedArray.length === 1 &&
      firstSelectedForConnector &&
      selectedArray[0] !== firstSelectedForConnector
    ) {
      createConnector(firstSelectedForConnector, selectedArray[0], connectorStyle);
      showToast('🔗 Connector created!', 'success');
      setFirstSelectedForConnector(null);
    }
  }, [selectedIds, connectorMode, firstSelectedForConnector, connectorStyle, createConnector]);

  useEffect(() => {
    if (!connectorMode) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setConnectorMode(false);
        setFirstSelectedForConnector(null);
        showToast('✓ Connector mode exited', 'info');
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [connectorMode]);

  const collapsed = isCollapsed;

  const Btn = ({ icon, label, onClick, disabled, title, className = '' }) => (
    <button
      type="button"
      className={`toolbar-btn${className ? ' ' + className : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title || label}
    >
      <span className="btn-icon">{icon}</span>
      <span className="btn-label">{label}</span>
    </button>
  );

  return (
    <div className={`toolbar${collapsed ? ' is-collapsed' : ''}`}>
      {/* Collapse toggle */}
      <button
        type="button"
        className="toolbar-collapse-btn"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '▶' : '◀'}
      </button>

      <div className="toolbar-divider" />

      {/* CREATE OBJECTS */}
      <div className="toolbar-section-label">Create</div>

      <Btn
        icon="📝" label="Sticky Note"
        onClick={canEdit ? handleAddSticky : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Sticky note (N)' : 'View-only'}
      />
      <Btn
        icon="◻" label="Rectangle"
        onClick={canEdit ? handleAddRectangle : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Rectangle (R)' : 'View-only'}
      />
      <Btn
        icon="⭕" label="Circle"
        onClick={canEdit ? handleAddCircle : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Circle (C)' : 'View-only'}
      />
      <Btn
        icon="➖" label="Line"
        onClick={canEdit ? handleAddLine : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Line (L)' : 'View-only'}
      />
      <Btn
        icon="⭕" label="Oval"
        onClick={canEdit ? handleAddOval : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Oval (O)' : 'View-only'}
      />
      <Btn
        icon="🔗" label={connectorMode ? 'Connecting…' : 'Connector'}
        onClick={canEdit ? toggleConnectorMode : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Connect objects' : 'View-only'}
        className={connectorMode ? 'active' : ''}
      />
      <Btn
        icon="📦" label="Frame"
        onClick={canEdit ? handleAddFrame : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Frame (F)' : 'View-only'}
      />
      <Btn
        icon="T" label="Text Box"
        onClick={canEdit ? handleAddTextBox : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Plain text box' : 'View-only'}
      />
      <Btn
        icon="→" label="Arrow"
        onClick={canEdit ? handleAddArrow : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Standalone arrow' : 'View-only'}
      />
      <Btn
        icon="🖼" label="Image"
        onClick={canEdit ? () => imageInputRef.current?.click() : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Upload an image' : 'View-only'}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFile}
      />

      <div className="toolbar-divider" />
      <div className="toolbar-section-label">Rich Objects</div>

      <Btn
        icon="📋" label="Kanban"
        onClick={canEdit ? handleAddKanban : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Kanban board (3 columns)' : 'View-only'}
      />
      <Btn
        icon="📊" label="Table"
        onClick={canEdit ? handleAddTable : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Editable table' : 'View-only'}
      />
      <Btn
        icon="💻" label="Code Block"
        onClick={canEdit ? handleAddCodeBlock : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Code editor block' : 'View-only'}
      />
      <Btn
        icon="🔗" label="Embed"
        onClick={canEdit ? handleAddEmbed : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Embed a URL (iFrame)' : 'View-only'}
      />
      <Btn
        icon="🧠" label="Mind Map"
        onClick={canEdit ? handleAddMindMapNode : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Mind map node' : 'View-only'}
      />

      {/* Connector style selector (only when in connector mode and not collapsed) */}
      {connectorMode && !collapsed && (
        <div style={{ padding: '4px 6px' }}>
          <select
            value={connectorStyle}
            onChange={(e) => setConnectorStyle(e.target.value)}
            style={{
              width: '100%',
              padding: '5px 8px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            <option value="arrow">→ Arrow</option>
            <option value="line">─ Line</option>
            <option value="curved">⤴ Curved</option>
            <option value="elbowed">⌐ Elbowed</option>
          </select>
        </div>
      )}

      <div className="toolbar-divider" style={{ marginTop: 6 }} />

      {/* ACTIONS */}
      <div className="toolbar-section-label">Actions</div>

      <Btn
        icon="📋" label="Board state"
        onClick={() => setBoardStateModalOpen(true)}
        title="View board state"
      />
      <HistoryPanel collapsed={collapsed} />
      <ClearBoardButton collapsed={collapsed} />

      {boardStateModalOpen && getBoardState && (
        <BoardStateModal
          getBoardState={getBoardState}
          onClose={() => setBoardStateModalOpen(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
