/**
 * RightPanel — collapse/expand toggle, localStorage persistence,
 * keyboard shortcut, and auto tab-switching tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useBoard } from '../context/BoardContext';
import RightPanel from '../components/RightPanel';

// ─── Mock dependencies ────────────────────────────────────────────────────

vi.mock('../context/BoardContext', () => ({
  useBoard: vi.fn(),
}));

vi.mock('../components/AIAssistant', () => ({
  default: () => <div data-testid="ai-assistant-stub" />,
}));

vi.mock('../components/PropertiesPanel', () => ({
  default: () => <div data-testid="properties-panel-stub" />,
}));

// ─── localStorage stub — jsdom provides window.localStorage but we need ──
// a reliable in-memory version we can clear/inspect across tests.         ──
let lsStore = {};
const localStorageMock = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: (k) => { delete lsStore[k]; },
  clear: () => { lsStore = {}; },
  get length() { return Object.keys(lsStore).length; },
  key: (i) => Object.keys(lsStore)[i] ?? null,
};

vi.stubGlobal('localStorage', localStorageMock);

// ─── Helpers ─────────────────────────────────────────────────────────────

const makeBoard = (selectedSize = 0) => ({
  selectedIds: new Set(Array.from({ length: selectedSize }, (_, i) => `id-${i}`)),
});

const renderPanel = () => render(<RightPanel />);

// ─── Tests ────────────────────────────────────────────────────────────────

describe('RightPanel — initial render', () => {
  beforeEach(() => {
    lsStore = {};
    vi.mocked(useBoard).mockReturnValue(makeBoard(0));
  });

  afterEach(() => {
    lsStore = {};
  });

  it('renders without crashing', () => {
    expect(() => renderPanel()).not.toThrow();
  });

  it('shows the AI Assistant tab by default', () => {
    renderPanel();
    const aiTab = screen.getByText(/AI Assistant/i);
    expect(aiTab).toBeTruthy();
  });

  it('shows the Properties tab button', () => {
    renderPanel();
    // Use getByRole to avoid matching the empty-state paragraph "...its properties."
    expect(screen.getByRole('button', { name: /Properties/i })).toBeTruthy();
  });

  it('renders the AI assistant content when AI tab is active', () => {
    renderPanel();
    expect(screen.getByTestId('ai-assistant-stub')).toBeTruthy();
  });
});

describe('RightPanel — collapse / expand toggle', () => {
  beforeEach(() => {
    lsStore = {};
    vi.mocked(useBoard).mockReturnValue(makeBoard(0));
  });

  afterEach(() => {
    lsStore = {};
  });

  it('toggle button is always in the DOM', () => {
    renderPanel();
    // The toggle button shows › (collapse) or ‹ (expand)
    const toggle = screen.getByTitle(/panel/i);
    expect(toggle).toBeTruthy();
  });

  it('toggle button shows "›" when panel is expanded (default)', () => {
    renderPanel();
    const toggle = screen.getByTitle(/Hide panel/i);
    expect(toggle.textContent).toBe('›');
  });

  it('clicking toggle button saves collapsed=true to localStorage', () => {
    renderPanel();
    const toggle = screen.getByTitle(/Hide panel/i);
    fireEvent.click(toggle);
    expect(localStorage.getItem('rightPanelCollapsed')).toBe('true');
  });

  it('clicking toggle twice restores expanded state in localStorage', () => {
    renderPanel();
    const toggle = screen.getByTitle(/Hide panel/i);
    fireEvent.click(toggle); // collapse
    // Now toggle has "Show panel" title
    const toggle2 = screen.getByTitle(/Show panel/i);
    fireEvent.click(toggle2); // expand
    expect(localStorage.getItem('rightPanelCollapsed')).toBe('false');
  });

  it('toggle arrow flips from › to ‹ when collapsed', () => {
    renderPanel();
    const toggle = screen.getByTitle(/Hide panel/i);
    expect(toggle.textContent).toBe('›');
    fireEvent.click(toggle);
    const toggleAfter = screen.getByTitle(/Show panel/i);
    expect(toggleAfter.textContent).toBe('‹');
  });
});

describe('RightPanel — localStorage persistence', () => {
  afterEach(() => {
    lsStore = {};
  });

  it('starts collapsed when localStorage has rightPanelCollapsed=true', () => {
    lsStore['rightPanelCollapsed'] = 'true';
    vi.mocked(useBoard).mockReturnValue(makeBoard(0));
    renderPanel();
    expect(screen.getByTitle(/Show panel/i)).toBeTruthy();
    expect(screen.getByText('‹')).toBeTruthy();
  });

  it('starts expanded when localStorage has rightPanelCollapsed=false', () => {
    lsStore['rightPanelCollapsed'] = 'false';
    vi.mocked(useBoard).mockReturnValue(makeBoard(0));
    renderPanel();
    expect(screen.getByTitle(/Hide panel/i)).toBeTruthy();
    expect(screen.getByText('›')).toBeTruthy();
  });

  it('starts expanded when localStorage key is absent', () => {
    delete lsStore['rightPanelCollapsed'];
    vi.mocked(useBoard).mockReturnValue(makeBoard(0));
    renderPanel();
    expect(screen.getByTitle(/Hide panel/i)).toBeTruthy();
  });
});

describe('RightPanel — keyboard shortcut (Ctrl+\\)', () => {
  beforeEach(() => {
    lsStore = {};
    vi.mocked(useBoard).mockReturnValue(makeBoard(0));
  });

  afterEach(() => {
    lsStore = {};
  });

  it('Ctrl+\\ collapses the panel when expanded', () => {
    renderPanel();
    expect(screen.getByTitle(/Hide panel/i)).toBeTruthy();

    fireEvent.keyDown(window, { key: '\\', ctrlKey: true });

    expect(screen.getByTitle(/Show panel/i)).toBeTruthy();
    expect(localStorage.getItem('rightPanelCollapsed')).toBe('true');
  });

  it('Ctrl+\\ expands the panel when collapsed', () => {
    localStorage.setItem('rightPanelCollapsed', 'true');
    renderPanel();

    fireEvent.keyDown(window, { key: '\\', ctrlKey: true });

    expect(screen.getByTitle(/Hide panel/i)).toBeTruthy();
    expect(localStorage.getItem('rightPanelCollapsed')).toBe('false');
  });

  it('Meta+\\ (Cmd) also toggles the panel', () => {
    renderPanel();
    fireEvent.keyDown(window, { key: '\\', metaKey: true });
    expect(screen.getByTitle(/Show panel/i)).toBeTruthy();
  });
});

describe('RightPanel — tab auto-switching', () => {
  afterEach(() => {
    lsStore = {};
  });

  it('shows AI content when no objects are selected', () => {
    vi.mocked(useBoard).mockReturnValue(makeBoard(0));
    renderPanel();
    expect(screen.getByTestId('ai-assistant-stub')).toBeTruthy();
  });

  it('shows Properties content when objects are selected', () => {
    vi.mocked(useBoard).mockReturnValue(makeBoard(1));
    renderPanel();
    expect(screen.getByTestId('properties-panel-stub')).toBeTruthy();
  });

  it('clicking AI tab while objects are selected stays on AI', () => {
    vi.mocked(useBoard).mockReturnValue(makeBoard(1));
    renderPanel();
    // Properties auto-switched — click AI tab manually
    const aiTabBtn = screen.getByText(/AI Assistant/i);
    fireEvent.click(aiTabBtn);
    expect(screen.getByTestId('ai-assistant-stub')).toBeTruthy();
  });
});
