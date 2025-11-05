# Neural Cat · Core Feature Sheet | v0.1

> Concept positioning: A self‑observation app that helps ADHD/HSP users manage daily rhythm, break down tasks, and track mood.  
> Three core keywords: 💥 Dopamine feedback · 🌱 Sustainable · 🧩 Structured

---

## 💥 Dopamine Feedback (instant, visual, task‑linked)

| Module | Description | Purpose | Demo / Mock | Est. effort | Interview talking point |
| --- | --- | --- | --- | --- | --- |
| ✅ Miracle Journal | Record tiny miracles and micro breakthroughs each day | Strengthen positive self‑sense; build a sense of achievement | Mock + runnable front‑end demo | 1–1.5d | “Feedback comes from internal confirmation, not external check‑ins.” |
| ✅ Micro Reward Card | Pop celebratory animation on completion (sticker/confetti/encouragement) | Instant positive feedback to break the ‘blank after finishing’ | Mostly mock | 0.5d | “Completion isn’t silence; it’s something worth celebrating.” |

## 🌱 Sustainable (low threshold, repeatable, non‑explosive)

| Module | Description | Purpose | Demo / Mock | Est. effort | Interview talking point |
| --- | --- | --- | --- | --- | --- |
| ✅ Bait Cards | Provide different “starter moves” (5–10 minutes) | Reduce activation anxiety with optional starting strategies | Mock + optional front‑end prototype | 1d | “Help users find a preferred starter, not push with sheer willpower.” |
| ✅ Mood Scan + Choice | Scan mood before starting; recommend matching baits | Personalized activation flow | Mock | 1d | “Guide with ‘find your feeling’, not pressure.” |

## 🧩 Structured (task breakdown, reflective loop, AI hook)

| Module | Description | Purpose | Demo / Mock | Est. effort | Interview talking point |
| --- | --- | --- | --- | --- | --- |
| ✅ AI Task Splitter (placeholder) | Natural‑language input → actionable subtasks | Reduce overload; enable start | Flow + placeholder API | 1d | “Left a semantic processing slot; GPT not yet wired.” |
| ✅ Structured Daily Wrap‑up | One‑pager: tasks · body · mood · highlights | Aggregated reflection; long‑term tracking | Demo (can connect backend) | 1.5d | “Not just journaling— a daily feedback loop.” |
| ✅ Behavior → Mood Map (placeholder) | Model links between actions and moods | Insight for self‑regulation | Mock | 0.5d | “Visualization for future AI assistance.” |

---

## Suggested Tech Stack for Demo

- Front‑end: Vue (Pinia / Composition API)
- Back‑end: Spring Boot / Mock API (DB optional)
- AI module for demo: mocked data + flow diagrams
- Visuals: Figma / PS for UI mockups

## Interview Sound Bites (PM tone)

- “This isn’t a To‑Do app; it’s a task interface that interacts with the autonomic nervous system.”
- “Modules are meant to be reused and gradually build feedback loops.”
- “For ADHD, activation comes from environmental design, not anxiety.”
- “AI isn’t the selling point; it’s a semantic assistant for breakdown, completion, and companion‑style restructuring.”

---

## 🎰 Micro Mission Gacha · Dopamine Module v1.0

Keywords: randomness, micro tasks, instant success, fun‑driven

### Module Positioning

| Item | Value |
| --- | --- |
| Name | Micro Mission Gacha |
| Type | Task generation + feedback system |
| Audience | ADHD/HSP; low motivation; hard to start |
| Scope | Selectable domains (language/writing/exercise etc.) |
| Frequency | 1–3 times/day; works best with bait cards |

### Core Mechanics

1) 🎯 Task Pool Management  
   - Categorized by domain; each task is 5–10 minutes, clear actions, perceivable outcome  
   - Support built‑in pool + user custom tasks (can mark “I want this!”)

2) 🎲 Gacha Draw  
   - Each draw reveals one card: title, time label, reroll limit, finish button + feedback

3) 🧸 Feedback Design  
   - Completion triggers a soothing reward animation  
   - Streaks earn playful titles (“Micro Mover”, “Card Hunter”, …)

4) 🧠 Intelligent Pool (AI hook)  
   - Now: random from text pool  
   - Future: connect GPT to user goals → auto‑generated cards

### UI/UX Notes (for mocks)

- Gashapon‑like reveal; blind‑box animation; a fun “nope” (a cat runs away with the card)

---

## Why ADHD/HSP Design (Brief Rationale)

- Activation over obligation  
  Starting is the hard part. Mood‑first and 5–10 minute “starter moves” reduce cognitive friction and invite action.

- Instant reinforcement, not delayed judgment  
  Celebrate tiny wins immediately (sticker/confetti) so the nervous system learns “showing up pays off.”

- Sustainable, repeatable flows  
  Local‑first, low‑latency loops and small scopes keep usage sustainable and non‑explosive.

- Structured reflection builds agency  
  The daily wrap‑up captures highlights and behaviors to keep; small structure, big signal.

- Decoupled feedback = reusable UX  
  Events → Reward Center UI via a bus allow feedback patterns to be reused across modules without tight coupling.

---

## This MVP vs. the Prototype

### Implemented

- Miracle Journal: edit/submit/reward; Sticker Wall grouped by local day
- Task Cards: pool, types, user tasks + management; draw page + limits/token hooks ready
- Mood Bait + Mood Catalog: choose mood; 5–10m baits; custom moods with alias and soft hide
- Reward Center: sticker queue + confetti; decoupled via CustomEvent bus

### Reserved / Hooks in Place

- AI task breakdown and AI daily summary (template registry + local provider)
- Metrics aggregation and behavior→mood mapping (metrics store, analytics adapter)

