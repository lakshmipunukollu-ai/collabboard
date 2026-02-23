/**
 * BoardContext CRUD + Undo/Redo integration tests.
 * Uses the real BoardProvider with mocked Firebase and Clerk.
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
      id: 'user-1',
      firstName: 'Alice',
      emailAddresses: [{ emailAddress: 'alice@test.com' }],
    },
    isLoaded: true,
  }),
}));

// ─── Shared mock setup ────────────────────────────────────────────────────

const setupOnValue = () => {
  vi.mocked(firebaseDatabase.onValue).mockImplementation((path, cb) => {
    if (typeof path === 'string' && path.startsWith('boardsMeta/')) {
      cb({ val: () => ({ ownerId: 'user-1', name: 'Test Board' }) });
    } else {
      cb({ val: () => ({}) });
    }
    return vi.fn();
  });
};

// ─── Test helper components ───────────────────────────────────────────────

function CRUDHelper() {
  const {
    createStickyNote, createShape, deleteObject, updateObject,
    duplicateObjects, clearBoard, objects, selectedIds, toggleSelection,
    undo, redo,
  } = useBoard();

  const ids = Object.keys(objects);
  const count = ids.length;
  const firstId = ids[0] ?? '';

  return (
    <div>
      <span data-testid="count">{count}</span>
      <span data-testid="first-id">{firstId}</span>
      <span data-testid="first-text">{objects[firstId]?.text ?? ''}</span>
      <span data-testid="selected-count">{selectedIds.size}</span>

      <button onClick={() => createStickyNote(100, 100)}>add sticky</button>
      <button onClick={() => createShape('rectangle', 200, 200, 160, 80)}>add rect</button>
      <button onClick={() => deleteObject(firstId)}>delete first</button>
      <button onClick={() => updateObject(firstId, { text: 'updated text' })}>update text</button>
      <button onClick={() => { if (firstId) toggleSelection(firstId, false); }}>select first</button>
      <button onClick={() => duplicateObjects()}>duplicate</button>
      <button onClick={() => clearBoard()}>clear</button>
      <button onClick={() => undo()}>undo</button>
      <button onClick={() => redo()}>redo</button>
    </div>
  );
}

const wrap = (ui) =>
  render(<BoardProvider boardId="test-board">{ui}</BoardProvider>);

// ─── Tests ────────────────────────────────────────────────────────────────

describe('BoardContext — Create operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOnValue();
  });

  it('starts with zero objects', () => {
    wrap(<CRUDHelper />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('createStickyNote adds one object', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add sticky'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    { timeout: 2000 });
  });

  it('createShape adds one object', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add rect'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    { timeout: 2000 });
  });

  it('creates multiple objects independently', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add sticky'));
    fireEvent.click(screen.getByText('add rect'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('2'),
    { timeout: 2000 });
  });

  it('writes to Firebase on object creation', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add sticky'));
    await waitFor(() =>
      expect(vi.mocked(firebaseDatabase.set)).toHaveBeenCalled(),
    { timeout: 2000 });
  });
});

describe('BoardContext — Delete operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOnValue();
  });

  it('deleteObject removes object from state', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add sticky'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    { timeout: 2000 });

    fireEvent.click(screen.getByText('delete first'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('0'),
    { timeout: 2000 });
  });

  it('clearBoard removes all objects', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add sticky'));
    fireEvent.click(screen.getByText('add rect'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('2'),
    { timeout: 2000 });

    fireEvent.click(screen.getByText('clear'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('0'),
    { timeout: 2000 });
  });
});

describe('BoardContext — Update operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOnValue();
  });

  it('updateObject changes the text field', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add sticky'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    { timeout: 2000 });

    fireEvent.click(screen.getByText('update text'));
    await waitFor(() =>
      expect(screen.getByTestId('first-text')).toHaveTextContent('updated text'),
    { timeout: 2000 });
  });
});

describe('BoardContext — Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOnValue();
  });

  it('toggleSelection adds object to selectedIds', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add sticky'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    { timeout: 2000 });

    fireEvent.click(screen.getByText('select first'));
    await waitFor(() =>
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1'),
    { timeout: 1000 });
  });

  it('selection count starts at zero', () => {
    wrap(<CRUDHelper />);
    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
  });
});

describe('BoardContext — Undo / Redo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOnValue();
  });

  it('undo after createStickyNote removes the object', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add sticky'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    { timeout: 2000 });

    fireEvent.click(screen.getByText('undo'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('0'),
    { timeout: 2000 });
  });

  it('redo re-creates the object after undo', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add sticky'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    { timeout: 2000 });

    fireEvent.click(screen.getByText('undo'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('0'),
    { timeout: 2000 });

    fireEvent.click(screen.getByText('redo'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    { timeout: 2000 });
  });

  it('undo multiple steps works correctly', async () => {
    wrap(<CRUDHelper />);
    fireEvent.click(screen.getByText('add sticky'));
    fireEvent.click(screen.getByText('add rect'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('2'),
    { timeout: 2000 });

    fireEvent.click(screen.getByText('undo'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    { timeout: 2000 });

    fireEvent.click(screen.getByText('undo'));
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('0'),
    { timeout: 2000 });
  });
});
