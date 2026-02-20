/**
 * brainstormSkill — generates sticky notes from a topic or prompt.
 * Triggered by /brainstorm or natural language like "brainstorm ideas about X".
 */
const BRAINSTORM_KEYWORDS = ['brainstorm', 'ideas for', 'generate ideas', 'think of'];

export default {
  name: 'brainstorm',
  description: 'Generate sticky note ideas for a given topic',

  match(input) {
    const lower = input.toLowerCase();
    if (lower.startsWith('/brainstorm')) return true;
    return BRAINSTORM_KEYWORDS.some((kw) => lower.includes(kw));
  },

  buildPrompt(input, boardState) {
    const topic = input.replace(/^\/brainstorm\s*/i, '').trim() || input;
    const existingText = boardState
      .filter((o) => o.text)
      .map((o) => o.text)
      .slice(0, 10)
      .join(', ');

    return `You are a creative brainstorming assistant for a collaborative whiteboard.

Topic to brainstorm: "${topic}"
${existingText ? `\nExisting board content for context: ${existingText}` : ''}

Generate 6-8 concise, distinct sticky note ideas about the topic.
Each idea should be a short phrase (3-8 words).
Use the createStickyNote tool for each idea, arranging them in a neat grid.
Use varied sticky note colors to make the board visually engaging.`;
  },
};
