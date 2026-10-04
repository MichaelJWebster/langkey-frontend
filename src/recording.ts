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
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
