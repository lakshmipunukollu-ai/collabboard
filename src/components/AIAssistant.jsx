import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { ref, set, remove, push, get } from 'firebase/database';
import { database } from '../lib/firebase';
import { useBoard } from '../context/BoardContext';
import { showToast } from './Toast';
import { findSkill } from '../sdk/skills/index.js';

const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#FDE68A'];
const SHAPE_RANDOM_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6', '#A855F7', '#E11D48'];

export default function AIAssistant({ embedded = false }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const {
    boardId,
    objects,
    getBoardState,
    createShape,
    createStickyNote,
    createFrame,
    createConnector,
    moveObject,
    updateObject,
    resizeObject,
    deleteObject,
    clearBoard,
    stageRef,
    viewportCenterRef,
    setDeferPan,
    setRequestCenterView,
    startBatch,
    flushBatch,
    aiLock,
  } = useBoard();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const abortControllerRef = useRef(null);
  // kept for any legacy reference; actual batch placement uses per-type row logic
  const aiPlacementOffsetIndexRef = useRef(0);
  const [pendingActions, setPendingActions] = useState(null);
  const [msgRatings, setMsgRatings] = useState({});
  const [reviewState, setReviewState] = useState(null); // { ids: string[] } | null
  const reviewTimerRef = useRef(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const historyLoadedRef = useRef(false); // prevents double-fetch within a session

  // When embedded in a tab panel, always keep the panel open so history loads
  useEffect(() => {
    if (embedded) setIsOpen(true);
  }, [embedded]);

  // ── Load chat history on first open ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !boardId || !user?.id || historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    const msgsRef = ref(database, `chats/${boardId}/${user.id}/messages`);
    get(msgsRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const loaded = Object.entries(data)
          .map(([key, msg]) => ({ ...msg, _fbKey: key }))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          .map(({ _fbKey, timestamp, ...msg }) => msg); // strip internal fields
        setMessages(loaded);
      }
      setHistoryLoaded(true);
    }).catch(() => {
      setHistoryLoaded(true); // fail silently — show welcome as fallback
    });
  }, [isOpen, boardId, user?.id]);

  // ── Chat history persistence ────────────────────────────────────────────────
  const saveMessageToFirebase = useCallback(async (msg) => {
    if (!boardId || !user?.id) return;
    try {
      const msgsRef = ref(database, `chats/${boardId}/${user.id}/messages`);
      const newRef = push(msgsRef);
      await set(newRef, { ...msg, timestamp: Date.now(), id: newRef.key });
      // Enforce 100-message cap: delete oldest if over the limit
      const snap = await get(msgsRef);
      if (snap.exists()) {
        const entries = Object.entries(snap.val());
        if (entries.length > 100) {
          const sorted = entries.sort(([, a], [, b]) => (a.timestamp || 0) - (b.timestamp || 0));
          for (const [key] of sorted.slice(0, entries.length - 100)) {
            await remove(ref(database, `chats/${boardId}/${user.id}/messages/${key}`));
          }
        }
      }
    } catch (err) {
      console.warn('[AI] Failed to save message to history:', err);
    }
  }, [boardId, user?.id]);

  // Voice input via Web Speech API
  const toggleRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice input is not supported in this browser', 'warning');
      return;
    }

    if (isRecording && speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    speechRecognitionRef.current = recognition;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      speechRecognitionRef.current = null;
    };

    recognition.start();
  }, [isRecording]);

  const getBoardCenter = useCallback(() => {
    const stage = stageRef?.current;
    if (stage && stage.width() > 0 && stage.height() > 0) {
      const transform = stage.getAbsoluteTransform().copy().invert();
      return transform.point({
        x: stage.width() / 2,
        y: stage.height() / 2,
      });
    }
    if (viewportCenterRef?.current) return viewportCenterRef.current;
    return { x: 0, y: 0 };
  }, [stageRef, viewportCenterRef]);

  const getScaledSize = useCallback((baseSize) => {
    const stage = stageRef?.current;
    const scale = stage ? stage.scaleX() : 1;
    const minScreenSize = 150;
    const minWorldSize = minScreenSize / scale;
    const scaleFactor = Math.max(1, minWorldSize / baseSize);
    return Math.min(scaleFactor, 200);
  }, [stageRef]);

  /**
   * Returns a CENTER point such that new content (reqW × reqH) will start
   * gap=60 px below the bounding box of all existing objects.
   * Falls back to viewport center when the board is empty.
   */
  const findEmptyPlacement = useCallback((reqW, reqH) => {
    const boardState = getBoardState();
    if (!boardState || boardState.length === 0) {
      return getBoardCenter();
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of boardState) {
      const ox = obj.x ?? 0;
      const oy = obj.y ?? 0;
      const ow = obj.width ?? 100;
      const oh = obj.height ?? 100;
      minX = Math.min(minX, ox);
      minY = Math.min(minY, oy);
      maxX = Math.max(maxX, ox + ow);
      maxY = Math.max(maxY, oy + oh);
    }
    const gap = 60;
    return {
      x: (minX + maxX) / 2,
      y: maxY + gap + (reqH / 2),
    };
  }, [getBoardState, getBoardCenter]);

  // Auto-calculate font size so text fits inside a container
  const calcFontSize = useCallback((text, containerW, containerH, padding = 12) => {
    if (!text) return 13;
    const availW = Math.max(1, containerW - 2 * padding);
    const availH = Math.max(1, containerH - 2 * padding);
    const lines = text.split('\n');
    for (let size = 14; size >= 9; size--) {
      const lineH = size * 1.5;
      const charsPerLine = Math.max(1, Math.floor(availW / (size * 0.58)));
      const totalLines = lines.reduce(
        (acc, line) => acc + Math.max(1, Math.ceil((line.length || 1) / charsPerLine)),
        0
      );
      if (totalLines * lineH <= availH) return size;
    }
    return 9;
  }, []);

  const executeActions = useCallback((actions) => {
    if (!Array.isArray(actions) || actions.length === 0) return;

    aiPlacementOffsetIndexRef.current = 0;

    // firstCenter: used only for setRequestCenterView at the end (pan the viewport)
    const firstCenter = getBoardCenter();
    // layoutCenter: where new content should land (below existing objects)
    // used for spaceEvenly, arrangeInGrid reference — mutable so SWOT/flowchart can override
    let layoutCenter = findEmptyPlacement(160, 120);

    const hasCreates = actions.some((a) => [
      'add_shape', 'add_sticky_note', 'add_frame',
      'createShape', 'createStickyNote', 'createFrame',
      'createStickyNoteGrid', 'createSwotTemplate',
      'createUserJourney', 'createRetrospectiveBoard', 'createFrameWithNotes',
    ].includes(a.type));
    if (hasCreates && actions.length > 1 && setDeferPan) {
      setDeferPan(true);
      if (startBatch) startBatch(); // batch all Firebase writes into one round trip
    }

    // Two-pass: run all non-layout actions first, then layout (arrangeInGrid, spaceEvenly)
    const layoutTypes = ['arrangeInGrid', 'spaceEvenly'];
    const pass1Actions = actions.filter((a) => !layoutTypes.includes(a.type));
    const pass2Actions = actions.filter((a) => layoutTypes.includes(a.type));
    const actionsToRun = pass2Actions.length > 0 ? [...pass1Actions, ...pass2Actions] : actions;

    const createdIdsThisBatch = [];
    let didArrangeInGrid = false;

    const shapeDefaults = {
      circle: { base: 100, w: 100, h: 100, color: '#10B981' },
      rectangle: { base: 100, w: 100, h: 80, color: '#6366F1' },
      line: { base: 150, w: 150, h: 20, color: '#F59E0B' },
      oval: { base: 120, w: 120, h: 80, color: '#8B5CF6' },
    };

    // ── Pre-compute batch counts for horizontal row layout ────────────────────
    // Items with explicit x/y use those coords; only auto-placed items get row layout.
    const batchGap = 24;

    const autoShapeCount = actionsToRun.filter(
      (a) => (a.type === 'createShape' || a.type === 'add_shape') && a.x == null
    ).length;
    const autoStickyCount = actionsToRun.filter(
      (a) => (a.type === 'createStickyNote' || a.type === 'add_sticky_note') && a.x == null
    ).length;
    const autoFrameCount = actionsToRun.filter(
      (a) => (a.type === 'createFrame' || a.type === 'add_frame') && a.x == null
    ).length;

    // Compute placement anchors once (board state is stable during this function)
    const shapeBatchPlacement = autoShapeCount > 0
      ? findEmptyPlacement(autoShapeCount * (100 + batchGap) - batchGap, 100)
      : layoutCenter;
    const stickyBatchPlacement = autoStickyCount > 0
      ? findEmptyPlacement(autoStickyCount * (160 + batchGap) - batchGap, 120)
      : layoutCenter;
    const frameBatchPlacement = autoFrameCount > 0
      ? findEmptyPlacement(autoFrameCount * (600 + batchGap) - batchGap, 400)
      : layoutCenter;

    let autoShapeIdx = 0;
    let autoStickyIdx = 0;
    let autoFrameIdx = 0;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const runCreateShape = (shape, color, x, y, width, height, useRandomColor) => {
      const d = shapeDefaults[shape] || shapeDefaults.circle;
      const scaleFactor = getScaledSize(d.base);
      const w = width ?? (d.w || d.base) * scaleFactor;
      const h = height ?? (d.h || d.base) * scaleFactor;
      let fx, fy;
      if (x != null) {
        fx = x;
        fy = y;
      } else {
        const N = autoShapeCount;
        const i = autoShapeIdx++;
        const totalW = N * (w + batchGap) - batchGap;
        fx = shapeBatchPlacement.x - totalW / 2 + i * (w + batchGap);
        fy = shapeBatchPlacement.y - h / 2;
      }
      const resolvedColor = useRandomColor
        ? SHAPE_RANDOM_COLORS[Math.floor(Math.random() * SHAPE_RANDOM_COLORS.length)]
        : (color || d.color);
      const id = createShape(shape, fx, fy, w, h, resolvedColor);
      if (id) createdIdsThisBatch.push(id);
      return id;
    };

    const runCreateStickyNote = (text, color, x, y, width, height) => {
      const baseW = 160;
      const baseH = 120;
      const scaleFactor = getScaledSize(baseW);
      const w = width ?? baseW * scaleFactor;
      const h = height ?? baseH * scaleFactor;
      let fx, fy;
      if (x != null) {
        fx = x;
        fy = y;
      } else {
        const N = autoStickyCount;
        const i = autoStickyIdx++;
        const totalW = N * (w + batchGap) - batchGap;
        fx = stickyBatchPlacement.x - totalW / 2 + i * (w + batchGap);
        fy = stickyBatchPlacement.y - h / 2;
      }
      const c = color || STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
      const id = createStickyNote(text ?? 'New note', fx, fy, c, w, h);
      if (id) createdIdsThisBatch.push(id);
      showToast('Sticky note added', 'success');
      return id;
    };

    const runCreateFrame = (title, x, y, width, height) => {
      const fw = width ?? 600;
      const fh = height ?? 400;
      let fx, fy;
      if (x != null) {
        fx = x;
        fy = y;
      } else {
        const N = autoFrameCount;
        const i = autoFrameIdx++;
        const totalW = N * (fw + batchGap) - batchGap;
        fx = frameBatchPlacement.x - totalW / 2 + i * (fw + batchGap);
        fy = frameBatchPlacement.y - fh / 2;
      }
      const id = createFrame(fx, fy, fw, fh, title ?? 'Frame');
      if (id) createdIdsThisBatch.push(id);
      showToast('Frame added', 'success');
      return id;
    };

    // ── Main action loop ──────────────────────────────────────────────────────
    for (const action of actionsToRun) {
      try {
        if (action.type === 'add_shape' || action.type === 'createShape') {
          const id = runCreateShape(action.shape || 'circle', action.color, action.x, action.y, action.width, action.height, !!action.randomColor);
          const shapeCount = actionsToRun.filter((a) => a.type === 'add_shape' || a.type === 'createShape').length;
          if (shapeCount === 1 && id) showToast('Shape added', 'success');
        } else if (action.type === 'add_sticky_note' || action.type === 'createStickyNote') {
          runCreateStickyNote(action.text, action.color, action.x, action.y, action.width, action.height);
        } else if (action.type === 'add_frame' || action.type === 'createFrame') {
          runCreateFrame(action.title, action.x, action.y, action.width, action.height);
        } else if (action.type === 'createFrameWithNotes') {
          const fw = action.width ?? 600;
          const notes = action.notes ?? [];
          const titleH = 40;
          const pad = 16;
          const sw = fw - 2 * pad;
          const sh = 72;
          const noteGap = 12;
          // Calculate exact height needed so notes never overflow the frame
          const requiredH = titleH + pad + notes.length * sh + Math.max(0, notes.length - 1) * noteGap + pad;
          const fh = Math.max(action.height ?? 400, requiredH);
          const placement = findEmptyPlacement(fw, fh);
          const fx = placement.x - fw / 2;
          const fy = placement.y - fh / 2;
          const frameId = createFrame(fx, fy, fw, fh, action.title ?? 'Frame');
          if (frameId) createdIdsThisBatch.push(frameId);
          // Collect created sticky IDs so index-based connections can be wired up after
          const frameNoteIds = [];
          notes.forEach((text, idx) => {
            const nx = fx + pad;
            const ny = fy + titleH + pad + idx * (sh + noteGap);
            const stickyId = createStickyNote(String(text), nx, ny, STICKY_COLORS[idx % STICKY_COLORS.length], sw, sh);
            if (stickyId) {
              createdIdsThisBatch.push(stickyId);
              frameNoteIds.push(stickyId);
              requestAnimationFrame(() => setTimeout(() => {
                updateObject(stickyId, { parentFrameId: frameId });
              }, 0));
            }
          });
          // Wire connections by note index (e.g. [{from:0,to:1}]) using real generated IDs
          const connections = action.connections ?? [];
          if (connections.length > 0 && frameNoteIds.length > 1) {
            requestAnimationFrame(() => setTimeout(() => {
              connections.forEach(({ from, to }) => {
                const fromId = frameNoteIds[from];
                const toId = frameNoteIds[to];
                if (fromId && toId) createConnector(fromId, toId, 'straight');
              });
            }, 150));
          }
          showToast('Frame with notes created', 'success');
        } else if (action.type === 'createConnector') {
          if (action.fromId && action.toId) {
            createConnector(action.fromId, action.toId, action.style || 'straight');
            showToast('Connector added', 'success');
          }
        } else if (action.type === 'moveObject') {
          if (action.objectId != null && action.x != null && action.y != null && moveObject) {
            moveObject(action.objectId, action.x, action.y);
            showToast('Moved', 'success');
          }
        } else if (action.type === 'resizeObject') {
          if (action.objectId != null && action.width != null && action.height != null && resizeObject) {
            resizeObject(action.objectId, action.width, action.height);
            showToast('Resized', 'success');
          }
        } else if (action.type === 'updateText') {
          if (action.objectId != null && action.newText != null && updateObject) {
            const obj = objects[action.objectId];
            if (obj) {
              if (obj.type === 'frame') updateObject(action.objectId, { title: action.newText });
              else updateObject(action.objectId, { text: action.newText });
              showToast('Text updated', 'success');
            }
          }
        } else if (action.type === 'changeColor') {
          if (action.objectId != null && action.color && updateObject) {
            updateObject(action.objectId, { color: action.color });
            showToast('Color updated', 'success');
          }
        } else if (action.type === 'deleteObject') {
          if (action.objectId && deleteObject) {
            if (objects[action.objectId]) {
              deleteObject(action.objectId);
              showToast('Deleted', 'success');
            } else {
              console.warn('[AI] deleteObject: id not found in objects:', action.objectId);
              showToast('Object not found — board state may be stale', 'warning');
            }
          }
        } else if (action.type === 'clearBoard') {
          if (clearBoard) {
            clearBoard();
          } else {
            Object.keys(objects).forEach((id) => deleteObject && deleteObject(id));
          }
          showToast('Board cleared', 'success');
        } else if (action.type === 'arrangeInGrid') {
          const layoutAction = action;
          const ids = layoutAction.objectIds?.length ? layoutAction.objectIds : [...createdIdsThisBatch];
          if (!ids.length || !layoutAction.rows || !layoutAction.cols || !moveObject) continue;
          didArrangeInGrid = true;
          const fc = { ...layoutCenter };
          const sp = layoutAction.spacing ?? 20;
          const runGrid = () => {
            const objs = ids.map((id) => ({ id, width: 160, height: 120 }));
            const maxW = 160;
            const maxH = 120;
            const { rows, cols } = layoutAction;
            const startX = fc.x - (cols * (maxW + sp) - sp) / 2;
            const startY = fc.y - (rows * (maxH + sp) - sp) / 2;
            objs.forEach((obj, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              moveObject(obj.id, startX + c * (maxW + sp), startY + r * (maxH + sp));
            });
            showToast('Arranged in grid', 'success');
          };
          requestAnimationFrame(() => setTimeout(runGrid, 0));
        } else if (action.type === 'createStickyNoteGrid') {
          const { rows, cols, labels = [], spacing = 20 } = action;
          const baseW = 160;
          const baseH = 120;
          const scaleFactor = getScaledSize(baseW);
          const w = baseW * scaleFactor;
          const h = baseH * scaleFactor;
          const totalW = cols * (w + spacing) - spacing;
          const totalH = rows * (h + spacing) - spacing;
          const gridPlacement = findEmptyPlacement(totalW, totalH);
          const startX = gridPlacement.x - totalW / 2;
          const startY = gridPlacement.y - totalH / 2;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const idx = r * cols + c;
              const text = labels[idx] ?? '';
              const id = createStickyNote(text, startX + c * (w + spacing), startY + r * (h + spacing), STICKY_COLORS[idx % STICKY_COLORS.length], w, h);
              if (id) createdIdsThisBatch.push(id);
            }
          }
          showToast('Sticky note grid created', 'success');
        } else if (action.type === 'spaceEvenly') {
          let { objectIds: ids, direction = 'horizontal' } = action;
          if (!ids?.length && createdIdsThisBatch.length) ids = [...createdIdsThisBatch];
          if (!ids?.length || !moveObject) continue;
          const gap = 24;
          const defaultW = 160;
          const defaultH = 120;
          const objs = ids.map((id) => ({ id, width: defaultW, height: defaultH }));
          const totalW = objs.length * defaultW + (objs.length - 1) * gap;
          const totalH = objs.length * defaultH + (objs.length - 1) * gap;
          const span = direction === 'horizontal' ? totalW : totalH;
          const start = direction === 'horizontal' ? layoutCenter.x - span / 2 : layoutCenter.y - span / 2;
          const fc = { ...layoutCenter };
          const runSpace = () => {
            objs.forEach((obj, i) => {
              if (direction === 'horizontal') {
                const x = start + i * (defaultW + gap);
                moveObject(obj.id, x, fc.y - defaultH / 2);
              } else {
                const y = start + i * (defaultH + gap);
                moveObject(obj.id, fc.x - defaultW / 2, y);
              }
            });
            showToast('Spaced evenly', 'success');
          };
          requestAnimationFrame(() => setTimeout(runSpace, 0));
        } else if (action.type === 'createSwotTemplate') {
          // ── Layout constants ────────────────────────────────────────────────
          // titleH matches Frame.jsx's actual title bar (height={40} in Rect)
          const TITLE_H = 40;
          const PAD    = 20;   // 20 px padding on all sides inside each quadrant
          const GAP    = 20;   // 20 px gap between the 4 quadrant frames
          const QW     = 320;  // quadrant frame width
          const QH     = 400;  // quadrant frame height
          // Sticky size derived from quadrant minus padding — hits professor's 280×320 minimum
          const SW = QW - 2 * PAD;          // 280 px
          const SH = QH - TITLE_H - 2 * PAD; // 320 px

          const totalW = 2 * QW + GAP;  // 660 px
          const totalH = 2 * QH + GAP;  // 820 px

          const swotPlacement = findEmptyPlacement(totalW, totalH);
          const startX = swotPlacement.x - totalW / 2;
          const startY = swotPlacement.y - totalH / 2;
          // Ensure the viewport pans to show the freshly generated SWOT
          layoutCenter = swotPlacement;

          // ── Hardcoded colour mapping — never drifts regardless of AI output ─
          const SWOT_FRAME_COLORS = [
            { bg: 'rgba(187,247,208,0.22)', border: '#4ade80' },  // Strengths    — green
            { bg: 'rgba(254,202,202,0.22)', border: '#f87171' },  // Weaknesses   — pink/red
            { bg: 'rgba(191,219,254,0.22)', border: '#60a5fa' },  // Opportunities — blue
            { bg: 'rgba(254,240,138,0.22)', border: '#facc15' },  // Threats      — yellow
          ];
          const SWOT_STICKY_COLORS = ['#bbf7d0', '#fecaca', '#bfdbfe', '#fef08a'];
          const TITLES   = ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'];
          const QUAD_KEYS = ['strengths', 'weaknesses', 'opportunities', 'threats'];

          // ── Stickies payload (fallback if AI sends empty/partial data) ───────
          let stickiesPayload = action.stickies && typeof action.stickies === 'object' ? action.stickies : null;
          const allEmpty = !stickiesPayload || QUAD_KEYS.every(
            (k) => !Array.isArray(stickiesPayload[k]) || stickiesPayload[k].length === 0
          );
          if (allEmpty) {
            stickiesPayload = {
              strengths:     ['Clear competitive advantage in core market', 'Strong existing customer relationships', 'Experienced and dedicated team', 'Unique product or service offering'],
              weaknesses:    ['Limited marketing budget and brand awareness', 'Operational processes need improvement', 'Dependency on key personnel', 'Gaps in product or service coverage'],
              opportunities: ['Growing demand in target market segment', 'New technology enables cost reduction', 'Untapped geographic markets available', 'Strategic partnership potential with industry leaders'],
              threats:       ['Increasing competition from new market entrants', 'Regulatory changes could impact operations', 'Economic uncertainty affecting consumer spending', 'Rapid technology shifts requiring adaptation'],
            };
          }

          // ── Create all 4 quadrants in a strict 2×2 grid ─────────────────────
          // Build the full list synchronously before touching any deferred calls.
          const swotFrameIds = [];
          const swotStickyIds = [];

          for (let qi = 0; qi < 4; qi++) {
            const col    = qi % 2;
            const row    = Math.floor(qi / 2);
            const frameX = startX + col * (QW + GAP);
            const frameY = startY + row * (QH + GAP);

            const { bg, border } = SWOT_FRAME_COLORS[qi];
            const frameId = createFrame(frameX, frameY, QW, QH, TITLES[qi], bg, border);
            if (frameId) {
              createdIdsThisBatch.push(frameId);
              swotFrameIds[qi] = frameId;
            }

            // Build bullet text (• …) for this quadrant
            const key   = QUAD_KEYS[qi];
            const items = Array.isArray(stickiesPayload[key]) ? stickiesPayload[key].slice(0, 6) : [];
            const bulletText = items.length
              ? items.map((t) => `• ${String(t).trim()}`).join('\n')
              : `• Add your ${TITLES[qi].toLowerCase()} here`;

            // Position sticky so it fills the quadrant with PAD on all sides
            const stickyX = frameX + PAD;
            const stickyY = frameY + TITLE_H + PAD;
            const stickyId = createStickyNote(bulletText, stickyX, stickyY, SWOT_STICKY_COLORS[qi], SW, SH);
            if (stickyId) {
              createdIdsThisBatch.push(stickyId);
              swotStickyIds[qi] = stickyId;
            }
          }

          // ── Deferred: set parentFrameId + font size on every sticky ─────────
          // Done after creation so all IDs are confirmed in the optimistic store.
          const stickyPairs = swotStickyIds
            .map((sid, qi) => ({ sid, fid: swotFrameIds[qi] }))
            .filter((p) => p.sid && p.fid);

          if (stickyPairs.length && updateObject) {
            requestAnimationFrame(() => setTimeout(() => {
              stickyPairs.forEach(({ sid, fid }) => {
                updateObject(sid, { parentFrameId: fid, fontSize: 12 });
              });
            }, 50));
          }

          showToast('SWOT analysis created', 'success');
        } else if (action.type === 'createUserJourney') {
          const n = Math.min(Number(action.stageCount) || 5, 15);
          const names = action.stageNames && action.stageNames.length >= n ? action.stageNames : Array.from({ length: n }, (_, i) => `Stage ${i + 1}`);
          const baseW = 140;
          const baseH = 80;
          const scaleFactor = getScaledSize(baseW);
          const w = baseW * scaleFactor;
          const h = baseH * scaleFactor;
          const gap = 24;
          const totalW = n * (w + gap) - gap;
          const journeyPlacement = findEmptyPlacement(totalW, h);
          const startX = journeyPlacement.x - totalW / 2;
          const startY = journeyPlacement.y - h / 2;
          for (let i = 0; i < n; i++) {
            const id = createStickyNote(names[i], startX + i * (w + gap), startY, STICKY_COLORS[i % STICKY_COLORS.length], w, h);
            if (id) createdIdsThisBatch.push(id);
          }
          showToast('User journey created', 'success');
        } else if (action.type === 'createRetrospectiveBoard') {
          const cols = ['What Went Well', "What Didn't", 'Action Items'];
          const cw = 320;
          const ch = 360;
          const gap = 24;
          const totalW = 3 * cw + 2 * gap;
          const retroPlacement = findEmptyPlacement(totalW, ch);
          const startX = retroPlacement.x - totalW / 2;
          const startY = retroPlacement.y - ch / 2;
          cols.forEach((title, i) => {
            const id = createFrame(startX + i * (cw + gap), startY, cw, ch, title);
            if (id) createdIdsThisBatch.push(id);
          });
          showToast('Retrospective board created', 'success');
        } else if (action.type === 'addFlowchart') {
          const steps = action.steps ?? ['Start', 'Step 1', 'Step 2', 'End'];
          const sw = 180;
          const sh = 60;
          const gap = 80;  // 80px vertical gap as specified
          const totalH = steps.length * sh + (steps.length - 1) * gap;
          const placement = findEmptyPlacement(sw + 80, totalH + 80);
          const startX = placement.x - sw / 2;
          const startY = placement.y - totalH / 2;
          layoutCenter = placement;

          // Outer frame for the flowchart
          const outerPad = 40;
          const outerTitle = action.title ? `Flowchart — ${action.title}` : 'Flowchart';
          const outerFrameId = createFrame(
            startX - outerPad,
            startY - outerPad - 44,
            sw + 2 * outerPad,
            totalH + 2 * outerPad + 44,
            outerTitle
          );
          if (outerFrameId) createdIdsThisBatch.push(outerFrameId);

          const shapeIds = [];
          steps.forEach((stepLabel, i) => {
            const y = startY + i * (sh + gap);
            const isEnd = i === steps.length - 1;
            const isStart = i === 0;
            const shapeType = (isStart || isEnd) ? 'oval' : 'rectangle';
            const color = isStart ? '#10B981' : isEnd ? '#EF4444' : '#6366F1';
            const id = createShape(shapeType, startX, y, sw, sh, color);
            if (id) {
              shapeIds.push(id);
              createdIdsThisBatch.push(id);
              requestAnimationFrame(() => setTimeout(() => {
                if (updateObject) updateObject(id, { label: stepLabel, parentFrameId: outerFrameId });
              }, 100));
            }
          });
          // Connect all shapes in sequence
          requestAnimationFrame(() => setTimeout(() => {
            for (let i = 0; i < shapeIds.length - 1; i++) {
              createConnector(shapeIds[i], shapeIds[i + 1], 'arrow');
            }
          }, 200));
          showToast(`Flowchart "${action.title ?? ''}" created (${steps.length} steps)`, 'success');
        }
      } catch (err) {
        console.error(`AI action error [type=${action?.type}]:`, err);
      }
    }

    if (hasCreates && setDeferPan && setRequestCenterView) {
      if (flushBatch) flushBatch(); // emit all queued creates as a single Firebase update()
      setDeferPan(false);
      // Pan to where new content was placed, not the old board center
      setRequestCenterView(layoutCenter);
    }
    return createdIdsThisBatch;
  }, [getBoardCenter, findEmptyPlacement, getScaledSize, calcFontSize, objects, createShape, createStickyNote, createFrame, createConnector, moveObject, updateObject, resizeObject, deleteObject, clearBoard, setDeferPan, setRequestCenterView, startBatch, flushBatch]);

  // Function URL — always uses the deployed Firebase function.
  // To use the local emulator instead, temporarily change functionUrl to:
  // `http://localhost:5002/${firebaseProjectId}/us-central1/aiChat`
  const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'collabboard-d900c';
  const functionUrl = `https://us-central1-${firebaseProjectId}.cloudfunctions.net/aiChat`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  }, []);

  const sendMessage = async (overrideText) => {
    const messageText = overrideText !== undefined ? String(overrideText).trim() : input.trim();
    if (!messageText) return;

    if (!user) {
      showToast('⚠️ Please sign in to use the AI Assistant', 'warning');
      return;
    }

    // Discard any pending confirmation when a new message is sent
    if (pendingActions) setPendingActions(null);

    const userMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    saveMessageToFirebase(userMessage);
    setInput('');
    setIsLoading(true);

    // Await the aiLock write so other clients see it BEFORE the fetch starts
    if (boardId && user) {
      try {
        await set(ref(database, `boards/${boardId}/aiLock`), {
          userId: user.id,
          userName: user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Someone',
          timestamp: Date.now(),
        });
      } catch (_) {}
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      let token = null;
      if (typeof getToken === 'function') {
        try {
          token = await getToken();
        } catch (tokenErr) {
          console.warn('[AI] getToken() threw — proceeding without Clerk token:', tokenErr?.message);
        }
      }

      // Check for a matching skill to inject a structured system prompt
      const boardState = getBoardState();
      const skill = findSkill(messageText);
      let enrichedMessages = [...messages, userMessage];
      if (skill) {
        const skillPrompt = skill.buildPrompt(messageText, boardState || []);
        enrichedMessages = [
          { role: 'user', content: `[SKILL:${skill.name}] ${skillPrompt}` },
          ...messages,
          userMessage,
        ];
      }

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || 'emulator-session'}`,
        },
        body: JSON.stringify({
          messages: enrichedMessages,
          model: 'gpt-4o-mini',
          boardState,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.message?.content ?? "I've added that to your board.";
      const assistantMessage = { role: 'assistant', content };
      setMessages(prev => [...prev, assistantMessage]);
      saveMessageToFirebase(assistantMessage);
      // Notify RightPanel so it can show the unread dot when panel is collapsed
      window.dispatchEvent(new CustomEvent('ai:response'));

      if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
        // Execute immediately so the user sees the result on canvas
        const createdIds = executeActions(data.actions);
        if (createdIds && createdIds.length > 0) {
          clearTimeout(reviewTimerRef.current);
          setReviewState({ ids: createdIds });
          // Auto-dismiss after 30 seconds (treat as "Keep it")
          reviewTimerRef.current = setTimeout(() => setReviewState(null), 30000);
        }
      } else if (data.actions && data.actions.length === 0) {
        // AI returned an explicit empty actions array — show helpful message
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "I wasn't able to create that. Try describing what you want differently.",
        }]);
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        const msg = 'This is taking too long. Please try again.';
        showToast(`⏱ ${msg}`, 'warning');
        setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
      } else {
        console.error('AI Assistant error:', error);
        const isConnectionError = error?.message === 'Failed to fetch' || (error?.name === 'TypeError' && String(error?.message || '').toLowerCase().includes('fetch'));
        const userMsg = isConnectionError
          ? 'AI Assistant is temporarily unavailable. Please check your internet connection and try again.'
          : 'Sorry, I encountered an error. Please try again.';
        showToast(isConnectionError ? `❌ ${userMsg}` : '❌ Failed to get response. Please try again.', 'error');
        setMessages(prev => [...prev, { role: 'assistant', content: userMsg }]);
      }
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setIsLoading(false);
      if (boardId) {
        remove(ref(database, `boards/${boardId}/aiLock`)).catch(() => {});
      }
    }
  };

  // ── Clear chat history ─────────────────────────────────────────────────────
  const clearChatHistory = useCallback(async () => {
    if (!boardId || !user?.id) return;
    if (!window.confirm('Are you sure? This will delete your entire chat history for this board.')) return;
    try {
      await remove(ref(database, `chats/${boardId}/${user.id}/messages`));
      setMessages([]);
      historyLoadedRef.current = false; // allow reload if panel is closed+reopened
      showToast('Chat history cleared', 'info');
    } catch {
      showToast('Failed to clear history', 'error');
    }
  }, [boardId, user?.id]);

  // Determine if another user holds the AI lock
  const otherUserLock = aiLock && aiLock.userId !== user?.id ? aiLock : null;

  // ── Review flow handlers ────────────────────────────────────────────────────
  const handleKeepGenerated = useCallback(() => {
    clearTimeout(reviewTimerRef.current);
    setReviewState(null);
  }, []);

  const handleModifyGenerated = useCallback(() => {
    clearTimeout(reviewTimerRef.current);
    setReviewState(null);
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleRemoveGenerated = useCallback(() => {
    clearTimeout(reviewTimerRef.current);
    if (reviewState) {
      reviewState.ids.forEach(id => deleteObject(id));
    }
    setReviewState(null);
  }, [reviewState, deleteObject]);

  // Compute screen-space rect for a canvas object (for highlight overlays)
  const getObjectScreenRect = useCallback((id) => {
    const obj = objects[id];
    if (!obj || obj.type === 'connector') return null;
    const stageNode = stageRef?.current;
    if (!stageNode) return null;
    try {
      const containerRect = stageNode.container().getBoundingClientRect();
      const left = containerRect.left + stageNode.x() + obj.x * stageNode.scaleX();
      const top = containerRect.top + stageNode.y() + obj.y * stageNode.scaleY();
      const width = (obj.width || 100) * stageNode.scaleX();
      const height = (obj.height || 100) * stageNode.scaleY();
      if (!isFinite(left) || !isFinite(top)) return null;
      return { left, top, width, height };
    } catch {
      return null;
    }
  }, [objects, stageRef]);

  // Floating review banner + per-object highlight overlays
  const reviewBannerJSX = reviewState ? (
    <>
      {/* Per-object highlight overlays */}
      {reviewState.ids.map(id => {
        const rect = getObjectScreenRect(id);
        if (!rect) return null;
        return (
          <div
            key={id}
            style={{
              position: 'fixed',
              left: rect.left - 3,
              top: rect.top - 3,
              width: rect.width + 6,
              height: rect.height + 6,
              border: '2px solid #3B82F6',
              borderRadius: 6,
              boxShadow: '0 0 0 4px rgba(59,130,246,0.18)',
              pointerEvents: 'none',
              zIndex: 1999,
            }}
          />
        );
      })}

      {/* Floating review banner at top-center of viewport */}
      <div style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 3000,
        background: '#1e293b',
        border: '1px solid #3B82F6',
        borderRadius: 12,
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 4px 24px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.4)',
        color: 'white',
        fontSize: '0.85rem',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}>
        <span style={{ fontSize: '1rem' }}>✨</span>
        <span style={{ color: '#93c5fd', fontWeight: 500 }}>
          AI generated {reviewState.ids.length} object{reviewState.ids.length !== 1 ? 's' : ''} — does it look good?
        </span>
        <button
          onClick={handleKeepGenerated}
          style={{
            padding: '5px 12px', background: '#10b981', border: 'none',
            borderRadius: 6, color: 'white', cursor: 'pointer',
            fontSize: '0.8rem', fontWeight: 600,
          }}
        >
          ✅ Keep it
        </button>
        <button
          onClick={handleModifyGenerated}
          style={{
            padding: '5px 12px', background: '#3B82F6', border: 'none',
            borderRadius: 6, color: 'white', cursor: 'pointer',
            fontSize: '0.8rem', fontWeight: 600,
          }}
        >
          ✏️ Modify
        </button>
        <button
          onClick={handleRemoveGenerated}
          style={{
            padding: '5px 12px', background: 'transparent',
            border: '1px solid #ef4444',
            borderRadius: 6, color: '#ef4444', cursor: 'pointer',
            fontSize: '0.8rem', fontWeight: 600,
          }}
        >
          🗑️ Remove it
        </button>
      </div>
    </>
  ) : null;

  if (!isOpen && !embedded) {
    return (
      <>
        {reviewBannerJSX}
        <button
          onClick={() => setIsOpen(true)}
          title="AI Assistant"
          style={{
            position: 'fixed',
            bottom: 76,
            right: 20,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
            cursor: 'pointer',
            fontSize: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            transition: 'transform 0.2s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          🤖
        </button>
      </>
    );
  }

  return (
    <>
    {reviewBannerJSX}
    <div
      style={embedded ? {
        // Fill the parent tab container — no fixed positioning
        width: '100%',
        flex: 1,
        minHeight: 0,
        background: '#1e293b',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      } : {
        position: 'fixed',
        bottom: 76,
        right: 20,
        width: 380,
        height: 520,
        background: '#1e293b',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1001,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.5rem' }}>🤖</span>
          <span style={{ fontWeight: 600 }}>AI Assistant</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Clear chat history */}
          {messages.length > 0 && (
            <button
              onClick={clearChatHistory}
              title="Clear chat history"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '0.8rem',
                padding: '4px 6px',
                borderRadius: 4,
              }}
            >
              🗑 Clear
            </button>
          )}
          {!embedded && (
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1.5rem',
                padding: 4,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Chat status panel */}
      <div style={{
        padding: '4px 16px',
        background: otherUserLock ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
        borderBottom: '1px solid #334155',
        color: otherUserLock ? '#FCD34D' : '#64748b',
        fontSize: '0.68rem',
        fontWeight: otherUserLock ? 600 : 400,
        textAlign: 'center',
        minHeight: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flexShrink: 0,
      }}>
        {otherUserLock
          ? `⏳ ${otherUserLock.userName} is using AI...`
          : (
            <>
              <span>✨ AI Assistant Ready</span>
              {historyLoaded && messages.length > 0 && (
                <span style={{ color: '#334155', fontSize: '0.7rem' }}>· 💾 history saved</span>
              )}
            </>
          )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {/* Loading indicator while fetching history */}
        {!historyLoaded && (
          <div style={{ textAlign: 'center', color: '#475569', padding: '24px 16px', fontSize: '0.8rem' }}>
            ⏳ Loading your chat...
          </div>
        )}

        {historyLoaded && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '24px 16px' }}>
            <p style={{ fontSize: '1.25rem', marginBottom: 8 }}>👋</p>
            <p style={{ fontSize: '0.875rem', margin: '0 0 16px' }}>
              Hi{user?.firstName ? `, ${user.firstName}` : ''}! I'm your AI assistant. Ask me anything about brainstorming,
              organizing ideas, or using CollabBoard!
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {[
                'Create a SWOT Analysis',
                'Brainstorm Ideas',
                'Build a Mind Map',
                'Create a Flowchart',
                'Make a Kanban Board',
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  disabled={isLoading}
                  style={{
                    padding: '6px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 16,
                    color: '#93C5FD',
                    fontSize: '0.75rem',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                  onMouseOver={(e) => { if (!isLoading) e.currentTarget.style.background = '#1e293b'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#0f172a'; }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: msg.role === 'user' ? '75%' : '85%',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 16,
                background: msg.role === 'user' ? '#667eea' : '#334155',
                color: 'white',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {msg.content}
            </div>
            {msg.role === 'assistant' && (
              <div style={{ display: 'flex', gap: 2, marginTop: 4, paddingLeft: 4 }}>
                {['up', 'down'].map((dir) => (
                  <button
                    key={dir}
                    title={dir === 'up' ? 'Helpful' : 'Not helpful'}
                    onClick={() => {
                      setMsgRatings((r) => ({ ...r, [idx]: dir }));
                      if (dir === 'up') showToast('Thanks!', 'success');
                    }}
                    style={{
                      background: msgRatings[idx] === dir
                        ? (dir === 'up' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)')
                        : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      lineHeight: 1,
                      padding: '2px 4px',
                      borderRadius: 4,
                      opacity: msgRatings[idx] && msgRatings[idx] !== dir ? 0.35 : 1,
                    }}
                  >
                    {dir === 'up' ? '👍' : '👎'}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: 16,
              background: '#334155',
              color: '#94A3B8',
              fontSize: '0.875rem',
            }}>
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending actions confirmation */}
      {pendingActions && (
        <div style={{
          padding: '10px 16px',
          background: '#0f172a',
          borderTop: '1px solid #334155',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', flex: 1 }}>
            Ready to place {pendingActions.length} object{pendingActions.length !== 1 ? 's' : ''} on canvas
          </span>
          <button
            onClick={() => { executeActions(pendingActions); setPendingActions(null); showToast('Added to canvas', 'success'); }}
            style={{
              padding: '6px 12px', background: '#10b981', border: 'none',
              borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
            }}
          >
            ✅ Add to canvas
          </button>
          <button
            onClick={() => { setPendingActions(null); showToast('Discarded', 'info'); }}
            style={{
              padding: '6px 10px', background: 'transparent', border: '1px solid #475569',
              borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            ✗ Discard
          </button>
        </div>
      )}

      {/* Slash command hints */}
      {input.startsWith('/') && (
        <div style={{
          padding: '6px 12px',
          background: '#0f172a',
          borderTop: '1px solid #1e293b',
          fontSize: '0.72rem',
          color: '#64748b',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 12px',
          flexShrink: 0,
        }}>
          {[
            '/summarize', '/brainstorm [topic]', '/generate kanban [topic]',
            '/add flowchart [process]', '/explain', '/schema [app]',
          ].map((cmd) => (
            <span
              key={cmd}
              style={{
                cursor: 'pointer',
                color: input && cmd.startsWith(input) ? '#93C5FD' : '#64748b',
              }}
              onClick={() => setInput(cmd.split(' [')[0] + ' ')}
            >
              {cmd}
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        borderTop: '1px solid #334155',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!isLoading) sendMessage();
            }
          }}
          placeholder="Ask anything or type / for help…"
          disabled={isLoading}
          rows={1}
          style={{
            flex: 1,
            padding: '10px 10px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            color: 'white',
            fontSize: '13px',
            resize: 'none',
            minHeight: 52,
            maxHeight: 120,
            overflowY: 'auto',
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />
        {/* Mic button for voice input */}
        <button
          onClick={toggleRecording}
          title={isRecording ? 'Stop recording' : 'Voice input'}
          style={{
            padding: '10px 12px',
            background: isRecording ? 'rgba(239,68,68,0.15)' : '#1e293b',
            border: `1px solid ${isRecording ? '#ef4444' : '#334155'}`,
            borderRadius: 8,
            color: isRecording ? '#ef4444' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '1rem',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isRecording ? (
            <span style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#ef4444',
              animation: 'micPulse 1s ease-in-out infinite',
            }} />
          ) : '🎤'}
        </button>
        {isLoading ? (
          <button
            onClick={cancelRequest}
            title="Stop generation"
            style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid #ef4444',
              borderRadius: 8,
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            ⏹ Stop
          </button>
        ) : (
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim()}
            style={{
              padding: '10px 16px',
              background: !input.trim() ? '#334155' : '#667eea',
              border: 'none',
              borderRadius: 8,
              color: 'white',
              cursor: !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            ➤
          </button>
        )}
      </div>
    </div>
    </>
  );
}
