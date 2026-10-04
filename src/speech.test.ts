// @vitest-environment jsdom
//
// Regression cover for two faults seen in listening practice:
//   1. the exercise started and two clips played over each other;
//   2. choosing "very slow" sounded louder but not slower -- because the
//      normal-speed clip was still playing underneath the slow one.
//
// Both came from the same thing. Loading a clip is asynchronous, so between
// the request going out and the player existing there is nothing for
// stopSpeech() to stop, and two overlapping calls both reached play().

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAudioFailure, speak, stopSpeech } from './speech'

/** Every Audio the module creates, so the test can see what is playing. */
const players: FakeAudio[] = []

class FakeAudio {
  src: string
  playing = false
  playCount = 0
  constructor(src: string) {
    this.src = src
    players.push(this)
  }
  addEventListener() {}
  removeEventListener() {}
  async play() {
    this.playing = true
    this.playCount += 1
  }
  pause() {
    this.playing = false
  }
}

const nowPlaying = () => players.filter((p) => p.playing)

/** Resolve the fetch for `url` only when the test says so.
 *
 * One URL may be requested more than once (two speak() calls racing on mount),
 * so every request gets its own resolver and releasing a URL settles them all.
 */
function deferredFetch() {
  const pending = new Map<string, (() => void)[]>()
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string) =>
        new Promise((resolve) => {
          const waiting = pending.get(url) ?? []
          waiting.push(() => resolve(new Response(new Blob(['audio']), { status: 200 })))
          pending.set(url, waiting)
        }),
    ),
  )
  return {
    release: async (url: string) => {
      ;(pending.get(url) ?? []).forEach((resolve) => resolve())
      pending.delete(url)
      // let the awaits inside speak() settle
      await new Promise((r) => setTimeout(r, 0))
    },
  }
}

beforeEach(() => {
  players.length = 0
  stopSpeech()
  clearAudioFailure()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('Audio', FakeAudio)
  let n = 0
  vi.stubGlobal('URL', {
    createObjectURL: () => `blob:fake-${++n}`,
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('only one clip is ever audible', () => {
  it('does not stack two clips when speak() is called twice in a row', async () => {
    const f = deferredFetch()
    // Both start before either finishes loading -- the mount case, where
    // StrictMode invokes the autoplay effect twice.
    const a = speak('x', '/audio/one.wav')
    const b = speak('x', '/audio/one.wav')
    await f.release('/audio/one.wav')
    await Promise.all([a, b])

    expect(nowPlaying()).toHaveLength(1)
  })

  it('plays the newest clip, not the one that was already loading', async () => {
    const f = deferredFetch()
    const slowFirst = speak('x', '/audio/normal.wav')
    const thenFast = speak('x', '/audio/veryslow.wav')

    // The first request finishes last, so without a guard it would win.
    await f.release('/audio/veryslow.wav')
    await f.release('/audio/normal.wav')
    await Promise.all([slowFirst, thenFast])

    expect(nowPlaying()).toHaveLength(1)
    expect(nowPlaying()[0].src).toBe('blob:fake-1')
    // The abandoned one must never have been started at all.
    const abandoned = players.find((p) => p !== nowPlaying()[0])
    expect(abandoned?.playCount ?? 0).toBe(0)
  })

  it('choosing another speed replaces the clip rather than adding to it', async () => {
    const f = deferredFetch()
    const normal = speak('x', '/audio/normal.wav')
    await f.release('/audio/normal.wav')
    await normal
    expect(nowPlaying()).toHaveLength(1)

    const verySlow = speak('x', '/audio/veryslow.wav')
    await f.release('/audio/veryslow.wav')
    await verySlow

    // Exactly one, and it is the slow one: two at once is what made the old
    // build sound louder while still playing at normal speed.
    expect(nowPlaying()).toHaveLength(1)
    expect(players).toHaveLength(2)
    expect(players[0].playing).toBe(false)
  })

  it('pressing "very slow" while autoplay is still loading plays only the slow clip', async () => {
    // The reported case: the exercise opens, autoplay is still fetching, and
    // the learner immediately presses the slow chip. Both were landing, so it
    // sounded louder but still ran at normal speed.
    const f = deferredFetch()
    const autoplay = speak('x', '/audio/normal.wav')
    const chip = speak('x', '/audio/veryslow.wav')

    await f.release('/audio/normal.wav')
    await f.release('/audio/veryslow.wav')
    await Promise.all([autoplay, chip])

    expect(nowPlaying()).toHaveLength(1)
    // Only the slow clip was ever handed to a player.
    expect(players).toHaveLength(1)
  })

  it('stopSpeech() cancels a clip that is still loading', async () => {
    const f = deferredFetch()
    const pending = speak('x', '/audio/one.wav')
    stopSpeech()
    await f.release('/audio/one.wav')
    await pending

    expect(nowPlaying()).toHaveLength(0)
  })

  it('releases the blob of an abandoned clip', async () => {
    const f = deferredFetch()
    const pending = speak('x', '/audio/one.wav')
    stopSpeech()
    await f.release('/audio/one.wav')
    await pending

    // Abandoned before a player existed, so no object URL should linger.
    expect(players).toHaveLength(0)
  })
})
