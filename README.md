# Neural Cat · MVP

ADHD/HSP‑friendly self‑activation app designed to spark small wins through mood-driven actions, dopamine feedback, and structured reflection.

Users start with picking today’s mood → receive curated micro “baits” or draw a task card → take action → get immediate rewards (stickers + confetti) → later reflect via miracle journal. The app emphasizes low-friction entry, instant feedback, and a self-owned local-first flow.

This repository is a runnable MVP built with Vue 3 + TypeScript + Vite. It demonstrates the core behavior loop and gamified UX, ready for interview demos and portfolio use.

---

## 🧠 Highlights

- **Activation-first**: App opens to Home → mood and task entry points are always one tap away
- **Dopamine feedback**: every successful micro-action grants a sticker + animation reward
- **Structured end-of-day reflection**: miracle journal grouped by local day key
- **Local-first**: everything works offline; data stored with localStorage + dayKey logic
- **Gamified loop**: mood → bait → task → reward → journal → sticker wall

---

## 🧭 Demo Script (recommended)

1. **Home → Mood → Pick today's mood → Baits**
   - Show curated 5–10 min baits; talk through low-friction activation
2. **Home → Tasks → Type → Card**
   - Explain task gacha logic; show reroll, reward hooks, and gamification
3. **Home → Records → Add Miracle Journal**
   - Type a few lines, Save → get sticker + confetti → view in Sticker Wall

---

## 🧱 System Architecture

**Frontend Stack**:  
Vue 3 + TypeScript + Vite, Pinia, Vue Router 4, Element Plus, localStorage, Capacitor (optional Android)

**App Shell** → mounts:
- `<RouterView />` routed to tabbed MainLayout (Home / Mood / Tasks / Records)
- `<RewardCenter />` globally overlays sticker & confetti on events

**MainLayout Tabs**:
- Home: daily entry point
- Mood Baits: mood chooser + baits
- Task Cards: task types + draw
- Records: Journal / Sticker Wall
- Account, Tools (optional)

---

## 🧩 Feature Modules

### 🟦 Reward Center
- Listens to `nc:reward.*` events via `window.dispatchEvent`
- Shows animated sticker + confetti
- Manages token balance + cooldowns

### 🟨 Mood Baits
- Mood selection + curated baits (5–10 min tasks)
- Supports custom moods, alias matching, and soft-hiding
- Bait session tracks draw / accept / exit

### 🟩 Task Cards
- System task pool by domain + user-added tasks
- Draw → accept → complete → reward
- Token/spend logic prepared; reroll limits supported

### 🟥 Records
- Miracle Journal: daily notes, auto-save, draft templates
- Sticker Wall: groups entries and rewards by local day
- Data migration logic supports long-term evolution

---

## 🔁 Runtime Flows

### 1. Mood → Bait → Reward
- Select mood → draw bait → complete
- `logBaitCompleted()` → publish `nc:reward.bait.completed`
- RewardCenter handles popup → token + sticker added

### 2. Task Card → Reward
- Draw card → accept task → complete
- `logTaskCompleted()` → publish `nc:reward.task.completed`
- RewardCenter processes reward

### 3. Miracle Journal → Reward
- Write → submit → `logJournalCreated()` → reward triggered
- Grouped using `DayKeyLocal` by user’s local timezone

---

## 📦 Tech Stack

- Vue 3 + TypeScript + Vite
- Pinia for state
- Vue Router 4
- Element Plus UI
- localStorage + SSOT keys
- Optional: Capacitor for Android

---

## 🧠 UX for ADHD/HSP

| Pain Point | Neural Cat’s Approach |
|------------|------------------------|
| Hard to get started | Mood + bait provide quick emotional entry |
| Avoidance | Micro task gacha lowers threshold for action |
| Lack of reward | Every action → instant dopamine (sticker/confetti) |
| Disconnected days | Journal + sticker wall form a visual record |
| Overwhelm | Local-first, no account, no clutter |

---

## 🗂️ Repo Structure

- `src/app/` — layout, router, analytics, main.ts
- `src/features/mood-baits/` — mood system
- `src/features/task-cards/` — task draw, types
- `src/features/records/` — journal, stickers
- `src/features/reward/` — reward center logic/UI
- `src/shared/` — utils, constants, components

---

## 🧪 Tests

Vitest and Playwright templates scaffolded. Enable and extend if needed for CI use.

---

## 📎 Portfolio Materials

- [Concept Deck (zh-Hant)](docs/portfolio.zh-Hant.md)
- [Demo Script](docs/demo-script.md)
- [GitHub Repository](your-link-here)
- [Live Demo (if any)](your-demo-link-here)

---

## 💬 Final Note

This MVP focuses on enabling ADHD/HSP users to “show up” — to take small steps, feel good about it, and try again tomorrow. The architecture is designed for extensibility (AI summaries, cloud sync, metrics), but the core loop remains simple and delightful: **do one small thing → get a cat sticker 🎁**
