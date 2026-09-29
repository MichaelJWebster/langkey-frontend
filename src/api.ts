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

export interface Example {
  sentence: string
  translation: string
  audio_url: string
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
}

export const fetchQueue = (focus?: string | null) =>
  request<Queue>(`/api/v1/reviews/queue${focus ? `?focus=${encodeURIComponent(focus)}` : ''}`)
export const fetchProgress = () => request<Progress>('/api/v1/progress')
export const fetchTopics = () => request<Topic[]>('/api/v1/topics')

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
  exercise_type: 'dictation' | 'listen_choose'
  item_id?: number
  example_id?: number
  correct: boolean
  near_miss?: boolean
  hints?: number
  speed?: number
  answer?: string
}) => request<{ status: string }>('/api/v1/exercises/attempts', { method: 'POST', body: JSON.stringify(attempt) })

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
