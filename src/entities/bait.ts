// src/entities/bait.ts
import type { UIMood as MoodKey } from '@/entities/mood'

export type BaitKind = 'sensory' | 'action' | 'environment'
export type BaitCard = {
  id: string
  title: string
  minutes: 5 | 10
  kind: BaitKind
  mood: MoodKey[] // Which moods this bait card fits (each entry currently uses a single mood)
}

// Each mood has 5 entries; minutes are always 5 or 10; kind helps build UI filters
const byMood: Record<MoodKey, Omit<BaitCard, 'mood'>[]> = {
  'low-energy': [
    {
      id: 'le-1',
      title: 'Drink a glass of water + stretch your neck and shoulders',
      minutes: 5,
      kind: 'action',
    },
    {
      id: 'le-2',
      title: 'Wash your face/comb your hair, open the window for fresh air',
      minutes: 5,
      kind: 'environment',
    },
    {
      id: 'le-3',
      title: 'Stand by the window for sunlight + breathe slowly',
      minutes: 5,
      kind: 'sensory',
    },
    { id: 'le-4', title: 'Only tidy a small "A5 area" on the desk', minutes: 5, kind: 'action' },
    { id: 'le-5', title: 'Move gently to music + swing your arms', minutes: 10, kind: 'action' },
  ],
  anxious: [
    { id: 'an-1', title: '4-7-8 breathing for 3 rounds', minutes: 5, kind: 'sensory' },
    {
      id: 'an-2',
      title: 'Write down the three biggest worries + one next step for each',
      minutes: 10,
      kind: 'action',
    },
    { id: 'an-3', title: '5-4-3-2-1 sensory grounding', minutes: 5, kind: 'sensory' },
    {
      id: 'an-4',
      title: 'Set a 10-minute timer and do just one small task',
      minutes: 10,
      kind: 'action',
    },
    {
      id: 'an-5',
      title: 'Write intrusive thoughts into the "inbox" without judging',
      minutes: 5,
      kind: 'action',
    },
  ],
  overwhelmed: [
    {
      id: 'ov-1',
      title: 'Break the current task into three small steps and circle the first',
      minutes: 5,
      kind: 'action',
    },
    {
      id: 'ov-2',
      title: 'Keep just one tab/document and minimize the rest',
      minutes: 5,
      kind: 'environment',
    },
    {
      id: 'ov-3',
      title: 'Organize one "palm-sized zone" of the workspace',
      minutes: 5,
      kind: 'environment',
    },
    {
      id: 'ov-4',
      title: 'Run a 10-minute "launch timer" and do only the first step',
      minutes: 10,
      kind: 'action',
    },
    {
      id: 'ov-5',
      title: 'Move anything not for today to the "parking lot list"',
      minutes: 5,
      kind: 'action',
    },
  ],
  distracted: [
    {
      id: 'di-1',
      title: 'Enable Do Not Disturb for 10 minutes + keep your phone away',
      minutes: 10,
      kind: 'environment',
    },
    {
      id: 'di-2',
      title: 'Close unrelated apps/tabs, keep just one',
      minutes: 5,
      kind: 'environment',
    },
    {
      id: 'di-3',
      title: 'Write three lines of next steps and do the first line',
      minutes: 5,
      kind: 'action',
    },
    {
      id: 'di-4',
      title: '60-second desk reset + 4-minute single-task sprint',
      minutes: 5,
      kind: 'action',
    },
    {
      id: 'di-5',
      title: 'Wear headphones, play white noise/Lo-fi, focus for 10 minutes',
      minutes: 10,
      kind: 'sensory',
    },
  ],
  'low-mood': [
    {
      id: 'lm-1',
      title: 'Brew a warm drink and sit by the window for a bit',
      minutes: 5,
      kind: 'sensory',
    },
    { id: 'lm-2', title: 'Write three gentle sentences to yourself', minutes: 5, kind: 'action' },
    {
      id: 'lm-3',
      title: 'Play a favorite song and tidy the desk while listening',
      minutes: 5,
      kind: 'action',
    },
    {
      id: 'lm-4',
      title: 'Step outside for a short loop and stop when you are back',
      minutes: 10,
      kind: 'action',
    },
    {
      id: 'lm-5',
      title: 'Open the curtains/turn on the lights and make the bed',
      minutes: 5,
      kind: 'environment',
    },
  ],
  good: [
    { id: 'gd-1', title: 'Push the main task forward for 10 minutes', minutes: 10, kind: 'action' },
    { id: 'gd-2', title: 'Write a short outline for the current work', minutes: 5, kind: 'action' },
    {
      id: 'gd-3',
      title: 'Deep clean the workspace for 10 minutes',
      minutes: 10,
      kind: 'environment',
    },
    {
      id: 'gd-4',
      title: 'Finish an email/decision that has been "stalled forever"',
      minutes: 5,
      kind: 'action',
    },
    {
      id: 'gd-5',
      title: "Review yesterday + plan today's top three priorities",
      minutes: 10,
      kind: 'action',
    },
  ],
}

// Export the "flat pool": BAIT_POOL + type BaitCard
export const BAIT_POOL: BaitCard[] = Object.entries(byMood).flatMap(([mood, arr]) =>
  (arr as Omit<BaitCard, 'mood'>[]).map((x) => ({ ...x, mood: [mood as MoodKey] }))
)

// Helper to grab the pool for a mood (optional)
export const getBaitPool = (mood: MoodKey): BaitCard[] =>
  (byMood[mood] || []).map((x) => ({ ...x, mood: [mood] }))

// "Indexed by mood" version (optional)
export const BAIT_BY_MOOD: Record<MoodKey, BaitCard[]> = Object.fromEntries(
  Object.entries(byMood).map(([m, arr]) => [m, arr.map((x) => ({ ...x, mood: [m as MoodKey] }))])
) as Record<MoodKey, BaitCard[]>
