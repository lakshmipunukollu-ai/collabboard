# AI Board Agent – Capabilities Checklist

## Creation
| Status | Item | Note |
|--------|------|------|
| Done | Add sticky note with custom text and color (e.g. "Add a yellow sticky note that says 'User Research'") | Implemented in `functions/index.js` (add_sticky_note with text, color) and `AIAssistant.jsx` passes text/color to createStickyNote. |
| Done | Create shape at explicit position (e.g. "Create a blue rectangle at position 100, 200") | Backend createShape has x, y, width, height; frontend uses them when provided else viewport center. |
| Done | Add frame with custom title (e.g. "Add a frame called 'Sprint Planning'") | add_frame/createFrame has title param; frontend passes title and optional x, y, width, height. |
| Done | Parse numeric quantities in natural language (e.g. "add 10 circles" or "ten circles" → create 10 circles) | Backend createShape/createStickyNote accept count; system prompt instructs model to parse "10 circles", "ten circles"; backend emits multiple actions. |

## Manipulation
| Status | Item | Note |
|--------|------|------|
| Done | Move object(s) by id or description (e.g. "Move all the pink sticky notes to the right side", "Move [object] to 100, 200") | moveObject tool in backend; frontend executeActions calls BoardContext moveObject; model uses board state for ids. |
| Done | Resize object/frame (e.g. "Resize the frame to fit its contents" or "resize [id] to WxH") | resizeObject tool and frontend handler; BoardContext resizeObject. |
| Done | Change color of object(s) (e.g. "Change the sticky note color to green") | changeColor tool and frontend handler; BoardContext updateObject with color. |

## Layout
| Status | Item | Note |
|--------|------|------|
| Done | Arrange selected or described objects in a grid | arrangeInGrid(objectIds, rows, cols, spacing) tool; frontend computes positions and calls moveObject for each. |
| Done | Create a grid of sticky notes (e.g. "Create a 2x3 grid of sticky notes for pros and cons") | createStickyNoteGrid(rows, cols, labels?, spacing?) tool; frontend creates stickies in grid layout. |
| Done | Space elements evenly | spaceEvenly(objectIds, direction) tool; frontend spaces horizontally or vertically and moves each. |

## Complex
| Status | Item | Note |
|--------|------|------|
| Done | Create a SWOT-style template (four quadrants) | createSwotTemplate() tool; frontend creates four frames (Strengths, Weaknesses, Opportunities, Threats). |
| Done | Create a user journey with N stages | createUserJourney(stageCount, stageNames?) tool; frontend creates a row of sticky notes with stage labels. |
| Done | Create a retrospective board with columns (e.g. What Went Well, What Didn't, Action Items) | createRetrospectiveBoard() tool; frontend creates three frames with those column titles. |

## Tool schema (backend + frontend)
| Status | Tool | Note |
|--------|------|------|
| Done | createStickyNote(text, x, y, color) | Backend createStickyNote has text, x, y, width, height, color, count; frontend passes through to BoardContext. |
| Done | createShape(type, x, y, width, height, color) | Backend createShape with type, x, y, width, height, color, count; frontend uses explicit position/size when provided. |
| Done | createFrame(title, x, y, width, height) | Backend createFrame has title, x, y, width, height; frontend createFrame(x, y, width, height, title). |
| Done | createConnector(fromId, toId, style) | Backend createConnector; frontend calls BoardContext createConnector(fromId, toId, style). |
| Done | moveObject(objectId, x, y) | Backend and frontend; BoardContext moveObject. |
| Done | resizeObject(objectId, width, height) | Backend and frontend; BoardContext resizeObject. |
| Done | updateText(objectId, newText) | Backend updateText; frontend uses updateObject for text/title. |
| Done | changeColor(objectId, color) | Backend changeColor; frontend uses updateObject({ color }). |
| Done | getBoardState() | Frontend getBoardState() returns serialized objects; sent as boardState in request body; backend injects into system prompt so model can reason. |

## UX / robustness
| Status | Item | Note |
|--------|------|------|
| Done | Sticky note creation works reliably (including custom text and color) | Implemented; backend and frontend pass text and color. |
| Done | Natural language quantity parsing ("10 circles", "ten circles", "three sticky notes") | System prompt instructs model to parse quantities; backend createShape/createStickyNote support count; multiple actions emitted. |

---

## Implementation note

**Files changed**

- **functions/index.js**
  - Accept `boardState` in request body; inject into system prompt so the model can use object ids for move/resize/updateText/changeColor/connectors.
  - Replaced/add tools: createShape, createStickyNote, createFrame (with optional x, y, width, height and count for creation); createConnector; moveObject; resizeObject; updateText; changeColor; arrangeInGrid; createStickyNoteGrid; spaceEvenly; createSwotTemplate; createUserJourney; createRetrospectiveBoard.
  - System prompt updated: assistant can create, move, resize, change color, update text, and arrange; must use provided board state to resolve “the pink sticky notes”, “the frame”, etc.; quantity parsing for “10 circles”, “ten circles”.
  - Legacy add_shape, add_sticky_note, add_frame still mapped to createShape/createStickyNote/createFrame actions for compatibility.

- **src/components/AIAssistant.jsx**
  - getBoardState() added: returns array of { id, type, x, y, width, height, color, text } from context objects; sent as `boardState` in every AI request.
  - executeActions extended to handle: createShape, createStickyNote, createFrame (with x, y, width, height); createConnector; moveObject; resizeObject; updateText; changeColor; arrangeInGrid; createStickyNoteGrid; spaceEvenly; createSwotTemplate; createUserJourney; createRetrospectiveBoard. Creation uses viewport center when x/y omitted; explicit position/size when provided.
  - useBoard() now includes objects, createConnector, moveObject, updateObject, resizeObject.

**Summary:** Added moveObject, resizeObject, changeColor, updateText, createConnector, getBoardState (client-side + send in request); added creation with explicit position/size and quantity (count); fixed sticky note text/color flow; added layout tools (arrangeInGrid, createStickyNoteGrid, spaceEvenly) and templates (SWOT, user journey, retrospective). Connector: model must use object ids from getBoardState(); documented in system prompt.
