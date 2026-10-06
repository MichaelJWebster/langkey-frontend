import { afterEach, describe, expect, it, vi } from 'vitest'
import { startRecording } from './recording'

// The microphone does not start when getUserMedia resolves. These fakes let a
// test hold the first sample back, which is the bug that lost 832-957 ms off
// the front of every take on 2026-10-06.

class FakeAnalyser {
  fftSize = 256
  constructor(private readonly live: () => boolean) {}
  getFloatTimeDomainData(buf: Float32Array) {
    buf.fill(this.live() ? 0.01 : 0)
  }
}

class FakeRecorder {
  static isTypeSupported = () => true
  state = 'recording'
  mimeType = 'audio/webm;codecs=opus'
  private listeners: Record<string, (e: unknown) => void> = {}
  constructor(public stream: unknown, public options?: unknown) {}
  addEventListener(name: string, fn: (e: unknown) => void) {
    this.listeners[name] = fn
  }
  start() {}
  stop() {
    this.state = 'inactive'
    this.listeners.dataavailable?.({ data: new Blob(['x']) })
    this.listeners.stop?.({})
  }
}

function install({ liveAfterMs = 0 }: { liveAfterMs?: number } = {}) {
  const stopped: string[] = []
  const stream = {
    getTracks: () => [{ stop: () => stopped.push('track') }],
  } as unknown as MediaStream
  const openedAt = Date.now()
  const constraints: MediaStreamConstraints[] = []

  vi.stubGlobal('MediaRecorder', FakeRecorder)
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: (c: MediaStreamConstraints) => {
        constraints.push(c)
        return Promise.resolve(stream)
      },
    },
  })
  vi.stubGlobal('AudioContext', class {
    state = 'running'
    resume = () => Promise.resolve()
    close = () => Promise.resolve()
    createAnalyser = () => new FakeAnalyser(() => Date.now() - openedAt >= liveAfterMs)
    createMediaStreamSource = () => ({ connect: () => undefined })
  })
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => setTimeout(fn, 4) as unknown as number)
  return { constraints, stopped }
}

afterEach(() => vi.unstubAllGlobals())

describe('startRecording', () => {
  it('asks for unprocessed audio', async () => {
    const { constraints } = install()
    await startRecording()
    expect(constraints[0].audio).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    })
  })

  it('does not resolve until the microphone delivers a sample', async () => {
    install({ liveAfterMs: 120 })
    const began = Date.now()
    const active = await startRecording()
    expect(Date.now() - began).toBeGreaterThanOrEqual(100)
    expect((await active.stop()).armMs).toBeGreaterThanOrEqual(100)
  })

  it('resolves straight away when the microphone is already live', async () => {
    install()
    const began = Date.now()
    await startRecording()
    expect(Date.now() - began).toBeLessThan(100)
  })

  it('releases the microphone when the take is finished', async () => {
    const { stopped } = install()
    const active = await startRecording()
    await active.stop()
    expect(stopped).toEqual(['track'])
  })
})
