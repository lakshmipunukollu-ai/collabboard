import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { ref, set, remove, onValue } from 'firebase/database';
import { database } from '../lib/firebase';
import { useBoard } from '../context/BoardContext';
import { showToast } from './Toast';

const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#FDE68A'];
const SHAPE_RANDOM_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6', '#A855F7', '#E11D48'];

export default function AIAssistant() {
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
  } = useBoard();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiLock, setAiLock] = useState(null); // { userId, userName, timestamp }
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  // kept for any legacy reference; actual batch placement uses per-type row logic
  const aiPlacementOffsetIndexRef = useRef(0);

  // ── aiLock listener ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!boardId) return;
    const lockRef = ref(database, `boards/${boardId}/aiLock`);
    const unsub = onValue(lockRef, (snap) => {
      setAiLock(snap.val() ?? null);
    });
    return () => unsub();
  }, [boardId]);

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

  const executeActions = useCallback((actions) => {
    if (!Array.isArray(actions) || actions.length === 0) return;

    aiPlacementOffsetIndexRef.current = 0;

    // firstCenter: used only for setRequestCenterView at the end (pan the viewport)
    const firstCenter = getBoardCenter();
    // layoutCenter: where new content should land (below existing objects)
    // used for spaceEvenly, arrangeInGrid reference
    const layoutCenter = findEmptyPlacement(160, 120);

    const hasCreates = actions.some((a) => [
      'add_shape', 'add_sticky_note', 'add_frame',
      'createShape', 'createStickyNote', 'createFrame',
      'createStickyNoteGrid', 'createSwotTemplate',
      'createUserJourney', 'createRetrospectiveBoard', 'createFrameWithNotes',
    ].includes(a.type));
    if (hasCreates && actions.length > 1 && setDeferPan) setDeferPan(true);

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
          const fh = action.height ?? 400;
          const placement = findEmptyPlacement(fw, fh);
          const fx = placement.x - fw / 2;
          const fy = placement.y - fh / 2;
          const frameId = createFrame(fx, fy, fw, fh, action.title ?? 'Frame');
          if (frameId) createdIdsThisBatch.push(frameId);
          const notes = action.notes ?? [];
          const titleH = 40;
          const pad = 16;
          const sw = fw - 2 * pad;
          const sh = 72;
          const noteGap = 12;
          notes.forEach((text, idx) => {
            const nx = fx + pad;
            const ny = fy + titleH + pad + idx * (sh + noteGap);
            const stickyId = createStickyNote(String(text), nx, ny, STICKY_COLORS[idx % STICKY_COLORS.length], sw, sh);
            if (stickyId) {
              createdIdsThisBatch.push(stickyId);
              requestAnimationFrame(() => setTimeout(() => {
                updateObject(stickyId, { parentFrameId: frameId });
              }, 0));
            }
          });
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
          const sp = 24;
          const fw = 440;
          const fh = 400;
          const swotPlacement = findEmptyPlacement(2 * fw + sp, 2 * fh + sp);
          const startX = swotPlacement.x - (2 * fw + sp) / 2;
          const startY = swotPlacement.y - (2 * fh + sp) / 2;
          const titles = ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'];
          const frameIds = [];
          titles.forEach((title, i) => {
            const c = i % 2;
            const r = Math.floor(i / 2);
            const id = createFrame(startX + c * (fw + sp), startY + r * (fh + sp), fw, fh, title);
            if (id) {
              createdIdsThisBatch.push(id);
              frameIds.push(id);
            }
          });
          let stickiesPayload = action.stickies && typeof action.stickies === 'object' ? action.stickies : null;
          if (!stickiesPayload || ['strengths', 'weaknesses', 'opportunities', 'threats'].every(
            (k) => !Array.isArray(stickiesPayload[k]) || stickiesPayload[k].length === 0
          )) {
            stickiesPayload = {
              strengths: ['Add strengths here', 'Key advantage'],
              weaknesses: ['Add weaknesses here', 'Area to improve'],
              opportunities: ['Add opportunities here', 'Growth area'],
              threats: ['Add threats here', 'Risk factor'],
            };
          }
          const quadKeys = ['strengths', 'weaknesses', 'opportunities', 'threats'];
          const titleH = 40;
          const pad = 16;
          const sw = fw - 2 * pad;
          const sh = 72;
          const gap = 12;
          if (updateObject) {
            const updates = [];
            quadKeys.forEach((key, quadIndex) => {
              const frameId = frameIds[quadIndex];
              const items = Array.isArray(stickiesPayload[key]) ? stickiesPayload[key].slice(0, 4) : [];
              if (!frameId || items.length === 0) return;
              const frameX = startX + (quadIndex % 2) * (fw + sp);
              const frameY = startY + Math.floor(quadIndex / 2) * (fh + sp);
              items.forEach((text, idx) => {
                const x = frameX + pad;
                const y = frameY + titleH + pad + idx * (sh + gap);
                const stickyId = createStickyNote(String(text || '').slice(0, 200), x, y, STICKY_COLORS[idx % STICKY_COLORS.length], sw, sh);
                if (stickyId) {
                  createdIdsThisBatch.push(stickyId);
                  updates.push({ stickyId, frameId });
                }
              });
            });
            if (updates.length) {
              requestAnimationFrame(() => setTimeout(() => {
                updates.forEach(({ stickyId, frameId }) => updateObject(stickyId, { parentFrameId: frameId }));
              }, 0));
            }
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
        }
      } catch (err) {
        console.error(`AI action error [type=${action?.type}]:`, err);
      }
    }

    if (hasCreates && setDeferPan && setRequestCenterView) {
      setDeferPan(false);
      setRequestCenterView(firstCenter);
    }
    if (createdIdsThisBatch.length > 1 && !didArrangeInGrid) {
      showToast(`Added ${createdIdsThisBatch.length} shapes`, 'success');
    }
  }, [getBoardCenter, findEmptyPlacement, getScaledSize, objects, createShape, createStickyNote, createFrame, createConnector, moveObject, updateObject, resizeObject, deleteObject, clearBoard, setDeferPan, setRequestCenterView]);

  // Function URL resolution
  const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'collabboard-d900c';
  const emulatorProjectId = import.meta.env.VITE_EMULATOR_PROJECT_ID || firebaseProjectId;
  const emulatorPort = import.meta.env.VITE_EMULATOR_PORT || '5002';
  const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const functionUrl = (useEmulator && isLocalhost)
    ? `http://localhost:${emulatorPort}/${emulatorProjectId}/us-central1/aiChat`
    : `https://us-central1-${firebaseProjectId}.cloudfunctions.net/aiChat`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    if (!user) {
      showToast('⚠️ Please sign in to use the AI Assistant', 'warning');
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
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

    try {
      let token = null;
      if (typeof getToken === 'function') {
        try {
          token = await getToken();
        } catch (tokenErr) {
          console.warn('[AI] getToken() threw — proceeding without Clerk token:', tokenErr?.message);
        }
      }

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || 'emulator-session'}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          model: 'gpt-4o-mini',
          boardState: getBoardState(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.message?.content ?? "I've added that to your board.";
      const assistantMessage = { role: 'assistant', content };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
        executeActions(data.actions);
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      const isConnectionError = error?.message === 'Failed to fetch' || (error?.name === 'TypeError' && String(error?.message || '').toLowerCase().includes('fetch'));
      const userMsg = isConnectionError
        ? 'AI Assistant is unavailable. Make sure the backend is running (e.g. Firebase Functions emulator).'
        : 'Sorry, I encountered an error. Please try again.';
      showToast(isConnectionError ? `❌ ${userMsg}` : '❌ Failed to get response. Please try again.', 'error');
      setMessages(prev => [...prev, { role: 'assistant', content: userMsg }]);
    } finally {
      setIsLoading(false);
      // Release aiLock
      if (boardId) {
        remove(ref(database, `boards/${boardId}/aiLock`)).catch(() => {});
      }
    }
  };

  // Determine if another user holds the AI lock
  const otherUserLock = aiLock && aiLock.userId !== user?.id ? aiLock : null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="AI Assistant"
        style={{
          position: 'fixed',
          bottom: 20,
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
          zIndex: 999,
          transition: 'transform 0.2s',
        }}
        onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        🤖
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 380,
        height: 500,
        background: '#1e293b',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: 16,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.5rem' }}>🤖</span>
          <span style={{ fontWeight: 600 }}>AI Assistant</span>
        </div>
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
      </div>

      {/* Chat status panel */}
      <div style={{
        padding: '6px 16px',
        background: otherUserLock ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
        borderBottom: '1px solid #334155',
        color: otherUserLock ? '#FCD34D' : '#94a3b8',
        fontSize: '0.75rem',
        fontWeight: otherUserLock ? 600 : 400,
        textAlign: 'center',
        minHeight: 28,
      }}>
        {otherUserLock
          ? `⏳ ${otherUserLock.userName} is using AI...`
          : '✨ AI Assistant Ready'}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px' }}>
            <p style={{ fontSize: '1.25rem', marginBottom: 8 }}>👋</p>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>
              Hi! I'm your AI assistant. Ask me anything about brainstorming,
              organizing ideas, or using CollabBoard!
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
            }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: msg.role === 'user' ? '#667eea' : '#334155',
                color: 'white',
                fontSize: '0.875rem',
                lineHeight: 1.5,
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start' }}>
            <div style={{
              padding: 12,
              borderRadius: 12,
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

      {/* Input */}
      <div style={{
        padding: 16,
        borderTop: '1px solid #334155',
        display: 'flex',
        gap: 8,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask me anything... (paste with Ctrl+V / Cmd+V)"
          disabled={isLoading}
          rows={2}
          style={{
            flex: 1,
            padding: 10,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            color: 'white',
            fontSize: '0.875rem',
            resize: 'vertical',
            minHeight: 44,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '10px 16px',
            background: isLoading || !input.trim() ? '#334155' : '#667eea',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
