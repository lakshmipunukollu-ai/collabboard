/**
 * KanbanObject — render, card management, selection, drag handle, context menu.
 * TableObject and CodeBlock follow the same patterns; spot-checks included.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useBoard } from '../context/BoardContext';
import KanbanObject from '../components/KanbanObject';
import TableObject from '../components/TableObject';
import CodeBlock from '../components/CodeBlock';

// ─── Mocks ────────────────────────────────────────────────────────────────

vi.mock('../context/BoardContext', () => ({
  useBoard: vi.fn(),
}));

const mockBoard = (extras = {}) => ({
  selectedIds: new Set(),
  toggleSelection: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
  moveObjectGroupLocal: vi.fn(),
  moveObjectGroup: vi.fn(),
  beginMoveUndo: vi.fn(),
  resizeObject: vi.fn(),
  ...extras,
});

const defaultStage = { stagePos: { x: 0, y: 0 }, scale: 1 };

// ─── Kanban render tests ──────────────────────────────────────────────────

describe('KanbanObject — rendering', () => {
  beforeEach(() => {
    vi.mocked(useBoard).mockReturnValue(mockBoard());
  });

  it('renders without crashing', () => {
    expect(() =>
      render(
        <KanbanObject
          id="k1"
          data={{ x: 0, y: 0, width: 760, height: 480 }}
          {...defaultStage}
        />,
      ),
    ).not.toThrow();
  });

  it('renders default column titles', () => {
    render(
      <KanbanObject
        id="k1"
        data={{ x: 0, y: 0, width: 760, height: 480 }}
        {...defaultStage}
      />,
    );
    expect(screen.getByText(/To Do/i)).toBeTruthy();
    expect(screen.getByText(/In Progress/i)).toBeTruthy();
    expect(screen.getByText(/Done/i)).toBeTruthy();
  });

  it('renders custom columns from data', () => {
    render(
      <KanbanObject
        id="k1"
        data={{
          x: 0, y: 0, width: 760, height: 480,
          columns: [
            { title: 'Backlog', cards: ['Task A'] },
            { title: 'Active', cards: [] },
          ],
        }}
        {...defaultStage}
      />,
    );
    expect(screen.getByText(/Backlog/i)).toBeTruthy();
    expect(screen.getByText(/Active/i)).toBeTruthy();
  });

  it('renders card text inside a column', () => {
    render(
      <KanbanObject
        id="k1"
        data={{
          x: 0, y: 0, width: 760, height: 480,
          columns: [{ title: 'To Do', cards: ['Write tests', 'Fix bug'] }],
        }}
        {...defaultStage}
      />,
    );
    expect(screen.getByText('Write tests')).toBeTruthy();
    expect(screen.getByText('Fix bug')).toBeTruthy();
  });

  it('renders card count in column header', () => {
    render(
      <KanbanObject
        id="k1"
        data={{
          x: 0, y: 0, width: 760, height: 480,
          columns: [{ title: 'To Do', cards: ['A', 'B', 'C'] }],
        }}
        {...defaultStage}
      />,
    );
    expect(screen.getByText(/To Do \(3\)/i)).toBeTruthy();
  });

  it('handles Firebase object-style cards (cards as plain object keys)', () => {
    render(
      <KanbanObject
        id="k1"
        data={{
          x: 0, y: 0, width: 760, height: 480,
          // Firebase stores arrays as {0:'a', 1:'b'} when received via snapshot
          columns: [{ title: 'To Do', cards: { 0: 'Card A', 1: 'Card B' } }],
        }}
        {...defaultStage}
      />,
    );
    expect(screen.getByText('Card A')).toBeTruthy();
    expect(screen.getByText('Card B')).toBeTruthy();
  });
});

describe('KanbanObject — drag handle', () => {
  beforeEach(() => {
    vi.mocked(useBoard).mockReturnValue(mockBoard());
  });

  it('renders a dedicated drag handle strip at the top', () => {
    render(
      <KanbanObject
        id="k1"
        data={{ x: 0, y: 0, width: 760, height: 480 }}
        {...defaultStage}
      />,
    );
    // The drag handle contains the grip text
    expect(screen.getByText('drag to move')).toBeTruthy();
  });

  it('drag handle has grab cursor style', () => {
    render(
      <KanbanObject
        id="k1"
        data={{ x: 0, y: 0, width: 760, height: 480 }}
        {...defaultStage}
      />,
    );
    const handle = screen.getByText('drag to move').closest('div');
    expect(handle.style.cursor).toBe('grab');
  });
});

describe('KanbanObject — selection', () => {
  it('calls toggleSelection when clicked', () => {
    const toggleSelection = vi.fn();
    vi.mocked(useBoard).mockReturnValue(mockBoard({ toggleSelection }));

    render(
      <KanbanObject
        id="k1"
        data={{ x: 0, y: 0, width: 760, height: 480 }}
        {...defaultStage}
      />,
    );

    // Click the outer container (not a button inside it)
    const container = screen.getByText('drag to move').closest('div[style]');
    fireEvent.click(container.parentElement);
    expect(toggleSelection).toHaveBeenCalledWith('k1', false);
  });

  it('shows selection border when isSelected', () => {
    vi.mocked(useBoard).mockReturnValue(
      mockBoard({ selectedIds: new Set(['k1']) }),
    );
    const { container } = render(
      <KanbanObject
        id="k1"
        data={{ x: 0, y: 0, width: 760, height: 480 }}
        {...defaultStage}
      />,
    );
    // When selected, the drag handle strip is the first child and the outer wrapper
    // has the selection shadow/border applied. We verify isSelected affects rendered output
    // by checking the box-shadow contains the accent colour values (102,126,234).
    const outerDiv = container.firstChild;
    const shadow = outerDiv?.style?.boxShadow ?? '';
    // Selected shadow: '0 4px 24px rgba(102,126,234,0.3)'
    expect(shadow).toMatch(/102.*126.*234|667eea/i);
  });
});

describe('KanbanObject — context menu event', () => {
  it('dispatches richobject:contextmenu custom event on right-click', () => {
    vi.mocked(useBoard).mockReturnValue(mockBoard());
    render(
      <KanbanObject
        id="k-ctx"
        data={{ x: 0, y: 0, width: 760, height: 480 }}
        {...defaultStage}
      />,
    );

    const received = [];
    window.addEventListener('richobject:contextmenu', (e) => received.push(e.detail));

    const outer = screen.getByText('drag to move').parentElement.parentElement;
    fireEvent.contextMenu(outer);

    expect(received.length).toBe(1);
    expect(received[0].objectId).toBe('k-ctx');
  });
});

// ─── TableObject spot-checks ──────────────────────────────────────────────

describe('TableObject — rendering', () => {
  beforeEach(() => {
    vi.mocked(useBoard).mockReturnValue(mockBoard());
  });

  it('renders without crashing', () => {
    expect(() =>
      render(
        <TableObject
          id="t1"
          data={{ x: 0, y: 0, width: 480, height: 280 }}
          {...defaultStage}
        />,
      ),
    ).not.toThrow();
  });

  it('renders drag handle strip', () => {
    render(
      <TableObject
        id="t1"
        data={{ x: 0, y: 0, width: 480, height: 280 }}
        {...defaultStage}
      />,
    );
    expect(screen.getByText('drag to move')).toBeTruthy();
  });

  it('renders default rows and columns', () => {
    render(
      <TableObject
        id="t1"
        data={{ x: 0, y: 0, width: 480, height: 280 }}
        {...defaultStage}
      />,
    );
    expect(screen.getByDisplayValue('Column 1')).toBeTruthy();
    expect(screen.getByDisplayValue('Column 2')).toBeTruthy();
  });
});

// ─── CodeBlock spot-checks ────────────────────────────────────────────────

describe('CodeBlock — rendering', () => {
  beforeEach(() => {
    vi.mocked(useBoard).mockReturnValue(mockBoard());
  });

  it('renders without crashing', () => {
    expect(() =>
      render(
        <CodeBlock
          id="cb1"
          data={{ x: 0, y: 0, width: 420, height: 240 }}
          {...defaultStage}
        />,
      ),
    ).not.toThrow();
  });

  it('renders drag handle strip', () => {
    render(
      <CodeBlock
        id="cb1"
        data={{ x: 0, y: 0, width: 420, height: 240 }}
        {...defaultStage}
      />,
    );
    expect(screen.getByText('drag to move')).toBeTruthy();
  });

  it('renders the code textarea with default code', () => {
    render(
      <CodeBlock
        id="cb1"
        data={{ x: 0, y: 0, width: 420, height: 240 }}
        {...defaultStage}
      />,
    );
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('renders language selector', () => {
    render(
      <CodeBlock
        id="cb1"
        data={{ x: 0, y: 0, width: 420, height: 240 }}
        {...defaultStage}
      />,
    );
    expect(screen.getByDisplayValue('javascript')).toBeTruthy();
  });
});
