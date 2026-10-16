// @vitest-environment jsdom
//
// The matching game. What matters: the two columns are not in the same order
// (the thing Michael was specific about), a wrong pairing costs a mistake and
// nothing else, and a finished round is recorded once.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameSet } from './api'

const QUESTION_WORDS: GameSet = {
  slug: 'question-words',
  game: 'matching',
  title: 'Question words',
  description: 'Match each English word to its Norwegian equivalent.',
  pairs: [
    { en: 'what', no: 'hva', note: null },
    { en: 'who', no: 'hvem', note: null },
    { en: 'where', no: 'hvor', note: null },
    { en: 'when', no: 'når', note: null },
    { en: 'how long', no: 'hvor lenge', note: 'time' },
    { en: 'how far', no: 'hvor langt', note: 'distance' },
  ],
  played: 0,
  best: null,
}

const postGameRound = vi.fn(async () => ({ mistakes: 0, seconds: 1 }))
let sets: GameSet[] = [QUESTION_WORDS]

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  fetchGames: async () => ({ sets: structuredClone(sets) }),
  postGameRound: (...a: unknown[]) =>
    (postGameRound as unknown as (...x: unknown[]) => unknown)(...a),
}))

import Games from './Games'

beforeEach(() => {
  postGameRound.mockClear()
  sets = [QUESTION_WORDS]
})
afterEach(cleanup)

/** Walk Games -> Flashcards -> Question words. */
async function openSet() {
  render(<Games onBack={() => {}} />)
  await waitFor(() => expect(screen.getByText('Flashcards')).toBeTruthy())
  fireEvent.click(screen.getByText('Flashcards'))
  await waitFor(() => expect(screen.getByText('Question words')).toBeTruthy())
  fireEvent.click(screen.getByText('Question words'))
  await waitFor(() => expect(screen.getByText('English')).toBeTruthy())
}

/** The clickable card carrying exactly this label. */
const card = (label: string) =>
  screen.getAllByRole('button').find((b) => b.textContent === label) as HTMLButtonElement

// This repo does not use @testing-library/jest-dom, so assert on the DOM
// property rather than reaching for toBeDisabled().
const isDead = (label: string) => card(label).disabled

describe('navigation', () => {
  it('opens on the subsections, not on a game', async () => {
    render(<Games onBack={() => {}} />)
    await waitFor(() => expect(screen.getByText('Flashcards')).toBeTruthy())
    expect(screen.getByText('1 set')).toBeTruthy()
    expect(screen.queryByText('English')).toBeNull()
  })

  it('lists the sets in a subsection before playing one', async () => {
    render(<Games onBack={() => {}} />)
    await waitFor(() => expect(screen.getByText('Flashcards')).toBeTruthy())
    fireEvent.click(screen.getByText('Flashcards'))
    await waitFor(() => expect(screen.getByText('Question words')).toBeTruthy())
    expect(screen.getByText('6 pairs')).toBeTruthy()
    expect(screen.getByText(/not played yet/)).toBeTruthy()
  })

  it('leaves Games only from the top level', async () => {
    const onBack = vi.fn()
    render(<Games onBack={onBack} />)
    await waitFor(() => expect(screen.getByText('Flashcards')).toBeTruthy())
    fireEvent.click(screen.getByText('Flashcards'))
    await waitFor(() => expect(screen.getByText('Question words')).toBeTruthy())

    fireEvent.click(screen.getByText('← Games'))

    await waitFor(() => expect(screen.getByText('Flashcards')).toBeTruthy())
    expect(onBack).not.toHaveBeenCalled()
  })

  it('shows a best score once there is one', async () => {
    sets = [{ ...QUESTION_WORDS, played: 3, best: { mistakes: 0, seconds: 24 } }]
    render(<Games onBack={() => {}} />)
    await waitFor(() => expect(screen.getByText('Flashcards')).toBeTruthy())
    fireEvent.click(screen.getByText('Flashcards'))
    await waitFor(() => expect(screen.getByText(/no mistakes/)).toBeTruthy())
    expect(screen.getByText(/24s/)).toBeTruthy()
    expect(screen.getByText(/played 3 times/)).toBeTruthy()
  })
})

describe('the board', () => {
  it('puts English on one side and Norwegian on the other', async () => {
    await openSet()
    expect(screen.getByText('English')).toBeTruthy()
    expect(screen.getByText('Norsk')).toBeTruthy()
    for (const label of ['what', 'who', 'hva', 'hvem']) {
      expect(card(label)).toBeTruthy()
    }
  })

  // The requirement Michael spelled out: "but not in the same order".
  it('never leaves a word facing its own translation', async () => {
    for (let i = 0; i < 8; i++) {
      cleanup()
      await openSet()
      const lists = screen.getAllByRole('list')
      const left = [...lists[0].querySelectorAll('button')].map((b) => b.textContent)
      const right = [...lists[1].querySelectorAll('button')].map((b) => b.textContent)
      const translation: Record<string, string> = Object.fromEntries(
        QUESTION_WORDS.pairs.map((p) => [
          p.note ? `${p.en} (${p.note})` : p.en,
          p.note ? `${p.no} (${p.note})` : p.no,
        ]),
      )
      left.forEach((en, idx) => {
        expect(right[idx]).not.toBe(translation[en!])
      })
    }
  })

  it('labels the ambiguous words so they can be told apart', async () => {
    await openSet()
    expect(card('how long (time)')).toBeTruthy()
    expect(card('how far (distance)')).toBeTruthy()
    expect(card('hvor lenge (time)')).toBeTruthy()
  })
})

describe('matching', () => {
  it('marks a correct pair and takes it out of play', async () => {
    await openSet()
    fireEvent.click(card('what'))
    fireEvent.click(card('hva'))

    await waitFor(() => expect(screen.getByText(/1\/6 matched/)).toBeTruthy())
    expect(isDead('what')).toBe(true)
    expect(isDead('hva')).toBe(true)
    expect(screen.getByText(/0 mistakes/)).toBeTruthy()
  })

  it('counts a wrong pairing once and leaves both in play', async () => {
    await openSet()
    fireEvent.click(card('what'))
    fireEvent.click(card('hvem'))

    await waitFor(() => expect(screen.getByText(/1 mistake/)).toBeTruthy())
    expect(screen.getByText(/0\/6 matched/)).toBeTruthy()
    expect(isDead('what')).toBe(false)
    expect(isDead('hvem')).toBe(false)
  })

  it('lets you change your mind on the same side without penalty', async () => {
    await openSet()
    fireEvent.click(card('what'))
    fireEvent.click(card('who'))
    expect(screen.getByText(/0 mistakes/)).toBeTruthy()

    fireEvent.click(card('hvem'))
    await waitFor(() => expect(screen.getByText(/1\/6 matched/)).toBeTruthy())
    expect(screen.getByText(/0 mistakes/)).toBeTruthy()
  })

  it('can be started from either side', async () => {
    await openSet()
    fireEvent.click(card('hvor'))
    fireEvent.click(card('where'))
    await waitFor(() => expect(screen.getByText(/1\/6 matched/)).toBeTruthy())
  })

  it('ignores a card that is already matched', async () => {
    await openSet()
    fireEvent.click(card('what'))
    fireEvent.click(card('hva'))
    await waitFor(() => expect(screen.getByText(/1\/6 matched/)).toBeTruthy())

    fireEvent.click(card('hva'))
    fireEvent.click(card('who'))
    expect(screen.getByText(/0 mistakes/)).toBeTruthy()
  })
})

describe('finishing', () => {
  async function playThrough(wrongFirst = false) {
    await openSet()
    if (wrongFirst) {
      fireEvent.click(card('what'))
      fireEvent.click(card('hvem'))
      await waitFor(() => expect(screen.getByText(/1 mistake/)).toBeTruthy())
    }
    for (const p of QUESTION_WORDS.pairs) {
      const en = p.note ? `${p.en} (${p.note})` : p.en
      const no = p.note ? `${p.no} (${p.note})` : p.no
      fireEvent.click(card(en))
      fireEvent.click(card(no))
    }
  }

  it('reports a clean round and records it once', async () => {
    await playThrough()
    await waitFor(() => expect(screen.getByText('Perfect — no mistakes')).toBeTruthy())
    expect(postGameRound).toHaveBeenCalledTimes(1)
    expect(postGameRound.mock.calls[0][0]).toBe('question-words')
    expect(postGameRound.mock.calls[0][1]).toBe(0)
  })

  it('reports the mistakes it counted', async () => {
    await playThrough(true)
    await waitFor(() => expect(screen.getByText('1 mistake')).toBeTruthy())
    expect(postGameRound.mock.calls[0][1]).toBe(1)
  })

  it('offers another round, reshuffled and reset', async () => {
    await playThrough()
    await waitFor(() => expect(screen.getByText('Play again')).toBeTruthy())

    fireEvent.click(screen.getByText('Play again'))

    await waitFor(() => expect(screen.getByText(/0\/6 matched/)).toBeTruthy())
    expect(screen.getByText(/0 mistakes/)).toBeTruthy()
    expect(isDead('what')).toBe(false)
  })

  it('does not block the learner when recording fails', async () => {
    postGameRound.mockRejectedValueOnce(new Error('offline'))
    await playThrough()
    await waitFor(() => expect(screen.getByText('Perfect — no mistakes')).toBeTruthy())
  })
})
