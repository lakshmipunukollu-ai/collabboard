/**
 * schemaSkill — generates a database schema diagram from a description.
 * Triggered by /schema or "create a schema for X" or "database diagram".
 */
const SCHEMA_KEYWORDS = ['schema', 'database diagram', 'erd', 'entity relationship', 'data model', 'db diagram'];

export default {
  name: 'schema',
  description: 'Generate a database schema / ERD diagram on the board',

  match(input) {
    const lower = input.toLowerCase();
    if (lower.startsWith('/schema') || lower.startsWith('/erd')) return true;
    return SCHEMA_KEYWORDS.some((kw) => lower.includes(kw));
  },

  buildPrompt(input, boardState) {
    const topic = input
      .replace(/^\/(schema|erd)\s*/i, '')
      .replace(/create\s+a?\s+(schema|erd|database diagram|data model)\s+(for\s+)?/i, '')
      .trim() || 'a simple application';

    return `You are creating a database schema / ERD diagram on a collaborative whiteboard.

Application/Domain: "${topic}"

Create an ERD with 3-4 entity tables using frames, where:
- Each frame = one database table (name it after the entity, e.g. "Users")
- Inside each frame, create sticky notes for the key fields (e.g. "id: INT PK", "email: VARCHAR", "created_at: TIMESTAMP")
- Use createFrameWithNotes for each entity
- Place entities in a 2-column grid layout
- Use createConnector to draw relationship lines between related entities
- Keep field names concise

Make the entities realistic and relevant to "${topic}".`;
  },
};
