// @vitest-environment jsdom
//
// The conversation screen: the list runs easiest first with later ones
// locked, and a thread walks each of the server's three decisions --
// accepted (the reply follows), choice (two chips), unclear (try again, or
// pick from the list). The server, the microphone and the audio are faked.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Conversation from './Conversation'
import type { ConversationStart, Dialogue, Line, Step, TurnResult } from './api'

const api = vi.hoisted(() => ({
  fetchDialogues: vi.fn(),
  startConversation: vi.fn(),
  sendTurn: vi.fn(),
  confirmTurn: vi.fn(),
}))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  ...api,
}))
vi.mock('./speech', () => ({
  speak: vi.fn(),
  speakToEnd: vi.fn(() => Promise.resolve(true)),
  stopSpeech: vi.fn(),
}))
vi.mock('./recording', () => ({
  canRecord: () => true,
  describeMicError: () => 'mic error',
  releaseTake: vi.fn(),
  startRecording: vi.fn(() =>
    Promise.resolve({
      stop: () =>
        Promise.resolve({ blob: new Blob(['x']), mimeType: 'audio/webm', durationMs: 900, url: 'blob:x', armMs: 0 }),
      cancel: vi.fn(),
    }),
  ),
}))

// jsdom has no layout; the thread scrolls itself into view.
Element.prototype.scrollTo = vi.fn()

const SPEEDS = [4, 3.4, 2.8, 2.2, 1.6].map((scale) => ({ scale, url: `/a/${scale}.wav` }))
const line = (text: string, en = 'gloss'): Line => ({ text, en, audio_url: '/a/x.wav', speeds: SPEEDS })

const ANSWERS = [
  { id: 'bra', text: 'Bra, takk. Og du?', en: 'Good, thanks.', universal: false },
  { id: 'trott', text: 'Jeg er litt trøtt.', en: "I'm a bit tired.", universal: false },
  { id: 'forstar-ikke', text: 'Jeg forstår ikke.', en: "I don't understand.", universal: true },
]

function dialogue(over: Partial<Dialogue>): Dialogue {
  return {
    slug: 'hei', title: 'Hei!', title_en: 'Hello!', blurb: 'Meet your neighbour.', level: 1,
    character: { name: 'Ingrid', role: 'your neighbour' }, turns_min: 5, turns_max: 5,
    finished: 0, unlocked: true, unlock_after: null, ...over,
  }
}

const START: ConversationStart = {
  id: 'c1',
  dialogue: dialogue({}),
  node: { id: 'hvordan', line: line('Hvordan har du det?', 'How are you?'), answers: ANSWERS },
  unclear: line('Unnskyld, jeg hørte ikke helt.'),
  choice: line('Unnskyld, hva sa du?'),
  offscript: line('Beklager, det forstod jeg ikke helt.'),
}

const NEXT_STEP: Step = {
  reply: line('Så bra!'),
  node: { id: 'fra', line: line('Hvor kommer du fra?'), answers: ANSWERS },
  repeat: false,
  finished: false,
}

function turn(over: Partial<TurnResult>): TurnResult {
  return { turn_id: 't1', decision: 'accepted', reason: '', transcript: null, picked: null, offered: [], step: null, ...over }
}

beforeEach(() => {
  api.fetchDialogues.mockResolvedValue([
    dialogue({}),
    dialogue({ slug: 'kafe', title: 'På kafé', level: 2, character: { name: 'Lars', role: 'a waiter' }, unlocked: false, unlock_after: 'Hei!' }),
  ])
  api.startConversation.mockResolvedValue(START)
  api.confirmTurn.mockResolvedValue(NEXT_STEP)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function openThread() {
  render(<Conversation onBack={() => undefined} />)
  fireEvent.click(await screen.findByText(/Ingrid · Hei!/))
  await screen.findByText('Hvordan har du det?')
  await waitFor(() => expect((screen.getByLabelText('Answer by voice') as HTMLButtonElement).disabled).toBe(false))
}

async function speak() {
  fireEvent.click(screen.getByLabelText('Answer by voice'))
  fireEvent.click(await screen.findByLabelText('Stop and send'))
}

describe('Conversation list', () => {
  it('runs easiest first, marks what is next, and locks the rest', async () => {
    render(<Conversation onBack={() => undefined} />)
    expect(await screen.findByText(/Ingrid · Hei!/)).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
    expect(screen.getByText(/Finish “Hei!” to open/)).toBeTruthy()
    expect(screen.getByText(/Lars · På kafé/).closest('button')?.disabled).toBe(true)
  })
})

describe('Conversation thread', () => {
  it('shows what you said and plays the reply and the next line when accepted', async () => {
    api.sendTurn.mockResolvedValue(
      turn({ decision: 'accepted', transcript: 'Bra takk og du', picked: ANSWERS[0], step: NEXT_STEP }),
    )
    await openThread()
    await speak()

    expect(await screen.findByText('Bra, takk. Og du?')).toBeTruthy()
    expect(await screen.findByText('Så bra!')).toBeTruthy()
    expect(await screen.findByText('Hvor kommer du fra?')).toBeTruthy()
    expect(api.sendTurn).toHaveBeenCalledWith('c1', expect.objectContaining({ mimeType: 'audio/webm' }))
  })

  it('offers the two close answers as chips, and a pick moves on', async () => {
    api.sendTurn.mockResolvedValue(
      turn({ decision: 'choice', transcript: 'Bra trøtt', picked: ANSWERS[0], offered: [ANSWERS[0], ANSWERS[1]] }),
    )
    await openThread()
    await speak()

    expect(await screen.findByText('Unnskyld, hva sa du?')).toBeTruthy()
    const chips = await screen.findByTestId('chips')
    fireEvent.click(await screen.findByRole('button', { name: 'Jeg er litt trøtt.' }))

    await waitFor(() =>
      expect(api.confirmTurn).toHaveBeenCalledWith('c1', 't1', { answer_id: 'trott', how: 'choice' }),
    )
    expect(await screen.findByText('Hvor kommer du fra?')).toBeTruthy()
    // In the order it happened: what was heard, the "sorry?", then the pick.
    const thread = screen.getByTestId('thread').textContent ?? ''
    const order = ['Bra trøtt', 'Unnskyld, hva sa du?', 'Jeg er litt trøtt.', 'Så bra!'].map((t) => thread.indexOf(t))
    expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]))).toBe(true)
    expect(chips.isConnected).toBe(false)
  })

  it('heard clearly but off-script: "didn\'t understand", not "didn\'t hear"', async () => {
    api.sendTurn.mockResolvedValue(
      turn({ decision: 'unclear', reason: 'transcript fits better', transcript: 'Jeg har en hund' }),
    )
    await openThread()
    await speak()

    expect(await screen.findByText('Beklager, det forstod jeg ikke helt.')).toBeTruthy()
    expect(screen.queryByText('Unnskyld, jeg hørte ikke helt.')).toBeNull()
  })

  it('when unclear, lets you try again or pick from every answer', async () => {
    api.sendTurn.mockResolvedValue(turn({ decision: 'unclear', reason: 'nothing heard', transcript: 'Jeg har en hund' }))
    await openThread()
    await speak()

    expect(await screen.findByText('Unnskyld, jeg hørte ikke helt.')).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Velg svaret ditt…' }))
    // The full list, the universal answers included.
    expect(await screen.findByRole('button', { name: 'Jeg forstår ikke.' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Bra, takk. Og du?' }))
    await waitFor(() =>
      expect(api.confirmTurn).toHaveBeenCalledWith('c1', 't1', { answer_id: 'bra', how: 'list' }),
    )
  })

  it('trying again confirms a retry and reopens the microphone', async () => {
    api.sendTurn.mockResolvedValue(turn({ decision: 'unclear', transcript: null }))
    api.confirmTurn.mockResolvedValue({ reply: null, node: null, repeat: false, finished: false })
    await openThread()
    await speak()

    fireEvent.click(await screen.findByRole('button', { name: /Prøv igjen/ }))
    await waitFor(() => expect(api.confirmTurn).toHaveBeenCalledWith('c1', 't1', { retry: true }))
    await waitFor(() => expect((screen.getByLabelText('Answer by voice') as HTMLButtonElement).disabled).toBe(false))
  })

  it('tapping an accepted answer offers a correction that relabels it', async () => {
    api.sendTurn.mockResolvedValue(turn({ decision: 'accepted', picked: ANSWERS[0], step: NEXT_STEP }))
    await openThread()
    await speak()

    fireEvent.click(await screen.findByRole('button', { name: 'Bra, takk. Og du?' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Jeg er litt trøtt.' }))
    await waitFor(() =>
      expect(api.confirmTurn).toHaveBeenCalledWith('c1', 't1', { answer_id: 'trott' }),
    )
    expect(await screen.findByRole('button', { name: 'Jeg er litt trøtt.' })).toBeTruthy()
  })

  it('a finished conversation offers the next one', async () => {
    api.sendTurn.mockResolvedValue(
      turn({ decision: 'accepted', picked: ANSWERS[0], step: { reply: line('Ha det!'), node: null, repeat: false, finished: true } }),
    )
    await openThread()
    await speak()

    expect(await screen.findByText(/Samtalen er ferdig/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next: På kafé' })).toBeTruthy()
  })
})
