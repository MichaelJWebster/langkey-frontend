// Marking a grammar answer.
//
// A grammar answer is near-unique, unlike a free translation, so a string
// comparison is a fair judge. Case, punctuation and spacing are ignored: they
// are not what the exercise is about, and "i dag jobber jeg" is as right as
// "I dag jobber jeg." Æ ø å are not ignored (ADR-040): a missing one is wrong,
// but it is reported as its own kind of wrong, because "it was only the
// letters" is worth being told.

export type GrammarVerdict = 'ok' | 'letters' | 'wrong'

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fold(s: string): string {
  return normalise(s).replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
}

export function checkGrammar(given: string, answers: string[]): GrammarVerdict {
  const g = normalise(given)
  if (answers.some((a) => normalise(a) === g)) return 'ok'
  const f = fold(given)
  if (answers.some((a) => fold(a) === f)) return 'letters'
  return 'wrong'
}
