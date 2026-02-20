/**
 * summarySkill — summarizes all text content currently on the board.
 * Triggered by /summarize or "summarize the board".
 */
const SUMMARY_KEYWORDS = ['summarize', 'summary of', 'what is on the board', 'describe the board', 'explain the board'];

export default {
  name: 'summary',
  description: 'Summarize all text content on the board',

  match(input) {
    const lower = input.toLowerCase();
    if (lower.startsWith('/summarize')) return true;
    return SUMMARY_KEYWORDS.some((kw) => lower.includes(kw));
  },

  buildPrompt(input, boardState) {
    const textItems = boardState
      .filter((o) => o.text || o.title)
      .map((o) => {
        const label = o.type === 'frame' ? `Frame "${o.title || 'Frame'}"` : `${o.type}`;
        const text = o.text || o.title || '';
        return `- [${label}]: ${text}`;
      });

    if (textItems.length === 0) {
      return `The user wants to summarize the board, but the board appears to be empty or has no text. Let them know the board is empty and suggest adding some content first.`;
    }

    return `You are summarizing a collaborative whiteboard for the user.

Board content (${textItems.length} items with text):
${textItems.join('\n')}

Please provide a concise, well-structured summary of:
1. The main themes or topics on the board
2. Key points or ideas
3. Any structure or organization you notice (frames, groups, etc.)

Respond conversationally — no need to use any board tools. Just describe what's on the board.`;
  },
};
