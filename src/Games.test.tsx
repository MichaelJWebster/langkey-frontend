// @vitest-environment jsdom
//
// The matching game. What matters: the two columns are not in the same order
// (the thing Michael was specific about), a wrong pairing costs a mistake and
// nothing else, and a finished round is recorded once.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameRoundResult, GameSet } from './api'

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

const postGameRound = vi.fn(
  async (_slug: string, _mistakes: number, _seconds: number): Promise<GameRoundResult> => ({
    mistakes: 0,
    seconds: 1,
    best: true,
    previous: null,
  }),
)
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

/** The cards currently flashing as a wrong guess. */
const flashing = () =>
  screen.getAllByRole('button').filter((b) => b.getAttribute('data-state') === 'wrong')

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
        QUESTION_WORDS.pairs.map((p) => [p.note ? `${p.en} (${p.note})` : p.en, p.no]),
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
    // ...but the Norwegian side carries no note: those are already two
    // different words, and repeating it labels the answer.
    expect(card('hvor lenge')).toBeTruthy()
    expect(card('hvor langt')).toBeTruthy()
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

  // Michael: "I noticed the UI flashed the correct option when I picked
  // incorrectly. That's not helpful." The flash was keyed by pair rather than
  // by card, so marking the two he had touched also marked their partners
  // across the board -- pointing straight at both right answers.
  it('flashes only the two cards picked, never their partners', async () => {
    await openSet()
    fireEvent.click(card('what'))
    fireEvent.click(card('hvem'))

    await waitFor(() => expect(screen.getByText(/1 mistake/)).toBeTruthy())
    const lit = flashing().map((b) => b.textContent)

    expect(lit.sort()).toEqual(['hvem', 'what'])
    // The giveaway: "hva" answers "what", and "who" answers "hvem".
    expect(lit).not.toContain('hva')
    expect(lit).not.toContain('who')
  })

  // Real timers, not fake ones: openSet() waits on waitFor, which never
  // advances under vi.useFakeTimers() and hangs the whole file.
  it('clears the flash so the next guess starts clean', async () => {
    await openSet()
    fireEvent.click(card('what'))
    fireEvent.click(card('hvem'))
    expect(flashing()).toHaveLength(2)

    await waitFor(() => expect(flashing()).toHaveLength(0), { timeout: 2000 })
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
      fireEvent.click(card(p.note ? `${p.en} (${p.note})` : p.en))
      fireEvent.click(card(p.no))
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

  // Michael: "The flashcards question words game is not updating the best so
  // far score." The panel used to read the GameSet captured when the set was
  // opened, so the reload after the round had nowhere to land. It now reads
  // what the server said about the round it just recorded.
  it('celebrates a round that beat the previous best', async () => {
    postGameRound.mockResolvedValueOnce({
      mistakes: 0,
      seconds: 12,
      best: true,
      previous: { mistakes: 2, seconds: 40 },
    })

    await playThrough()

    await waitFor(() => expect(screen.getByText(/A new best/)).toBeTruthy())
    expect(screen.getByText(/beat 2 mistakes, 40s/)).toBeTruthy()
  })

  // `best` is true on a first round too -- it is the best there is. Saying
  // "a new best" for beating nothing would cheapen it everywhere else, so
  // the badge wants `previous` as well.
  it('does not celebrate the first round, which has beaten nothing', async () => {
    postGameRound.mockResolvedValueOnce({
      mistakes: 0,
      seconds: 12,
      best: true,
      previous: null,
    })

    await playThrough()

    await waitFor(() => expect(screen.getByText('Play again')).toBeTruthy())
    expect(screen.queryByText(/A new best/)).toBeNull()
  })

  it('shows the standing best when the round did not beat it', async () => {
    postGameRound.mockResolvedValueOnce({
      mistakes: 3,
      seconds: 80,
      best: false,
      previous: { mistakes: 0, seconds: 12 },
    })

    await playThrough()

    await waitFor(() => expect(screen.getByText(/best so far: no mistakes, 12s/)).toBeTruthy())
    expect(screen.queryByText(/A new best/)).toBeNull()
  })

  it('clears the celebration when the next round starts', async () => {
    postGameRound.mockResolvedValueOnce({
      mistakes: 0,
      seconds: 12,
      best: true,
      previous: { mistakes: 2, seconds: 40 },
    })
    await playThrough()
    await waitFor(() => expect(screen.getByText(/A new best/)).toBeTruthy())

    fireEvent.click(screen.getByText('Play again'))

    expect(screen.queryByText(/A new best/)).toBeNull()
  })

  // The one place the set's own best is still read: before the server has
  // answered, and if it never does.
  it("falls back to the set's best when the round cannot be recorded", async () => {
    sets = [{ ...QUESTION_WORDS, played: 4, best: { mistakes: 1, seconds: 30 } }]
    postGameRound.mockRejectedValueOnce(new Error('offline'))

    await playThrough()

    await waitFor(() => expect(screen.getByText(/best so far: 1 mistake, 30s/)).toBeTruthy())
  })

  // This path was never broken -- the set list always rendered from the
  // reloaded `sets`. Pinned anyway, because the fix moves the open set onto
  // that same array and the list must keep working off it.
  it('carries the new best back to the set list', async () => {
    postGameRound.mockImplementationOnce(async () => {
      sets = [{ ...QUESTION_WORDS, played: 1, best: { mistakes: 0, seconds: 12 } }]
      return { mistakes: 0, seconds: 12, best: true, previous: null }
    })
    await playThrough()
    await waitFor(() => expect(screen.getByText('Play again')).toBeTruthy())

    fireEvent.click(screen.getByText('Back to sets'))

    await waitFor(() => expect(screen.getByText(/played 1 time/)).toBeTruthy())
    expect(screen.getByText(/12s/)).toBeTruthy()
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
