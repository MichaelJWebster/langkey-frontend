// Plain-English explanations of the grammar words the Grammar section uses.
//
// Michael: *"including tooltips over terms like 'subject', 'verb', 'adverbial
// phrase' so they can be understood by people not familiar with grammar
// rules."* Each entry is [name, explanation, example]; the example is HTML so
// the word being explained can be highlighted with <em>.
//
// Exercise instructions from the backend mark terms up as [[key]] or
// [[key|label]]; the keys must match GRAMMAR_TERMS in the backend's
// app/content.py, which a test there checks against the content file.

export const TERMS: Record<string, [string, string, string]> = {
  subject: ['Subject', 'Who or what does the action. Ask “who?”', 'In <em>Jeg</em> spiser frokost, the subject is jeg.'],
  verb: ['Verb', 'The action or state word.', 'spiser (eats), bor (lives), er (is)'],
  finite: [
    'Conjugated verb',
    'The verb form that shows the time: spiser, spiste, vil, har. This is the verb that must stand second. The basic form (spise) doesn’t count.',
    'Jeg <em>vil</em> spise. Only vil counts.',
  ],
  object: ['Object', 'The person or thing the action is done to. Ask “what?” after the verb.', 'Jeg spiser <em>frokost</em>. Eat what? Frokost.'],
  adverbial: [
    'Adverbial phrase',
    'Words that say when, where or how. They can go at the end or at the front.',
    '<em>klokka sju</em>, <em>i dag</em>, <em>hjemme</em>, <em>i Oslo</em>',
  ],
  adverb: [
    'Adverb',
    'A small word that says how often, or not. In Norwegian it comes straight after the verb.',
    '<em>ofte</em> (often), <em>alltid</em> (always), <em>aldri</em> (never), <em>ikke</em> (not)',
  ],
  infinitive: [
    'Infinitive',
    'The basic form of a verb, as in the dictionary. After vil, kan, skal or må, the second verb takes this form.',
    'å <em>spise</em> · Jeg vil <em>spise</em>.',
  ],
  conjunction: [
    'Linking word',
    'A word that joins two sentences. It stands outside the count, so the sentence after it starts fresh.',
    '<em>og</em> (and), <em>men</em> (but), <em>eller</em> (or)',
  ],
  inversion: ['Inversion', 'The subject and verb swap places so that the verb stays second.', 'jeg spiser → <em>spiser jeg</em>'],
  slot: [
    'Slot 2 (V2)',
    'Count the parts of a sentence, not the words. Klokka sju is two words but one part, so spiser is still second.',
    '<em>Klokka sju</em> | <em>spiser</em> | jeg …',
  ],
  front: ['Front', 'The first part of the sentence. Only one part fits here: the subject, a time, a place or an object.', '<em>I dag</em> jobber jeg.'],
  rest: ['Rest', 'Everything after: the object, time, place and other details.', ''],
  noun: ['Noun', 'A word for a person, thing or place.', 'gutt, jente, hus'],
  pronoun: ['Pronoun', 'A short word that stands in for a noun.', 'Kari → <em>hun</em> · Kari → <em>henne</em>'],
  gender: ['Gender', 'Every Norwegian noun belongs to one of three groups: en, ei or et. The group decides the endings.', 'en gutt · ei jente · et hus'],
  definite: ['Definite form', 'The “the” form. Norwegian adds it as an ending.', 'gutt → <em>gutten</em> (the boy)'],
  plural: ['Plural', 'More than one.', 'en bil → to <em>biler</em>'],
  possessive: ['Possessive', 'A word that says who owns something.', '<em>min</em>, <em>din</em>, <em>hans</em>, <em>hennes</em>'],
  past: ['Past tense', 'Something that happened and is finished.', 'Jeg <em>spiste</em> i går.'],
  perfect: ['Perfect tense', 'har + verb. Something done, with a link to now.', 'Jeg <em>har spist</em>.'],
}

export type Segment = { text: string } | { term: string; label: string }

/** Split "Which part is the [[adverbial|adverbial phrase]]?" into text and terms.
 *  An unknown key is left as plain text rather than dropped, so a typo in the
 *  content shows up as visible brackets instead of a missing word. */
export function parseTerms(s: string): Segment[] {
  const out: Segment[] = []
  const re = /\[\[([a-z]+)(?:\|([^\]]+))?\]\]/g
  let at = 0
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > at) out.push({ text: s.slice(at, m.index) })
    const [whole, key, label] = m
    if (TERMS[key]) out.push({ term: key, label: label ?? TERMS[key][0].toLowerCase() })
    else out.push({ text: whole })
    at = m.index + whole.length
  }
  if (at < s.length) out.push({ text: s.slice(at) })
  return out
}
