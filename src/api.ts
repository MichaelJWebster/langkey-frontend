const TOKEN_KEY = 'langkey.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const resp = await fetch(path, { ...init, headers })
  if (!resp.ok) {
    if (resp.status === 401) clearToken()
    const body = await resp.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : `Request failed (${resp.status})`
    throw new Error(detail)
  }
  return resp.json()
}

export async function login(email: string, password: string): Promise<void> {
  const { access_token } = await request<{ access_token: string }>(
    '/api/v1/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  )
  localStorage.setItem(TOKEN_KEY, access_token)
}

export interface Gloss {
  word: string
  translation: string
}

export interface Example {
  id: number
  sentence: string
  translation: string
  audio_url: string
  // Deck words in the sentence not yet established (headword excluded).
  gloss: Gloss[]
}

export interface Item {
  id: number
  item_type: string
  source_text: string
  translation: string
  pos: string | null
  cefr_level: string
  audio_url: string
  examples: Example[]
}

export interface Card {
  card_id: string
  direction: 'recognition' | 'production'
  is_new: boolean
  due: string
  item: Item
  alternatives: string[] // answers the learner has vouched for on this card
}

export interface Queue {
  cards: Card[]
  due_count: number
  new_count: number
}

export interface ReviewResult {
  card_id: string
  due: string
  requeue: boolean
}

export interface Progress {
  due_now: number
  new_available: number
  reviewed_today: number
  cards_learning: number
  cards_established: number
  total_items: number
  streak_days: number
}

export interface Topic {
  topic: string
  label: string
  total: number
  remaining: number
  established: number // learning count = total - remaining - established
}

export interface CardBreakdown {
  unseen: number
  learning: number
  relearning: number
  established: number
}

export interface SkillsBreakdown {
  vocabulary: CardBreakdown
  writing: CardBreakdown
  listening: { clean: number; helped: number; missed: number; total: number }
  reading: { sentences_read: number; sentences_total: number }
}

export interface CefrSkill {
  skill: string
  practised: boolean
  level: string | null // highest band cleared; null = pre-A1
  next_level: string | null
  progress: number // 0..1 toward next_level
  detail: string
}

export interface CefrProgress {
  overall_level: string | null
  overall_next: string | null
  overall_progress: number
  skills: CefrSkill[]
  note: string
}

export interface QueueOptions {
  focus?: string | null
  direction?: 'recognition' | 'production'
  mode?: 'tricky'
}

export const fetchQueue = (opts: QueueOptions = {}) => {
  const params = new URLSearchParams()
  if (opts.focus) params.set('focus', opts.focus)
  if (opts.direction) params.set('direction', opts.direction)
  if (opts.mode) params.set('mode', opts.mode)
  const qs = params.toString()
  return request<Queue>(`/api/v1/reviews/queue${qs ? `?${qs}` : ''}`)
}
export const fetchProgress = () => request<Progress>('/api/v1/progress')
export const fetchTopics = () => request<Topic[]>('/api/v1/topics')
export const fetchCefr = () => request<CefrProgress>('/api/v1/progress/cefr')
export const fetchSkillsBreakdown = () => request<SkillsBreakdown>('/api/v1/progress/skills')

export interface GlossaryEntry {
  word: string
  translation: string
  pos: string | null
  cefr_level: string
  topic_label: string | null
  first_seen_at: string
  via: 'card' | 'example'
  status: 'established' | 'learning' | 'seen'
  audio_url: string
}

export const fetchGlossary = () => request<GlossaryEntry[]>('/api/v1/glossary')

export interface DictationExercise {
  kind: 'dictation'
  item_id: number
  example_id: number
  speeds: { scale: number; url: string }[]
  suggested_scale: number
  target: string
  translation: string
}

export interface ChoiceExercise {
  kind: 'listen_choose'
  item_id: number
  audio_url: string
  word: string
  options: string[]
  correct_index: number
}

export type ListeningExercise = DictationExercise | ChoiceExercise

export const fetchListening = (limit = 8) =>
  request<{ exercises: ListeningExercise[] }>(`/api/v1/exercises/listening?limit=${limit}`)

export const postAttempt = (attempt: {
  exercise_type: 'dictation' | 'listen_choose' | 'vocab_recall'
  item_id?: number
  example_id?: number
  correct: boolean
  near_miss?: boolean
  hints?: number
  score?: number // graded mark 0..1 (hints reduce it)
  speed?: number
  answer?: string
}) => request<{ status: string }>('/api/v1/exercises/attempts', { method: 'POST', body: JSON.stringify(attempt) })

export const addAlternative = (cardId: string, answer: string) =>
  request<{ status: string }>('/api/v1/reviews/alternatives', {
    method: 'POST',
    body: JSON.stringify({ card_id: cardId, answer }),
  })

export interface Recording {
  id: string
  item_id: number
  example_id: number | null
  content_type: string
  size_bytes: number
  duration_ms: number | null
  created_at: string
}

export async function uploadRecording(opts: {
  itemId: number
  exampleId?: number | null
  blob: Blob
  mimeType: string
  durationMs: number
}): Promise<Recording> {
  const form = new FormData()
  form.set('item_id', String(opts.itemId))
  if (opts.exampleId != null) form.set('example_id', String(opts.exampleId))
  form.set('duration_ms', String(opts.durationMs))
  // The filename is only for readability in the bucket; the type drives playback.
  form.set('audio', new File([opts.blob], 'take', { type: opts.mimeType }))

  const token = getToken()
  // No Content-Type header: the browser must set the multipart boundary.
  const resp = await fetch('/api/v1/recordings', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!resp.ok) {
    if (resp.status === 401) clearToken()
    const body = await resp.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'Upload failed')
  }
  return resp.json()
}

export const fetchRecordings = (itemId: number, exampleId?: number | null) => {
  const params = new URLSearchParams({ item_id: String(itemId) })
  if (exampleId != null) params.set('example_id', String(exampleId))
  return request<Recording[]>(`/api/v1/recordings?${params}`)
}

export const deleteRecording = (id: string) =>
  fetch(`/api/v1/recordings/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  }).then((r) => {
    if (!r.ok) throw new Error('Could not delete the recording')
  })

/**
 * Fetch a stored recording as an object URL. <audio> cannot send our bearer
 * token, so the bytes come through fetch() and are played from a blob.
 */
export async function recordingObjectUrl(id: string): Promise<string> {
  const token = getToken()
  const resp = await fetch(`/api/v1/recordings/${id}/audio`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resp.ok) throw new Error('Could not load the recording')
  return URL.createObjectURL(await resp.blob())
}

export const submitReview = (cardId: string, rating: 1 | 2 | 3 | 4) =>
  request<ReviewResult>('/api/v1/reviews', {
    method: 'POST',
    body: JSON.stringify({ card_id: cardId, rating }),
  })

export interface TextSummary {
  slug: string
  title: string
  author: string | null
  kind: string
  orthography: string
  license: string | null
  sentence_count: number
  position: number
}

export interface TextSentence {
  seq: number
  paragraph: number
  no: string
  en: string
}

export interface TextPage {
  slug: string
  title: string
  author: string | null
  from_seq: number
  to_seq: number
  sentence_count: number
  sentences: TextSentence[]
}

export const fetchTexts = () => request<TextSummary[]>('/api/v1/texts')

export const fetchTextPage = (slug: string, fromSeq = 1) =>
  request<TextPage>(`/api/v1/texts/${slug}?from_seq=${fromSeq}`)

export const saveReadingPosition = (slug: string, seq: number) =>
  request<{ seq: number }>(`/api/v1/texts/${slug}/position`, {
    method: 'PUT',
    body: JSON.stringify({ seq }),
  })
