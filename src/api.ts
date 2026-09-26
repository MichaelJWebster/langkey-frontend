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

export interface Item {
  id: number
  item_type: string
  source_text: string
  translation: string
  pos: string | null
  cefr_level: string
  example_sentence: string
  example_translation: string
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

export const fetchQueue = () => request<Queue>('/api/v1/reviews/queue')
export const fetchProgress = () => request<Progress>('/api/v1/progress')

export const submitReview = (cardId: string, rating: 1 | 2 | 3 | 4) =>
  request<ReviewResult>('/api/v1/reviews', {
    method: 'POST',
    body: JSON.stringify({ card_id: cardId, rating }),
  })
