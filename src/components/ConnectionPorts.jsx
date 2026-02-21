import { Group, Circle } from 'react-konva';

const PORT_RADIUS = 6;

const PORT_OFFSETS = {
  top:    (w, h) => ({ x: w / 2, y: 0 }),
  bottom: (w, h) => ({ x: w / 2, y: h }),
  left:   (w, h) => ({ x: 0, y: h / 2 }),
  right:  (w, h) => ({ x: w, y: h / 2 }),
};

export default function ConnectionPorts({ x, y, width, height, onPortMouseDown, onPortMouseUp, isConnecting }) {
  return (
    <Group x={x} y={y} listening>
      {Object.entries(PORT_OFFSETS).map(([side, getOffset]) => {
        const offset = getOffset(width, height);
        return (
          <Circle
            key={side}
            x={offset.x}
            y={offset.y}
            radius={PORT_RADIUS}
            fill={isConnecting ? '#10B981' : '#3B82F6'}
            stroke="white"
            strokeWidth={2}
            shadowBlur={6}
            shadowColor={isConnecting ? '#10B981' : '#3B82F6'}
            shadowOpacity={0.7}
            onMouseDown={(e) => {
              e.cancelBubble = true;
              onPortMouseDown(side);
            }}
            onMouseUp={(e) => {
              e.cancelBubble = true;
              onPortMouseUp(side);
            }}
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'crosshair';
            }}
            onMouseLeave={(e) => {
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
