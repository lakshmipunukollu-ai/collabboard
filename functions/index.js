const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { Agent, tool, run, setDefaultOpenAIKey, MaxTurnsExceededError } = require('@openai/agents');
const { z } = require('zod');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

admin.initializeApp();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
console.log('🔑 API Key loaded:', OPENAI_API_KEY ? 'YES' : 'NO');

// ─── Tool factory ─────────────────────────────────────────────────────────────
// @openai/agents uses strict mode by default: ALL properties must be in `required`,
// optional fields use z.nullish() which generates  anyOf:[type, null]  in the schema.
// In execute() we coerce null back to undefined with `?? undefined`.
function buildTools(actions) {
  return [
    tool({
      name: 'createShape',
      description:
        'Add one or more shapes (circle, rectangle, line, oval) to the board. ' +
        'For "N shapes in a grid" with random colors: set count=N, randomColor=true, ' +
        'then also call arrangeInGrid(objectIds:[], rows, cols) in the same turn.',
      parameters: z.object({
        type: z.enum(['circle', 'rectangle', 'line', 'oval']),
        x: z.number().nullish().describe('Optional x position.'),
        y: z.number().nullish().describe('Optional y position.'),
        width: z.number().nullish(),
        height: z.number().nullish(),
        color: z.string().nullish().describe('Hex color. Omit when using randomColor.'),
        randomColor: z.boolean().nullish().describe('If true, each shape gets a random color.'),
        count: z.number().nullish().describe('Number of shapes. Default 1. Max 200.'),
      }),
      execute: async (args) => {
        const count = Math.min(Math.max(1, args.count ?? 1), 200);
        for (let i = 0; i < count; i++) {
          actions.push({
            type: 'createShape',
            shape: args.type,
            color: args.color ?? undefined,
            randomColor: !!args.randomColor,
            x: args.x ?? undefined,
            y: args.y ?? undefined,
            width: args.width ?? undefined,
            height: args.height ?? undefined,
          });
        }
        return `Added ${count} ${args.type}(s) to the board.`;
      },
    }),

    tool({
      name: 'createStickyNote',
      description:
        'Add one or more sticky notes. Omit x,y to place at viewport center. Use count for multiple.',
      parameters: z.object({
        text: z.string().nullish().describe('Note text. Default: "New note".'),
        x: z.number().nullish(),
        y: z.number().nullish(),
        width: z.number().nullish(),
        height: z.number().nullish(),
        color: z.string().nullish().describe('Hex color.'),
        count: z.number().nullish().describe('Number to create. Default 1.'),
      }),
      execute: async (args) => {
        const count = Math.min(args.count ?? 1, 50);
        for (let i = 0; i < count; i++) {
          actions.push({
            type: 'createStickyNote',
            text: args.text ?? undefined,
            color: args.color ?? undefined,
            x: args.x ?? undefined,
            y: args.y ?? undefined,
            width: args.width ?? undefined,
            height: args.height ?? undefined,
          });
        }
        return `Added ${count} sticky note(s).`;
      },
    }),

    tool({
      name: 'createFrame',
      description: 'Add a labelled frame/container. Omit x,y to place at viewport center.',
      parameters: z.object({
        title: z.string().nullish().describe('Frame title. Default: "Frame".'),
        x: z.number().nullish(),
        y: z.number().nullish(),
        width: z.number().nullish(),
        height: z.number().nullish(),
      }),
      execute: async (args) => {
        actions.push({
          type: 'createFrame',
          title: args.title ?? undefined,
          x: args.x ?? undefined,
          y: args.y ?? undefined,
          width: args.width ?? undefined,
          height: args.height ?? undefined,
        });
        return `Added frame "${args.title ?? 'Frame'}".`;
      },
    }),

    tool({
      name: 'createConnector',
      description: 'Connect two board objects with a line. Use IDs from board state.',
      parameters: z.object({
        fromId: z.string(),
        toId: z.string(),
        style: z.enum(['straight', 'arrow', 'curved', 'elbowed']).nullish()
          .describe('Default: straight.'),
      }),
      execute: async (args) => {
        actions.push({
          type: 'createConnector',
          fromId: args.fromId,
          toId: args.toId,
          style: args.style ?? 'straight',
        });
        return `Connected ${args.fromId} → ${args.toId}.`;
      },
    }),

    tool({
      name: 'moveObject',
      description: 'Move an object to new coordinates. objectId must come from board state.',
      parameters: z.object({
        objectId: z.string(),
        x: z.number(),
        y: z.number(),
      }),
      execute: async (args) => {
        actions.push({ type: 'moveObject', objectId: args.objectId, x: args.x, y: args.y });
        return `Moved ${args.objectId}.`;
      },
    }),

    tool({
      name: 'resizeObject',
      description: 'Resize an object. objectId must come from board state.',
      parameters: z.object({
        objectId: z.string(),
        width: z.number(),
        height: z.number(),
      }),
      execute: async (args) => {
        actions.push({ type: 'resizeObject', objectId: args.objectId, width: args.width, height: args.height });
        return `Resized ${args.objectId}.`;
      },
    }),

    tool({
      name: 'updateText',
      description: 'Change the text of a sticky note or frame title. objectId from board state.',
      parameters: z.object({
        objectId: z.string(),
        newText: z.string(),
      }),
      execute: async (args) => {
        actions.push({ type: 'updateText', objectId: args.objectId, newText: args.newText });
        return `Updated text on ${args.objectId}.`;
      },
    }),

    tool({
      name: 'changeColor',
      description: 'Change the fill color of an object. objectId from board state.',
      parameters: z.object({
        objectId: z.string(),
        color: z.string().describe('Hex color, e.g. #10B981.'),
      }),
      execute: async (args) => {
        actions.push({ type: 'changeColor', objectId: args.objectId, color: args.color });
        return `Changed color of ${args.objectId} to ${args.color}.`;
      },
    }),

    tool({
      name: 'arrangeInGrid',
      description:
        'Lay objects out in a grid. Pass objectIds from board state, or [] for objects ' +
        'just created in this same turn (the frontend will use the new batch).',
      parameters: z.object({
        objectIds: z.array(z.string()).describe('IDs to arrange, or [] for just-created objects.'),
        rows: z.number(),
        cols: z.number(),
        spacing: z.number().nullish().describe('Gap between cells. Default 20.'),
      }),
      execute: async (args) => {
        actions.push({
          type: 'arrangeInGrid',
          objectIds: args.objectIds,
          rows: args.rows,
          cols: args.cols,
          spacing: args.spacing ?? 20,
        });
        return `Arranged objects in a ${args.rows}×${args.cols} grid.`;
      },
    }),

    tool({
      name: 'createStickyNoteGrid',
      description: 'Create a grid of sticky notes with optional per-note labels.',
      parameters: z.object({
        rows: z.number(),
        cols: z.number(),
        labels: z.array(z.string()).nullish().describe('Text per note, row-major order.'),
        spacing: z.number().nullish().describe('Default 20.'),
      }),
      execute: async (args) => {
        actions.push({
          type: 'createStickyNoteGrid',
          rows: args.rows,
          cols: args.cols,
          labels: args.labels ?? [],
          spacing: args.spacing ?? 20,
        });
        return `Created a ${args.rows}×${args.cols} sticky note grid.`;
      },
    }),

    tool({
      name: 'spaceEvenly',
      description: 'Space objects evenly in a row or column. Pass [] for objects just created.',
      parameters: z.object({
        objectIds: z.array(z.string()).describe('IDs to space, or [] for just-created objects.'),
        direction: z.enum(['horizontal', 'vertical']).nullish().describe('Default: horizontal.'),
      }),
      execute: async (args) => {
        actions.push({
          type: 'spaceEvenly',
          objectIds: args.objectIds,
          direction: args.direction ?? 'horizontal',
        });
        return `Spaced objects evenly ${args.direction ?? 'horizontally'}.`;
      },
    }),

    tool({
      name: 'createSwotTemplate',
      description:
        'Create a SWOT analysis with four labelled quadrants. ' +
        'RULE: whenever the user names a topic, you MUST pass stickies with 2–4 short ' +
        'topic-specific items per quadrant — the board will be completely blank without them.',
      parameters: z.object({
        stickies: z
          .object({
            strengths: z.array(z.string()),
            weaknesses: z.array(z.string()),
            opportunities: z.array(z.string()),
            threats: z.array(z.string()),
          })
          .nullish()
          .describe('Pre-filled content. Required when user specifies a topic.'),
      }),
      execute: async (args) => {
        const stickies = args.stickies
          ? {
              strengths: args.stickies.strengths.slice(0, 6).map(String),
              weaknesses: args.stickies.weaknesses.slice(0, 6).map(String),
              opportunities: args.stickies.opportunities.slice(0, 6).map(String),
              threats: args.stickies.threats.slice(0, 6).map(String),
            }
          : null;
        actions.push({ type: 'createSwotTemplate', stickies });
        return 'SWOT template created with four quadrants.';
      },
    }),

    tool({
      name: 'createUserJourney',
      description: 'Create a user journey map with N stages as sticky notes in a row.',
      parameters: z.object({
        stageCount: z.number(),
        stageNames: z.array(z.string()).nullish(),
      }),
      execute: async (args) => {
        actions.push({
          type: 'createUserJourney',
          stageCount: args.stageCount,
          stageNames: args.stageNames ?? [],
        });
        return `Created a ${args.stageCount}-stage user journey.`;
      },
    }),

    tool({
      name: 'createRetrospectiveBoard',
      description: "Create a retro board: What Went Well / What Didn't / Action Items.",
      parameters: z.object({}),
      execute: async () => {
        actions.push({ type: 'createRetrospectiveBoard' });
        return 'Retrospective board created.';
      },
    }),

    tool({
      name: 'deleteObject',
      description: 'Delete a specific object by ID. Use IDs from board state.',
      parameters: z.object({
        objectId: z.string().describe('ID of the object to delete.'),
      }),
      execute: async (args) => {
        actions.push({ type: 'deleteObject', objectId: args.objectId });
        return `Deleted ${args.objectId}.`;
      },
    }),

    tool({
      name: 'clearBoard',
      description: 'Delete ALL objects on the board at once.',
      parameters: z.object({}),
      execute: async () => {
        actions.push({ type: 'clearBoard' });
        return 'Board cleared.';
      },
    }),

    tool({
      name: 'createFrameWithNotes',
      description:
        'Create a frame and pre-populate it with sticky notes inside. ' +
        'Use this whenever the user asks to create a frame AND add content inside it — ' +
        'do NOT use separate createFrame + createStickyNote calls for this.',
      parameters: z.object({
        title: z.string().nullish().describe('Frame title. Default: "Frame".'),
        width: z.number().nullish().describe('Frame width. Default 600.'),
        height: z.number().nullish().describe('Frame height. Default 400.'),
        notes: z.array(z.string()).nullish().describe('Text for each sticky note inside the frame.'),
      }),
      execute: async (args) => {
        actions.push({
          type: 'createFrameWithNotes',
          title: args.title ?? 'Frame',
          width: args.width ?? 600,
          height: args.height ?? 400,
          notes: args.notes ?? [],
        });
        return `Created frame "${args.title ?? 'Frame'}" with ${(args.notes ?? []).length} notes inside.`;
      },
    }),
  ];
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemContent(boardState) {
  const boardStateBlurb =
    boardState && Array.isArray(boardState) && boardState.length > 0
      ? `\n\nCurrent board state (use these IDs for move/resize/updateText/changeColor/createConnector):\n${JSON.stringify(boardState).slice(0, 8000)}`
      : '\n\nThe board is currently empty. Create new objects freely.';

  return `You are a helpful assistant for CollabBoard, a collaborative whiteboard app. \
You can create, move, resize, recolor, arrange, and delete objects using the provided tools.

CRITICAL RULES:
1. When the user asks to add or create anything, call the correct tool immediately — never \
describe what you would do without calling the tool.
2. SWOT with a topic: call createSwotTemplate and pass stickies with 2–4 short \
topic-specific items per quadrant. Example for "online coaching": \
strengths:["Expert content","Scalable model"], weaknesses:["High competition","Tech costs"], \
opportunities:["Growing remote demand","Subscriptions"], threats:["Free rivals","Platform risk"].
3. Multi-step requests: call all needed tools in one turn. Example — "add 3 notes then \
arrange in a row": call createStickyNote three times, then spaceEvenly(objectIds:[]). \
When the user asks to create a frame AND put content inside it, use createFrameWithNotes \
instead of separate createFrame + createStickyNote calls.
4. Grid layout: after creating N shapes, call arrangeInGrid(objectIds:[], rows, cols).
5. For manipulation (move/resize/color/text/connect/delete), use exact IDs from board state.
6. You can delete individual objects with deleteObject(objectId) or clear everything with clearBoard().
7. After calling tools, reply with one short sentence confirming what was done.${boardStateBlurb}`;
}

// ─── Action post-processing helpers ──────────────────────────────────────────
const CREATE_TYPES = new Set([
  'createShape', 'createStickyNote', 'createFrame',
  'createStickyNoteGrid', 'createSwotTemplate',
  'createUserJourney', 'createRetrospectiveBoard',
  'createFrameWithNotes',
]);
const LAYOUT_TYPES = new Set(['arrangeInGrid', 'spaceEvenly']);

function reorderActions(actions) {
  if (!actions.some((a) => LAYOUT_TYPES.has(a.type))) return actions;
  const creates = actions.filter((a) => CREATE_TYPES.has(a.type));
  const layouts = actions.filter((a) => LAYOUT_TYPES.has(a.type));
  const others = actions.filter((a) => !CREATE_TYPES.has(a.type) && !LAYOUT_TYPES.has(a.type));
  return [...creates, ...others, ...layouts];
}

function applySwotFallback(actions, lastContent) {
  const swotAction = actions.find((a) => a.type === 'createSwotTemplate');
  if (!swotAction) return;
  const stickiesEmpty =
    !swotAction.stickies ||
    ['strengths', 'weaknesses', 'opportunities', 'threats'].every(
      (k) => !Array.isArray(swotAction.stickies[k]) || swotAction.stickies[k].length === 0,
    );
  const topicResidue = lastContent
    .replace(/\b(swot|analysis|create|make|build|generate|a|an|the|me|us|for|about|on|of|please|can|you)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stickiesEmpty && topicResidue.length > 2) {
    console.log(`⚠️ [FALLBACK] Injecting default stickies for topic: "${topicResidue}"`);
    swotAction.stickies = {
      strengths: ['Clear expertise', 'Scalable model'],
      weaknesses: ['Limited reach', 'High competition'],
      opportunities: ['Growing demand', 'New channels'],
      threats: ['Free alternatives', 'Market shifts'],
    };
  }
}

function applyGridFallback(actions, lastContent) {
  const wantsGrid = /\bin\s+(a\s+)?grid\b|grid\s+layout/.test(lastContent);
  const totalShapes = actions.filter((a) => a.type === 'createShape').length;
  const hasGrid = actions.some((a) => a.type === 'arrangeInGrid');
  if (wantsGrid && totalShapes > 1 && !hasGrid) {
    const cols = Math.ceil(Math.sqrt(totalShapes));
    const rows = Math.ceil(totalShapes / cols);
    actions.push({ type: 'arrangeInGrid', objectIds: [], rows, cols, spacing: 20 });
  }
}

const REPLY_MAP = {
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
  deleteObject: 'Object deleted.',
  clearBoard: 'Board cleared.',
  createFrameWithNotes: 'Frame with notes created.',
};

// ─── Multi-step detection ─────────────────────────────────────────────────────
const MULTI_STEP_CONJUNCTIONS = /\b(then|and then|also|after that)\b/;
const ACTION_KEYWORDS = ['create', 'add', 'make', 'draw', 'place', 'move', 'arrange',
  'delete', 'clear', 'remove', 'resize', 'change', 'update', 'connect'];

function isMultiStep(content) {
  if (MULTI_STEP_CONJUNCTIONS.test(content)) return true;
  const count = ACTION_KEYWORDS.filter((kw) => content.includes(kw)).length;
  return count >= 2;
}

// ─── HTTP handler ─────────────────────────────────────────────────────────────
exports.aiChat = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    console.log('🤖 AI Chat request received!', {
      method: req.method,
      hasAuth: !!req.headers.authorization,
    });

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const keyIsPlaceholder =
        !OPENAI_API_KEY ||
        OPENAI_API_KEY.startsWith('YOUR_') ||
        OPENAI_API_KEY.includes('YOUR_OPENAI') ||
        OPENAI_API_KEY.length < 20;
      if (keyIsPlaceholder) {
        console.error('❌ OpenAI API key not configured.');
        return res.status(500).json({
          error: 'AI Assistant not configured — OpenAI API key missing. Set OPENAI_API_KEY in functions/.env (emulator) or Firebase Console (deployed).',
        });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { messages, model = 'gpt-4o-mini', boardState } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request: messages array required' });
      }

      const lastContent =
        messages.at(-1)?.role === 'user'
          ? String(messages.at(-1)?.content || '').toLowerCase().trim()
          : '';

      setDefaultOpenAIKey(OPENAI_API_KEY);

      const actions = [];

      const agent = new Agent({
        name: 'BoardAgent',
        model,
        instructions: buildSystemContent(boardState),
        tools: buildTools(actions),
      });

      // @openai/agents uses the Responses API internally, which requires content
      // as an array of typed parts. User turns use "input_text"; assistant turns use "output_text".
      const normalizedMessages = messages.slice(-10).map((msg) => ({
        role: msg.role,
        content: typeof msg.content === 'string'
          ? [{ type: msg.role === 'user' ? 'input_text' : 'output_text', text: msg.content }]
          : msg.content,
      }));
      // maxTurns: 1 for single-step commands (~2–3 s); 5 for multi-step.
      // When maxTurns=1 the model calls tools but produces no final text — finalOutput will
      // be null. That is fine: the REPLY_MAP fallback below fills in the reply.
      const maxTurns = isMultiStep(lastContent) ? 5 : 2;
      let runResult = null;
      try {
        runResult = await run(agent, normalizedMessages, { maxTurns });
      } catch (err) {
        if (err instanceof MaxTurnsExceededError) {
          // Tools already executed (actions are populated). Just skip the final text turn.
          console.warn('⚠️ MaxTurns hit — returning collected actions without final text turn.');
        } else {
          throw err;
        }
      }

      applySwotFallback(actions, lastContent);
      applyGridFallback(actions, lastContent);
      const orderedActions = reorderActions(actions);

      const actionTypes = [...new Set(orderedActions.map((a) => a.type))];
      const firstKnown = actionTypes.find((t) => REPLY_MAP[t]);
      const reply = runResult?.finalOutput || (firstKnown ? REPLY_MAP[firstKnown] : "I've updated your board.");

      console.log(`✅ actions=${JSON.stringify(actionTypes)}, reply="${reply}"`);

      return res.status(200).json({
        message: { role: 'assistant', content: reply },
        ...(orderedActions.length > 0 && { actions: orderedActions }),
      });
    } catch (error) {
      console.error('Error in aiChat:', error);
      if (error?.status === 401 || error?.message?.includes('401')) {
        return res.status(401).json({ error: 'Invalid OpenAI API key' });
      }
      return res.status(500).json({
        error: 'Failed to get AI response',
        details: error.message,
      });
    }
  });
});
