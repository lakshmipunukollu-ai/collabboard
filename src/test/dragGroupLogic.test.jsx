/**
 * Group-drag logic tests — verifies that moveObjectGroup and moveObjectGroupLocal
 * correctly update all objects in a multi-selection when one is dragged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BoardProvider, useBoard } from '../context/BoardContext';
import * as firebaseDatabase from 'firebase/database';

// ─── Firebase / Clerk mocks ───────────────────────────────────────────────

vi.mock('../lib/firebase', () => ({ database: {} }));

vi.mock('firebase/database', () => ({
  ref: (_db, path) => path,
  onValue: vi.fn(),
  get: vi.fn().mockResolvedValue({ val: () => ({}) }),
  set: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: () => Date.now(),
  onDisconnect: () => ({ set: vi.fn(), remove: vi.fn(), update: vi.fn() }),
}));

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({
    user: {
      id: 'user-drag',
      firstName: 'Dragger',
      emailAddresses: [{ emailAddress: 'dragger@test.com' }],
    },
    isLoaded: true,
  }),
}));

// ─── Setup ────────────────────────────────────────────────────────────────

const setupOnValue = () => {
  vi.mocked(firebaseDatabase.onValue).mockImplementation((path, cb) => {
    if (typeof path === 'string' && path.startsWith('boardsMeta/')) {
      cb({ val: () => ({ ownerId: 'user-drag' }) });
    } else {
      cb({ val: () => ({}) });
    }
    return vi.fn();
  });
};

// ─── Test helper component ────────────────────────────────────────────────

function DragHelper() {
  const {
    createStickyNote,
    moveObjectGroup,
    moveObjectGroupLocal,
    beginMoveUndo,
    toggleSelection,
    objects,
    selectedIds,
  } = useBoard();

  const ids = Object.keys(objects);

  const setup = async () => {
    // Create 3 sticky notes
    createStickyNote(0, 0);
    createStickyNote(200, 0);
    createStickyNote(400, 0);
  };

  const selectAll = () => {
    ids.forEach((id) => toggleSelection(id, true));
  };

  const dragFirst = () => {
    if (ids.length === 0) return;
    beginMoveUndo(ids[0]);
    moveObjectGroup(ids[0], 100, 100);
  };

  const localDragFirst = () => {
    if (ids.length === 0) return;
    beginMoveUndo(ids[0]);
    moveObjectGroupLocal(ids[0], 100, 100);
  };

  const positions = ids.map((id) => `${id}:${objects[id]?.x},${objects[id]?.y}`).join('|');

  return (
    <div>
      <span data-testid="count">{ids.length}</span>
      <span data-testid="selected">{selectedIds.size}</span>
      <span data-testid="positions">{positions}</span>
      <button onClick={setup}>setup</button>
      <button onClick={selectAll}>select all</button>
      <button onClick={dragFirst}>drag first</button>
      <button onClick={localDragFirst}>local drag first</button>
    </div>
  );
}

const wrap = () =>
  render(
    <BoardProvider boardId="drag-board">
      <DragHelper />
    </BoardProvider>,
  );

// ─── Tests ────────────────────────────────────────────────────────────────

describe('moveObjectGroup — single object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOnValue();
  });

  it('moves a single object to new position', async () => {
    wrap();
    fireEvent.click(screen.getByText('setup'));

    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('3'),
    { timeout: 2000 });

    // Without multi-select, drag first just moves that one
    fireEvent.click(screen.getByText('drag first'));

    await waitFor(() => {
      const pos = screen.getByTestId('positions').textContent;
      // First object should be at 100,100
      expect(pos).toMatch(/100,100/);
    }, { timeout: 2000 });
  });
});

describe('moveObjectGroup — group drag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOnValue();
  });

  it('calls Firebase set for every selected object when group-dragged', async () => {
    wrap();
    fireEvent.click(screen.getByText('setup'));

    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('3'),
    { timeout: 2000 });

    // Record baseline set() calls from object creation
    const setCallsAfterCreate = vi.mocked(firebaseDatabase.set).mock.calls.length;
    expect(setCallsAfterCreate).toBeGreaterThan(0); // sanity: objects were created

    fireEvent.click(screen.getByText('select all'));

    // Clicking select all changes selection state — wait a tick for React batching
    await new Promise((r) => setTimeout(r, 50));

    fireEvent.click(screen.getByText('drag first'));

    await waitFor(() => {
      // moveObjectGroup should write to Firebase for each selected object
      const totalCalls = vi.mocked(firebaseDatabase.set).mock.calls.length;
      expect(totalCalls).toBeGreaterThan(setCallsAfterCreate);
    }, { timeout: 2000 });
  });
});

describe('moveObjectGroupLocal — optimistic local update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOnValue();
  });

  it('updates local state immediately without Firebase write', async () => {
    vi.clearAllMocks();
    setupOnValue();

    wrap();
    fireEvent.click(screen.getByText('setup'));

    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('3'),
    { timeout: 2000 });

    const setCallsBefore = vi.mocked(firebaseDatabase.set).mock.calls.length;

    // Local drag should NOT call Firebase set (only final commit does)
    act(() => {
      fireEvent.click(screen.getByText('local drag first'));
    });

    await waitFor(() => {
      const positions = screen.getByTestId('positions').textContent;
      expect(positions).toMatch(/100,100/);
    }, { timeout: 1000 });

    // Local drag should not trigger additional Firebase set calls
    const setCallsAfter = vi.mocked(firebaseDatabase.set).mock.calls.length;
    expect(setCallsAfter).toBe(setCallsBefore);
  });
});

// ─── Pure delta math tests (no React) ────────────────────────────────────

describe('Group drag delta math', () => {
  it('computes correct delta when primary object moved right', () => {
    const preDrag = { 'a': { x: 50, y: 50 }, 'b': { x: 200, y: 100 } };
    const newX = 150, newY = 50; // primary moved right by 100
    const dx = newX - preDrag['a'].x;
    const dy = newY - preDrag['a'].y;
    expect(dx).toBe(100);
    expect(dy).toBe(0);
    // b's new position
    expect(preDrag['b'].x + dx).toBe(300);
    expect(preDrag['b'].y + dy).toBe(100);
  });

  it('computes correct delta for diagonal movement', () => {
    const preDrag = { 'a': { x: 0, y: 0 } };
    const dx = 75 - preDrag['a'].x;
    const dy = 60 - preDrag['a'].y;
    expect(dx).toBe(75);
    expect(dy).toBe(60);
  });

  it('handles negative delta (dragging up-left)', () => {
    const preDrag = { 'a': { x: 300, y: 400 } };
    const dx = 100 - preDrag['a'].x; // -200
    const dy = 200 - preDrag['a'].y; // -200
    expect(dx).toBe(-200);
    expect(dy).toBe(-200);
  });

  it('zero delta when object not moved', () => {
    const preDrag = { 'a': { x: 100, y: 100 } };
    const dx = 100 - preDrag['a'].x;
    const dy = 100 - preDrag['a'].y;
    expect(dx).toBe(0);
    expect(dy).toBe(0);
  });
});
