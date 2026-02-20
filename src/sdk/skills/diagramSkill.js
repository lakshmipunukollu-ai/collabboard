/**
 * diagramSkill — generates a flowchart or ERD from a text description.
 * Triggered by /add flowchart, /diagram, or "create a flowchart for X".
 */
const DIAGRAM_KEYWORDS = ['flowchart', 'flow chart', 'flow diagram', 'process diagram', 'diagram for', 'diagram of'];

export default {
  name: 'diagram',
  description: 'Generate a flowchart or process diagram on the board',

  match(input) {
    const lower = input.toLowerCase();
    if (lower.startsWith('/add flowchart') || lower.startsWith('/flowchart') || lower.startsWith('/diagram')) return true;
    return DIAGRAM_KEYWORDS.some((kw) => lower.includes(kw));
  },

  buildPrompt(input, boardState) {
    const topic = input
      .replace(/^\/(add\s+)?flowchart\s*/i, '')
      .replace(/^\/(diagram)\s*/i, '')
      .replace(/create\s+a?\s+(flowchart|diagram)\s+(for\s+)?/i, '')
      .trim() || 'a generic process';

    return `You are creating a flowchart on a collaborative whiteboard.

Process to diagram: "${topic}"

Create a top-to-bottom flowchart using shapes and connectors:
- Use rectangles for process steps (e.g. "Validate Input")
- Use ovals for start/end nodes
- Use createConnector to connect shapes with arrows in order
- Place shapes in a vertical column, spaced ~120px apart
- Keep labels short (3-6 words per step)
- Create 5-7 steps total

First create all shapes, then connect them with arrows using createConnector.`;
  },
};
