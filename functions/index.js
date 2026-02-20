const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const OpenAI = require('openai');
const cors = require('cors')({ origin: true });
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

admin.initializeApp();

// Load OpenAI API key from environment (functions/.env for emulator, Firebase secrets for production)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('🔑 API Key loaded:', OPENAI_API_KEY ? 'YES' : 'NO');

// OpenAI client is initialized lazily inside the request handler once the key is confirmed valid,
// so a missing key at module load time does not crash the module and prevents the route from registering.
let openai = null;

/**
 * AI Chat endpoint
 * POST /aiChat
 * Body: { messages: [...], model: 'gpt-4o-mini' }
 */
exports.aiChat = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    console.log('🤖 AI Chat request received!', {
      method: req.method,
      hasAuth: !!req.headers.authorization,
      body: req.body ? 'yes' : 'no'
    });

    // Only allow POST requests
    if (req.method !== 'POST') {
      console.log('❌ Method not allowed:', req.method);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Check if API key is configured (reject placeholder values of any form)
      const keyIsPlaceholder = !OPENAI_API_KEY ||
        OPENAI_API_KEY.startsWith('YOUR_') ||
        OPENAI_API_KEY.includes('YOUR_OPENAI') ||
        OPENAI_API_KEY.length < 20;
      if (keyIsPlaceholder) {
        console.error('❌ OpenAI API key not configured or is a placeholder. Set OPENAI_API_KEY in functions/.env for the emulator.');
        return res.status(500).json({ 
          error: 'AI Assistant not configured — OpenAI API key missing. Set OPENAI_API_KEY in functions/.env (emulator) or Firebase Console (deployed).' 
        });
      }

      if (!openai) {
        openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      }

      // Verify user is authenticated (using Clerk token or Firebase Auth)
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { messages, model = 'gpt-4o-mini', boardState } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request: messages array required' });
      }

      // Board state: frontend must call getBoardState() locally and send it here so the model can reason about positions, colors, types, and plan moves/layouts. Backend does not have direct DB access.
      const boardStateBlurb = (boardState && Array.isArray(boardState) && boardState.length > 0)
        ? `\n\nCurrent board state (use these object ids for move, resize, updateText, changeColor, createConnector):\n${JSON.stringify(boardState, null, 0).slice(0, 8000)}`
        : '\n\nNo board state was provided for this request. You can still create new objects with createStickyNote, createShape, createFrame. For move, resize, updateText, changeColor, or createConnector, the frontend will send board state on the next user message after objects exist.';

      const systemContent = `You are a helpful assistant for CollabBoard, a collaborative whiteboard app. You can create, move, resize, change color, update text, and arrange objects. Use the provided board state (when present) to resolve references — use the exact object ids from board state for moveObject, resizeObject, updateText, changeColor, createConnector, arrangeInGrid, and spaceEvenly. The app sends board state with every message; the user cannot provide it manually.

CRITICAL — When the user asks to add, create, or put anything on the board, you MUST call the corresponding tool in the same turn. Never reply that you have added something without actually calling the tool. Use sensible defaults; omit x,y so the frontend places at viewport center.

Command patterns (use these tools reliably):
- "Create a SWOT analysis for [topic]" (e.g. "for a coaching business", "for a cafe") → call createSwotTemplate. REQUIRED RULE: whenever the user specifies a topic (any noun after "for", "about", "on", etc.), you MUST pass stickies: { strengths: string[], weaknesses: string[], opportunities: string[], threats: string[] } with 2–4 short, topic-specific items per quadrant. The board will be completely blank if you omit stickies — never omit them when a topic is given. Example for "online coaching business": strengths: ["Expert-led content","Scalable model"], weaknesses: ["High competition","Requires tech infra"], opportunities: ["Growing remote learning demand","Subscription revenue"], threats: ["Free alternatives","Platform dependency"].
- "Arrange in a grid" / "put these in a grid" / "align in a grid" → call arrangeInGrid with objectIds from board state (use all object ids or the ones the user means), plus rows, cols, and spacing (e.g. 20). If the user said "these" or "selected", use the ids from the current board state.
- Multi-step (e.g. "add three sticky notes and then arrange them in a row"): call multiple tools in one turn in order. First call createStickyNote (or createShape/createFrame) for each new object, then call spaceEvenly or arrangeInGrid. When arranging objects you just created in the same turn, pass objectIds as an empty array [] — the frontend will use the objects created in this batch. Example: "add 3 stickies then arrange in a row" → three createStickyNote calls, then spaceEvenly(objectIds: [], direction: "horizontal").
- "N shapes [or rectangles/circles] in a grid" (e.g. "create 100 rectangles all random colors in a grid"): (1) Call createShape with type (e.g. rectangle), count N (e.g. 100), and set randomColor: true if the user asked for random colors. (2) Then call arrangeInGrid(objectIds: [], rows: R, cols: C, spacing: 20) with R×C >= N (e.g. rows: 10, cols: 10 for 100). The frontend will create the shapes then arrange them in a grid. You must call arrangeInGrid in the same turn after createShape.

Creation (omit x, y for viewport center): createStickyNote, createShape, createFrame, createConnector(fromId, toId).
Manipulation (objectId from board state): moveObject, resizeObject, updateText, changeColor.
Layout: arrangeInGrid(objectIds, rows, cols, spacing?) — objects from board state or [] for just-created; createStickyNoteGrid(rows, cols, labels?); spaceEvenly(objectIds, direction?).
Templates: createSwotTemplate (four quadrants; REQUIRED: pass stickies when user gives a topic), createUserJourney, createRetrospectiveBoard.

Reply briefly after calling tools. For general questions, answer without calling tools.${boardStateBlurb}`;

      // When the last user message clearly requests something, nudge the model to call the right tool.
      const lastUserMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      const lastContent = (lastUserMessage && lastUserMessage.role === 'user' && typeof lastUserMessage.content === 'string')
        ? lastUserMessage.content.toLowerCase().trim()
        : '';
      const wantsSwot = /\bswot\b|strengths.*weaknesses.*opportunities.*threats|four\s+quadrants/.test(lastContent);
      const wantsArrangeGrid = /\barrange\s+(in\s+)?(a\s+)?grid\b|put\s+(these\s+)?in\s+(a\s+)?grid|align\s+in\s+(a\s+)?grid|grid\s+layout/.test(lastContent);
      const wantsSticky = /\b(sticky|note|sticky note)\b|add\s+(a\s+)?note|put\s+(a\s+)?note|create\s+(a\s+)?note/.test(lastContent) || (/\badd\b|\bcreate\b|\bput\b/.test(lastContent) && /\b(say|write|that says|says)\b/.test(lastContent));
      const wantsFrame = /\bframe\b/.test(lastContent) && (/\badd\b|\bcreate\b|\bput\b/.test(lastContent)) && !wantsSwot;
      const wantsShape = /\b(circle|rectangle|square|line|oval|ellipse|shape)\b/.test(lastContent) && (/\badd\b|\bcreate\b|\bput\b|\bdraw\b/.test(lastContent));
      let toolChoice = undefined;
      if (wantsSwot) toolChoice = { type: 'function', function: { name: 'createSwotTemplate' } };
      else if (wantsArrangeGrid) toolChoice = { type: 'function', function: { name: 'arrangeInGrid' } };
      else if (wantsSticky && !wantsFrame && !wantsShape) toolChoice = { type: 'function', function: { name: 'createStickyNote' } };
      else if (wantsFrame) toolChoice = { type: 'function', function: { name: 'createFrame' } };
      else if (wantsShape) toolChoice = { type: 'function', function: { name: 'createShape' } };

      const tools = [
        {
          type: 'function',
          function: {
            name: 'createShape',
            description: 'Add one or more shapes (circle, rectangle, line, oval) to the board. Use count for many shapes (e.g. 100). For "N shapes in a grid" with random colors: use count N, set randomColor: true, then call arrangeInGrid(objectIds: [], rows, cols, spacing) in the same turn so the frontend lays them in a grid with varied colors.',
            parameters: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['circle', 'rectangle', 'line', 'oval'], description: 'Shape type.' },
                x: { type: 'number', description: 'Optional x position (world coords).' },
                y: { type: 'number', description: 'Optional y position (world coords).' },
                width: { type: 'number', description: 'Optional width.' },
                height: { type: 'number', description: 'Optional height.' },
                color: { type: 'string', description: 'Optional hex color (e.g. #10B981). Omit when using randomColor.' },
                randomColor: { type: 'boolean', description: 'If true, each shape gets a random color (use for "random colors" requests).' },
                count: { type: 'number', description: 'Number of shapes to create (e.g. 100). Default 1. Max 200.' },
              },
              required: ['type'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'createStickyNote',
            description: 'Add one or more sticky notes. Use optional x, y, width, height for position/size; omit for viewport center. Use count for "three sticky notes".',
            parameters: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'Optional text. Default: "New note".' },
                x: { type: 'number', description: 'Optional x position.' },
                y: { type: 'number', description: 'Optional y position.' },
                width: { type: 'number', description: 'Optional width.' },
                height: { type: 'number', description: 'Optional height.' },
                color: { type: 'string', description: 'Optional hex color.' },
                count: { type: 'number', description: 'Optional number to create (e.g. 3). Default 1.' },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'createFrame',
            description: 'Add a frame. Optional x, y, width, height; omit for viewport center.',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Optional frame title. Default: "Frame".' },
                x: { type: 'number', description: 'Optional x position.' },
                y: { type: 'number', description: 'Optional y position.' },
                width: { type: 'number', description: 'Optional width.' },
                height: { type: 'number', description: 'Optional height.' },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'createConnector',
            description: 'Create a connector between two objects. Use object ids from the provided board state.',
            parameters: {
              type: 'object',
              properties: {
                fromId: { type: 'string', description: 'Object id of the start object (from board state).' },
                toId: { type: 'string', description: 'Object id of the end object (from board state).' },
                style: { type: 'string', enum: ['straight', 'arrow', 'curved', 'elbowed'], description: 'Optional connector style. Default: straight.' },
              },
              required: ['fromId', 'toId'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'moveObject',
            description: 'Move an object to world coordinates. objectId must be from board state.',
            parameters: {
              type: 'object',
              properties: {
                objectId: { type: 'string', description: 'Object id from board state.' },
                x: { type: 'number', description: 'Target x position.' },
                y: { type: 'number', description: 'Target y position.' },
              },
              required: ['objectId', 'x', 'y'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'resizeObject',
            description: 'Resize an object or frame. objectId from board state.',
            parameters: {
              type: 'object',
              properties: {
                objectId: { type: 'string', description: 'Object id from board state.' },
                width: { type: 'number', description: 'New width.' },
                height: { type: 'number', description: 'New height.' },
              },
              required: ['objectId', 'width', 'height'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'updateText',
            description: 'Update text on a sticky note or frame title. objectId from board state.',
            parameters: {
              type: 'object',
              properties: {
                objectId: { type: 'string', description: 'Object id from board state.' },
                newText: { type: 'string', description: 'New text or title.' },
              },
              required: ['objectId', 'newText'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'changeColor',
            description: 'Change the color of an object. objectId from board state.',
            parameters: {
              type: 'object',
              properties: {
                objectId: { type: 'string', description: 'Object id from board state.' },
                color: { type: 'string', description: 'Hex color (e.g. #10B981).' },
              },
              required: ['objectId', 'color'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'arrangeInGrid',
            description: 'Arrange objects in a grid with consistent spacing. Use objectIds from board state (all or a subset). When arranging objects you just created in the same turn, pass objectIds as an empty array; the frontend will use the objects created in this batch.',
            parameters: {
              type: 'object',
              properties: {
                objectIds: { type: 'array', items: { type: 'string' }, description: 'Object ids from board state, or [] for objects created in this same turn.' },
                rows: { type: 'number', description: 'Number of rows.' },
                cols: { type: 'number', description: 'Number of columns.' },
                spacing: { type: 'number', description: 'Optional spacing between elements. Default 20.' },
              },
              required: ['objectIds', 'rows', 'cols'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'createStickyNoteGrid',
            description: 'Create a grid of sticky notes (e.g. 2x3 for pros and cons). Optional labels for each note.',
            parameters: {
              type: 'object',
              properties: {
                rows: { type: 'number', description: 'Number of rows.' },
                cols: { type: 'number', description: 'Number of columns.' },
                labels: { type: 'array', items: { type: 'string' }, description: 'Optional text for each note (row-major order).' },
                spacing: { type: 'number', description: 'Optional spacing. Default 20.' },
              },
              required: ['rows', 'cols'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'spaceEvenly',
            description: 'Space objects evenly in a row or column. Use objectIds from board state, or [] for objects just created in the same turn.',
            parameters: {
              type: 'object',
              properties: {
                objectIds: { type: 'array', items: { type: 'string' }, description: 'Object ids from board state, or [] for objects created in this same turn.' },
                direction: { type: 'string', enum: ['horizontal', 'vertical'], description: 'Layout direction. Default: horizontal.' },
              },
              required: ['objectIds'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'createSwotTemplate',
            description: 'Create a SWOT analysis: four labeled quadrants (Strengths, Weaknesses, Opportunities, Threats). RULE: when the user specifies a topic (e.g. "for a cafe", "for a coaching business"), you MUST pass stickies with 2–4 short topic-relevant strings per quadrant so the board is pre-filled. Never call this without stickies when a topic is given — the board will be empty without them.',
            parameters: {
              type: 'object',
              properties: {
                stickies: {
                  type: 'object',
                  description: 'Optional per-quadrant arrays of short strings for sticky notes inside each frame.',
                  properties: {
                    strengths: { type: 'array', items: { type: 'string' }, description: 'e.g. ["Cozy atmosphere", "Quality coffee", "Loyal customers"]' },
                    weaknesses: { type: 'array', items: { type: 'string' }, description: 'e.g. ["Limited seating", "High costs", "Limited online presence"]' },
                    opportunities: { type: 'array', items: { type: 'string' }, description: 'e.g. ["Catering & events", "Local partnerships", "Loyalty program"]' },
                    threats: { type: 'array', items: { type: 'string' }, description: 'e.g. ["Chain competition", "Rising bean prices", "Changing preferences"]' },
                  },
                },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'createUserJourney',
            description: 'Create a user journey with N stages. Optionally provide stage names.',
            parameters: {
              type: 'object',
              properties: {
                stageCount: { type: 'number', description: 'Number of stages (e.g. 5).' },
                stageNames: { type: 'array', items: { type: 'string' }, description: 'Optional names for each stage.' },
              },
              required: ['stageCount'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'createRetrospectiveBoard',
            description: 'Create a retrospective board with columns: What Went Well, What Didn\'t, Action Items.',
            parameters: { type: 'object', properties: {} },
          },
        },
      ];

      const chatMessages = [
        { role: 'system', content: systemContent },
        ...messages.slice(-10),
      ];

      const completionOptions = {
        model: model,
        messages: chatMessages,
        max_tokens: 300,
        temperature: 0.7,
        tools: tools.length ? tools : undefined,
      };
      if (toolChoice) completionOptions.tool_choice = toolChoice;
      let completion = await openai.chat.completions.create(completionOptions);

      let assistantMessage = completion.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from OpenAI');
      }

      let actions = [];
      if (assistantMessage.tool_calls && Array.isArray(assistantMessage.tool_calls)) {
        for (const tc of assistantMessage.tool_calls) {
          const fn = tc.function;
          if (!fn || !fn.name) continue;
          try {
            const args = fn.arguments ? JSON.parse(fn.arguments) : {};
            // Legacy names (keep for compatibility)
            if (fn.name === 'add_shape') {
              const count = Math.min(Number(args.count) || 1, 50);
              for (let i = 0; i < count; i++) {
                actions.push({ type: 'createShape', shape: args.shape || 'circle', color: args.color });
              }
              continue;
            }
            if (fn.name === 'add_sticky_note') {
              const count = Math.min(Number(args.count) || 1, 50);
              for (let i = 0; i < count; i++) {
                actions.push({ type: 'createStickyNote', text: args.text, color: args.color });
              }
              continue;
            }
            if (fn.name === 'add_frame') {
              actions.push({ type: 'createFrame', title: args.title });
              continue;
            }
            // New schema
            if (fn.name === 'createShape') {
              const count = Math.min(Math.max(1, Number(args.count) || 1), 200);
              const randomColor = !!args.randomColor;
              for (let i = 0; i < count; i++) {
                actions.push({
                  type: 'createShape',
                  shape: args.type || 'circle',
                  color: args.color,
                  randomColor,
                  x: args.x,
                  y: args.y,
                  width: args.width,
                  height: args.height,
                });
              }
            } else if (fn.name === 'createStickyNote') {
              const count = Math.min(Number(args.count) || 1, 50);
              for (let i = 0; i < count; i++) {
                actions.push({
                  type: 'createStickyNote',
                  text: args.text,
                  color: args.color,
                  x: args.x,
                  y: args.y,
                  width: args.width,
                  height: args.height,
                });
              }
            } else if (fn.name === 'createFrame') {
              actions.push({
                type: 'createFrame',
                title: args.title,
                x: args.x,
                y: args.y,
                width: args.width,
                height: args.height,
              });
            } else if (fn.name === 'createConnector') {
              actions.push({
                type: 'createConnector',
                fromId: args.fromId,
                toId: args.toId,
                style: args.style || 'straight',
              });
            } else if (fn.name === 'moveObject') {
              actions.push({
                type: 'moveObject',
                objectId: args.objectId,
                x: Number(args.x),
                y: Number(args.y),
              });
            } else if (fn.name === 'resizeObject') {
              actions.push({
                type: 'resizeObject',
                objectId: args.objectId,
                width: Number(args.width),
                height: Number(args.height),
              });
            } else if (fn.name === 'updateText') {
              actions.push({
                type: 'updateText',
                objectId: args.objectId,
                newText: args.newText,
              });
            } else if (fn.name === 'changeColor') {
              actions.push({
                type: 'changeColor',
                objectId: args.objectId,
                color: args.color,
              });
            } else if (fn.name === 'arrangeInGrid') {
              actions.push({
                type: 'arrangeInGrid',
                objectIds: args.objectIds || [],
                rows: Number(args.rows),
                cols: Number(args.cols),
                spacing: args.spacing != null ? Number(args.spacing) : 20,
              });
            } else if (fn.name === 'createStickyNoteGrid') {
              actions.push({
                type: 'createStickyNoteGrid',
                rows: Number(args.rows),
                cols: Number(args.cols),
                labels: args.labels || [],
                spacing: args.spacing != null ? Number(args.spacing) : 20,
              });
            } else if (fn.name === 'spaceEvenly') {
              actions.push({
                type: 'spaceEvenly',
                objectIds: args.objectIds || [],
                direction: args.direction || 'horizontal',
              });
            } else if (fn.name === 'createSwotTemplate') {
              const stickies = args.stickies && typeof args.stickies === 'object' ? {
                strengths: Array.isArray(args.stickies.strengths) ? args.stickies.strengths.slice(0, 6).map(String) : [],
                weaknesses: Array.isArray(args.stickies.weaknesses) ? args.stickies.weaknesses.slice(0, 6).map(String) : [],
                opportunities: Array.isArray(args.stickies.opportunities) ? args.stickies.opportunities.slice(0, 6).map(String) : [],
                threats: Array.isArray(args.stickies.threats) ? args.stickies.threats.slice(0, 6).map(String) : [],
              } : null;
              actions.push({ type: 'createSwotTemplate', stickies });
            } else if (fn.name === 'createUserJourney') {
              actions.push({
                type: 'createUserJourney',
                stageCount: Number(args.stageCount),
                stageNames: args.stageNames || [],
              });
            } else if (fn.name === 'createRetrospectiveBoard') {
              actions.push({ type: 'createRetrospectiveBoard' });
            }
          } catch (e) {
            console.warn('Tool call parse error:', e);
          }
        }

        // If user asked for shapes "in a grid" but the model didn't call arrangeInGrid, append it so the frontend lays them in a grid
        const wantsGrid = /\bin\s+(a\s+)?grid\b|grid\s+layout/.test(lastContent);
        const totalShapeCount = actions
          .filter((a) => a.type === 'createShape')
          .reduce((sum, a) => sum + (typeof a.count === 'number' ? Math.max(1, a.count) : 1), 0);
        const hasArrangeInGrid = actions.some((a) => a.type === 'arrangeInGrid');
        if (wantsGrid && totalShapeCount > 1 && !hasArrangeInGrid) {
          const n = totalShapeCount;
          const cols = Math.ceil(Math.sqrt(n));
          const rows = Math.ceil(n / cols);
          actions.push({ type: 'arrangeInGrid', objectIds: [], rows, cols, spacing: 20 });
        }

        // Reorder so layout actions (arrangeInGrid, spaceEvenly) run after all create actions — frontend needs createdIdsThisBatch populated first
        const createTypes = ['add_shape', 'add_sticky_note', 'add_frame', 'createShape', 'createStickyNote', 'createFrame', 'createStickyNoteGrid', 'createSwotTemplate', 'createUserJourney', 'createRetrospectiveBoard'];
        const layoutTypes = ['arrangeInGrid', 'spaceEvenly'];
        const createActions = actions.filter((a) => createTypes.includes(a.type));
        const layoutActions = actions.filter((a) => layoutTypes.includes(a.type));
        const otherActions = actions.filter((a) => !createTypes.includes(a.type) && !layoutTypes.includes(a.type));
        if (layoutActions.length > 0) {
          actions = [...createActions, ...otherActions, ...layoutActions];
        }

        // Fallback: if model called createSwotTemplate without stickies but user specified a topic, inject defaults.
        // Detect a "SWOT with topic" by checking if there's meaningful content beyond the bare word "swot".
        const swotAction = actions.find((a) => a.type === 'createSwotTemplate');
        if (swotAction) {
          const stickiesEmpty = !swotAction.stickies ||
            (['strengths', 'weaknesses', 'opportunities', 'threats'].every(
              (k) => !Array.isArray(swotAction.stickies[k]) || swotAction.stickies[k].length === 0
            ));
          const topicResidue = lastContent
            .replace(/\b(swot|analysis|create|make|build|generate|a|an|the|me|us|for|about|on|of|please|can|you)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const hasTopic = topicResidue.length > 2;
          if (stickiesEmpty && hasTopic) {
            console.log(`⚠️ [FALLBACK] Model omitted stickies for SWOT with topic "${topicResidue}" — injecting defaults`);
            swotAction.stickies = {
              strengths: ['Clear expertise', 'Scalable model'],
              weaknesses: ['Limited reach', 'High competition'],
              opportunities: ['Growing demand', 'New channels'],
              threats: ['Free alternatives', 'Market shifts'],
            };
          }
        }

        // Single round-trip: skip the follow-up completion for tool-call responses.
        // Build a short reply from the action types instead of a second API call.
        const actionTypeSet = [...new Set(actions.map((a) => a.type))];
        const replyMap = {
          createSwotTemplate: 'SWOT analysis added to your board.',
          createStickyNote: 'Sticky note added.',
          createShape: 'Shape added.',
          createFrame: 'Frame added.',
          createUserJourney: 'User journey created.',
          createRetrospectiveBoard: 'Retrospective board created.',
          createStickyNoteGrid: 'Sticky note grid created.',
          moveObject: 'Object moved.',
          resizeObject: 'Object resized.',
          updateText: 'Text updated.',
          changeColor: 'Color updated.',
          createConnector: 'Connector added.',
          arrangeInGrid: 'Objects arranged in grid.',
          spaceEvenly: 'Objects spaced evenly.',
        };
        const firstKnown = actionTypeSet.find((n) => replyMap[n]);
        const reply = firstKnown ? replyMap[firstKnown] : "I've updated your board.";
        assistantMessage = { ...assistantMessage, content: reply };
        console.log(`✅ [SINGLE ROUND-TRIP] actions=${JSON.stringify(actionTypeSet)}, reply="${reply}"`);
      }

      const responsePayload = { message: assistantMessage, usage: completion.usage };
      if (actions.length > 0) {
        responsePayload.actions = actions;
      }
      return res.status(200).json(responsePayload);
    } catch (error) {
      console.error('Error in aiChat function:', error);
      
      // Return appropriate error message
      if (error.response?.status === 401) {
        return res.status(401).json({ error: 'Invalid OpenAI API key' });
      }
      
      return res.status(500).json({
        error: 'Failed to get AI response',
        details: error.message,
      });
    }
  });
});
