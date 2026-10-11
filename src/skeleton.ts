// The shape of the sentence you are listening for: one underscore per letter,
// punctuation left standing, words filled in as you get them right.
//
//   Hva heter du?   ->   ___ _____ __?
//   after "Hva "    ->   Hva _____ __?
//
// Michael asked for this after pressing Hint believing he already had the
// whole phrase typed: with nothing on screen but his own input, there was no
// way to see how much sentence was still to come.
//
// The rule that matters is *when* a word is judged. A word gives no feedback
// at all while it is being typed -- no letters appearing, no early verdict --
// because judging a prefix means flashing an error at every learner who has
// not finished the word yet. Only a word the learner has moved past, or
// closed with a space, is complete and gets an answer.

import { clean, isDiacriticSlip } from './matching'

export type SlotState =
  | 'blank' // not yet earned: shown as underscores
  | 'filled' // typed correctly
  | 'slip' // wrong only in its æ ø å -- a mistake, but a nameable one
  | 'wrong' // a completed word that does not match

export type Slot = {
  word: string // the real word, original case and punctuation: "du?"
  shape: string // "__?"
  state: SlotState
}

export type Skeleton = {
  slots: Slot[]
  wrong: number // completed words that do not match their slot, slips included
  slips: number // of those, the ones that are only a missing æ ø å
  extra: number // completed words past the end of the sentence
}

/** One underscore per letter or digit; everything else stands as written, so
 *  punctuation stays visible as part of the shape. */
export function shapeOf(word: string): string {
  return [...word].map((ch) => (/[\p{L}\p{N}]/u.test(ch) ? '_' : ch)).join('')
}

/**
 * Split typed input into words, and say how many of them are complete.
 *
 * The last word is still being typed unless the input ends in whitespace --
 * that trailing space is the learner saying "done with that one". Everything
 * before it they have already moved past.
 */
export function typedWords(typed: string): { words: string[]; complete: number } {
  const words = typed.trim().split(/\s+/).filter(Boolean)
  const closed = /\s$/.test(typed)
  return { words, complete: closed ? words.length : Math.max(0, words.length - 1) }
}

/** Compare one typed word with its slot, by the same rule as checking. */
function verdict(got: string, want: string): SlotState {
  const a = clean(got)
  const b = clean(want)
  if (!a) return 'blank'
  if (a === b) return 'filled'
  // A missing å is a mistake like any other (ADR-040), but it is worth
  // telling apart so the feedback can point at the character.
  if (isDiacriticSlip(a, b)) return 'slip'
  return 'wrong'
}

/**
 * The skeleton for `target` given what has been `typed` so far.
 *
 * Positions are independent: a wrong third word does not hide a right fourth
 * one, and going back to fix the third fills it in without disturbing the
 * rest. Deriving it from the current input on every render is also what lets
 * the mistake indicator clear itself -- correcting the word is what clears
 * it, with no stored error to go stale.
 */
export function skeleton(target: string, typed: string): Skeleton {
  const targetWords = target.trim().split(/\s+/).filter(Boolean)
  const { words, complete } = typedWords(typed)

  let wrong = 0
  let slips = 0
  const slots = targetWords.map((word, i) => {
    const shape = shapeOf(word)
    if (i >= complete) return { word, shape, state: 'blank' as SlotState }
    const state = verdict(words[i], word)
    if (state === 'wrong' || state === 'slip') wrong += 1
    if (state === 'slip') slips += 1
    return { word, shape, state }
  })

  return { slots, wrong, slips, extra: Math.max(0, complete - targetWords.length) }
}

/** Whether the learner has a mistake standing right now. */
export function hasMistake(s: Skeleton): boolean {
  return s.wrong > 0 || s.extra > 0
}
