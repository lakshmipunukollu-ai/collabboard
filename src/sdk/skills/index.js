/**
 * Skills registry — each skill matches a user intent and builds a
 * structured prompt. Skills are checked in order; first match wins.
 */
import brainstormSkill from './brainstormSkill.js';
import summarySkill from './summarySkill.js';
import kanbanSkill from './kanbanSkill.js';
import diagramSkill from './diagramSkill.js';
import schemaSkill from './schemaSkill.js';
import explainSkill from './explainSkill.js';

const skills = [
  summarySkill,    // /summarize — check early so it doesn't get caught by others
  explainSkill,    // /explain
  kanbanSkill,     // /generate kanban
  diagramSkill,    // /add flowchart
  schemaSkill,     // /schema
  brainstormSkill, // /brainstorm — broadest match, goes last
];

/**
 * Find the first skill that matches the user's input.
 * @param {string} input - raw user message
 * @returns {{ skill, prompt: (boardState, selectedObjects?) => string } | null}
 */
export function findSkill(input) {
  const skill = skills.find((s) => s.match(input));
  return skill || null;
}

export { skills };
export default skills;
