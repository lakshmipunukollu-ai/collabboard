export default function ZoomDisplay({ scale }) {
  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        right: 20,
        transform: 'translateY(-50%)',
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 12,
        padding: '16px 20px',
        zIndex: 900,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div style={{
        color: '#94A3B8',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        Zoom
      </div>
      <div style={{
        color: 'white',
        fontSize: '1.5rem',
        fontWeight: 700,
        lineHeight: 1,
      }}>
        {zoomPercent}%
      </div>
    </div>
  );
}
