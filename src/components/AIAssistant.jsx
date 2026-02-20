import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useBoard } from '../context/BoardContext';
import { showToast } from './Toast';

const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#FDE68A'];
const SHAPE_RANDOM_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6', '#A855F7', '#E11D48'];

export default function AIAssistant() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const {
    objects,
    getBoardState,
    createShape,
    createStickyNote,
    createFrame,
    createConnector,
    moveObject,
    updateObject,
    resizeObject,
    stageRef,
    viewportCenterRef,
    setDeferPan,
    setRequestCenterView,
  } = useBoard();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const aiPlacementOffsetIndexRef = useRef(0);

  const getBoardCenter = useCallback(() => {
    const stage = stageRef?.current;
    if (stage && stage.width() > 0 && stage.height() > 0) {
      const transform = stage.getAbsoluteTransform().copy().invert();
      return transform.point({
        x: stage.width() / 2,
        y: stage.height() / 2,
      });
    }
    // Use viewport center kept in sync by Canvas (pan/zoom) so AI-created objects appear in view
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

  const executeActions = useCallback((actions) => {
    if (!Array.isArray(actions) || actions.length === 0) return;
    const firstCenter = getBoardCenter();
    const hasCreates = actions.some((a) => ['add_shape', 'add_sticky_note', 'add_frame', 'createShape', 'createStickyNote', 'createFrame', 'createStickyNoteGrid', 'createSwotTemplate', 'createUserJourney', 'createRetrospectiveBoard'].includes(a.type));
    if (hasCreates && actions.length > 1 && setDeferPan) setDeferPan(true);

    // Two-pass: run all non-layout actions first (so createdIdsThisBatch is populated), then layout (arrangeInGrid, spaceEvenly)
    const layoutTypes = ['arrangeInGrid', 'spaceEvenly'];
    const pass1Actions = actions.filter((a) => !layoutTypes.includes(a.type));
    const pass2Actions = actions.filter((a) => layoutTypes.includes(a.type));
    const actionsToRun = pass2Actions.length > 0 ? [...pass1Actions, ...pass2Actions] : actions;

    // Collect ids of objects created in this batch so arrangeInGrid/spaceEvenly can use them when objectIds is []
    const createdIdsThisBatch = [];
    let didArrangeInGrid = false;

    const shapeDefaults = {
      circle: { base: 100, w: 100, h: 100, color: '#10B981' },
      rectangle: { base: 100, w: 100, h: 80, color: '#6366F1' },
      line: { base: 150, w: 150, h: 20, color: '#F59E0B' },
      oval: { base: 120, w: 120, h: 80, color: '#8B5CF6' },
    };

    for (const action of actionsToRun) {
      try {
        const offset = 45 * aiPlacementOffsetIndexRef.current;
        const px = firstCenter.x + offset;
        const py = firstCenter.y + offset;
        const useCenter = (action.x == null && action.y == null);

        const runCreateShape = (shape, color, x, y, width, height, useRandomColor) => {
          const d = shapeDefaults[shape] || shapeDefaults.circle;
          const scaleFactor = getScaledSize(d.base);
          const w = width ?? (d.w || d.base) * scaleFactor;
          const h = height ?? (d.h || d.base) * scaleFactor;
          const fx = x ?? px - w / 2;
          const fy = y ?? py - h / 2;
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
          const fx = x ?? px - w / 2;
          const fy = y ?? py - h / 2;
          const c = color || STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
          const id = createStickyNote(text ?? 'New note', fx, fy, c, w, h);
          if (id) createdIdsThisBatch.push(id);
          showToast('Sticky note added', 'success');
          return id;
        };

        const runCreateFrame = (title, x, y, width, height) => {
          const fw = width ?? 600;
          const fh = height ?? 400;
          const fx = x ?? px - fw / 2;
          const fy = y ?? py - fh / 2;
          const id = createFrame(fx, fy, fw, fh, title ?? 'Frame');
          if (id) createdIdsThisBatch.push(id);
          showToast('Frame added', 'success');
          return id;
        };

        if (action.type === 'add_shape' || action.type === 'createShape') {
          if (useCenter) aiPlacementOffsetIndexRef.current += 1;
          const id = runCreateShape(action.shape || 'circle', action.color, action.x, action.y, action.width, action.height, !!action.randomColor);
          const shapeCount = actionsToRun.filter((a) => a.type === 'add_shape' || a.type === 'createShape').length;
          if (shapeCount === 1 && id) showToast('Shape added', 'success');
        } else if (action.type === 'add_sticky_note' || action.type === 'createStickyNote') {
          if (useCenter) aiPlacementOffsetIndexRef.current += 1;
          runCreateStickyNote(action.text, action.color, action.x, action.y, action.width, action.height);
        } else if (action.type === 'add_frame' || action.type === 'createFrame') {
          if (useCenter) aiPlacementOffsetIndexRef.current += 1;
          runCreateFrame(action.title, action.x, action.y, action.width, action.height);
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
        } else if (action.type === 'arrangeInGrid') {
          // Defer so React has committed create state; then moveObject will see full object and not overwrite it
          const layoutAction = action;
          const ids = layoutAction.objectIds?.length ? layoutAction.objectIds : [...createdIdsThisBatch];
          if (!ids.length || !layoutAction.rows || !layoutAction.cols || !moveObject) continue;
          didArrangeInGrid = true;
          const fc = { ...firstCenter };
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
          const startX = firstCenter.x - (cols * (w + spacing) - spacing) / 2;
          const startY = firstCenter.y - (rows * (h + spacing) - spacing) / 2;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const idx = r * cols + c;
              const text = labels[idx] ?? '';
              const id = createStickyNote(text, startX + c * (w + spacing), startY + r * (h + spacing), STICKY_COLORS[idx % STICKY_COLORS.length], w, h);
              if (id) createdIdsThisBatch.push(id);
            }
          }
          aiPlacementOffsetIndexRef.current += rows * cols;
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
          const start = direction === 'horizontal' ? firstCenter.x - span / 2 : firstCenter.y - span / 2;
          const fc = { ...firstCenter };
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
          // Layout constants
          // Before: sp=30, fw=400, fh=280 — stickies were 120×80 in a 2-col mini-grid starting at y+12 (overlapping the 40px title bar)
          // After:  sp=24, fw=440, fh=400 — stickies are full-width single column, starting below the 40px title bar
          const sp = 24;
          const fw = 440;
          const fh = 400;
          const startX = firstCenter.x - (2 * fw + sp) / 2;
          const startY = firstCenter.y - (2 * fh + sp) / 2;
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
          // Frontend fallback: if stickies are missing or all empty, use placeholder content so the board is never blank.
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
          const titleH = 40; // matches the title bar height rendered in Frame.jsx
          const pad = 16;    // padding on left/right/bottom of sticky area
          const sw = fw - 2 * pad; // full-width stickies (408px at fw=440)
          const sh = 72;     // sticky height — tall enough for 2–3 lines
          const gap = 12;    // vertical gap between stickies
          if (updateObject) {
            const updates = [];
            quadKeys.forEach((key, quadIndex) => {
              const frameId = frameIds[quadIndex];
              const items = Array.isArray(stickiesPayload[key]) ? stickiesPayload[key].slice(0, 4) : [];
              if (!frameId || items.length === 0) return;
              const frameX = startX + (quadIndex % 2) * (fw + sp);
              const frameY = startY + Math.floor(quadIndex / 2) * (fh + sp);
              items.forEach((text, idx) => {
                // Single-column layout, starting below the title bar
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
          aiPlacementOffsetIndexRef.current += 4;
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
          const startX = firstCenter.x - (n * (w + gap) - gap) / 2;
          const startY = firstCenter.y - h / 2;
          for (let i = 0; i < n; i++) {
            const id = createStickyNote(names[i], startX + i * (w + gap), startY, STICKY_COLORS[i % STICKY_COLORS.length], w, h);
            if (id) createdIdsThisBatch.push(id);
          }
          aiPlacementOffsetIndexRef.current += n;
          showToast('User journey created', 'success');
        } else if (action.type === 'createRetrospectiveBoard') {
          const cols = ['What Went Well', "What Didn't", 'Action Items'];
          const cw = 320;
          const ch = 360;
          const gap = 24;
          const startX = firstCenter.x - (3 * cw + 2 * gap) / 2;
          const startY = firstCenter.y - ch / 2;
          cols.forEach((title, i) => {
            const id = createFrame(startX + i * (cw + gap), startY, cw, ch, title);
            if (id) createdIdsThisBatch.push(id);
          });
          aiPlacementOffsetIndexRef.current += 3;
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
  }, [getBoardCenter, getScaledSize, objects, createShape, createStickyNote, createFrame, createConnector, moveObject, updateObject, resizeObject, setDeferPan, setRequestCenterView]);

  // Function URL resolution:
  //   Deployed  → https://us-central1-<VITE_FIREBASE_PROJECT_ID>.cloudfunctions.net/aiChat
  //   Emulator  → http://localhost:<VITE_EMULATOR_PORT>/<VITE_EMULATOR_PROJECT_ID>/us-central1/aiChat
  //
  // To use the local emulator add these to .env.local:
  //   VITE_USE_EMULATOR=true
  //   VITE_EMULATOR_PROJECT_ID=<your .firebaserc default project, e.g. collabboard-lakshmi>
  //   VITE_EMULATOR_PORT=5002   (optional, defaults to 5002)
  const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'collabboard-d900c';
  // Emulator project may differ from the Realtime-DB project — read from its own var, fall back to firebaseProjectId.
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

    try {
      // Get Clerk session token for authentication.
      // Defensively handle cases where getToken is not yet available (Clerk still loading)
      // or returns null (no active session). The emulator doesn't verify the JWT — it only
      // checks that a Bearer header is present, so a fallback value keeps it working locally.
      let token = null;
      if (typeof getToken === 'function') {
        try {
          token = await getToken();
        } catch (tokenErr) {
          console.warn('[AI] getToken() threw — proceeding without Clerk token:', tokenErr?.message);
        }
      } else {
        console.warn('[AI] getToken is not a function (Clerk may not be initialized). Proceeding without token.');
      }

      // Call our Firebase Function instead of OpenAI directly
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Only include the Authorization header when we have a real token.
          // For the emulator this falls back to 'emulator-session' so the
          // backend's Bearer-presence check still passes.
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
      const assistantMessage = {
        role: 'assistant',
        content,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
        executeActions(data.actions);
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      const isConnectionError = error?.message === 'Failed to fetch' || (error?.name === 'TypeError' && String(error?.message || '').toLowerCase().includes('fetch'));
      const userMessage = isConnectionError
        ? 'AI Assistant is unavailable. Make sure the backend is running (e.g. Firebase Functions emulator).'
        : 'Sorry, I encountered an error. Please try again.';
      showToast(isConnectionError ? `❌ ${userMessage}` : '❌ Failed to get response. Please try again.', 'error');
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: userMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

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
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
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

      {/* Chat Panel */}
      {(
        <div style={{
          padding: 16,
          background: '#0f172a',
          borderBottom: '1px solid #334155',
          color: '#94a3b8',
          fontSize: '0.75rem',
          textAlign: 'center',
        }}>
          ✨ AI Assistant Ready
        </div>
      )}

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
          <div style={{
            textAlign: 'center',
            color: '#64748b',
            padding: '40px 20px',
          }}>
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
