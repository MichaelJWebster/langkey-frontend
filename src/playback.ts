// The output stage for every clip the app plays.
//
// Two jobs the <audio> element cannot do on its own. First, loudness: Piper
// speaks at about -10 dBFS and Michael records at about -20 to -28, so his own
// takes played back a third as loud as the reference he was comparing them to
// and he could not hear what differed. Each clip is measured once and
// levelled to a common target, which means boosting as well as cutting --
// HTMLAudioElement.volume only attenuates, so this runs through Web Audio.
// Second, a master volume, which the element has no equivalent of across the
// several players scattered through the app.
//
// Web Audio is not available everywhere (and Safari cannot decode webm), so
// every path falls back to a plain element at master volume rather than
// failing to play.

// v2: under the old key a stored 1 meant unity gain, and would now mean 3x.
const VOLUME_KEY = 'langkey.volume.v2'

// The slider is not the gain. Levelling every clip to TARGET_DBFS left the
// whole app quieter than Michael wants, so the slider's midpoint reproduces
// what used to be its maximum and the top half is new headroom: half gives
// unity, full gives 3x (about +9.5 dB). The curve below is the one that hits
// both of those exactly.
const GAIN_AT_FULL = 3
const VOLUME_CURVE = Math.log2(GAIN_AT_FULL)
export const DEFAULT_VOLUME = 0.5

/** Output gain for a slider position in 0..1. */
export function masterGain(position: number): number {
  if (position <= 0) return 0
  return (2 * position) ** VOLUME_CURVE
}

/** Where levelled speech lands. Chosen to leave headroom for the loudest
 *  Piper clips, which already peak near full scale. */
const TARGET_DBFS = -18
// Gain is clamped: a clip of near-silence must not be amplified into noise,
// and nothing should be made painfully loud.
const MIN_GAIN = 0.2
const MAX_GAIN = 8

type Listener = (volume: number) => void
const listeners = new Set<Listener>()

function readVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw === null) return DEFAULT_VOLUME
    const n = Number(raw)
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME // private window, or site data blocked
  }
}

let volume = readVolume()

export function getVolume(): number {
  return volume
}

export function setVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next))
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    /* the setting just does not survive the session */
  }
  if (master) master.gain.value = masterGain(volume)
  // The element fallback cannot exceed unity, so the top of the slider is
  // only reachable through Web Audio. Nothing breaks; it just stops there.
  if (element) element.volume = Math.min(1, masterGain(volume))
  listeners.forEach((l) => l(volume))
}

/** Subscribe to volume changes. Returns an unsubscribe function. */
export function onVolumeChange(listener: Listener): () => void {
  listeners.add(listener)
  listener(volume)
  return () => listeners.delete(listener)
}

// --- Web Audio graph ---------------------------------------------------------

let ctx: AudioContext | null = null
let master: GainNode | null = null

function audioContext(): AudioContext | null {
  if (ctx) return ctx
  const g = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }
  const Ctx = g.AudioContext ?? g.webkitAudioContext
  if (!Ctx) return null
  try {
    ctx = new Ctx()
    master = ctx.createGain()
    master.gain.value = masterGain(volume)
    // A safety limiter, not an effect. At the top of the slider a levelled
    // clip's peaks would otherwise pass full scale and crackle; this only
    // engages up there and leaves ordinary levels untouched.
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -2
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.1
    master.connect(limiter).connect(ctx.destination)
    return ctx
  } catch {
    return null
  }
}

/**
 * How much to scale this clip so its speech sits at TARGET_DBFS.
 *
 * Measured over the loud frames only: averaging the whole clip would let the
 * silence either side of a short sentence decide the level, so a take with a
 * long run-up would come back louder than the same voice without one.
 */
export function normalisationGain(channel: Float32Array, sampleRate: number): number {
  const frame = Math.max(1, Math.round(sampleRate * 0.02))
  const frames = Math.floor(channel.length / frame)
  if (frames === 0) return 1

  const rms = new Float32Array(frames)
  let loudest = 0
  for (let f = 0; f < frames; f += 1) {
    let sum = 0
    for (let i = f * frame; i < (f + 1) * frame; i += 1) sum += channel[i] * channel[i]
    rms[f] = Math.sqrt(sum / frame)
    if (rms[f] > loudest) loudest = rms[f]
  }
  if (loudest === 0) return 1

  // Everything within 25 dB of the loudest frame counts as speech.
  const floor = loudest * 10 ** (-25 / 20)
  let sum = 0
  let n = 0
  for (let f = 0; f < frames; f += 1) {
    if (rms[f] >= floor) {
      sum += rms[f] * rms[f]
      n += 1
    }
  }
  if (n === 0) return 1

  const speech = Math.sqrt(sum / n)
  const gain = 10 ** (TARGET_DBFS / 20) / speech
  return Math.min(MAX_GAIN, Math.max(MIN_GAIN, gain))
}

// --- playback ----------------------------------------------------------------

const gains = new Map<string, number>()

let source: AudioBufferSourceNode | null = null
let element: HTMLAudioElement | null = null
let elementUrl: string | null = null
let token = 0

export function stop(): void {
  token += 1 // abandon anything still decoding
  if (source) {
    try {
      source.onended = null
      source.stop()
    } catch {
      /* already finished */
    }
    source = null
  }
  if (element) {
    element.pause()
    element = null
  }
  if (elementUrl) {
    URL.revokeObjectURL(elementUrl)
    elementUrl = null
  }
}

function playThroughElement(blob: Blob, mine: number): Promise<void> {
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.volume = Math.min(1, masterGain(volume))
  element = audio
  elementUrl = url
  const done = () => {
    if (element === audio) {
      element = null
      elementUrl = null
    }
    URL.revokeObjectURL(url)
  }
  audio.addEventListener('ended', done)
  return audio.play().then(
    () => {
      if (mine !== token) {
        audio.pause()
        done()
      }
    },
    (err) => {
      done()
      throw err
    },
  )
}

/**
 * Play a clip, levelled against every other clip.
 *
 * `key` identifies the clip for the level cache — the source URL, so the same
 * clip is only measured once per session. Rejects if the browser refuses to
 * play, which is the caller's cue to report it.
 */
export async function play(blob: Blob, key: string): Promise<void> {
  stop()
  const mine = token
  const context = audioContext()
  if (!context || !master) return playThroughElement(blob, mine)

  let buffer: AudioBuffer
  try {
    if (context.state === 'suspended') await context.resume()
    buffer = await context.decodeAudioData(await blob.arrayBuffer())
  } catch {
    // Safari cannot decode webm/opus, and a truncated clip can fail here too.
    if (mine !== token) return
    return playThroughElement(blob, mine)
  }
  if (mine !== token) return

  let gain = gains.get(key)
  if (gain === undefined) {
    gain = normalisationGain(buffer.getChannelData(0), buffer.sampleRate)
    gains.set(key, gain)
  }

  const node = context.createBufferSource()
  node.buffer = buffer
  const level = context.createGain()
  level.gain.value = gain
  node.connect(level).connect(master)
  node.onended = () => {
    if (source === node) source = null
  }
  source = node
  node.start()
}

// --- cues ---------------------------------------------------------------------

/**
 * A short, low two-tone blip for a wrong answer.
 *
 * Through the same master gain as every clip, so the volume control governs it
 * and it cannot become the one loud thing in the app. Deliberately quiet and
 * low: it is a nudge while the learner is mid-sentence, not an alarm. Does
 * nothing where Web Audio is unavailable — a missing cue is not worth an error.
 */
export function wrongTone(): void {
  const context = audioContext()
  if (!context || !master) return
  try {
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    const gain = context.createGain()
    // Shaped rather than switched: a square-edged gate on a sine clicks.
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    gain.connect(master)

    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, now)
    osc.frequency.setValueAtTime(165, now + 0.09) // a step down reads as "no"
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + 0.2)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  } catch {
    /* no cue, no problem */
  }
}
