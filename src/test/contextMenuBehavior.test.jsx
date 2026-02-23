/**
 * ContextMenu — tests for object context menu vs. empty-canvas context menu.
 * ContextMenu receives all callbacks as props; no useBoard dependency.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContextMenu from '../components/ContextMenu';

// ─── Helpers ─────────────────────────────────────────────────────────────

const makeObjectMenuProps = (overrides = {}) => ({
  x: 200,
  y: 150,
  objectId: 'obj-1',
  worldX: 200,
  worldY: 150,
  onClose: vi.fn(),
  onCopy: vi.fn(),
  onPaste: vi.fn(),
  onDuplicate: vi.fn(),
  onDuplicateObject: vi.fn(),
  onDelete: vi.fn(),
  onBringToFront: vi.fn(),
  onSendToBack: vi.fn(),
  onAddStickyNote: vi.fn(),
  onAddShape: vi.fn(),
  hasSelection: true,
  hasClipboard: false,
  ...overrides,
});

const makeEmptyMenuProps = (overrides = {}) => ({
  x: 300,
  y: 300,
  objectId: null,
  worldX: 300,
  worldY: 300,
  onClose: vi.fn(),
  onCopy: vi.fn(),
  onPaste: vi.fn(),
  onDuplicate: vi.fn(),
  onDuplicateObject: vi.fn(),
  onDelete: vi.fn(),
  onBringToFront: vi.fn(),
  onSendToBack: vi.fn(),
  onAddStickyNote: vi.fn(),
  onAddShape: vi.fn(),
  hasSelection: false,
  hasClipboard: false,
  ...overrides,
});

// ─── Object context menu tests ────────────────────────────────────────────

describe('ContextMenu — object context menu', () => {
  it('renders when objectId is provided', () => {
    expect(() => render(<ContextMenu {...makeObjectMenuProps()} />)).not.toThrow();
  });

  it('shows Duplicate option', () => {
    render(<ContextMenu {...makeObjectMenuProps()} />);
    expect(screen.getByText('Duplicate')).toBeTruthy();
  });

  it('shows Delete option', () => {
    render(<ContextMenu {...makeObjectMenuProps()} />);
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('shows Copy option', () => {
    render(<ContextMenu {...makeObjectMenuProps()} />);
    expect(screen.getByText('Copy')).toBeTruthy();
  });

  it('shows Bring to Front option', () => {
    render(<ContextMenu {...makeObjectMenuProps()} />);
    expect(screen.getByText('Bring to Front')).toBeTruthy();
  });

  it('shows Send to Back option', () => {
    render(<ContextMenu {...makeObjectMenuProps()} />);
    expect(screen.getByText('Send to Back')).toBeTruthy();
  });

  it('clicking Duplicate calls onDuplicateObject and onClose', () => {
    const props = makeObjectMenuProps();
    render(<ContextMenu {...props} />);
    fireEvent.click(screen.getByText('Duplicate'));
    expect(props.onDuplicateObject).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('clicking Delete calls onDelete and onClose', () => {
    const props = makeObjectMenuProps();
    render(<ContextMenu {...props} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(props.onDelete).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('clicking Bring to Front calls onBringToFront', () => {
    const props = makeObjectMenuProps();
    render(<ContextMenu {...props} />);
    fireEvent.click(screen.getByText('Bring to Front'));
    expect(props.onBringToFront).toHaveBeenCalled();
  });
});

// ─── Empty canvas context menu tests ──────────────────────────────────────

describe('ContextMenu — empty canvas context menu', () => {
  it('renders when objectId is null', () => {
    expect(() => render(<ContextMenu {...makeEmptyMenuProps()} />)).not.toThrow();
  });

  it('shows "Add Sticky Note here" option', () => {
    render(<ContextMenu {...makeEmptyMenuProps()} />);
    expect(screen.getByText('Add Sticky Note here')).toBeTruthy();
  });

  it('shows "Add Shape here" option', () => {
    render(<ContextMenu {...makeEmptyMenuProps()} />);
    expect(screen.getByText('Add Shape here')).toBeTruthy();
  });

  it('does NOT show Delete in empty canvas menu', () => {
    render(<ContextMenu {...makeEmptyMenuProps()} />);
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('does NOT show Duplicate in empty canvas menu', () => {
    render(<ContextMenu {...makeEmptyMenuProps()} />);
    expect(screen.queryByText('Duplicate')).toBeNull();
  });

  it('shows "Paste here" when hasClipboard is true', () => {
    render(<ContextMenu {...makeEmptyMenuProps({ hasClipboard: true })} />);
    expect(screen.getByText('Paste here')).toBeTruthy();
  });

  it('does NOT show "Paste here" when clipboard is empty', () => {
    render(<ContextMenu {...makeEmptyMenuProps({ hasClipboard: false })} />);
    expect(screen.queryByText('Paste here')).toBeNull();
  });

  it('clicking "Add Sticky Note here" calls onAddStickyNote with world coords', () => {
    const props = makeEmptyMenuProps();
    render(<ContextMenu {...props} />);
    fireEvent.click(screen.getByText('Add Sticky Note here'));
    expect(props.onAddStickyNote).toHaveBeenCalledWith(300, 300);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('clicking "Add Shape here" calls onAddShape with world coords', () => {
    const props = makeEmptyMenuProps();
    render(<ContextMenu {...props} />);
    fireEvent.click(screen.getByText('Add Shape here'));
    expect(props.onAddShape).toHaveBeenCalledWith(300, 300);
  });
});

// ─── Dismiss behaviour ────────────────────────────────────────────────────

describe('ContextMenu — dismiss behaviour', () => {
  it('calls onClose when Escape key is pressed', () => {
    const props = makeObjectMenuProps();
    render(<ContextMenu {...props} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('renders at the given screen position', () => {
    const { container } = render(<ContextMenu {...makeObjectMenuProps({ x: 450, y: 250 })} />);
    const menu = container.firstChild;
    expect(menu.style.left).toBe('450px');
    expect(menu.style.top).toBe('250px');
  });
});
