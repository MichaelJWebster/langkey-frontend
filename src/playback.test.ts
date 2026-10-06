import { describe, expect, it } from 'vitest'
import { normalisationGain } from './playback'

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
