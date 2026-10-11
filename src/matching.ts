// Answer checking shared by dictation and typed vocabulary recall.

export function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?…"'«»:;()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Norwegian diacritics flattened: å→a, ø→o, æ→ae.
 *
 * This no longer forgives anything. Writing "a" for "å" used to count as
 * nearly right; it is a mistake now that æ ø å have prominent buttons on
 * every screen that asks for Norwegian (ADR-040). Folding survives only to
 * *recognise* that shape of mistake, so the feedback can name the character
 * instead of marking the word wrong without saying why.
 */
export function fold(s: string): string {
  return s.replaceAll('å', 'a').replaceAll('ø', 'o').replaceAll('æ', 'ae')
}

/** True when the only thing wrong is a missing æ ø å. */
export function isDiacriticSlip(got: string, target: string): boolean {
  return got !== target && fold(got) === fold(target)
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
 * Credit for one word of a dictation: full marks only for the word as spelt,
 * otherwise spelling similarity, zeroed below half so an unrelated word earns
 * nothing.
 *
 * A missing å costs what any other wrong letter costs -- most of the word's
 * credit survives, but it is no longer free (ADR-040).
 */
export function wordCredit(got: string | undefined, target: string): number {
  if (!got) return 0
  if (got === target) return 1
  const sim = similarity(got, target)
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
export function gradeAnswer(
  translation: string,
  guess: string,
  /** Answers the learner has vouched for on this card; treated as exact. */
  alternatives: string[] = [],
): AnswerMark {
  // Both sides lose their optional openers, so "sorry" answers "I'm sorry".
  // Norwegian answers are compared as spelt: æ ø å are part of the word, and
  // the buttons under the box make them easy to type (ADR-040). A slip lands
  // as a near miss on its spelling similarity rather than as a free pass.
  const normalise = (s: string) => clean(s).replace(LEADERS, '').replace(FILLERS, '')
  const got = normalise(guess)

  for (const accepted of alternatives) {
    if (normalise(accepted) === got) return { verdict: 'exact', similarity: 1, best: accepted }
  }

  let best = { similarity: 0, best: translation }
  for (const accepted of acceptedAnswers(translation)) {
    const sim = similarity(normalise(accepted), got)
    if (sim > best.similarity) best = { similarity: sim, best: accepted }
  }

  // Short words are minimal pairs, not typos: one edit turns "bo" into "bok"
  // and "hun" into "han", so near-misses only count on longer answers.
  const shortest = Math.min(got.length, normalise(best.best).length)
  const nearMissAllowed = shortest >= 5
  const verdict: Verdict =
    best.similarity >= 0.95
      ? 'exact'
      : nearMissAllowed && best.similarity >= 0.7
        ? 'close'
        : 'wrong'
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
