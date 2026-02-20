/**
 * Board templates — each template is a plain object with a list of
 * seed objects to batch-write to Firebase when the board is created.
 * Coordinates are in world units. The template picker renders a
 * text description since we don't generate thumbnails.
 */

const GAP = 24;

// ── Helpers ────────────────────────────────────────────────────────────────
function sticky(text, x, y, color = '#FEF08A', w = 160, h = 100) {
  return { type: 'sticky', text, x, y, width: w, height: h, color };
}
function rect(x, y, w, h, color = '#6366F1') {
  return { type: 'rectangle', x, y, width: w, height: h, color };
}
function oval(x, y, w = 140, h = 60, color = '#10B981') {
  return { type: 'oval', x, y, width: w, height: h, color };
}
function frame(x, y, w, h, title) {
  return { type: 'frame', x, y, width: w, height: h, title };
}
function line(x1, y1, x2, y2) {
  return { type: 'arrow', x1, y1, x2, y2, color: '#667eea', strokeWidth: 2 };
}
function textbox(text, x, y, w = 160, h = 40, color = '#94a3b8') {
  return { type: 'textbox', text, x, y, width: w, height: h, color };
}

// ── Template definitions ───────────────────────────────────────────────────
export const templates = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    emoji: '⬜',
    description: 'Start with an empty board',
    objects: [],
  },

  {
    id: 'kanban',
    name: 'Kanban Board',
    emoji: '📋',
    description: '3-column task board with sample cards',
    objects: (() => {
      const cols = [
        { title: 'To Do', x: 0, color: '#FEF08A' },
        { title: 'In Progress', x: 340, color: '#BFDBFE' },
        { title: 'Done', x: 680, color: '#BBF7D0' },
      ];
      const sampleTasks = [
        ['Design wireframes', 'Write user stories', 'Set up repo', 'Define acceptance criteria'],
        ['Implement auth', 'Build dashboard'],
        ['Write tests', 'Deploy to staging'],
      ];
      const result = [];
      cols.forEach(({ title, x, color }, ci) => {
        result.push(frame(x, 0, 300, 480, title));
        sampleTasks[ci].forEach((task, ti) => {
          result.push(sticky(task, x + GAP, 52 + ti * 112, color, 260, 96));
        });
      });
      return result;
    })(),
  },

  {
    id: 'retrospective',
    name: 'Retrospective Board',
    emoji: '🔄',
    description: '4-quadrant retro: Went Well / Improve / Ideas / Actions',
    objects: (() => {
      const quadrants = [
        { title: '✅ What Went Well', x: 0, y: 0 },
        { title: '⚠️ What to Improve', x: 460, y: 0 },
        { title: '💡 Ideas', x: 0, y: 460 },
        { title: '🎯 Action Items', x: 460, y: 460 },
      ];
      const seeds = [
        ['Great team collaboration', 'Clear goals', 'Fast PR reviews'],
        ['Deployment took too long', 'More async comms needed'],
        ['Automate CI pipeline', 'Weekly demos'],
        ['Set up staging env', 'Document API'],
      ];
      const result = [];
      const COLORS = ['#BBF7D0', '#FECACA', '#BFDBFE', '#FDE68A'];
      quadrants.forEach(({ title, x, y }, i) => {
        result.push(frame(x, y, 420, 420, title));
        seeds[i].forEach((text, ti) => {
          result.push(sticky(text, x + GAP, y + 52 + ti * 110, COLORS[i], 380, 96));
        });
      });
      return result;
    })(),
  },

  {
    id: 'user-story-map',
    name: 'User Story Map',
    emoji: '🗺️',
    description: 'Backbone → user tasks → story details in rows',
    objects: (() => {
      const epics = ['Onboarding', 'Core Features', 'Settings', 'Reporting'];
      const tasks = [
        ['Sign up', 'Log in', 'Profile setup'],
        ['Create board', 'Add objects', 'Invite team'],
        ['Edit profile', 'Manage billing', 'Notifications'],
        ['View history', 'Export board', 'Analytics'],
      ];
      const result = [];
      const FW = 300;
      epics.forEach((epic, ei) => {
        const x = ei * (FW + GAP);
        result.push(frame(x, 0, FW, 60, epic));
        tasks[ei].forEach((task, ti) => {
          result.push(sticky(task, x + GAP, 80 + ti * 110, '#BFDBFE', FW - 2 * GAP, 90));
        });
      });
      return result;
    })(),
  },

  {
    id: 'flowchart',
    name: 'Flowchart Scaffold',
    emoji: '🔀',
    description: 'Start → 4 steps → End, pre-connected with arrows',
    objects: [
      oval(130, 0, 140, 56, '#10B981'),
      textbox('Start', 165, 15, 70, 28, '#fff'),
      rect(100, 100, 200, 70, '#6366F1'),
      textbox('Step 1: Input', 125, 120, 150, 30, '#fff'),
      rect(100, 220, 200, 70, '#6366F1'),
      textbox('Step 2: Process', 115, 240, 170, 30, '#fff'),
      rect(100, 340, 200, 70, '#8B5CF6'),
      textbox('Step 3: Validate', 110, 360, 180, 30, '#fff'),
      rect(100, 460, 200, 70, '#6366F1'),
      textbox('Step 4: Output', 120, 480, 160, 30, '#fff'),
      oval(130, 580, 140, 56, '#EF4444'),
      textbox('End', 175, 595, 50, 28, '#fff'),
      line(200, 56, 200, 100),
      line(200, 170, 200, 220),
      line(200, 290, 200, 340),
      line(200, 410, 200, 460),
      line(200, 530, 200, 580),
    ],
  },

  {
    id: 'mind-map',
    name: 'Mind Map Scaffold',
    emoji: '🧠',
    description: 'Central idea with 6 radiating branches',
    objects: (() => {
      const cx = 300; const cy = 300;
      const result = [];
      result.push({ type: 'circle', x: cx - 60, y: cy - 40, width: 120, height: 80, color: '#667eea' });
      result.push(textbox('Main Idea', cx - 50, cy - 20, 100, 40, '#fff'));
      const branches = ['Idea A', 'Idea B', 'Idea C', 'Idea D', 'Idea E', 'Idea F'];
      const angles = [0, 60, 120, 180, 240, 300];
      const r = 200;
      const COLORS = ['#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899'];
      branches.forEach((label, i) => {
        const rad = (angles[i] * Math.PI) / 180;
        const bx = cx + Math.cos(rad) * r;
        const by = cy + Math.sin(rad) * r;
        result.push({ type: 'oval', x: bx - 60, y: by - 25, width: 120, height: 50, color: COLORS[i] });
        result.push(textbox(label, bx - 45, by - 12, 90, 25, '#fff'));
        result.push(line(cx, cy, bx, by));
      });
      return result;
    })(),
  },

  {
    id: 'erd',
    name: 'Database ERD Scaffold',
    emoji: '🗄️',
    description: '3 entity tables connected with relationship lines',
    objects: (() => {
      const entities = [
        {
          title: 'users',
          x: 0, y: 0,
          fields: ['id: INT PK', 'email: VARCHAR', 'name: VARCHAR', 'created_at: TIMESTAMP'],
        },
        {
          title: 'posts',
          x: 460, y: 0,
          fields: ['id: INT PK', 'user_id: INT FK', 'title: VARCHAR', 'body: TEXT', 'created_at: TIMESTAMP'],
        },
        {
          title: 'comments',
          x: 460, y: 380,
          fields: ['id: INT PK', 'post_id: INT FK', 'user_id: INT FK', 'body: TEXT'],
        },
      ];
      const result = [];
      const FW = 340; const FH = 300;
      entities.forEach(({ title, x, y, fields }) => {
        result.push(frame(x, y, FW, FH, title));
        fields.forEach((field, fi) => {
          result.push(textbox(field, x + 16, y + 48 + fi * 52, FW - 32, 40, '#94a3b8'));
        });
      });
      // Relationship arrows
      result.push(line(FW, FH / 2, 460, FH / 2));           // users → posts
      result.push(line(460 + FW / 2, FH, 460 + FW / 2, 380)); // posts → comments
      return result;
    })(),
  },
];

export default templates;
