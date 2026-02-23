import { useCallback, useState, useRef } from 'react';
import { useBoard } from '../context/BoardContext';
import { showToast } from './Toast';
import ClearBoardButton from './ClearBoardButton';
import HistoryPanel from './HistoryPanel';
import BoardStateModal from './BoardStateModal';

const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#FDE68A'];

export default function Toolbar({ isCollapsed, onToggleCollapse }) {
  const {
    createStickyNote, createShape, createFrame,
    createTextBox, createArrow, createImage,
    createKanban, createTable, createCodeBlock, createEmbed, createMindMapNode,
    getBoardState, stageRef, userPermission,
    activeTool, setActiveTool,
  } = useBoard();
  const imageInputRef = useRef(null);
  const [boardStateModalOpen, setBoardStateModalOpen] = useState(false);

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

  // Click-to-place: set active tool instead of creating immediately
  const handleAddSticky = useCallback(() => {
    setActiveTool(activeTool === 'sticky' ? 'select' : 'sticky');
    showToast('📝 Click on the board to place sticky note', 'info');
  }, [setActiveTool, activeTool]);

  const handleAddRectangle = useCallback(() => {
    setActiveTool(activeTool === 'rect' ? 'select' : 'rect');
    showToast('◻ Click on the board to place rectangle', 'info');
  }, [setActiveTool, activeTool]);

  const handleAddSquare = useCallback(() => {
    setActiveTool(activeTool === 'square' ? 'select' : 'square');
    showToast('⬛ Click on the board to place square', 'info');
  }, [setActiveTool, activeTool]);

  const handleAddCircle = useCallback(() => {
    setActiveTool(activeTool === 'circle' ? 'select' : 'circle');
    showToast('⭕ Click on the board to place circle', 'info');
  }, [setActiveTool, activeTool]);

  const handleAddLine = useCallback(() => {
    setActiveTool(activeTool === 'line' ? 'select' : 'line');
    showToast('➖ Click on the board to place line', 'info');
  }, [setActiveTool, activeTool]);

  const handleAddOval = useCallback(() => {
    setActiveTool(activeTool === 'oval' ? 'select' : 'oval');
    showToast('⭕ Click on the board to place oval', 'info');
  }, [setActiveTool, activeTool]);

  const handleAddFrame = useCallback(() => {
    setActiveTool(activeTool === 'frame' ? 'select' : 'frame');
    showToast('📦 Click on the board to place frame', 'info');
  }, [setActiveTool, activeTool]);

  const handleAddTextBox = useCallback(() => {
    setActiveTool(activeTool === 'text' ? 'select' : 'text');
    showToast('T Click on the board to place text box', 'info');
  }, [setActiveTool, activeTool]);

  const handleAddArrow = useCallback(() => {
    setActiveTool(activeTool === 'arrow' ? 'select' : 'arrow');
    showToast('→ Click on the board to place arrow', 'info');
  }, [setActiveTool, activeTool]);

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

  const collapsed = isCollapsed;

  const Btn = ({ icon, label, onClick, disabled, title, className = '', active = false }) => (
    <button
      type="button"
      className={`toolbar-btn${className ? ' ' + className : ''}${active ? ' toolbar-btn--active' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title || label}
      style={active ? { background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.6)', borderRadius: 6 } : undefined}
    >
      <span className="btn-icon">{icon}</span>
      <span className="btn-label">{label}</span>
    </button>
  );

  return (
    <div className={`toolbar${collapsed ? ' is-collapsed' : ''}`}>
      <div className="toolbar-divider" />

      {/* NAVIGATION TOOLS */}
      <div className="toolbar-section-label">Navigate</div>
      <Btn
        icon="🖱️" label="Select"
        onClick={() => setActiveTool(activeTool === 'select' ? 'select' : 'select')}
        title="Select tool (V) — click objects or drag to multi-select"
        active={activeTool === 'select' || !activeTool}
      />
      <Btn
        icon="✋" label="Hand"
        onClick={() => setActiveTool(activeTool === 'hand' ? 'select' : 'hand')}
        title="Hand tool (H) — drag to pan the canvas"
        active={activeTool === 'hand'}
      />

      <div className="toolbar-divider" />

      {/* CREATE OBJECTS */}
      <div className="toolbar-section-label">Create</div>

      <Btn
        icon="📝" label="Sticky Note"
        onClick={canEdit ? handleAddSticky : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Sticky note (N) — click board to place' : 'View-only'}
        active={activeTool === 'sticky'}
      />
      <Btn
        icon="◻" label="Rectangle"
        onClick={canEdit ? handleAddRectangle : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Rectangle (R) — click board to place' : 'View-only'}
        active={activeTool === 'rect'}
      />
      <Btn
        icon={<span style={{display:'inline-block',width:14,height:14,border:'2px solid currentColor',verticalAlign:'middle'}} />}
        label="Square"
        onClick={canEdit ? handleAddSquare : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Square — click board to place' : 'View-only'}
        active={activeTool === 'square'}
      />
      <Btn
        icon="⭕" label="Circle"
        onClick={canEdit ? handleAddCircle : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Circle (C) — click board to place' : 'View-only'}
        active={activeTool === 'circle'}
      />
      <Btn
        icon="➖" label="Line"
        onClick={canEdit ? handleAddLine : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Line (L) — click board to place' : 'View-only'}
        active={activeTool === 'line'}
      />
      <Btn
        icon={<span style={{display:'inline-block',width:18,height:12,borderRadius:'50%',border:'2.5px solid #4A90D9',verticalAlign:'middle'}} />}
        label="Oval"
        onClick={canEdit ? handleAddOval : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Oval (O) — click board to place' : 'View-only'}
        active={activeTool === 'oval'}
      />
      <Btn
        icon="📦" label="Frame"
        onClick={canEdit ? handleAddFrame : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Frame (F) — click board to place' : 'View-only'}
        active={activeTool === 'frame'}
      />
      <Btn
        icon="T" label="Text Box"
        onClick={canEdit ? handleAddTextBox : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Text box — click board to place' : 'View-only'}
        active={activeTool === 'text'}
      />
      <Btn
        icon="→" label="Arrow"
        onClick={canEdit ? handleAddArrow : undefined}
        disabled={!canEdit}
        title={canEdit ? 'Arrow — click board to place' : 'View-only'}
        active={activeTool === 'arrow'}
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

      {/* Connector hint — always visible when sidebar is expanded */}
      {!collapsed && (
        <div style={{ padding: '2px 8px 4px' }}>
          <div style={{
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            opacity: 0.75,
          }}>
            💡 Hover any object to see connect points
          </div>
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
