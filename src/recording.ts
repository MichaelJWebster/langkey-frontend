// Microphone capture for the speaking cards (M3 step 1). No models involved:
// we record, store, and play back against the Piper reference.

// Browsers disagree on container: Chrome and Firefox do webm/opus, Safari
// does mp4/aac. Pick whatever the browser admits to supporting and send the
// type along so the server stores it accurately.
const PREFERRED = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

export function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return PREFERRED.find((t) => MediaRecorder.isTypeSupported?.(t))
}

export interface Take {
  blob: Blob
  mimeType: string
  durationMs: number
  url: string // object URL; call releaseTake when finished with it
  /** How long the microphone took to deliver its first sample, in ms. */
  armMs: number
}

// The microphone does not start the instant getUserMedia resolves. Chrome
// returns a live track while the audio device is still spinning up, and
// MediaRecorder happily records that silence -- measured on 2026-10-06, the
// first 832-957 ms of every take was missing, so the opening word never
// reached the file. Waiting for a sample to actually arrive costs a fraction
// of a second and is the difference between recording the sentence and
// recording the end of it.
const ARM_TIMEOUT_MS = 2500

/** Resolve once the track delivers a non-zero sample, or the timeout passes. */
async function waitForFirstSample(stream: MediaStream): Promise<number> {
  const g = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }
  const Ctx: typeof AudioContext | undefined = g.AudioContext ?? g.webkitAudioContext
  if (!Ctx) return 0 // no Web Audio: record immediately rather than not at all

  const ctx = new Ctx()
  const started = performance.now()
  try {
    if (ctx.state === 'suspended') await ctx.resume()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buf = new Float32Array(analyser.fftSize)

    // A device that has not started yet reads as exact zeros; one that has
    // reads as at least dither. Poll on frames so this yields to the browser.
    while (performance.now() - started < ARM_TIMEOUT_MS) {
      analyser.getFloatTimeDomainData(buf)
      if (buf.some((v) => v !== 0)) break
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  } catch {
    /* Arming is an optimisation; a failure here must not block recording. */
  } finally {
    void ctx.close().catch(() => undefined)
  }
  return performance.now() - started
}

export function releaseTake(take: Take | null): void {
  if (take) URL.revokeObjectURL(take.url)
}

/**
 * A single recording in progress. `stop()` resolves with the take and always
 * releases the microphone, so the browser's recording indicator goes away
 * even if the caller throws.
 */
export interface ActiveRecording {
  stop: () => Promise<Take>
  cancel: () => void
}

export async function startRecording(): Promise<ActiveRecording> {
  // Raw audio, deliberately. The browser's defaults are tuned for calls, not
  // for pronunciation: automatic gain overdrove one take to 1.03 peak while
  // leaving others at 0.33, and echo cancellation couples the input to
  // whatever the page just played -- which, since the reference clip is
  // played immediately before every take, is exactly the wrong moment.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
  })
  const armMs = await waitForFirstSample(stream)
  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  const startedAt = performance.now()

  recorder.addEventListener('dataavailable', (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  })
  recorder.start()

  const release = () => stream.getTracks().forEach((t) => t.stop())

  return {
    stop: () =>
      new Promise<Take>((resolve, reject) => {
        recorder.addEventListener('stop', () => {
          release()
          const type = recorder.mimeType || mimeType || 'audio/webm'
          const blob = new Blob(chunks, { type })
          if (blob.size === 0) {
            reject(new Error('Nothing was recorded'))
            return
          }
          resolve({
            blob,
            mimeType: type,
            durationMs: Math.round(performance.now() - startedAt),
            url: URL.createObjectURL(blob),
            armMs: Math.round(armMs),
          })
        })
        recorder.addEventListener('error', () => {
          release()
          reject(new Error('Recording failed'))
        })
        if (recorder.state !== 'inactive') recorder.stop()
        else release()
      }),
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.stop()
      release()
    },
  }
}

export function describeMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError') return 'Microphone blocked — allow access in the address bar.'
  if (name === 'NotFoundError') return 'No microphone found.'
  return err instanceof Error ? err.message : 'Could not start recording'
}
