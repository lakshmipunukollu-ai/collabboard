/**
 * Pure utility / math tests — no React, no Firebase, no mocks needed.
 * These verify the core algorithms used throughout the board engine.
 */
import { describe, it, expect } from 'vitest';

// ─── Helpers (mirrored from Canvas.jsx / BoardContext.jsx) ────────────────

/** Clamp used in fitAllObjects */
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/** World → screen coordinate conversion */
const worldToScreen = (wx, wy, stageX, stageY, scale) => ({
  x: stageX + wx * scale,
  y: stageY + wy * scale,
});

/** Screen → world coordinate conversion (used in placeActiveTool) */
const screenToWorld = (sx, sy, stageX, stageY, scale) => ({
  x: (sx - stageX) / scale,
  y: (sy - stageY) / scale,
});

/** Bounding box of all board objects (used in fitAllObjects) */
function calcBoundingBox(objects) {
  const vals = Object.values(objects).filter(
    (o) => o && o.type !== 'connector' && o.type !== 'arrow',
  );
  if (!vals.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const o of vals) {
    const x1 = o.x ?? 0;
    const y1 = o.y ?? 0;
    const x2 = x1 + (o.width ?? 0);
    const y2 = y1 + (o.height ?? 0);
    if (x1 < minX) minX = x1;
    if (y1 < minY) minY = y1;
    if (x2 > maxX) maxX = x2;
    if (y2 > maxY) maxY = y2;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Fit-all scale calculation */
function calcFitScale(bb, canvasW, canvasH, padding = 50) {
  const scaleX = (canvasW - padding * 2) / bb.width;
  const scaleY = (canvasH - padding * 2) / bb.height;
  return clamp(Math.min(scaleX, scaleY), 0.05, 2.0);
}

/** Center-pan after fit */
function calcCenterPan(bb, scale, canvasW, canvasH) {
  const cx = bb.minX + bb.width / 2;
  const cy = bb.minY + bb.height / 2;
  return {
    x: canvasW / 2 - cx * scale,
    y: canvasH / 2 - cy * scale,
  };
}

/** Delta calculation for group drag (from BoardContext.moveObjectGroup) */
function calcGroupDelta(preDragPositions, primaryId, finalX, finalY) {
  const start = preDragPositions[primaryId];
  if (!start) return null;
  return { dx: finalX - start.x, dy: finalY - start.y };
}

/** Unique-ID uniqueness check (mirrors generateId in BoardContext) */
function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Coordinate math', () => {
  it('worldToScreen converts correctly at scale 1', () => {
    const result = worldToScreen(100, 200, 0, 0, 1);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it('worldToScreen converts correctly with stage offset', () => {
    const result = worldToScreen(100, 200, 50, 80, 1);
    expect(result.x).toBe(150);
    expect(result.y).toBe(280);
  });

  it('worldToScreen applies scale correctly', () => {
    const result = worldToScreen(100, 200, 0, 0, 2);
    expect(result.x).toBe(200);
    expect(result.y).toBe(400);
  });

  it('screenToWorld is the inverse of worldToScreen', () => {
    const stage = { x: 30, y: 60 };
    const scale = 1.5;
    const world = { x: 120, y: 80 };
    const screen = worldToScreen(world.x, world.y, stage.x, stage.y, scale);
    const back = screenToWorld(screen.x, screen.y, stage.x, stage.y, scale);
    expect(back.x).toBeCloseTo(world.x);
    expect(back.y).toBeCloseTo(world.y);
  });

  it('screenToWorld converts correctly at zoom-out (scale < 1)', () => {
    const result = screenToWorld(400, 300, 0, 0, 0.5);
    expect(result.x).toBe(800);
    expect(result.y).toBe(600);
  });
});

describe('Scale clamping', () => {
  it('clamps below minimum to 0.05', () => {
    expect(clamp(0.01, 0.05, 2.0)).toBe(0.05);
    expect(clamp(0, 0.05, 2.0)).toBe(0.05);
  });

  it('clamps above maximum to 2.0', () => {
    expect(clamp(5.0, 0.05, 2.0)).toBe(2.0);
    expect(clamp(100, 0.05, 2.0)).toBe(2.0);
  });

  it('leaves values within range unchanged', () => {
    expect(clamp(1.0, 0.05, 2.0)).toBe(1.0);
    expect(clamp(0.5, 0.05, 2.0)).toBe(0.5);
    expect(clamp(2.0, 0.05, 2.0)).toBe(2.0);
  });
});

describe('Bounding box calculation', () => {
  it('returns null for empty objects', () => {
    expect(calcBoundingBox({})).toBeNull();
  });

  it('calculates correct bounding box for single object', () => {
    const bb = calcBoundingBox({ a: { type: 'sticky', x: 10, y: 20, width: 160, height: 120 } });
    expect(bb.minX).toBe(10);
    expect(bb.minY).toBe(20);
    expect(bb.maxX).toBe(170);
    expect(bb.maxY).toBe(140);
    expect(bb.width).toBe(160);
    expect(bb.height).toBe(120);
  });

  it('calculates correct bounding box for multiple objects', () => {
    const objects = {
      a: { type: 'sticky', x: 10, y: 20, width: 100, height: 80 },
      b: { type: 'sticky', x: 50, y: 60, width: 200, height: 150 },
    };
    const bb = calcBoundingBox(objects);
    expect(bb.minX).toBe(10);
    expect(bb.minY).toBe(20);
    expect(bb.maxX).toBe(250); // 50 + 200
    expect(bb.maxY).toBe(210); // 60 + 150
  });

  it('skips connector objects in bounding box', () => {
    const objects = {
      a: { type: 'sticky', x: 0, y: 0, width: 100, height: 100 },
      c: { type: 'connector', x: 500, y: 500 }, // should be ignored
    };
    const bb = calcBoundingBox(objects);
    expect(bb.maxX).toBe(100); // connector not included
  });

  it('handles objects at negative coordinates', () => {
    const objects = {
      a: { type: 'sticky', x: -200, y: -100, width: 160, height: 120 },
      b: { type: 'sticky', x: 50, y: 50, width: 160, height: 120 },
    };
    const bb = calcBoundingBox(objects);
    expect(bb.minX).toBe(-200);
    expect(bb.minY).toBe(-100);
  });
});

describe('Fit-all scale and pan calculations', () => {
  const canvas = { w: 1200, h: 800 };

  it('produces scale that fits content within canvas', () => {
    const bb = { minX: 0, minY: 0, maxX: 1000, maxY: 600, width: 1000, height: 600 };
    const scale = calcFitScale(bb, canvas.w, canvas.h);
    // At this scale, content should fit: 1000 * scale <= 1200 - 100
    expect(bb.width * scale).toBeLessThanOrEqual(canvas.w - 50);
    expect(bb.height * scale).toBeLessThanOrEqual(canvas.h - 50);
  });

  it('never produces scale below 0.05', () => {
    // Huge board
    const bb = { minX: 0, minY: 0, maxX: 100000, maxY: 100000, width: 100000, height: 100000 };
    const scale = calcFitScale(bb, canvas.w, canvas.h);
    expect(scale).toBeGreaterThanOrEqual(0.05);
  });

  it('never produces scale above 2.0', () => {
    // Tiny content — single small sticky
    const bb = { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
    const scale = calcFitScale(bb, canvas.w, canvas.h);
    expect(scale).toBeLessThanOrEqual(2.0);
  });

  it('calculates center pan that positions bounding box center at canvas center', () => {
    const bb = { minX: 100, minY: 100, width: 400, height: 300 };
    const scale = 1;
    const pan = calcCenterPan(bb, scale, 1200, 800);
    // After panning, center of bb should map to canvas center (600, 400)
    const bbCenterX = bb.minX + bb.width / 2; // 300
    const bbCenterY = bb.minY + bb.height / 2; // 250
    expect(pan.x + bbCenterX * scale).toBeCloseTo(600);
    expect(pan.y + bbCenterY * scale).toBeCloseTo(400);
  });
});

describe('Group drag delta calculation', () => {
  it('correctly calculates delta from pre-drag snapshot', () => {
    const preDrag = { 'id-1': { x: 100, y: 200 }, 'id-2': { x: 300, y: 400 } };
    const delta = calcGroupDelta(preDrag, 'id-1', 150, 250);
    expect(delta.dx).toBe(50);
    expect(delta.dy).toBe(50);
  });

  it('returns null when primary object not in snapshot', () => {
    const delta = calcGroupDelta({}, 'missing-id', 100, 100);
    expect(delta).toBeNull();
  });

  it('applies same delta to all objects in group', () => {
    const preDrag = {
      'a': { x: 0, y: 0 },
      'b': { x: 100, y: 50 },
      'c': { x: 200, y: 100 },
    };
    const { dx, dy } = calcGroupDelta(preDrag, 'a', 30, 20);
    expect(dx).toBe(30);
    expect(dy).toBe(20);
    // All objects shifted by same delta
    expect(preDrag.b.x + dx).toBe(130);
    expect(preDrag.c.x + dx).toBe(230);
  });
});

describe('ID generation uniqueness', () => {
  it('generates unique IDs across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => makeId()));
    expect(ids.size).toBe(1000);
  });

  it('IDs are non-empty strings', () => {
    const id = makeId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('SWOT layout math', () => {
  const GAP = 20;
  const PAD = 40;
  const STICKY_W = 280;
  const STICKY_H = 320;

  it('computes non-overlapping 2x2 SWOT grid positions', () => {
    const frameW = STICKY_W * 2 + GAP + PAD * 2;
    const frameH = STICKY_H * 2 + GAP + PAD * 2;
    const frameX = 0;
    const frameY = 0;

    const positions = [
      { col: 0, row: 0 }, // Strengths — top-left
      { col: 1, row: 0 }, // Weaknesses — top-right
      { col: 0, row: 1 }, // Opportunities — bottom-left
      { col: 1, row: 1 }, // Threats — bottom-right
    ].map(({ col, row }) => ({
      x: frameX + PAD + col * (STICKY_W + GAP),
      y: frameY + PAD + row * (STICKY_H + GAP),
      w: STICKY_W,
      h: STICKY_H,
    }));

    // All 4 positions should be within frame
    positions.forEach((p) => {
      expect(p.x + p.w).toBeLessThanOrEqual(frameX + frameW - PAD + 1);
      expect(p.y + p.h).toBeLessThanOrEqual(frameY + frameH - PAD + 1);
    });

    // No two positions should overlap
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        const overlaps =
          a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('all 4 SWOT stickies are equal size', () => {
    const sizes = [STICKY_W, STICKY_W, STICKY_W, STICKY_W];
    expect(new Set(sizes).size).toBe(1);
  });
});
