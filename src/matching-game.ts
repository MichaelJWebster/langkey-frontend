// Laying out a matching round.
//
// Michael asked for "the English words on cards on the left and their
// Norwegian equivalents on cards on the right - but not in the same order".
// That last clause is the whole requirement: two columns in the same order
// turn a matching game into reading straight across, so the shuffle has to
// guarantee a difference rather than merely be random and usually produce one.

export interface GamePair {
  en: string
  no: string
  /** Disambiguates where the English alone would not: "how long" is time. */
  note: string | null
}

export interface Card {
  /** The pair this card belongs to; two cards match when their keys agree. */
  key: number
  label: string
  note: string | null
  side: 'en' | 'no'
}

export interface Board {
  left: Card[]
  right: Card[]
}

/** Fisher-Yates over a copy. `rnd` is injectable so a test can be exact. */
export function shuffle<T>(items: T[], rnd: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Deal a set into two independently shuffled columns.
 *
 * The right column is reshuffled until no card sits opposite its own pair.
 * Requiring the *whole order* to differ would not be enough: one card left in
 * place still gives a free match, and with ten pairs that happens often.
 *
 * A single-pair set cannot avoid it, so it is returned as is rather than
 * looping forever.
 */
export function deal(pairs: GamePair[], rnd: () => number = Math.random): Board {
  const left = shuffle(
    pairs.map((p, key) => ({ key, label: p.en, note: p.note, side: 'en' as const })),
    rnd,
  )
  const rightCards = pairs.map((p, key) => ({
    key,
    label: p.no,
    note: p.note,
    side: 'no' as const,
  }))
  if (pairs.length < 2) return { left, right: rightCards }

  let right = shuffle(rightCards, rnd)
  for (let tries = 0; tries < 20 && alignedWith(left, right); tries++) {
    right = shuffle(rightCards, rnd)
  }
  if (alignedWith(left, right)) {
    // Twenty shuffles all aligned means `rnd` is degenerate (a test stub, or
    // a browser doing something strange). Rotating by one is guaranteed to
    // break every alignment rather than leaving the board readable straight
    // across, which is the thing that must not happen.
    right = [...right.slice(1), right[0]]
  }
  return { left, right }
}

/** Whether any card faces its own pair across the board. */
export function alignedWith(left: Card[], right: Card[]): boolean {
  return left.some((card, i) => right[i]?.key === card.key)
}

/** What a card should read: the word, plus its note when it has one. */
export function labelOf(card: Card): string {
  return card.note ? `${card.label} (${card.note})` : card.label
}
