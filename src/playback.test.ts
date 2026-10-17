import { describe, expect, it } from 'vitest'
import { DEFAULT_VOLUME, SEGMENT_PAD, masterGain, normalisationGain, segmentWindow } from './playback'

const RATE = 48_000

/** A burst of tone at a known RMS, with silence either side. */
function utterance(rmsDbfs: number, { leadSecs = 0.5, speechSecs = 2 } = {}): Float32Array {
  const amplitude = 10 ** (rmsDbfs / 20) * Math.SQRT2 // sine RMS = peak / sqrt(2)
  const lead = Math.round(RATE * leadSecs)
  const speech = Math.round(RATE * speechSecs)
  const out = new Float32Array(lead * 2 + speech)
  for (let i = 0; i < speech; i += 1) {
    out[lead + i] = amplitude * Math.sin((2 * Math.PI * 220 * i) / RATE)
  }
  return out
}

const dbfs = (x: number) => 20 * Math.log10(x)

describe('normalisationGain', () => {
  /** Where a clip recorded at `level` ends up after levelling. */
  const playedAt = (level: number) => level + dbfs(normalisationGain(utterance(level), RATE))

  it('levels a quiet take and a loud reference to within a decibel', () => {
    // The measured gap: Michael's speech sits near -20 dBFS, Piper's near -10.
    expect(Math.abs(playedAt(-20) - playedAt(-10))).toBeLessThan(1)
  })

  it('lands both of them on the target level', () => {
    expect(playedAt(-20)).toBeCloseTo(-18, 0)
    expect(playedAt(-10)).toBeCloseTo(-18, 0)
  })

  it('boosts the quiet one and cuts the loud one', () => {
    expect(normalisationGain(utterance(-28), RATE)).toBeGreaterThan(1)
    expect(normalisationGain(utterance(-10), RATE)).toBeLessThan(1)
  })

  it('ignores the silence around the speech', () => {
    // Otherwise a long run-up would make the same voice come back louder.
    const short = normalisationGain(utterance(-20, { leadSecs: 0.1 }), RATE)
    const long = normalisationGain(utterance(-20, { leadSecs: 3 }), RATE)
    expect(Math.abs(dbfs(short) - dbfs(long))).toBeLessThan(0.5)
  })

  it('leaves silence alone rather than amplifying the noise floor', () => {
    expect(normalisationGain(new Float32Array(RATE), RATE)).toBe(1)
  })

  it('clamps so nothing is made painfully loud or pumped up from nothing', () => {
    expect(normalisationGain(utterance(-70), RATE)).toBeLessThanOrEqual(8)
    expect(normalisationGain(utterance(-1), RATE)).toBeGreaterThanOrEqual(0.2)
  })

  it('survives a clip shorter than one measurement frame', () => {
    expect(normalisationGain(new Float32Array(10), RATE)).toBe(1)
  })
})

describe('masterGain', () => {
  it('puts the old maximum at the middle of the slider', () => {
    // Michael's requirement: 50% should sound like 100% used to.
    expect(masterGain(0.5)).toBeCloseTo(1, 6)
  })

  it('leaves real headroom above it', () => {
    expect(masterGain(1)).toBeCloseTo(3, 6)
    expect(dbfs(masterGain(1))).toBeCloseTo(9.54, 1)
  })

  it('starts at the middle', () => {
    expect(DEFAULT_VOLUME).toBe(0.5)
  })

  it('is silent at zero and rises all the way up', () => {
    expect(masterGain(0)).toBe(0)
    for (let v = 0.05; v <= 1; v += 0.05) {
      expect(masterGain(v)).toBeGreaterThan(masterGain(v - 0.05))
    }
  })
})

describe('segmentWindow', () => {
  it('pads a word a little either side, because alignment is to a 20 ms frame', () => {
    const w = segmentWindow(1.0, 1.5, 4.0)
    expect(w).toEqual({ offset: 1.0 - SEGMENT_PAD, duration: 0.5 + 2 * SEGMENT_PAD })
  })

  it('never runs off the start or the end of the clip', () => {
    expect(segmentWindow(0.01, 0.3, 4.0)!.offset).toBe(0)
    const tail = segmentWindow(3.8, 4.0, 4.0)!
    expect(tail.offset + tail.duration).toBeCloseTo(4.0)
  })

  it('refuses an empty or inverted span rather than playing a click', () => {
    expect(segmentWindow(1.0, 1.0, 4.0)).toBeNull()
    expect(segmentWindow(1.5, 1.0, 4.0)).toBeNull()
    expect(segmentWindow(1.0, 1.5, 0)).toBeNull()
  })
})
