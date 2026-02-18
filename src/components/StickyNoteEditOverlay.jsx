import { useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBoard } from '../context/BoardContext';

export default function StickyNoteEditOverlay() {
  const { objects, editingNoteId, setEditingNoteId, stageRef, updateObject } = useBoard();
  const inputRef = useRef(null);
  const lastTextRef = useRef('');
  const debounceTimerRef = useRef(null);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Focus input when editing starts
  useEffect(() => {
    if (editingNoteId && inputRef.current) {
      try {
        inputRef.current.focus();
        lastTextRef.current = inputRef.current.value;
      } catch (err) {
        console.error('Error focusing input:', err);
      }
    }
  }, [editingNoteId]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced text editing: update Firebase after 300ms of no typing
  // This reduces Firebase writes while keeping local UI instant via optimistic updates
  const handleInput = useCallback((e) => {
    if (!editingNoteId) return;
    
    const newText = e.target.value;
    lastTextRef.current = newText;
    
    console.log(`⌨️ Text input (${newText.length} chars), debouncing Firebase write...`);
    
    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce Firebase write to 300ms after last keystroke
    debounceTimerRef.current = setTimeout(() => {
      console.log(`📤 Sending text update to Firebase...`);
      updateObject(editingNoteId, { text: newText });
    }, 300);
  }, [editingNoteId, updateObject]);

  const handleBlur = useCallback(() => {
    if (!editingNoteId) return;
    
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // Immediate final save on blur
    const finalText = inputRef.current?.value ?? '';
    updateObject(editingNoteId, { text: finalText });
    setEditingNoteId(null);
  }, [editingNoteId, updateObject, setEditingNoteId]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      inputRef.current?.blur();
    }
  }, []);

  // NOW we can do conditional returns (after all hooks are called)
  const note = editingNoteId ? objects[editingNoteId] : null;
  
  if (!note || note.type !== 'sticky') {
    return null;
  }

  const stage = stageRef.current;
  if (!stage) return null;

  const { x = 0, y = 0, width = 160, height = 120, text = '', color = '#FEF08A' } = note;
  
  const stageX = stage.x() || 0;
  const stageY = stage.y() || 0;
  const scale = stage.scaleX() || 1;
  
  const left = x * scale + stageX + 8;
  const top = y * scale + stageY + 8;
  const w = Math.max(100, (width - 16) * scale);
  const h = Math.max(80, (height - 16) * scale);

  try {
    const overlay = (
      <textarea
        ref={inputRef}
        defaultValue={text || ''}
        onInput={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Type here…"
        style={{
          position: 'absolute',
          left,
          top,
          width: w,
          height: h,
          border: 'none',
          outline: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 4,
          padding: 4,
          fontSize: 14,
          fontFamily: 'Inter, sans-serif',
          resize: 'none',
          background: color,
          color: '#374151',
          zIndex: 1000,
          boxSizing: 'border-box',
        }}
      />
    );

    const container = document.getElementById('canvas-overlay-root');
    if (!container) {
      console.warn('canvas-overlay-root container not found');
      return null;
    }
    return createPortal(overlay, container);
  } catch (err) {
    console.error('Error rendering edit overlay:', err);
    return null;
  }
}
