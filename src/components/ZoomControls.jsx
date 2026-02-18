export default function ZoomControls({ scale, onZoomChange, onFitAll }) {
  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: 20,
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <button
        onClick={() => onZoomChange(0.5)}
        title="Zoom to 50% (Press - repeatedly)"
        style={buttonStyle}
      >
        50%
      </button>
      <button
        onClick={() => onZoomChange(1)}
        title="Zoom to 100% (Press 1)"
        style={buttonStyle}
      >
        100%
      </button>
      <button
        onClick={() => onZoomChange(2)}
        title="Zoom to 200% (Press 2)"
        style={buttonStyle}
      >
        200%
      </button>
      <div
        style={{
          height: 1,
          background: 'rgba(255,255,255,0.1)',
          margin: '4px 0',
        }}
      />
      <button
        onClick={onFitAll}
        title="Fit all objects in view (Press 0)"
        style={buttonStyle}
      >
        Fit All
      </button>
      <div
        style={{
          padding: '8px 12px',
          color: '#94A3B8',
          fontSize: '0.75rem',
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        {zoomPercent}%
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: '8px 16px',
  background: 'rgba(59, 130, 246, 0.1)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: 6,
  color: '#93C5FD',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
  width: '100%',
};
