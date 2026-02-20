/**
 * kanbanSkill — builds a kanban board from a topic or list of tasks.
 * Triggered by /generate kanban or "create a kanban for X".
 */
const KANBAN_KEYWORDS = ['kanban', 'task board', 'to do list', 'sprint board', 'project board'];

export default {
  name: 'kanban',
  description: 'Generate a kanban board with To Do / In Progress / Done columns',

  match(input) {
    const lower = input.toLowerCase();
    if (lower.startsWith('/generate kanban') || lower.startsWith('/kanban')) return true;
    return KANBAN_KEYWORDS.some((kw) => lower.includes(kw));
  },

  buildPrompt(input, boardState) {
    const topic = input
      .replace(/^\/(generate\s+)?kanban\s*/i, '')
      .replace(/create\s+a?\s+kanban\s+(board\s+)?(for\s+)?/i, '')
      .trim() || 'general project';

    const existingText = boardState
      .filter((o) => o.text)
      .map((o) => o.text)
      .slice(0, 8)
      .join(', ');

    return `You are building a kanban board on a collaborative whiteboard.

Project/Topic: "${topic}"
${existingText ? `\nExisting board context: ${existingText}` : ''}

Create a kanban board with 3 columns using frames:
1. "To Do" — 4-5 task sticky notes (yellow)
2. "In Progress" — 2-3 task sticky notes (blue)  
3. "Done" — 2-3 completed task sticky notes (green)

Use createFrameWithNotes for each column.
Place the 3 frames side by side horizontally with ~20px gaps between them.
Each frame should be about 300px wide × 400px tall.
Make the tasks realistic and specific to the topic "${topic}".`;
  },
};
