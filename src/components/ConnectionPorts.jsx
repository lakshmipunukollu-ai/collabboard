import { useEffect, useRef, useState } from 'react';
import { Group, Circle } from 'react-konva';

// 16px diameter — prominent enough to discover and click easily
const PORT_RADIUS = 8;

const PORT_OFFSETS = {
  top:    (w, _h) => ({ x: w / 2, y: 0 }),
  bottom: (w, h)  => ({ x: w / 2, y: h }),
  left:   (_w, h) => ({ x: 0,     y: h / 2 }),
  right:  (w, h)  => ({ x: w,     y: h / 2 }),
};

export default function ConnectionPorts({
  x, y, width, height,
  onPortMouseDown, onPortMouseUp,
  isConnecting,
  // Pass animated=false when rendering many ports simultaneously (e.g. all-objects-during-drag)
  // to avoid dozens of concurrent rAF loops hurting performance.
  animated = true,
}) {
  const [hoveredPort, setHoveredPort] = useState(null);
  const groupRef = useRef(null);
  const pulseRef = useRef(null); // attached to first circle for the connecting pulse

  // Fade-in entrance so ports draw the user's eye when they first appear
  useEffect(() => {
    if (!animated) return;
    const g = groupRef.current;
    if (!g) return;
    let start = null;
    let frame;
    const animate = (ts) => {
      if (start === null) start = ts;
      const t = Math.min((ts - start) / 180, 1);
      g.opacity(t);
      g.getLayer()?.batchDraw();
      if (t < 1) { frame = requestAnimationFrame(animate); }
    };
    g.opacity(0);
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [animated]);

  // Pulsing scale on ports when a connector is being dragged toward them
  useEffect(() => {
    if (!isConnecting) return;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = ((now - start) / 600) % 1;
      const s = 1 + 0.35 * Math.sin(t * Math.PI * 2);
      pulseRef.current?.setAttr('scaleX', s);
      pulseRef.current?.setAttr('scaleY', s);
      pulseRef.current?.getLayer()?.batchDraw();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isConnecting]);

  return (
    <Group ref={groupRef} x={x} y={y} listening>
      {Object.entries(PORT_OFFSETS).map(([side, getOffset], idx) => {
        const offset = getOffset(width, height);
        const isFirst = idx === 0;
        const isHovered = hoveredPort === side;

        // Grow on hover: 8 → 11px radius
        const r = isHovered ? PORT_RADIUS + 3 : PORT_RADIUS;
        // Blue when idle, green when actively being targeted
        const fill = isConnecting ? '#10B981' : '#4A90E2';
        const shadowColor = isConnecting ? '#10B981' : '#4A90E2';
        const shadowBlur = isHovered ? 18 : isConnecting ? 10 : 8;
        const shadowOpacity = isHovered ? 1 : isConnecting ? 0.9 : 0.65;

        return (
          <Circle
            key={side}
            ref={isConnecting && isFirst ? pulseRef : undefined}
            x={offset.x}
            y={offset.y}
            radius={r}
            fill={fill}
            stroke="white"
            strokeWidth={2}
            shadowBlur={shadowBlur}
            shadowColor={shadowColor}
            shadowOpacity={shadowOpacity}
            onMouseDown={(e) => {
              e.cancelBubble = true;
              onPortMouseDown(side);
            }}
            onMouseUp={(e) => {
              e.cancelBubble = true;
              onPortMouseUp(side);
            }}
            onMouseEnter={(e) => {
              setHoveredPort(side);
              const stage = e.target.getStage();
              // crosshair = "drag to connect here"; cell = "drop here to finish connection"
              if (stage) stage.container().style.cursor = isConnecting ? 'cell' : 'crosshair';
            }}
            onMouseLeave={(e) => {
              setHoveredPort(null);
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = '';
            }}
          />
        );
      })}
    </Group>
  );
}

/** Returns the world position of a named port on an object */
export function getObjectPortPos(obj, portSide) {
  const w = obj.width || 100;
  const h = obj.height || 100;
  switch (portSide) {
    case 'top':    return { x: obj.x + w / 2, y: obj.y };
    case 'bottom': return { x: obj.x + w / 2, y: obj.y + h };
    case 'left':   return { x: obj.x,         y: obj.y + h / 2 };
    case 'right':  return { x: obj.x + w,     y: obj.y + h / 2 };
    default:       return { x: obj.x + w / 2, y: obj.y + h / 2 };
  }
}
