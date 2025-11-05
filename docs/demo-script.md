# Neural Cat · Interview Demo Script

This 3–5 minute walkthrough shows the MVP loops.

## 1) Miracle Journal → Reward

1. Open Records → Sticker Wall → “Add Miracle Journal”.
2. Keep “Template note”, type a few lines, press Save (or Cmd/Ctrl+Enter).
3. Observe: sticker popup + confetti (Reward Center). After accepting, a token is added and the sticker wall shows today’s sticker.

Talking points:
- Reinforcement on tiny wins; completion is celebrated, not silent.
- DayKeyLocal (YYYY‑MM‑DD) stabilizes grouping across timezones.

## 2) Mood → Baits

1. Go Home → Mood, pick a mood (e.g., low‑energy).
2. Enter Baits and describe 5–10 minute “starter moves”.

Talking points:
- Sustainable entry points reduce activation anxiety.
- Custom moods and alias resolution allow personal vocab.

## 3) Tasks → Type → Card

1. Go Home → Tasks. Pick a type, then go to Card.
2. Explain draw/accept/finish flow; reroll limit and token hooks.

Talking points:
- Micro mission gacha: randomness × micro‑scope × instant success.
- Reward Center decoupled via event bus → reusable feedback.

## Q&A prompts

- How AI integrates later: summarize client + template registry; task breakdown placeholder.
- Why local‑first: fast loops, privacy, and predictable demos.
- Extensibility: policy‑driven rewards, analytics adapters, metrics store.

