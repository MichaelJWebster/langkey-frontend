// @vitest-environment jsdom
//
// Michael: "When I click the record button in the pronunciation exercises,
// I'd like the stop button to be exactly in the same spot, so I don't have to
// look for it with my mouse while saying the phrase."
//
// The row is centred, so the button holds still only if nothing beside it
// appears or disappears between press and stop. jsdom has no layout, so these
// pin the structure that guarantees it -- and a structural test has already
// been wrong once: the first fix put "speak now" on its own wrapped line,
// passed here, and still moved the button 27.8 px in the browser, because a
// wrapping inline-flex sizes to every item laid end to end. So the property
// pinned now is the stronger one: the row holds the button and the playback
// buttons and nothing else, and everything that changes during a take lives
// outside it. Measured in Chromium after the fix: 501.7 px at idle, opening
// mic, speak now, with a long error and with a 640 px panel beneath.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let savedTakes: { id: string }[] = []

vi.mock('./api', () => ({
  fetchRecordings: async () => savedTakes,
  recordingBlob: async () => new Blob(['earlier']),
  uploadRecording: async () => ({ id: 'new-take' }),
  transcribeRecording: async () => null,
}))

const stopRecording = vi.fn(async () => ({
  blob: new Blob(['take']),
  mimeType: 'audio/webm',
  durationMs: 1200,
  url: 'blob:take',
  armMs: 40,
}))
vi.mock('./recording', () => ({
  canRecord: () => true,
  describeMicError: () => 'mic error',
  releaseTake: () => {},
  startRecording: async () => ({ stop: stopRecording, cancel: () => {} }),
}))

vi.mock('./playback', () => ({
  play: async () => {},
  stop: () => {},
  canPlaySegments: () => false,
  playSegments: async () => {},
}))
vi.mock('./speech', () => ({
  speak: async () => {},
  stopSpeech: () => {},
  fetchClip: async () => null,
}))

import RecordButton from './RecordButton'

beforeEach(() => {
  savedTakes = []
  stopRecording.mockClear()
})
afterEach(cleanup)

const mic = () => screen.getByRole('button', { name: /Record yourself|Stop recording/ })

/** The row the mic sits in, as a list of what is laid out beside it. */
function rowShape(): string[] {
  const row = mic().parentElement!
  return [...row.children].map(
    (el) => el.getAttribute('data-testid') ?? el.getAttribute('aria-label')?.split(':')[0] ?? el.tagName,
  )
}

async function startTake() {
  await act(async () => {
    fireEvent.click(mic())
  })
  await waitFor(() => expect(screen.getByText('speak now')).toBeTruthy())
}

describe('the record button holds still', () => {
  it('lays out the same row before and during a take, with nothing to play yet', async () => {
    render(<RecordButton itemId={1} text="Om vinteren går vi på ski i marka." />)
    const before = rowShape()

    await startTake()

    // Same elements in the same order: nothing appeared or vanished beside
    // the button, so the centred row did not change width.
    expect(rowShape()).toEqual(before.map((x) => (x === 'Record yourself saying' ? 'Stop recording' : x)))
  })

  it('keeps the playback buttons in place, hidden, while recording over an earlier take', async () => {
    savedTakes = [{ id: 'earlier' }]
    render(<RecordButton itemId={1} text="Om vinteren går vi på ski i marka." />)
    await waitFor(() =>
      expect(screen.getByTestId('playback-buttons').className).not.toContain('invisible'),
    )
    const before = rowShape()

    await startTake()

    expect(rowShape().length).toBe(before.length)
    const playback = screen.getByTestId('playback-buttons')
    // Still laid out -- so still taking up its space -- but not visible, and
    // not clickable mid-take.
    expect(playback.className).toContain('invisible')
    for (const b of playback.querySelectorAll('button')) {
      expect((b as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('keeps "speak now" out of the button row altogether', async () => {
    render(<RecordButton itemId={1} text="Om vinteren går vi på ski i marka." />)
    await startTake()

    const status = screen.getByTestId('record-status')
    expect(status.textContent).toBe('speak now')
    const row = screen.getByTestId('record-row')
    expect(row.contains(status)).toBe(false)
    // The row is the button and the playback buttons, and nothing else.
    expect(rowShape()).toEqual(['Stop recording', 'playback-buttons'])
  })

  it('centres the row on its own, in a column', () => {
    render(<RecordButton itemId={1} text="Om vinteren går vi på ski i marka." />)
    const column = screen.getByTestId('record-row').parentElement!
    // flex-col + items-center: each child is centred independently, so a
    // wide status line or feedback panel beneath cannot shift the row. A
    // wrapping row here is exactly the layout that moved the button.
    expect(column.className).toContain('flex-col')
    expect(column.className).toContain('items-center')
    expect(column.className).not.toContain('flex-wrap')
  })

  it('stops from the same button that started it', async () => {
    render(<RecordButton itemId={1} text="Om vinteren går vi på ski i marka." />)
    const button = mic()
    await startTake()

    expect(mic()).toBe(button) // the same element, not a replacement elsewhere
    await act(async () => {
      fireEvent.click(button)
    })
    expect(stopRecording).toHaveBeenCalledTimes(1)
  })
})
