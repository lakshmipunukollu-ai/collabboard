/**
 * HtmlOverlay — renders a positioned HTML div over the Konva canvas,
 * synchronized with canvas pan/zoom so it behaves like a canvas object.
 *
 * Props:
 *   obj      — the object data { x, y, width, height }
 *   scale    — current canvas scale
 *   stagePos — { x, y } current stage offset
 *   children — the HTML content to render inside
 *   onClick  — selection handler
 *   isSelected — shows an outline when true
 *   onResize — optional drag-corner resize callback
 */
export default function HtmlOverlay({
  obj, scale, stagePos, children,
  onClick, isSelected,
}) {
  const { x = 0, y = 0, width = 300, height = 200 } = obj;

  const screenX = stagePos.x + x * scale;
  const screenY = stagePos.y + y * scale;
  const screenW = width * scale;
  const screenH = height * scale;

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
        overflow: 'hidden',
        boxSizing: 'border-box',
        border: isSelected
          ? '2px solid #667eea'
          : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        background: '#1e293b',
        boxShadow: isSelected
          ? '0 0 0 2px rgba(102,126,234,0.3)'
          : '0 2px 8px rgba(0,0,0,0.3)',
        pointerEvents: 'all',
        zIndex: 20,
        transformOrigin: 'top left',
      }}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
    >
      {/* Scale inner content to match canvas zoom */}
      <div style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: width,
        height: height,
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}
