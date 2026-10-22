// @vitest-environment jsdom
//
// Grammar practice. What matters: a topic with several rules opens a menu of
// them, a one-rule topic goes straight to practice, exercises come one at a
// time with Next between them, every answer is recorded, and after ten the
// learner is asked whether to go on or go back.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GrammarExercise, GrammarRound, GrammarTopic } from './api'

const unit = (slug: string, title: string, review = false) => ({
  slug,
  title,
  blurb: `${title} blurb`,
  review,
  total: 10,
  seen: 0,
  right: 0,
})

const TOPICS: GrammarTopic[] = [
  {
    slug: 'v2',
    title: 'V2 word order',
    blurb: 'The verb is always second.',
    units: [unit('subj', 'Subject first'), unit('time', 'Time first'), unit('mix', 'Mixed review', true)],
  },
  { slug: 'neg', title: 'Negation', blurb: 'Where ikke goes.', units: [unit('main', 'Negation')] },
]

const choose: GrammarExercise = {
  slug: 'v2-time-03',
  kind: 'choose',
  unit: 'time',
  instr: 'Pick the correct order.',
  prompt: 'I dag ___ hjemme.',
  cue: null,
  hint: null,
  tiles: null,
  options: ['jeg jobber', 'jobber jeg'],
  answers: ['jobber jeg'],
  why: 'I dag fills the front, so the verb comes next.',
  ref: null,
}
const typed: GrammarExercise = {
  ...choose,
  slug: 'v2-time-01',
  kind: 'transform',
  instr: 'Move the cue to the front. Which part is the [[adverbial|adverbial phrase]]?',
  prompt: 'Vi spiser middag på lørdag.',
  cue: 'På lørdag …',
  options: null,
  answers: ['På lørdag spiser vi middag.'],
}
const build: GrammarExercise = {
  ...choose,
  slug: 'v2-time-10',
  kind: 'build',
  prompt: null,
  options: null,
  tiles: ['vi', 'I går', 'pizza', 'spiste'],
  answers: ['I går spiste vi pizza'],
}

const round = (exercises: GrammarExercise[]): GrammarRound => ({
  topic: 'v2',
  unit: 'time',
  title: 'Time first',
  exercises,
})

const postGrammarAttempt = vi.fn(async (slug: string, correct: boolean, _answer: string) => ({ slug, correct }))
const fetchGrammarRound = vi.fn(async (_topic: string, _unit: string) => round([choose, typed, build]))

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  fetchGrammar: async () => ({ topics: structuredClone(TOPICS) }),
  fetchGrammarRound: (...a: [string, string]) => fetchGrammarRound(...a),
  postGrammarAttempt: (...a: [string, boolean, string]) => postGrammarAttempt(...a),
}))

import Grammar from './Grammar'

beforeEach(() => {
  postGrammarAttempt.mockClear()
  fetchGrammarRound.mockClear()
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})
afterEach(cleanup)

async function openTimeFirst() {
  render(<Grammar onBack={() => {}} />)
  await waitFor(() => expect(screen.getByText('V2 word order')).toBeTruthy())
  fireEvent.click(screen.getByText('V2 word order'))
  await waitFor(() => expect(screen.getByText('Time first')).toBeTruthy())
  fireEvent.click(screen.getByText('Time first'))
  await waitFor(() => expect(screen.getByText('jeg jobber')).toBeTruthy())
}

describe('Grammar', () => {
  it('opens a menu of rules for a topic that has several', async () => {
    render(<Grammar onBack={() => {}} />)
    await waitFor(() => expect(screen.getByText('V2 word order')).toBeTruthy())
    fireEvent.click(screen.getByText('V2 word order'))
    await waitFor(() => expect(screen.getByText('Subject first')).toBeTruthy())
    expect(screen.getByText('Mixed review')).toBeTruthy()
    expect(fetchGrammarRound).not.toHaveBeenCalled()
  })

  it('goes straight to practice for a one-rule topic', async () => {
    render(<Grammar onBack={() => {}} />)
    await waitFor(() => expect(screen.getByText('Negation')).toBeTruthy())
    fireEvent.click(screen.getByText('Negation'))
    await waitFor(() => expect(fetchGrammarRound).toHaveBeenCalledWith('neg', 'main'))
  })

  it('shows one exercise at a time and records each answer', async () => {
    await openTimeFirst()
    expect(screen.getByText('1 of 3')).toBeTruthy()

    fireEvent.click(screen.getByText('jeg jobber'))
    expect(screen.getByText(/Not quite/)).toBeTruthy()
    expect(screen.getByText('See the rule')).toBeTruthy()
    expect(postGrammarAttempt).toHaveBeenCalledWith('v2-time-03', false, 'jeg jobber')

    fireEvent.click(screen.getByText('Next →'))
    expect(screen.getByText('2 of 3')).toBeTruthy()
    expect(screen.queryByText('jeg jobber')).toBeNull()
  })

  it('makes marked-up grammar words into explained terms', async () => {
    fetchGrammarRound.mockResolvedValueOnce(round([typed]))
    render(<Grammar onBack={() => {}} />)
    await waitFor(() => screen.getByText('V2 word order'))
    fireEvent.click(screen.getByText('V2 word order'))
    await waitFor(() => screen.getByText('Time first'))
    fireEvent.click(screen.getByText('Time first'))
    await waitFor(() => screen.getByText('Vi spiser middag på lørdag.'))
    const term = screen.getAllByText('adverbial phrase').find((el) => el.closest('article'))!
    fireEvent.click(term)
    expect(screen.getByRole('tooltip').textContent).toMatch(/when, where or how/)
  })

  it('marks a typed answer, ignoring case and full stops but not æ ø å', async () => {
    fetchGrammarRound.mockResolvedValueOnce(round([typed, typed]))
    await openTimeFirstWith()
    const input = screen.getByLabelText('Your answer') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'pa lordag spiser vi middag' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText(/Check æ, ø and å/)).toBeTruthy()
    expect(postGrammarAttempt).toHaveBeenLastCalledWith('v2-time-01', false, 'pa lordag spiser vi middag')

    fireEvent.click(screen.getByText('Next →'))
    const again = screen.getByLabelText('Your answer') as HTMLInputElement
    fireEvent.change(again, { target: { value: 'på lørdag spiser vi middag' } })
    fireEvent.keyDown(again, { key: 'Enter' })
    expect(screen.getByText(/^Right\./)).toBeTruthy()
  })

  it('builds a sentence from tiles', async () => {
    fetchGrammarRound.mockResolvedValueOnce(round([build]))
    await openTimeFirstWith()
    for (const t of ['I går', 'spiste', 'vi', 'pizza']) fireEvent.click(screen.getByText(t))
    fireEvent.click(screen.getByText('Check'))
    expect(screen.getByText(/^Right\./)).toBeTruthy()
    expect(postGrammarAttempt).toHaveBeenCalledWith('v2-time-10', true, 'I går spiste vi pizza')
  })

  it('asks whether to go on or go back after the round', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...choose, slug: `x-${i}` }))
    fetchGrammarRound.mockResolvedValue(round(ten))
    await openTimeFirstWith()
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByText('jobber jeg'))
      fireEvent.click(screen.getByText(i === 9 ? 'See results' : 'Next →'))
    }
    expect(screen.getByText('Round complete')).toBeTruthy()
    expect(postGrammarAttempt).toHaveBeenCalledTimes(10)

    fireEvent.click(screen.getByText('Practise 10 more'))
    await waitFor(() => expect(fetchGrammarRound).toHaveBeenCalledTimes(2))

    for (let i = 0; i < 10; i++) {
      await waitFor(() => screen.getByText('jobber jeg'))
      fireEvent.click(screen.getByText('jobber jeg'))
      fireEvent.click(screen.getByText(i === 9 ? 'See results' : 'Next →'))
    }
    fireEvent.click(screen.getByText('Back to V2 word order'))
    await waitFor(() => expect(screen.getByText('Subject first')).toBeTruthy())
    fetchGrammarRound.mockReset()
    fetchGrammarRound.mockImplementation(async () => round([choose, typed, build]))
  })
})

/** Open Time first when the round has already been mocked by the test. */
async function openTimeFirstWith() {
  render(<Grammar onBack={() => {}} />)
  await waitFor(() => screen.getByText('V2 word order'))
  fireEvent.click(screen.getByText('V2 word order'))
  await waitFor(() => screen.getByText('Time first'))
  fireEvent.click(screen.getByText('Time first'))
  await waitFor(() => expect(fetchGrammarRound).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
}
