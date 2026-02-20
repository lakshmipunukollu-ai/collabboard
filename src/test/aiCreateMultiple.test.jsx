import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BoardProvider, useBoard } from '../context/BoardContext';
import * as firebaseDatabase from 'firebase/database';

vi.mock('../lib/firebase', () => ({
  database: {},
}));

vi.mock('firebase/database', () => ({
  ref: (_db, path) => path,
  onValue: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  update: vi.fn(),
  remove: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: () => Date.now(),
  onDisconnect: () => ({ set: vi.fn(), remove: vi.fn(), update: vi.fn() }),
}));

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({
    user: {
      id: 'test-user-1',
      firstName: 'Test',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
    isLoaded: true,
  }),
}));

function TestHelper() {
  const { createShape, objects } = useBoard();
  const count = Object.keys(objects).length;

  const createTwo = () => {
    createShape('circle', 100, 100, 80, 80, '#10B981');
    createShape('rectangle', 150, 150, 100, 80);
  };

  return (
    <div>
      <span data-testid="object-count">{count}</span>
      <button type="button" onClick={createTwo}>
        Create two
      </button>
    </div>
  );
}

describe('AI create multiple objects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firebaseDatabase.onValue).mockImplementation((refPath, callback) => {
      if (typeof refPath === 'string' && refPath.startsWith('boardsMeta/')) {
        callback({ val: () => ({ ownerId: 'test-user-1' }) });
      } else {
        callback({ val: () => ({}) });
      }
      return vi.fn();
    });
  });

  it('creates two objects and both remain in state', async () => {
    render(
      <BoardProvider boardId="test-board">
        <TestHelper />
      </BoardProvider>
    );

    expect(screen.getByTestId('object-count')).toHaveTextContent('0');

    fireEvent.click(screen.getByRole('button', { name: /create two/i }));

    await waitFor(
      () => {
        expect(screen.getByTestId('object-count')).toHaveTextContent('2');
      },
      { timeout: 2000 }
    );
  });

  it('executeActions-style: two add_shape actions yield two objects', async () => {
    function BatchCreateHelper() {
      const { createShape, objects } = useBoard();
      const count = Object.keys(objects).length;

      const runTwoActions = () => {
        const actions = [
          { type: 'add_shape', shape: 'circle' },
          { type: 'add_shape', shape: 'rectangle' },
        ];
        const center = { x: 200, y: 200 };
        actions.forEach((action, i) => {
          const offset = 45 * i;
          const px = center.x + offset;
          const py = center.y + offset;
          if (action.type === 'add_shape') {
            const shape = action.shape || 'circle';
            const w = 100;
            const h = shape === 'rectangle' ? 80 : 100;
            createShape(shape, px - w / 2, py - h / 2, w, h);
          }
        });
      };

      return (
        <div>
          <span data-testid="object-count">{count}</span>
          <button type="button" onClick={runTwoActions}>
            Run two actions
          </button>
        </div>
      );
    }

    render(
      <BoardProvider boardId="test-board">
        <BatchCreateHelper />
      </BoardProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /run two actions/i }));

    await waitFor(
      () => {
        expect(screen.getByTestId('object-count')).toHaveTextContent('2');
      },
      { timeout: 2000 }
    );
  });
});
