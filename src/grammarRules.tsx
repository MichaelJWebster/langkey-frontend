// The rule diagrams: one picture per grammar unit, keyed "topic/unit".
//
// Presentation, so it lives here rather than in the backend's content file,
// which holds what gets marked. Each rule has a headline, the full diagram for
// the pinned panel (or the phone's slide-in sheet), and a compact strip for the
// top of the phone screen. An exercise's `ref` names a `data-row` in its rule,
// which "See the rule" scrolls to and flashes.
//
// Every part of a sentence keeps one colour everywhere -- subject pink, verb
// teal, object sky, time and place indigo, adverb amber -- so a learner who
// has seen the subject turn up pink after the verb in one diagram recognises
// the same move in the next.

import type { ReactNode } from 'react'
import { Term } from './Term'

// --- Parts of a sentence -------------------------------------------------------

export type Role =
  | 'subject'
  | 'verb'
  | 'object'
  | 'time'
  | 'place'
  | 'adverb'
  | 'verb2'
  | 'conj'
  | 'front'
  | 'rest'

const ROLES: Record<Role, { term: string; label: string; text: string; border: string }> = {
  subject: { term: 'subject', label: 'Subject', text: 'text-pink-300', border: 'border-pink-300' },
  verb: { term: 'finite', label: 'Verb', text: 'text-teal-300', border: 'border-teal-300' },
  object: { term: 'object', label: 'Object', text: 'text-sky-300', border: 'border-sky-300' },
  time: { term: 'adverbial', label: 'Time', text: 'text-indigo-300', border: 'border-indigo-300' },
  place: { term: 'adverbial', label: 'Place', text: 'text-indigo-300', border: 'border-indigo-300' },
  adverb: { term: 'adverb', label: 'Adverb', text: 'text-amber-300', border: 'border-amber-300' },
  verb2: { term: 'infinitive', label: 'Verb 2', text: 'text-teal-200', border: 'border-teal-200' },
  conj: { term: 'conjunction', label: 'Linking word', text: 'text-slate-400', border: 'border-slate-400' },
  front: { term: 'front', label: 'Front', text: 'text-indigo-300', border: 'border-indigo-300' },
  rest: { term: 'rest', label: 'Rest', text: 'text-slate-300', border: 'border-slate-400' },
}

const VERB_WASH = 'bg-gradient-to-b from-teal-400/20 to-indigo-400/20'

/** A word coloured as the subject, for use inside a "rest" cell. */
const S = ({ children }: { children: ReactNode }) => (
  <span className="font-semibold text-pink-300">{children}</span>
)

type Cell = ReactNode | { node: ReactNode; role: Role; tag: string }
interface PatternRow {
  id: string
  w: Cell[]
  gloss?: string
}

function isTagged(c: Cell): c is { node: ReactNode; role: Role; tag: string } {
  return typeof c === 'object' && c !== null && 'role' in (c as object) && 'node' in (c as object)
}

/** One column per part of the sentence, headed by its role and its position.
 *  `compact` drops the glosses and the tooltips, for the phone's top strip,
 *  which is itself a button. */
export function Pattern({
  cols,
  rows,
  pos,
  compact,
}: {
  cols: Role[]
  rows: PatternRow[]
  pos?: number[]
  compact?: boolean
}) {
  const nums = pos ?? cols.map((_, i) => i + 1)
  return (
    <div className="overflow-x-auto">
      <div
        className={`grid overflow-hidden rounded-[10px] border border-white/10 ${compact ? 'text-[13px]' : 'text-sm'}`}
        style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(${compact ? 48 : 56}px, auto))` }}
      >
        {cols.map((role, i) => {
          const r = ROLES[role]
          const two = nums[i] === 2
          return (
            <div
              key={`h${i}`}
              className={`border-b-2 bg-white/[.04] leading-tight ${r.border} ${compact ? 'px-[7px] py-1' : 'px-2 py-1.5'}`}
            >
              <span className={`block text-[10.5px] tabular-nums ${two ? 'font-bold text-teal-300' : 'text-slate-500'}`}>
                {nums[i]}
                {two && ' · verb slot'}
              </span>
              <span className={`text-xs font-semibold ${r.text}`}>
                {compact ? r.label : <Term k={r.term}>{r.label}</Term>}
              </span>
            </div>
          )
        })}
        {rows.map((row, ri) => (
          <RowCells key={row.id} row={row} cols={cols} first={ri === 0} compact={compact} />
        ))}
      </div>
    </div>
  )
}

function RowCells({
  row,
  cols,
  first,
  compact,
}: {
  row: PatternRow
  cols: Role[]
  first: boolean
  compact?: boolean
}) {
  return (
    <>
      {row.w.map((cell, i) => {
        let role = cols[i]
        let node: ReactNode = cell as ReactNode
        let tag = ''
        if (isTagged(cell)) ({ node, role, tag } = cell)
        const r = ROLES[role]
        const empty = node === '' || node === null || node === undefined
        return (
          <div
            key={i}
            data-row={row.id}
            className={`break-words ${first ? '' : 'border-t border-white/5'} ${compact ? 'px-[7px] py-1.5' : 'p-2'} ${
              role === 'verb' ? `${VERB_WASH} font-bold text-slate-100` : `${r.text} font-medium`
            } ${role === 'subject' ? 'font-bold' : ''}`}
          >
            {empty ? <span className="text-slate-500">·</span> : node}
            {tag && <span className="mt-px block text-[10.5px] font-medium text-slate-500">{tag}</span>}
          </div>
        )
      })}
      {row.gloss && !compact && (
        <div data-row={row.id} className="col-span-full px-2 pb-2 text-xs text-slate-500">
          {row.gloss}
        </div>
      )}
    </>
  )
}

/** The same sentence in two orders, as coloured word chips, to show what moved. */
function Compare({ rows, caption }: { rows: { label: string; toks: [string, Role][] }[]; caption?: string }) {
  return (
    <>
      <div className="grid gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap items-center gap-[5px]">
            <span className="w-full text-[11px] text-slate-500">{r.label}</span>
            {r.toks.map(([w, role], i) => (
              <span
                key={i}
                className={`rounded-lg border px-2 py-0.5 text-[13.5px] ${
                  role === 'verb'
                    ? `${VERB_WASH} border-teal-300/50 font-bold text-slate-100`
                    : `${ROLES[role].text} ${ROLES[role].border} border-opacity-50 font-medium`
                }`}
                style={role === 'verb' ? undefined : { borderColor: 'color-mix(in srgb, currentColor 55%, transparent)' }}
              >
                {w}
              </span>
            ))}
          </div>
        ))}
      </div>
      {caption && <p className="mt-1 text-[12.5px] text-slate-400">{caption}</p>}
    </>
  )
}

// --- Shared bits of the diagrams ---------------------------------------------

const Lead = ({ children }: { children: ReactNode }) => (
  <p className="mb-3 max-w-prose text-sm text-slate-300 [&_b]:text-slate-100">{children}</p>
)
const Heading = ({ children }: { children: ReactNode }) => (
  <div className="mb-2 mt-[18px] flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400 first:mt-0">
    {children}
  </div>
)
const Note = ({ children, row }: { children: ReactNode; row?: string }) => (
  <p data-row={row} className="mt-2.5 max-w-prose text-[12.5px] text-slate-400 [&_b]:text-slate-300">
    {children}
  </p>
)
const Level = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full border border-amber-300/50 px-1.5 text-[10px] normal-case tracking-normal text-amber-300">
    {children}
  </span>
)
function Legend({ items }: { items: [Role, string][] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-slate-400">
      {items.map(([role, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-sm bg-current ${ROLES[role].text}`} />
          {label}
        </span>
      ))}
    </div>
  )
}
const Box = ({ children, row }: { children: ReactNode; row?: string }) => (
  <div data-row={row} className="rounded-[10px] border border-white/10 px-2.5 py-2 text-[13px]">
    {children}
  </div>
)
const BoxLabel = ({ children }: { children: ReactNode }) => (
  <div className="mb-0.5 text-[11px] text-slate-400">{children}</div>
)
const tableBox = 'overflow-hidden rounded-[10px] border border-white/10 text-[13px]'
const th = 'bg-white/[.04] px-2 py-1.5 text-[11px] text-slate-400'
const td = 'border-t border-white/5 px-2 py-1.5'

// --- The six-slot sentence chart, for Questions and Negation -----------------

const HEADS: [string, string][] = [
  ['front', 'Front'],
  ['finite', 'Verb'],
  ['subject', 'Subject'],
  ['adverb', 'ikke'],
  ['infinitive', 'Verb 2'],
  ['rest', 'Rest'],
]
type SlotStyle = 'front' | 'subj' | 'neg'
const SLOT_STYLE: Record<SlotStyle, string> = {
  front: 'text-indigo-300',
  subj: 'font-semibold text-pink-300',
  neg: 'font-semibold text-amber-300',
}

function Schema({
  rows,
  hiCol,
}: {
  rows: { id: string; cells: string[]; style?: Partial<Record<number, SlotStyle>>; gloss: string }[]
  hiCol?: number
}) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[320px] overflow-hidden rounded-[10px] border border-white/10 text-[13px]"
        style={{ gridTemplateColumns: '1.1fr .95fr .85fr .75fr .75fr 1.1fr' }}
      >
        {HEADS.map(([term, label], i) => (
          <div key={label} className="border-b border-white/10 bg-white/[.04] px-1.5 py-1.5 text-[11px] font-semibold leading-tight text-slate-300">
            {i === 1 && <span className="text-teal-300">2 · </span>}
            <Term k={term}>{label}</Term>
          </div>
        ))}
        {rows.map((r) => (
          <SchemaRow key={r.id} row={r} hiCol={hiCol} />
        ))}
      </div>
    </div>
  )
}

function SchemaRow({
  row,
  hiCol,
}: {
  row: { id: string; cells: string[]; style?: Partial<Record<number, SlotStyle>>; gloss: string }
  hiCol?: number
}) {
  return (
    <>
      {row.cells.map((c, i) => (
        <div
          key={i}
          data-row={row.id}
          className={`min-h-[34px] break-words border-t border-white/5 px-1.5 py-[7px] ${
            i === 1 ? `${VERB_WASH} font-semibold text-slate-100` : i === hiCol ? 'bg-amber-300/[.07]' : ''
          } ${row.style?.[i] ? SLOT_STYLE[row.style[i]!] : ''}`}
        >
          {c || <span className="text-slate-500">·</span>}
        </div>
      ))}
      <div data-row={row.id} className="col-span-full px-1.5 pb-[7px] text-[11.5px] text-slate-500">
        {row.gloss}
      </div>
    </>
  )
}

// --- The rules ----------------------------------------------------------------

export interface Rule {
  headline: string
  /** The full diagram, for the pinned panel or the slide-in sheet. */
  body: ReactNode
  /** A small version for the top of the phone screen and the unit's menu card. */
  mini: ReactNode
  /** The diagram for the unit's card on its topic menu, when it has one. */
  card?: ReactNode
}

const P = {
  subj: { cols: ['subject', 'verb', 'object', 'time'] as Role[], rows: [{ id: 'p', w: ['Jeg', 'spiser', 'frokost', 'klokka sju.'], gloss: 'I eat breakfast at seven.' }] },
  adv: { cols: ['subject', 'verb', 'adverb', 'object'] as Role[], rows: [{ id: 'p', w: ['Jeg', 'drikker', 'alltid', 'kaffe.'], gloss: 'I always drink coffee.' }] },
  time: { cols: ['time', 'verb', 'subject', 'object'] as Role[], rows: [{ id: 'p', w: ['Klokka sju', 'spiser', 'jeg', 'frokost.'], gloss: 'At seven I eat breakfast.' }] },
  place: { cols: ['place', 'verb', 'subject', 'rest'] as Role[], rows: [{ id: 'p', w: ['I Bergen', 'regner', 'det', 'mye.'], gloss: 'In Bergen it rains a lot.' }] },
  two1: { cols: ['subject', 'verb', 'verb2', 'object'] as Role[], rows: [{ id: 'p', w: ['Jeg', 'vil', 'se', 'en film.'], gloss: 'I want to watch a film.' }] },
  two2: { cols: ['time', 'verb', 'subject', 'verb2', 'object'] as Role[], rows: [{ id: 'p2', w: ['I kveld', 'vil', 'jeg', 'se', 'en film.'], gloss: 'Tonight I want to watch a film.' }] },
  obj: {
    cols: ['object', 'verb', 'subject', 'rest'] as Role[],
    rows: [
      { id: 'p', w: ['Fisk', 'spiser', 'vi', 'på fredag.'], gloss: 'Fish we eat on Fridays.' },
      { id: 'p3', w: ['Kaffe', 'liker', 'jeg', 'ikke.'], gloss: 'Coffee I don’t like.' },
    ],
  },
  conj: { cols: ['conj', 'subject', 'verb', 'rest'] as Role[], pos: [0, 1, 2, 3], rows: [{ id: 'p', w: ['men', 'jeg', 'jobber', 'i dag.'], gloss: '…but I’m working today.' }] },
  mix: {
    cols: ['front', 'verb', 'rest'] as Role[],
    rows: [
      { id: 'subj', w: [{ node: 'Jeg', role: 'subject', tag: 'subject' }, 'spiser', 'frokost klokka sju.'] },
      { id: 'time', w: [{ node: 'Klokka sju', role: 'time', tag: 'time' }, 'spiser', <><S>jeg</S> frokost.</>] },
      { id: 'place', w: [{ node: 'Hjemme', role: 'place', tag: 'place' }, 'jobber', <><S>hun</S>.</>] },
      { id: 'two', w: [{ node: 'I kveld', role: 'time', tag: 'time' }, 'vil', <><S>jeg</S> se en film.</>] },
      { id: 'obj', w: [{ node: 'Fisk', role: 'object', tag: 'object' }, 'spiser', <><S>vi</S> på fredag.</>] },
    ] as PatternRow[],
  },
}

const lastRow = (p: { cols: Role[]; rows: PatternRow[]; pos?: number[] }) => ({ ...p, rows: p.rows.slice(-1) })

function v2(p: { cols: Role[]; rows: PatternRow[]; pos?: number[] }) {
  return {
    mini: <Pattern {...lastRow(p)} compact />,
    card: <Pattern {...lastRow(p)} />,
  }
}

export const V2_INTRO = (
  <>
    In a Norwegian main sentence the <Term k="finite">verb</Term> is always the{' '}
    <Term k="slot">second part</Term>. Start with the basic order, then learn what happens when
    something else comes first.
  </>
)

export const RULES: Record<string, Rule> = {
  'v2/subj': {
    headline: 'Subject, then verb, then the rest',
    ...v2(P.subj),
    body: (
      <>
        <Lead>
          Most sentences start with the <Term k="subject" />: the person or thing doing the action.
          Next comes the <Term k="finite">verb</Term>, then the <Term k="object" />, then details like
          time and place.
        </Lead>
        <Pattern {...P.subj} />
        <Note>
          <b>Spot the subject:</b> ask “who is doing it?” Jeg spiser frokost: who eats? <b>jeg</b>.
          What is eaten? <b>frokost</b>, the object.
        </Note>
      </>
    ),
  },
  'v2/adv': {
    headline: 'The adverb comes straight after the verb',
    ...v2(P.adv),
    body: (
      <>
        <Lead>
          Small <Term k="adverb">adverbs</Term> like <b>ofte</b> (often), <b>alltid</b> (always),{' '}
          <b>aldri</b> (never) and <b>også</b> (also) go right after the verb. English puts them
          before the verb; Norwegian doesn’t.
        </Lead>
        <Pattern {...P.adv} />
        <Heading>English vs Norwegian</Heading>
        <Compare
          rows={[
            { label: 'English', toks: [['I', 'subject'], ['always', 'adverb'], ['drink', 'verb'], ['coffee', 'object']] },
            { label: 'Norwegian', toks: [['Jeg', 'subject'], ['drikker', 'verb'], ['alltid', 'adverb'], ['kaffe', 'object']] },
          ]}
          caption="The verb keeps its place in slot 2. The adverb follows it."
        />
        <Note>
          This is the same place where <b>ikke</b> (not) goes, so learning this makes negation easy
          later.
        </Note>
      </>
    ),
  },
  'v2/time': {
    headline: 'Time in front, so the subject moves behind the verb',
    ...v2(P.time),
    body: (
      <>
        <Lead>
          You can start with a time <Term k="adverbial">adverbial phrase</Term> like <b>i dag</b>,{' '}
          <b>i morgen</b> or <b>klokka sju</b>. The verb must still be <Term k="slot">second</Term>.
          There’s only room for one part before it, so the subject moves behind the verb. This swap
          is called <Term k="inversion" />.
        </Lead>
        <Pattern {...P.time} />
        <Heading>What moves</Heading>
        <Compare
          rows={[
            { label: 'Subject first', toks: [['Jeg', 'subject'], ['spiser', 'verb'], ['frokost', 'object'], ['klokka sju', 'time']] },
            { label: 'Time first', toks: [['Klokka sju', 'time'], ['spiser', 'verb'], ['jeg', 'subject'], ['frokost', 'object']] },
          ]}
          caption="Klokka sju moves to the front. spiser stays second, so jeg goes after it."
        />
        <Note>
          <b>Count parts, not words.</b> Klokka sju is two words but one part.
        </Note>
      </>
    ),
  },
  'v2/place': {
    headline: 'Place in front, so the subject moves behind the verb',
    ...v2(P.place),
    body: (
      <>
        <Lead>
          A place <Term k="adverbial">adverbial phrase</Term> like <b>hjemme</b>, <b>i Oslo</b> or{' '}
          <b>på jobben</b> works the same way as a time. It takes the front, the verb stays second,
          and the subject moves behind the verb.
        </Lead>
        <Pattern {...P.place} />
        <Heading>What moves</Heading>
        <Compare
          rows={[
            { label: 'Subject first', toks: [['Hun', 'subject'], ['jobber', 'verb'], ['hjemme', 'place']] },
            { label: 'Place first', toks: [['Hjemme', 'place'], ['jobber', 'verb'], ['hun', 'subject']] },
          ]}
        />
        <Note>
          <b>det counts as a subject.</b> Det regner (it rains) → I Bergen regner <b>det</b>.
        </Note>
      </>
    ),
  },
  'v2/two': {
    headline: 'Only the conjugated verb goes in slot 2',
    ...v2(P.two2),
    body: (
      <>
        <Lead>
          With two verbs, only the <Term k="finite">conjugated verb</Term> (<b>vil, kan, skal, må, har</b>)
          goes in slot 2. The second verb is an <Term k="infinitive" /> and waits further back.
        </Lead>
        <div className="grid gap-2">
          <Pattern {...P.two1} />
          <Pattern {...P.two2} />
        </div>
        <Note>
          When something else is in front, the subject squeezes in between the two verbs: I kveld{' '}
          <b>vil</b> jeg <b>se</b> en film.
        </Note>
        <Note>
          <b>The second verb has no -r:</b> Jeg vil kjøpe, not Jeg vil kjøper.
        </Note>
      </>
    ),
  },
  'v2/obj': {
    headline: 'Object in front, verb second, subject after',
    ...v2(P.obj),
    body: (
      <>
        <Lead>
          To stress the thing you’re talking about, put the <Term k="object" /> first. It’s less
          common, but the rule doesn’t change: verb second, subject straight after.
        </Lead>
        <Pattern {...P.obj} />
        <Heading>What moves</Heading>
        <Compare
          rows={[
            { label: 'Subject first', toks: [['Vi', 'subject'], ['spiser', 'verb'], ['fisk', 'object'], ['på fredag', 'time']] },
            { label: 'Object first', toks: [['Fisk', 'object'], ['spiser', 'verb'], ['vi', 'subject'], ['på fredag', 'time']] },
          ]}
        />
        <Note>
          <b>Careful:</b> the first word is not always the subject. In Pizza elsker barna, the
          children love pizza.
        </Note>
      </>
    ),
  },
  'v2/conj': {
    headline: 'Linking words stand outside the count',
    ...v2(P.conj),
    body: (
      <>
        <Lead>
          The <Term k="conjunction">linking words</Term> <b>og</b> (and), <b>men</b> (but) and{' '}
          <b>eller</b> (or) join two sentences. They don’t take a slot, so the sentence after them
          starts fresh, usually with the subject.
        </Lead>
        <Pattern {...P.conj} />
        <Heading>Compare</Heading>
        <Compare
          rows={[
            { label: 'Time word: swap', toks: [['I dag', 'time'], ['jobber', 'verb'], ['jeg', 'subject']] },
            { label: 'Linking word: no swap', toks: [['men', 'conj'], ['jeg', 'subject'], ['jobber', 'verb'], ['i dag', 'time']] },
          ]}
          caption="men sits in slot 0. jeg is slot 1, jobber is still slot 2."
        />
      </>
    ),
  },
  'v2/mix': {
    headline: 'One part in front, the verb always second',
    mini: <Pattern cols={P.mix.cols} rows={[P.mix.rows[1]]} compact />,
    card: <Pattern cols={P.mix.cols} rows={[P.mix.rows[1]]} />,
    body: (
      <>
        <Lead>
          Whatever goes <Term k="front">in front</Term>, the <Term k="finite">verb</Term> comes{' '}
          <Term k="slot">second</Term>. If the front isn’t the <Term k="subject" />, the subject
          follows the verb.
        </Lead>
        <Pattern {...P.mix} />
        <Legend items={[['subject', 'subject'], ['verb', 'verb, slot 2'], ['time', 'time or place'], ['object', 'object']]} />
        <Note>
          <b>og, men, eller</b> don’t count: …men <S>jeg</S> jobber i dag.
        </Note>
      </>
    ),
  },

  'q/main': {
    headline: 'Leave the front empty: verb first',
    mini: <Pattern cols={['verb', 'subject', 'rest']} rows={[{ id: 'm', w: ['Snakker', 'du', 'norsk?'] }]} compact />,
    body: (
      <>
        <Lead>
          A yes/no question has <b>nothing in the <Term k="front" /></b>. The{' '}
          <Term k="finite">verb</Term> comes first and the <Term k="subject" /> follows. Only the
          conjugated verb moves; a second verb stays where it was.
        </Lead>
        <Schema
          hiCol={0}
          rows={[
            { id: 'q-basic', cells: ['', 'Snakker', 'du', '', '', 'norsk?'], style: { 2: 'subj' }, gloss: 'Do you speak Norwegian?' },
            { id: 'q-modal', cells: ['', 'Kan', 'du', '', 'hjelpe', 'meg?'], style: { 2: 'subj' }, gloss: 'Can you help me?' },
            { id: 'q-perf', cells: ['', 'Har', 'du', '', 'spist', 'frokost?'], style: { 2: 'subj' }, gloss: 'Have you eaten breakfast?' },
            { id: 'q-wh', cells: ['Hvor', 'bor', 'du?', '', '', ''], style: { 0: 'front', 2: 'subj' }, gloss: 'Where do you live? A question word fills the front, so V2 again.' },
          ]}
        />
        <Legend items={[['verb', 'verb'], ['subject', 'subject'], ['front', 'question word']]} />
        <Heading>Ja, nei or jo?</Heading>
        <div data-row="q-jo" className={`grid grid-cols-[auto_1fr_1fr] ${tableBox}`}>
          <div className={th}>Question</div>
          <div className={th}>Means yes</div>
          <div className={th}>Means no</div>
          <div className={`${td} text-slate-300`}>Snakker du norsk?</div>
          <div className={`${td} font-bold text-emerald-300`}>Ja</div>
          <div className={`${td} font-bold text-rose-300`}>Nei</div>
          <div className={`${td} text-slate-300`}>
            Snakker du <span className="text-amber-300">ikke</span> norsk?
          </div>
          <div className={`${td} font-bold text-amber-300`}>Jo</div>
          <div className={`${td} font-bold text-rose-300`}>Nei</div>
        </div>
        <Note>
          <b>Jo</b> contradicts a negative question: “Don’t you speak Norwegian?” “Yes I do!”
        </Note>
      </>
    ),
  },

  'neg/main': {
    headline: 'ikke goes right after the conjugated verb',
    mini: <Pattern cols={['subject', 'verb', 'adverb', 'rest']} rows={[{ id: 'm', w: ['Jeg', 'kommer', 'ikke', 'i dag.'] }]} compact />,
    body: (
      <>
        <Lead>
          In a main sentence <b>ikke</b> comes after the <Term k="finite">conjugated verb</Term>. If
          the <Term k="subject" /> has moved behind the verb, ikke comes after the subject. A second
          verb comes after ikke.
        </Lead>
        <Schema
          hiCol={3}
          rows={[
            { id: 'neg-basic', cells: ['Jeg', 'kommer', '', 'ikke', '', 'i dag.'], style: { 0: 'subj', 3: 'neg' }, gloss: 'I’m not coming today.' },
            { id: 'neg-obj', cells: ['Hun', 'liker', '', 'ikke', '', 'kaffe.'], style: { 0: 'subj', 3: 'neg' }, gloss: 'She doesn’t like coffee.' },
            { id: 'neg-perf', cells: ['Jeg', 'har', '', 'ikke', 'spist.', ''], style: { 0: 'subj', 3: 'neg' }, gloss: 'I haven’t eaten.' },
            { id: 'neg-inv', cells: ['I dag', 'jobber', 'jeg', 'ikke.', '', ''], style: { 0: 'front', 2: 'subj', 3: 'neg' }, gloss: 'Today I’m not working.' },
            { id: 'neg-q', cells: ['', 'Snakker', 'du', 'ikke', '', 'norsk?'], style: { 2: 'subj', 3: 'neg' }, gloss: 'Don’t you speak Norwegian?' },
          ]}
        />
        <Legend items={[['verb', 'verb'], ['adverb', 'ikke'], ['subject', 'subject, wherever it is']]} />
        <Heading>
          Pronoun or noun? <Level>tier 2</Level>
        </Heading>
        <div data-row="neg-pron" className="grid gap-2 sm:grid-cols-2">
          <Box>
            <BoxLabel>
              Small <Term k="pronoun" />: before ikke
            </BoxLabel>
            Jeg kjenner <span className="font-semibold text-pink-300">ham</span>{' '}
            <span className="font-semibold text-amber-300">ikke</span>.
          </Box>
          <Box>
            <BoxLabel>
              <Term k="noun">Noun</Term>: after ikke
            </BoxLabel>
            Jeg kjenner <span className="font-semibold text-amber-300">ikke</span>{' '}
            <span className="font-semibold text-pink-300">mannen</span>.
          </Box>
        </div>
        <Heading>
          After at, fordi, hvis, når <Level>A2</Level>
        </Heading>
        <Box row="neg-sub">
          <BoxLabel>ikke jumps in front of the verb</BoxLabel>… fordi jeg{' '}
          <span className="font-semibold text-amber-300">ikke</span> <b className="text-teal-300">har</b> tid.
        </Box>
      </>
    ),
  },

  'noun/main': {
    headline: 'en · ei · et, and the ending does the work',
    mini: <MiniText>en gutt · gutten · gutter · guttene</MiniText>,
    body: <NounBody />,
  },

  'tense/main': {
    headline: 'Four forms take you from yesterday to tomorrow',
    mini: <MiniText>spiste ← spiser → skal spise · har spist</MiniText>,
    body: <TenseBody />,
  },

  'pron/main': {
    headline: 'Pronouns change shape; possessives match the thing',
    mini: <MiniText>jeg → meg · bilen min · dette huset</MiniText>,
    body: <PronounBody />,
  },
}

function MiniText({ children }: { children: ReactNode }) {
  return <div className="px-0.5 pb-1 text-sm font-semibold">{children}</div>
}

// --- Nouns ----------------------------------------------------------------------

const GENDER = {
  en: { text: 'text-teal-300' },
  ei: { text: 'text-pink-300' },
  et: { text: 'text-indigo-300' },
}

function NounRow({ id, g, forms }: { id: string; g: 'en' | 'ei' | 'et'; forms: [string, string][] }) {
  const tone = GENDER[g].text
  return (
    <>
      <div data-row={id} className={`${td} flex items-center justify-center text-xs font-bold ${tone}`}>
        {g}
      </div>
      {forms.map(([stem, ending], i) => (
        <div key={i} data-row={id} className={td}>
          {stem}
          {ending === '' ? null : ending === '-' ? (
            <span className="text-[11px] text-slate-500"> (no ending)</span>
          ) : (
            <span className={`font-bold ${tone}`}>{ending}</span>
          )}
        </div>
      ))}
    </>
  )
}

function NounBody() {
  return (
    <>
      <Lead>
        “The” is an <b>ending</b> on the <Term k="noun" /> (the <Term k="definite">definite form</Term>).
        The ending depends on the <Term k="gender" />: <b className="text-teal-300">en</b>,{' '}
        <b className="text-pink-300">ei</b> or <b className="text-indigo-300">et</b>. Learn every noun
        with its gender.
      </Lead>
      <div className="overflow-x-auto">
        <div className={`grid min-w-[320px] grid-cols-[34px_repeat(4,1fr)] ${tableBox}`}>
          <div className={th} />
          <div className={th}>a / an</div>
          <div className={th}>the</div>
          <div className={th}>
            <Term k="plural" />
          </div>
          <div className={th}>the (plural)</div>
          <NounRow id="n-en" g="en" forms={[['en gutt', ''], ['gutt', 'en'], ['gutt', 'er'], ['gutt', 'ene']]} />
          <NounRow id="n-ei" g="ei" forms={[['ei jente', ''], ['jent', 'a'], ['jent', 'er'], ['jent', 'ene']]} />
          <NounRow id="n-et" g="et" forms={[['et eple', ''], ['eple', 't'], ['eple', 'r'], ['eple', 'ne']]} />
          <NounRow id="n-et1" g="et" forms={[['et hus', ''], ['hus', 'et'], ['hus', '-'], ['hus', 'ene']]} />
        </div>
      </div>
      <Note>
        <b>One-syllable et-words</b> take no plural ending: et hus, to hus. <b>ei-words</b> may also
        be used as en-words in Bokmål: en jente, jenten. Both are correct.
      </Note>
      <Heading>Learn these by heart</Heading>
      <div data-row="n-irr" className="flex flex-wrap gap-1.5">
        {[
          ['mann', 'mannen · menn · mennene'],
          ['barn', 'barnet · barn · barna'],
          ['bok', 'boka · bøker · bøkene'],
          ['lærer', 'læreren · lærere · lærerne'],
          ['øye', 'øyet · øyne · øynene'],
        ].map(([w, rest]) => (
          <span key={w} className="rounded-lg border border-white/10 px-2 py-1 text-[12.5px] text-slate-300">
            <b className="font-semibold text-slate-100">{w}</b> · {rest}
          </span>
        ))}
      </div>
    </>
  )
}

// --- Tenses ---------------------------------------------------------------------

function TenseBody() {
  const point = (label: string, now = false) => (
    <span
      className={`absolute -top-5 left-1/2 -ml-[5px] h-2.5 w-2.5 rounded-full border-2 ${
        now ? 'border-teal-300 bg-teal-300' : 'border-white/20 bg-[#0b1220]'
      }`}
      aria-label={label}
    />
  )
  return (
    <>
      <Lead>
        The verb never changes for the person: <b>jeg, du, hun, vi, de spiser</b>. What changes is
        the time.
      </Lead>
      <div data-row="t-line" className="relative grid grid-cols-3 gap-1.5 pt-[26px]">
        <span className="absolute left-[4%] right-[4%] top-[11px] h-0.5 rounded bg-gradient-to-r from-indigo-300 via-teal-300 to-pink-300" />
        <div className="relative text-center">
          {point('past')}
          <div className="text-[11px] text-slate-400">i går</div>
          <div className="text-sm font-semibold">spiste</div>
          <div className="text-[11px] text-slate-500">
            <Term k="past" />
          </div>
          <div className="mt-1.5 rounded-lg border border-dashed border-white/20 p-1 text-[12.5px]">
            har spist
            <div className="text-[11px] text-slate-500">
              <Term k="perfect" />
            </div>
          </div>
        </div>
        <div className="relative text-center">
          {point('now', true)}
          <div className="text-[11px] text-slate-400">nå</div>
          <div className="text-sm font-semibold">spiser</div>
          <div className="text-[11px] text-slate-500">present: + r</div>
        </div>
        <div className="relative text-center">
          {point('future')}
          <div className="text-[11px] text-slate-400">i morgen</div>
          <div className="text-sm font-semibold">skal spise</div>
          <div className="text-[11px] text-slate-500">future</div>
        </div>
      </div>
      <Heading>Regular verbs: the stem picks the ending</Heading>
      <div data-row="t-weak" className="grid gap-1.5">
        {[
          ['Two consonants before -e', '-et', 'jobbe', 'jobbet', 'har jobbet'],
          ['One consonant before -e', '-te', 'spise', 'spiste', 'har spist'],
          ['Stem ends in -v or -ei', '-de', 'leve', 'levde', 'har levd'],
          ['Stem ends in a vowel', '-dde', 'bo', 'bodde', 'har bodd'],
        ].map(([rule, end, inf, past, perf]) => (
          <div
            key={end}
            className="grid grid-cols-[1.3fr_18px_.6fr_1.3fr] items-center gap-1.5 rounded-[10px] border border-white/10 px-2.5 py-[7px] text-[12.5px]"
          >
            <span>{rule}</span>
            <span className="text-center text-slate-500">→</span>
            <span className="text-sm font-bold text-teal-300">{end}</span>
            <span className="text-slate-300">
              {inf} · <b className="text-slate-100">{past}</b> · {perf}
            </span>
          </div>
        ))}
      </div>
      <Note>A rule of thumb with exceptions: spille → spilte, kjenne → kjente.</Note>
      <Heading>Irregular: learn by heart</Heading>
      <div data-row="t-strong" className={`grid grid-cols-3 ${tableBox} text-[12.5px]`}>
        <div className={th}>now</div>
        <div className={th}>past</div>
        <div className={th}>har + …</div>
        {[
          ['er', 'var', 'vært'],
          ['har', 'hadde', 'hatt'],
          ['går', 'gikk', 'gått'],
          ['drikker', 'drakk', 'drukket'],
          ['ser', 'så', 'sett'],
          ['kommer', 'kom', 'kommet'],
        ].map(([now, past, perf]) => (
          <div key={now} className="contents">
            <div className={td}>{now}</div>
            <div className={`${td} text-pink-300`}>{past}</div>
            <div className={td}>{perf}</div>
          </div>
        ))}
      </div>
      <Note>
        <b>Time words at the front trigger V2:</b> I går <b className="text-teal-300">spiste</b> jeg
        frokost.
      </Note>
    </>
  )
}

// --- Pronouns -------------------------------------------------------------------

function PronounBody() {
  const tok = 'rounded-lg border px-2 py-1'
  return (
    <>
      <Heading>
        <Term k="pronoun">Pronouns</Term>: subject → object
      </Heading>
      <div data-row="p-obj" className={`grid grid-cols-4 ${tableBox}`}>
        <div className={th}>
          <Term k="subject" />
        </div>
        <div className={th}>
          <Term k="object" />
        </div>
        <div className={th}>
          <Term k="subject" />
        </div>
        <div className={th}>
          <Term k="object" />
        </div>
        {[
          ['jeg', 'meg', 'vi', 'oss'],
          ['du', 'deg', 'dere', 'dere'],
          ['han', 'ham', 'de', 'dem'],
          ['hun', 'henne', 'den / det', 'den / det'],
        ].map(([a, b, c, d]) => (
          <div key={a} className="contents">
            <div className={td}>{a}</div>
            <div className={`${td} font-semibold text-sky-300`}>{b}</div>
            <div className={td}>{c}</div>
            <div className={`${td} font-semibold text-sky-300`}>{d}</div>
          </div>
        ))}
      </div>
      <Note row="p-it">
        <b>“It”:</b> den for en/ei-words (Bilen er ny. <b>Den</b> er rød.), det for et-words (Huset
        er stort. <b>Det</b> er gult.)
      </Note>
      <Heading>
        <Term k="possessive">Possessives</Term> match the thing owned
      </Heading>
      <div className="overflow-x-auto">
        <div data-row="p-poss" className={`grid min-w-[300px] grid-cols-[56px_repeat(4,1fr)] text-center ${tableBox}`}>
          <div className={th} />
          <div className={`${th} text-teal-300`}>en</div>
          <div className={`${th} text-pink-300`}>ei</div>
          <div className={`${th} text-indigo-300`}>et</div>
          <div className={`${th} text-amber-300`}>plural</div>
          {[
            ['jeg', 'min', 'mi', 'mitt', 'mine'],
            ['du', 'din', 'di', 'ditt', 'dine'],
            ['vi', 'vår', 'vår', 'vårt', 'våre'],
          ].map(([who, ...forms]) => (
            <div key={who} className="contents">
              <div className={`${td} text-left text-xs text-slate-400`}>{who}</div>
              {forms.map((f, i) => (
                <div key={i} className={`${td} ${['text-teal-300', 'text-pink-300', 'text-indigo-300', 'text-amber-300'][i]}`}>
                  {f}
                </div>
              ))}
            </div>
          ))}
          {[
            ['han', 'hans'],
            ['hun', 'hennes'],
            ['dere/de', 'deres'],
          ].map(([who, form]) => (
            <div key={who} className="contents">
              <div className={`${td} text-left text-xs text-slate-400`}>{who}</div>
              <div className={`${td} col-span-4 text-slate-300`}>
                {form} <span className="text-[11px] text-slate-500">never changes</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Heading>Where it goes</Heading>
      <div data-row="p-pos" className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className={`${tok} border-teal-300/50`}>
          bil<b className="text-teal-300">en</b>
        </span>
        <span className={`${tok} border-pink-300/50 font-semibold text-pink-300`}>min</span>
        <span className="text-xs text-slate-500">usual: “the car my”</span>
        <span className="ml-2 text-xs text-slate-500">vs</span>
        <span className={`${tok} border-pink-300/50 font-semibold text-pink-300`}>min</span>
        <span className={`${tok} border-white/20`}>bil</span>
        <span className="text-xs text-slate-500">stressed</span>
      </div>
      <Heading>This / these</Heading>
      <div data-row="p-dem" className="flex flex-wrap items-center gap-1.5 text-sm">
        {[
          ['denne', 'bil', 'en'],
          ['dette', 'hus', 'et'],
          ['disse', 'bøk', 'ene'],
        ].map(([d, stem, end]) => (
          <span key={d} className="contents">
            <span className={`${tok} border-pink-300/50 font-semibold text-pink-300`}>{d}</span>
            <span className={`${tok} border-teal-300/50`}>
              {stem}
              <b className="text-teal-300">{end}</b>
            </span>
          </span>
        ))}
      </div>
      <Note>The noun keeps its “the” ending after denne, dette and disse.</Note>
    </>
  )
}
