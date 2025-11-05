// src/entities/task.ts
export type Domain = string
export type TaskCard = {
  id: number
  title: string
  domain: Domain
  minutes: 5 | 10
  typeTag?: string
}
export type UserTaskCard = Omit<TaskCard, 'typeTag'> & { typeTag: string }

// —— System built-in task pool (extend/localize as needed) —— //
export const TASK_POOL: TaskCard[] = [
  // study learning
  {
    id: 101,
    title: 'Memorize 20 words (or review one flashcard set)',
    domain: 'study',
    minutes: 10,
  },
  {
    id: 102,
    title: 'Read three foreign-language paragraphs aloud and record',
    domain: 'study',
    minutes: 10,
  },
  { id: 103, title: 'Watch a short grammar or study-note video', domain: 'study', minutes: 5 },
  {
    id: 104,
    title: '10 minutes of listening shadowing (follow the subtitles)',
    domain: 'study',
    minutes: 10,
  },
  {
    id: 105,
    title: 'Write five sentences in a foreign language (same structure)',
    domain: 'study',
    minutes: 5,
  },

  // clean organize
  { id: 201, title: 'Clear all clutter from an A5 area of the desk', domain: 'clean', minutes: 5 },
  {
    id: 202,
    title: 'Delete or archive 10 files in the downloads folder',
    domain: 'clean',
    minutes: 10,
  },
  { id: 203, title: 'Sort and store scattered papers/receipts', domain: 'clean', minutes: 10 },
  { id: 204, title: 'Gather laundry into the basket and sort it', domain: 'clean', minutes: 5 },

  // write writing
  {
    id: 301,
    title: 'Free associate five sentences for the current topic',
    domain: 'write',
    minutes: 5,
  },
  {
    id: 302,
    title: 'Draft an outline or bullet list with six items',
    domain: 'write',
    minutes: 10,
  },
  { id: 303, title: 'Finish an 80–120 word paragraph for a draft', domain: 'write', minutes: 10 },
  {
    id: 304,
    title: 'Write three sentences for a miracle journal or review',
    domain: 'write',
    minutes: 5,
  },

  // move exercise
  { id: 401, title: 'Power walk in place/step indoors for 600 steps', domain: 'move', minutes: 10 },
  {
    id: 402,
    title: 'Neck-and-shoulder stretch + thoracic spine rotation',
    domain: 'move',
    minutes: 5,
  },
  { id: 403, title: 'Two sets of push-ups or squats', domain: 'move', minutes: 5 },
  { id: 404, title: 'Core activation: plank intervals', domain: 'move', minutes: 10 },
]
