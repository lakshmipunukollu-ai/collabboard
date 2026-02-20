/**
 * explainSkill — explains the selected objects or diagrams on the board.
 * Triggered by /explain or "explain this/these/the diagram".
 */
const EXPLAIN_KEYWORDS = ['explain this', 'explain these', 'explain the', 'what does this mean', 'what is this'];

export default {
  name: 'explain',
  description: 'Explain the selected objects or current board content',

  match(input) {
    const lower = input.toLowerCase();
    if (lower.startsWith('/explain')) return true;
    return EXPLAIN_KEYWORDS.some((kw) => lower.includes(kw));
  },

  buildPrompt(input, boardState, selectedObjects) {
    const targets = selectedObjects && selectedObjects.length > 0 ? selectedObjects : boardState;

    if (targets.length === 0) {
      return `The user asked you to explain the board, but it appears to be empty. Tell them nothing is selected or on the board yet.`;
    }

    const items = targets
      .filter((o) => o.text || o.title || o.type)
      .map((o) => {
        const label = o.type === 'frame' ? `Frame "${o.title || 'Frame'}"` : o.type;
        const content = o.text || o.title || '(no text)';
        return `- ${label}: "${content}"`;
      })
      .join('\n');

    return `The user wants you to explain the following whiteboard content:

${items}

Please explain:
1. What each element represents
2. How they relate to each other (if applicable)
3. The overall purpose or meaning of the diagram/content

Speak conversationally and clearly. No need to use any board tools — just explain.`;
  },
};
