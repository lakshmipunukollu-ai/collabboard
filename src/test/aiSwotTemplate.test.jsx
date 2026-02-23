import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BoardProvider, useBoard } from '../context/BoardContext';
import AIAssistant from '../components/AIAssistant';
import * as firebaseDatabase from 'firebase/database';

// jsdom does not implement scrollIntoView — mock it globally so AIAssistant's
// useEffect(scrollIntoView) doesn't throw and kill the component tree.
Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
});

vi.mock('../lib/firebase', () => ({
  database: {},
}));

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
      id: 'test-user-1',
      firstName: 'Test',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
    isLoaded: true,
  }),
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-clerk-token'),
  }),
}));

/** Reads frame and sticky counts directly from BoardContext. */
function BoardStateDisplay() {
  const { objects } = useBoard();
  const all = Object.values(objects);
  const frameCount = all.filter((o) => o.type === 'frame').length;
  const stickyCount = all.filter((o) => o.type === 'sticky').length;
  const stickyTexts = all
    .filter((o) => o.type === 'sticky' && o.text)
    .map((o) => o.text);
  return (
    <div>
      <span data-testid="frame-count">{frameCount}</span>
      <span data-testid="sticky-count">{stickyCount}</span>
      <span data-testid="sticky-texts">{stickyTexts.join('|')}</span>
    </div>
  );
}

const SWOT_STICKIES_RESPONSE = {
  message: { role: 'assistant', content: 'SWOT analysis added to your board.' },
  actions: [
    {
      type: 'createSwotTemplate',
      stickies: {
        strengths: ['Expert-led content', 'Scalable model'],
        weaknesses: ['High competition', 'Requires tech infra'],
        opportunities: ['Growing remote learning demand', 'Subscription revenue'],
        threats: ['Free alternatives', 'Platform dependency'],
      },
    },
  ],
};

describe('SWOT template — createSwotTemplate with stickies', () => {
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

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SWOT_STICKIES_RESPONSE,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates 4 frames when SWOT template action is received', async () => {
    render(
      <BoardProvider boardId="test-board">
        <AIAssistant embedded />
        <BoardStateDisplay />
      </BoardProvider>
    );


    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, {
      target: { value: 'Create a SWOT analysis for an online coaching business' },
    });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(
      () => {
        expect(screen.getByTestId('frame-count')).toHaveTextContent('4');
      },
      { timeout: 3000 }
    );
  });

  it('creates sticky notes inside SWOT frames when stickies are provided', async () => {
    render(
      <BoardProvider boardId="test-board">
        <AIAssistant embedded />
        <BoardStateDisplay />
      </BoardProvider>
    );


    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, {
      target: { value: 'Create a SWOT analysis for an online coaching business' },
    });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(
      () => {
        const stickyCount = Number(screen.getByTestId('sticky-count').textContent);
        expect(stickyCount).toBeGreaterThanOrEqual(4);
      },
      { timeout: 3000 }
    );
  });

  it('shows sticky note text from the stickies payload on the board', async () => {
    render(
      <BoardProvider boardId="test-board">
        <AIAssistant embedded />
        <BoardStateDisplay />
      </BoardProvider>
    );


    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, {
      target: { value: 'Create a SWOT analysis for an online coaching business' },
    });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(
      () => {
        const texts = screen.getByTestId('sticky-texts').textContent;
        expect(texts).toContain('Expert-led content');
        expect(texts).toContain('High competition');
        expect(texts).toContain('Growing remote learning demand');
        expect(texts).toContain('Free alternatives');
      },
      { timeout: 3000 }
    );
  });

  it('still creates stickies (frontend fallback) when backend sends createSwotTemplate without stickies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { role: 'assistant', content: 'SWOT template created.' },
        actions: [{ type: 'createSwotTemplate', stickies: null }],
      }),
    }));

    render(
      <BoardProvider boardId="test-board">
        <AIAssistant embedded />
        <BoardStateDisplay />
      </BoardProvider>
    );


    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, { target: { value: 'SWOT analysis' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(
      () => {
        expect(screen.getByTestId('frame-count')).toHaveTextContent('4');
        const stickyCount = Number(screen.getByTestId('sticky-count').textContent);
        expect(stickyCount).toBeGreaterThanOrEqual(4);
      },
      { timeout: 3000 }
    );
  });

  it('displays AI reply text in the chat after SWOT creation', async () => {
    render(
      <BoardProvider boardId="test-board">
        <AIAssistant embedded />
        <BoardStateDisplay />
      </BoardProvider>
    );


    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, {
      target: { value: 'Create a SWOT analysis for an online coaching business' },
    });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(
      () => {
        expect(screen.getByText('SWOT analysis added to your board.')).toBeTruthy();
      },
      { timeout: 3000 }
    );
  });
});
