## Neural Cat (MVP)

### Overview
A local-first, offline-only self-activation app that models user behavior
as an event-driven feedback loop.

### Target Users
- Users who experience friction when starting small daily actions
- Users who benefit from immediate and low-pressure feedback

The system logic is behavior-driven and generalized,
rather than tailored to a specific demographic label.

### Tech Stack
Vue 3 · TypeScript · Pinia · localStorage

### Key Design
- Local-first architecture, no backend or authentication
- Decoupled reward system via a global event bus
- Domain-based state management

