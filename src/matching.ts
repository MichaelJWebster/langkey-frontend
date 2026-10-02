// Answer checking shared by dictation and typed vocabulary recall.

export function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?…"'«»:;()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Norwegian diacritics folded: writing "a" for "å" is nearly right, never wrong. */
export function fold(s: string): string {
  return s.replaceAll('å', 'a').replaceAll('ø', 'o').replaceAll('æ', 'ae')
}

export function editDistance(a: string, b: string): number {
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

export function similarity(a: string, b: string): number {
  if (!a && !b) return 1
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest
}

/**
 * Credit for one word of a dictation: full marks when right (folded å/ø/æ
 * counts), otherwise spelling similarity, zeroed below half so an unrelated
 * word earns nothing.
 */
export function wordCredit(got: string | undefined, target: string): number {
  if (!got) return 0
  const a = fold(got)
  const b = fold(target)
  if (a === b) return 1
  const sim = similarity(a, b)
  return sim >= 0.5 ? sim : 0
}

// --- Vocabulary answers --------------------------------------------------------

// Leading words a learner may reasonably leave off: English articles and the
// infinitive marker, and their Norwegian counterparts.
const LEADERS = /^(to|a|an|the|å|en|ei|et)\s+/

// Sentence-y deck entries ("I'm sorry", "it is raining") are often answered
// with just the meaningful part, so these openers are optional on both sides.
const FILLERS = /^(im|i am|i|its|it is|it|thats|that is|there is|there are|jeg er|jeg|det er|det)\s+/

function stripParenthetical(s: string): string {
  return s.replace(/\([^)]*\)/g, ' ')
}

/**
 * Every spelling of a deck translation we accept, e.g. "a road, a way" yields
 * "a road", "road", "a way", "way"; "a bag (plastic/paper)" also yields the
 * form without its clarifier.
 */
export function acceptedAnswers(translation: string): string[] {
  const out = new Set<string>()
  for (const raw of [translation, stripParenthetical(translation)]) {
    for (const part of raw.split(/[,;]|\s\/\s/)) {
      const base = clean(part)
      if (!base) continue
      out.add(base)
      const trimmed = base.replace(LEADERS, '')
      if (trimmed) out.add(trimmed)
      // Slash alternatives inside one phrase: "plastic/paper".
      for (const alt of base.split('/')) {
        const a = clean(alt)
        if (a) out.add(a)
      }
    }
  }
  return [...out]
}

export type Verdict = 'exact' | 'close' | 'wrong'

export interface AnswerMark {
  verdict: Verdict
  similarity: number // 0..1 against the closest accepted answer
  best: string // the accepted answer the guess was closest to
}

/**
 * Grade a typed guess against a deck translation. Norwegian answers fold
 * diacritics so "a" for "å" still counts as exact.
 */
export function gradeAnswer(translation: string, guess: string, norwegian = false): AnswerMark {
  // Both sides lose their optional openers, so "sorry" answers "I'm sorry".
  const normalise = (s: string) =>
    (norwegian ? fold(clean(s)) : clean(s)).replace(LEADERS, '').replace(FILLERS, '')
  const got = normalise(guess)
  let best = { similarity: 0, best: translation }
  for (const accepted of acceptedAnswers(translation)) {
    const sim = similarity(normalise(accepted), got)
    if (sim > best.similarity) best = { similarity: sim, best: accepted }
  }
  const verdict: Verdict =
    best.similarity >= 0.95 ? 'exact' : best.similarity >= 0.7 ? 'close' : 'wrong'
  return { verdict, similarity: best.similarity, best: best.best }
}

/**
 * The FSRS rating a guess earns, replacing the manual Again/Hard/Good/Easy
 * buttons: a fast exact answer is Easy, an exact one Good, a near miss Hard,
 * anything else Again.
 */
export function ratingFor(mark: AnswerMark, elapsedMs: number): 1 | 2 | 3 | 4 {
  if (mark.verdict === 'exact') return elapsedMs < 6000 ? 4 : 3
  if (mark.verdict === 'close') return 2
  return 1
}
