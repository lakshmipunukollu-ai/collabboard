# Project Context: CollabBoard

To optimize your development workflow in Cursor, this context file synthesizes the project requirements and your specific architectural decisions.

## Goal

Build a production-scale real-time collaborative whiteboard with an AI agent that manipulates the board via natural language.

## 1. Core Technical Stack

- **Frontend:** React 18 + Vite (SPA architecture). +1
- **Canvas Library:** konva.js with react-konva.
- **Backend/BaaS:** Firebase (Hosting, Authentication, Realtime Database). +2
- **AI Integration:** Anthropic Claude API (Sonnet 3.5/4.5) via Firebase Cloud Functions. +2
- **Real-time Engine:** Firebase Realtime Database (WebSocket-based sync).

## 2. Architectural Decisions & Constraints

- **Data Model:** High-frequency updates (cursors/objects) are stored in the Realtime Database for <50ms latency. +1
- **State Management:** React Context and Hooks (no Redux).
- **AI Functionality:** The agent uses Function Calling (tools) to interact with the board. It must support 6+ command types, including complex templates like SWOT analyses or Retrospectives. +4
- **Conflict Resolution:** Last-write-wins (LWW) is the accepted approach for simultaneous edits.

## 3. Required AI Agent Tool Schema

The AI agent must be able to call the following minimum functions:

- `createStickyNote(text, x, y, color)`
- `createShape(type, x, y, width, height, color)`
- `createFrame(title, x, y, width, height)`
- `moveObject(objectId, x, y)`
- `updateText(objectId, newText)`
- `getBoardState()` — To provide the agent with current context.

## 4. Code Style & Standards

- **Style Guide:** Airbnb JavaScript Style Guide.
- **Naming:** PascalCase for components (e.g., `StickyNote.jsx`), camelCase for functions/variables.
- **React Patterns:** Functional components only; use props destructuring and hooks.
- **Security:** Restrict DB access to authenticated users via Firebase Security Rules. Escape all user-generated text to prevent XSS. +2

## 5. Implementation Roadmap

1. **Cursor Sync:** Establish basic WebSocket connection for multiplayer cursors.
2. **Object Sync:** Implement real-time creation and movement of sticky notes.
3. **Persistence:** Ensure board state survives refreshes.
4. **AI Integration:** Build the Cloud Function to bridge natural language prompts to board operations.
