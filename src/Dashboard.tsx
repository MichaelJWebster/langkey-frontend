import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  fetchCefr,
  fetchProgress,
  fetchSkillsBreakdown,
  fetchCategories,
  getToken,
  type CardBreakdown,
  type CefrProgress,
  type CefrSkill,
  type Progress,
  type QueueOptions,
  type SkillsBreakdown,
  type Categories,
  type Category,
} from './api'
import Glossary from './Glossary'
import SpeakingSession from './SpeakingSession'
import ListeningSession from './ListeningSession'
import Games from './Games'
import Grammar from './Grammar'
import Library from './Library'
import Passages from './Passages'
import ReviewSession from './ReviewSession'

type SkillId = 'vocabulary' | 'listening' | 'reading' | 'writing' | 'speaking' | 'conversation'

// Speaking and conversation are separate rows because CEFR separates them:
// spoken production (saying it) and spoken interaction (talking with
// someone). Pronunciation practice trains the first; nothing trains the
// second yet, and one ring could not honestly stand for both.
const SKILL_ORDER: SkillId[] = [
  'vocabulary',
  'listening',
  'reading',
  'writing',
  'speaking',
  'conversation',
]

// Per-skill aurora gradient [from, to].
const GRADS: Record<SkillId, [string, string]> = {
  vocabulary: ['#38bdf8', '#818cf8'],
  listening: ['#a78bfa', '#f472b6'],
  reading: ['#34d399', '#22d3ee'],
  writing: ['#fbbf24', '#fb7185'],
  speaking: ['#2dd4bf', '#0ea5e9'],
  conversation: ['#fb923c', '#f472b6'],
}

const SUBS: Record<SkillId, string> = {
  vocabulary: 'Flashcards & spaced review',
  listening: 'Dictation & word recognition',
  reading: 'A1 passages to translate',
  writing: 'Produce Norwegian from English',
  speaking: 'Pronunciation — say it, hear it back',
  conversation: 'Talk turn by turn — coming later',
}

const ICONS: Record<SkillId, string> = {
  vocabulary:
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
  listening:
    'M3 18v-6a9 9 0 0 1 18 0v6M3 14h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3zM21 14h-2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2z',
  reading:
    'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  writing: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  speaking:
    'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8',
  conversation: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5',
}

// CEFR can-do descriptors shown in the milestone boxes.
const CANDO: Record<string, Record<SkillId, string>> = {
  A1: {
    vocabulary:
      'You know the ~500 most frequent Norwegian words — greetings, numbers, time, family, food, travel — and recall them both ways.',
    listening:
      'You understand familiar words and very basic phrases about yourself and your surroundings when people speak slowly and clearly.',
    reading:
      'You understand familiar names, words and very simple sentences — on notices, posters and in short, simple texts.',
    writing:
      'You can write short, simple phrases and fill in forms with personal details — name, nationality, address.',
    speaking:
      'You can use simple phrases and sentences to describe where you live and people you know.',
    conversation:
      'You can interact in a simple way if the other person speaks slowly and helps — asking and answering simple questions on very familiar topics.',
  },
  A2: {
    vocabulary:
      'Around 1,200 words covering routine daily life — shopping, work, local area — with common phrases and collocations.',
    listening:
      'You catch the main point in short, clear messages and announcements about everyday matters.',
    reading: 'You read short, simple everyday texts — ads, menus, timetables, short letters.',
    writing: 'You write short notes and messages, and simple personal letters.',
    speaking: 'You describe your family, living conditions, education and work in simple terms.',
    conversation:
      'You handle short social exchanges and simple, direct exchanges of information on routine tasks.',
  },
}

function SkillIcon({ skill, className }: { skill: SkillId; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={ICONS[skill]} />
    </svg>
  )
}

function Ring({
  skill,
  pct,
  size = 84,
  next = 'A1',
}: {
  skill: SkillId
  pct: number
  size?: number
  next?: string
}) {
  const [c1, c2] = GRADS[skill]
  const p = Math.round(pct * 100)
  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(from -90deg, ${c1}, ${c2} ${p}%, rgba(255,255,255,.08) ${p}% 100%)`,
        boxShadow: `0 0 22px ${c1}40`,
      }}
    >
      <div
        className="flex flex-col items-center justify-center rounded-full bg-[#0e1628]"
        style={{ width: size - 20, height: size - 20 }}
      >
        <span className="text-[17px] font-bold" style={{ color: c1 }}>
          {p}%
        </span>
        <span className="text-[8px] font-semibold tracking-[.08em] text-slate-500">TO {next}</span>
      </div>
    </div>
  )
}

function GradientText({ skill, children, className }: { skill: SkillId; children: ReactNode; className?: string }) {
  const [c1, c2] = GRADS[skill]
  return (
    <span
      className={`bg-clip-text text-transparent ${className ?? ''}`}
      style={{ backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})` }}
    >
      {children}
    </span>
  )
}

// Stacked state bar: established / learning / relearning / unseen (or custom segments).
export function StateBar({
  segments,
  className,
}: {
  segments: { label: string; count: number; color: string }[]
  className?: string
}) {
  const total = segments.reduce((s, x) => s + x.count, 0)
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        {total > 0 &&
          segments.map(
            (s) =>
              s.count > 0 && (
                <div
                  key={s.label}
                  style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
                />
              ),
          )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.count} {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function cardStateSegments(b: CardBreakdown) {
  return [
    { label: 'mastered', count: b.established, color: '#34d399' },
    { label: 'learning', count: b.learning, color: '#fbbf24' },
    { label: 'still hard', count: b.relearning, color: '#fb7185' },
    { label: 'unseen', count: b.unseen, color: 'rgba(255,255,255,.14)' },
  ]
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [cefr, setCefr] = useState<CefrProgress | null>(null)
  const [breakdown, setBreakdown] = useState<SkillsBreakdown | null>(null)
  const [categories, setCategories] = useState<Categories | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [screen, setScreen] = useState<SkillId | 'glossary' | 'games' | 'grammar' | 'library' | null>(null)

  const refresh = useCallback(() => {
    Promise.all([fetchProgress(), fetchCategories(), fetchCefr(), fetchSkillsBreakdown()])
      .then(([p, t, c, b]) => {
        setProgress(p)
        setCategories(t)
        setCefr(c)
        setBreakdown(b)
      })
      .catch((e) => {
        // request() clears the token on 401; bounce back to the login page.
        if (getToken() === null) onLogout()
        else setError(e instanceof Error ? e.message : 'Failed to load')
      })
  }, [onLogout])

  useEffect(refresh, [refresh])

  const backToSkills = () => {
    setScreen(null)
    refresh()
  }

  if (screen === 'glossary') {
    return (
      <SkillShell title="Glossary" onBack={backToSkills}>
        <Glossary onBack={backToSkills} />
      </SkillShell>
    )
  }

  // Games brings its own shell: it has no CEFR subtitle to put in a SkillShell
  // header, and it manages three levels of its own navigation.
  if (screen === 'games') return <Games onBack={backToSkills} />
  // Grammar, likewise: there is no can-do statement for word order on its own.
  if (screen === 'grammar') return <Grammar onBack={backToSkills} />
  // Reading for interest, likewise: a section, not a skill with a ring.
  if (screen === 'library') return <Library onBack={backToSkills} />

  if (screen && breakdown) {
    return (
      <SkillScreen
        skill={screen}
        categories={categories}
        breakdown={breakdown}
        onBack={backToSkills}
      />
    )
  }

  const skillsById = new Map<string, CefrSkill>(cefr?.skills.map((s) => [s.skill, s]) ?? [])

  return (
    <div>
      {error ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : !progress || !cefr || !breakdown ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
          Loading…
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Your skills</h2>
              <p className="mt-1 text-sm text-slate-400">
                The journey to A1 Norwegian, one skill at a time.
              </p>
            </div>
            <div className="flex gap-2 text-center text-xs">
              <Stat value={`🔥 ${progress.streak_days}`} label="day streak" />
              <Stat value={String(progress.cards_established)} label="established" />
              <Stat value={String(progress.reviewed_today)} label="reviews today" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {SKILL_ORDER.map((id) => (
              <SkillRow
                key={id}
                skill={id}
                cefr={skillsById.get(id)}
                onOpen={() => setScreen(id)}
              />
            ))}
            <SectionRow
              title="Grammar practice"
              subtitle="Word order, questions, negation, nouns, tenses, pronouns"
              gradient={['#5eead4', '#818cf8']}
              icon={GRAMMAR_ICON}
              onOpen={() => setScreen('grammar')}
            />
            <SectionRow
              title="Games"
              subtitle="Matching, flashcards and other practice"
              gradient={['#e879f9', '#8b5cf6']}
              icon={GAMES_ICON}
              onOpen={() => setScreen('games')}
            />
            <SectionRow
              title="Reading for interest"
              subtitle="Novels and folktales with the English beside them — not A1 based"
              gradient={['#38bdf8', '#34d399']}
              icon={LIBRARY_ICON}
              onOpen={() => setScreen('library')}
            />
          </div>

          <p className="mt-5 text-center text-xs text-slate-500">
            {cefr.note} Speaking is scored by NB-Whisper on this machine, so it only
            works while the speech service is running.
          </p>
        </>
      )}

      <div className="mt-5 flex items-center justify-center gap-6 text-center">
        <button
          onClick={() => setScreen('glossary')}
          className="text-sm font-medium text-teal-300 transition hover:text-teal-200"
        >
          Glossary
        </button>
        <button
          onClick={onLogout}
          className="text-sm font-medium text-slate-500 transition hover:text-slate-300"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2">
      <div className="text-base font-bold text-slate-100">{value}</div>
      <div className="mt-0.5 text-[10px] text-slate-400">{label}</div>
    </div>
  )
}

/**
 * A section on the skills list, without a ring: Grammar, Games, and Reading for interest.
 *
 * The skills above each carry a CEFR ring and an "A1 achieved" descriptor.
 * These have neither: there is no Council of Europe can-do statement for
 * matching ten words against the clock, or for reading Hamsun far above your
 * level for the pleasure of it, and a ring that looked the same but counted
 * something else would make every ring on the page mean less. So each takes
 * the full width where the ring and the milestone box would be, and says what
 * is inside it instead.
 */
function SectionRow({
  title,
  subtitle,
  gradient,
  icon,
  onOpen,
}: {
  title: string
  subtitle: string
  gradient: [string, string]
  icon: ReactNode
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/25 hover:bg-white/10"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#0b1220]"
        style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-[22px] w-[22px]"
        >
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-grow">
        <span className="block font-bold">{title}</span>
        <span className="block text-xs text-slate-400">{subtitle}</span>
      </span>
      <span className="text-lg" style={{ color: gradient[0] }}>
        ›
      </span>
    </button>
  )
}

const GRAMMAR_ICON = (
  <>
    <rect x="3" y="5" width="6" height="5" rx="1.2" />
    <rect x="10.5" y="5" width="4.5" height="5" rx="1.2" />
    <rect x="16.5" y="5" width="4.5" height="5" rx="1.2" />
    <path d="M12.75 13v3.5M12.75 16.5l-2-2M12.75 16.5l2-2" />
    <path d="M4 20h16" />
  </>
)

const GAMES_ICON = (
  <>
    <rect x="2" y="7" width="13" height="13" rx="2.5" />
    <path d="M6.5 11.5h.01M10.5 15.5h.01" />
    <path d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3H19a3 3 0 0 1 3 3v7.5a2.5 2.5 0 0 1-2.5 2.5H18" />
  </>
)

const LIBRARY_ICON = (
  <>
    <path d="M4 19.5V4.5A1.5 1.5 0 0 1 5.5 3H9v18H5.5A1.5 1.5 0 0 1 4 19.5z" />
    <path d="M9 3h4v18H9" />
    <path d="M14.5 4.2l3.6-.9 3.4 16.4-3.6.9z" />
  </>
)

function SkillRow({
  skill,
  cefr,
  onOpen,
}: {
  skill: SkillId
  cefr?: CefrSkill
  onOpen: () => void
}) {
  const enabled = true
  const [c1, c2] = GRADS[skill]
  const pct = cefr?.progress ?? 0
  const nextLevel = cefr?.next_level ?? 'A1'
  const cando = (CANDO[nextLevel] ?? CANDO.A1)[skill]
  const name = skill[0].toUpperCase() + skill.slice(1)
  const detail = cefr?.detail ?? ''

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <button
        onClick={onOpen}
        disabled={!enabled}
        className={`flex w-full items-center gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition md:w-[300px] md:shrink-0 ${
          enabled ? 'hover:border-white/25 hover:bg-white/10' : 'cursor-not-allowed opacity-45'
        }`}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#0b1220]"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          <SkillIcon skill={skill} className="h-[22px] w-[22px]" />
        </span>
        <span className="min-w-0 flex-grow">
          <span className="block font-bold">{name}</span>
          <span className="block text-xs text-slate-400">{SUBS[skill]}</span>
          <span className="mt-1 block text-[11px] text-slate-500 md:hidden">{detail}</span>
        </span>
        <span className="md:hidden">
          <Ring skill={skill} pct={pct} size={52} next={nextLevel} />
        </span>
        <span className="hidden text-lg md:block" style={{ color: c1 }}>
          ›
        </span>
      </button>

      {/* Desktop: curved journey with the ring on the path and numbers beneath. */}
      <div className="relative hidden h-[130px] w-[230px] shrink-0 md:block" aria-hidden="true">
        <svg width="230" height="130" viewBox="0 0 230 130" className="absolute inset-0">
          <path
            d="M0 60 C 55 12, 175 108, 230 60"
            fill="none"
            stroke="rgba(255,255,255,.1)"
            strokeWidth="2"
          />
          <path
            d="M0 60 C 55 12, 175 108, 230 60"
            fill="none"
            stroke={c2}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${Math.round(280 * pct)} 900`}
          />
        </svg>
        <div className="absolute left-[78px] top-[8px]">
          <Ring skill={skill} pct={pct} size={74} next={nextLevel} />
        </div>
        <div className="absolute left-[-25px] right-[-25px] top-[88px] text-center text-[11px] leading-tight text-slate-400">
          {detail}
        </div>
      </div>

      {/* Desktop milestone box. */}
      <div
        className="hidden min-w-0 flex-grow rounded-2xl border border-white/10 bg-white/[.03] p-4 md:block"
        style={{ borderLeft: `3px solid ${c1}` }}
      >
        <div className="text-[11px] font-bold tracking-[.09em]">
          <GradientText skill={skill}>
            {nextLevel} ACHIEVED · {name.toUpperCase()}
          </GradientText>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300/80">{cando}</p>
      </div>

      {/* Phone: milestone collapses into a tappable line. */}
      <details className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-2.5 md:hidden">
        <summary className="cursor-pointer text-xs font-semibold" style={{ color: c1 }}>
          What {nextLevel} {skill} looks like
        </summary>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300/80">{cando}</p>
      </details>
    </div>
  )
}

// --- Skill screens -------------------------------------------------------------

export function SkillShell({
  title,
  subtitle,
  skill,
  onBack,
  children,
}: {
  title: string
  subtitle?: string
  skill?: SkillId
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-[15px] font-bold text-slate-100 transition hover:border-white/30 hover:bg-white/10"
        >
          ← Skills
        </button>
        <div className="min-w-0">
          <div className="truncate text-xl font-bold">
            {skill ? <GradientText skill={skill}>{title}</GradientText> : title}
          </div>
          {subtitle && <div className="truncate text-xs text-slate-400">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

function SkillScreen({
  skill,
  categories,
  breakdown,
  onBack,
}: {
  skill: SkillId
  categories: Categories | null
  breakdown: SkillsBreakdown
  onBack: () => void
}) {
  if (skill === 'vocabulary') {
    return (
      <VocabularyScreen
        categories={categories}
        breakdown={breakdown.vocabulary}
        onBack={onBack}
      />
    )
  }
  if (skill === 'listening') {
    const l = breakdown.listening
    return (
      <SkillShell
        skill="listening"
        title="Listening practice"
        subtitle={
          l.total > 0
            ? `last ${l.total} dictations — ${l.clean} clean · ${l.helped} with help · ${l.missed} missed`
            : 'dictation & word recognition'
        }
        onBack={onBack}
      >
        {l.total > 0 && (
          <StateBar
            className="mb-5"
            segments={[
              { label: 'clean', count: l.clean, color: '#34d399' },
              { label: 'with help', count: l.helped, color: '#fbbf24' },
              { label: 'missed', count: l.missed, color: '#fb7185' },
            ]}
          />
        )}
        <ListeningSession onFinish={onBack} />
      </SkillShell>
    )
  }
  if (skill === 'reading') {
    const r = breakdown.reading
    // Reading is the A1 passages alone now; the library is its own section
    // on the dashboard (Reading for interest), read rather than marked.
    const marked =
      r.passages.score !== null
        ? `A1 translation ${Math.round(r.passages.score)}% over ${r.passages.attempted} of ${r.passages.total}`
        : `${r.passages.total} A1 passages to translate`
    return (
      <SkillShell skill="reading" title="Reading" subtitle={marked} onBack={onBack}>
        <Passages onBack={onBack} />
      </SkillShell>
    )
  }
  if (skill === 'speaking') {
    // Straight into pronunciation: with conversation its own skill, a menu
    // of one would be a click for nothing.
    return (
      <SkillShell
        skill="speaking"
        title="Pronunciation"
        subtitle="say the phrase, and see which sounds landed"
        onBack={onBack}
      >
        <SpeakingSession onFinish={onBack} />
      </SkillShell>
    )
  }
  if (skill === 'conversation') {
    return (
      <SkillShell skill="conversation" title="Conversation" subtitle="not built yet" onBack={onBack}>
        <p className="text-slate-300">
          Turn-by-turn conversation with a Norwegian-speaking character. It needs the
          recording and recognition that pronunciation already has, plus a model to answer
          with — so it comes after pronunciation, not instead of it. When it exists, this
          ring will be scored from the conversations themselves.
        </p>
      </SkillShell>
    )
  }
  // writing
  return (
    <SkillShell
      skill="writing"
      title="Writing practice"
      subtitle="English → Norwegian production cards"
      onBack={onBack}
    >
      <StateBar className="mb-5" segments={cardStateSegments(breakdown.writing)} />
      <ReviewSession options={{ direction: 'production' }} onFinish={onBack} />
    </SkillShell>
  )
}

// --- Vocabulary: pick a category, then run a deck -----------------------------

const CATEGORY_KEY = 'langkey.category'
const REPEAT_DECK = 40

export function VocabularyScreen({
  categories,
  breakdown,
  onBack,
}: {
  categories: Categories | null
  breakdown: CardBreakdown
  onBack: () => void
}) {
  const [deck, setDeck] = useState<{ options: QueueOptions; title: string } | null>(null)

  if (deck) {
    return (
      <SkillShell
        skill="vocabulary"
        title="Vocabulary"
        subtitle={deck.title}
        onBack={() => setDeck(null)}
      >
        <ReviewSession options={deck.options} onFinish={() => setDeck(null)} />
      </SkillShell>
    )
  }

  const startCategory = (category: string | null, title: string) => {
    try {
      if (category) localStorage.setItem(CATEGORY_KEY, category)
      else localStorage.removeItem(CATEGORY_KEY)
    } catch {
      // localStorage unavailable — the choice just won't persist.
    }
    setDeck({ options: { category }, title })
  }

  const tricky = breakdown.learning + breakdown.relearning
  const met = breakdown.learning + breakdown.relearning + breakdown.established
  const overall = categories?.overall

  return (
    <SkillShell
      skill="vocabulary"
      title="Vocabulary"
      subtitle="choose what to study"
      onBack={onBack}
    >
      {overall ? <DeckProgress overall={overall} /> : null}

      <h3 className="mb-2 mt-5 text-xs font-semibold tracking-wide text-slate-400">
        REPETITION
      </h3>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <CategoryCard
          title="🔁 Keep it all alive"
          detail={
            met > 0
              ? `${REPEAT_DECK} cards from your ${met} met words — the shaky ones come round more often`
              : 'nothing met yet — start with a category below'
          }
          accent="#a78bfa"
          disabled={met === 0}
          onClick={() =>
            setDeck({
              options: { mode: 'repeat', limit: REPEAT_DECK },
              title: `repetition — ${REPEAT_DECK} cards, weighted toward your weak words`,
            })
          }
        />
        <CategoryCard
          title="⚡ Tricky words"
          detail={
            tricky > 0
              ? `${tricky} words not locked in yet — nearly-learned ones come first`
              : 'nothing pending — meet some words first'
          }
          accent="#fb7185"
          disabled={tricky === 0}
          onClick={() =>
            setDeck({ options: { mode: 'tricky' }, title: 'tricky words — nearly-learned first' })
          }
        />
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold tracking-wide text-slate-400">
        NEW WORDS
      </h3>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <CategoryCard
          title="🎯 By frequency"
          detail="due reviews plus the next most common words, whatever the subject"
          accent="#38bdf8"
          onClick={() => startCategory(null, 'by frequency — 15 cards')}
        />
        {(categories?.categories ?? [])
          .filter((c) => c.total > 0)
          .map((c) => (
            <CategoryProgressCard
              key={c.category}
              category={c}
              onClick={() => startCategory(c.category, `${c.label} — 15 cards`)}
            />
          ))}
      </div>
    </SkillShell>
  )
}

/** Progress through the whole A1 deck, counting each word once. */
function DeckProgress({ overall }: { overall: Category }) {
  const learning = Math.max(0, overall.total - overall.remaining - overall.established)
  const pct = (n: number) => (overall.total > 0 ? (n / overall.total) * 100 : 0)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-slate-400">
          {overall.established} OF {overall.total} WORDS ESTABLISHED
        </p>
        <p className="text-xs text-slate-500">
          {Math.round(pct(overall.established))}%
        </p>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div style={{ width: `${pct(overall.established)}%`, background: '#34d399' }} />
        <div style={{ width: `${pct(learning)}%`, background: '#fbbf24' }} />
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        {learning} in progress · {overall.remaining} not met yet
      </p>
    </div>
  )
}

function CategoryProgressCard({
  category,
  onClick,
}: {
  category: Category
  onClick: () => void
}) {
  const learning = Math.max(0, category.total - category.remaining - category.established)
  const pct = (n: number) => (category.total > 0 ? (n / category.total) * 100 : 0)
  return (
    <button
      onClick={onClick}
      title={category.blurb}
      className="rounded-xl border border-white/10 bg-white/5 p-3.5 text-left transition hover:border-white/25 hover:bg-white/10"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{category.label}</span>
        <span className="shrink-0 text-[11px] text-slate-500">
          {category.established}/{category.total}
        </span>
      </div>
      <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div style={{ width: `${pct(category.established)}%`, background: '#34d399' }} />
        <div style={{ width: `${pct(learning)}%`, background: '#fbbf24' }} />
      </div>
      <div className="mt-1.5 text-[11px] text-slate-500">
        {category.remaining > 0 ? `${category.remaining} new` : 'all met'}
      </div>
    </button>
  )
}

function CategoryCard({
  title,
  detail,
  accent,
  disabled,
  onClick,
}: {
  title: string
  detail: string
  accent: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border bg-white/5 p-3.5 text-left transition ${
        disabled
          ? 'cursor-not-allowed border-white/10 opacity-50'
          : 'border-white/15 hover:bg-white/10'
      }`}
      style={disabled ? undefined : { borderColor: `${accent}55` }}
    >
      <div className="text-sm font-bold">{title}</div>
      <div className="mt-1 text-xs text-slate-400">{detail}</div>
    </button>
  )
}

