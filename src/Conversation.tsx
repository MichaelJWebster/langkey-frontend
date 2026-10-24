// Conversation: talk turn by turn with a character (ROADMAP M3 step 5).
//
// Laid out like a messaging app on an Android phone, because that is what a
// short exchange with someone is shaped like: a list of conversations, one
// per character, opening into a thread. The character's lines arrive as
// bubbles on the left and play aloud; the learner answers by voice from the
// microphone in the composer. The server decides which expected answer was
// given (accepted / choice / unclear); offered answers appear as reply chips,
// the way a phone suggests replies.
//
// Every answer ends confirmed -- echoed, picked from two, or tapped from the
// list -- because the confirmed answer is the label the conversation corpus
// needs (docs/plans/conversation-corpus.md). A wrong guess can be corrected
// by tapping your own bubble; that relabels it without rewinding.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  confirmTurn,
  fetchDialogues,
  sendTurn,
  startConversation,
  type ConversationStart,
  type Dialogue,
  type DialogueAnswer,
  type DialogueNode,
  type Line,
  type Step,
  type TurnResult,
} from './api'
import { canRecord, describeMicError, releaseTake, startRecording, type ActiveRecording } from './recording'
import SpeedChips, { speedUrl, useCopySpeed } from './SpeedChips'
import { speakToEnd, stopSpeech } from './speech'

// --- look ----------------------------------------------------------------------

// Material 3 dark, as Google Messages draws it: grey incoming bubbles, the
// primary blue for your own, a pill composer with a round action button.
const AVATAR_COLOURS = ['#f28b82', '#fbbc04', '#81c995', '#78d9ec', '#aecbfa', '#d7aefb']
const SLOWEST = 4.0 // the bottom imitation rung, for "Kan du gjenta?"

function avatarColour(index: number): string {
  return AVATAR_COLOURS[index % AVATAR_COLOURS.length]
}

function Avatar({ name, colour, size = 40 }: { name: string; colour: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-[#1f1f1f]"
      style={{ width: size, height: size, background: colour, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1)}
    </span>
  )
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  const time = now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
  return (
    <div
      className="mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#121316] text-[#e3e3e3] shadow-2xl shadow-black/50"
      style={{ height: 'min(760px, calc(100vh - 190px))', minHeight: 520 }}
    >
      {/* A status bar, so the thread reads as a phone at a glance. */}
      <div className="flex h-7 shrink-0 items-center justify-between px-6 text-[12px] font-medium text-[#c4c7c5]">
        <span className="tabular-nums">{time}</span>
        <span className="flex items-center gap-1.5" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M2 22h3v-5H2zm5 0h3v-9H7zm5 0h3V8h-3zm5 0h3V2h-3z" />
          </svg>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M12 21 1.5 8.5a15 15 0 0 1 21 0z" />
          </svg>
          <svg viewBox="0 0 24 24" className="h-3.5 w-4" fill="currentColor">
            <rect x="2" y="7" width="17" height="10" rx="2" />
            <rect x="20" y="10" width="2" height="4" rx="1" />
          </svg>
        </span>
      </div>
      {children}
    </div>
  )
}

// --- the conversation list ---------------------------------------------------------

export default function Conversation({ onBack }: { onBack: () => void }) {
  const [dialogues, setDialogues] = useState<Dialogue[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<{ start: ConversationStart; colour: string } | null>(null)

  const load = useCallback(() => {
    fetchDialogues()
      .then(setDialogues)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])
  useEffect(load, [load])

  async function begin(d: Dialogue, index: number) {
    if (!d.unlocked) return
    setError(null)
    try {
      setOpen({ start: await startConversation(d.slug), colour: avatarColour(index) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the conversation')
    }
  }

  if (open) {
    const index = dialogues?.findIndex((d) => d.slug === open.start.dialogue.slug) ?? -1
    const next = index >= 0 ? dialogues?.[index + 1] : undefined
    return (
      <PhoneFrame>
        <Thread
          key={open.start.id}
          start={open.start}
          colour={open.colour}
          nextTitle={next?.title ?? null}
          onClose={() => {
            stopSpeech()
            setOpen(null)
            load()
          }}
          onNext={
            next
              ? () => {
                  stopSpeech()
                  void begin({ ...next, unlocked: true }, index + 1)
                }
              : null
          }
        />
      </PhoneFrame>
    )
  }

  // The first conversation not yet finished: where to go next.
  const upNext = dialogues?.find((d) => d.unlocked && d.finished === 0)?.slug

  return (
    <PhoneFrame>
      <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-2">
        <button
          onClick={onBack}
          aria-label="Back to skills"
          className="rounded-full p-2 text-[#c4c7c5] transition hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h2 className="text-[22px] font-normal text-[#e3e3e3]">Samtaler</h2>
          <p className="text-[12px] text-[#8e918f]">Easiest first · each one opens the next</p>
        </div>
      </div>

      {error && <p className="px-5 pb-2 text-sm text-rose-300">{error}</p>}
      {!dialogues && !error && <p className="px-5 text-sm text-[#8e918f]">Loading…</p>}

      <ul className="flex-1 overflow-y-auto px-2 pb-4">
        {dialogues?.map((d, i) => (
          <li key={d.slug}>
            <button
              onClick={() => void begin(d, i)}
              disabled={!d.unlocked}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition enabled:hover:bg-white/5 disabled:cursor-not-allowed"
            >
              <span className={d.unlocked ? '' : 'opacity-40 grayscale'}>
                <Avatar name={d.character.name} colour={avatarColour(i)} size={48} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-[16px] ${d.unlocked ? 'font-medium text-[#e3e3e3]' : 'text-[#8e918f]'}`}>
                    {d.character.name} · {d.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-[#8e918f]">Nivå {d.level}</span>
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-[#8e918f]">
                  {d.unlocked ? d.blurb : `🔒 Finish “${d.unlock_after}” to open`}
                </span>
                <span className="mt-1 flex items-center gap-2 text-[11px] text-[#8e918f]">
                  <span>
                    {d.turns_min === d.turns_max ? d.turns_min : `${d.turns_min}–${d.turns_max}`} replies
                  </span>
                  {d.finished > 0 && <span className="text-[#81c995]">✓ done {d.finished}×</span>}
                  {d.slug === upNext && (
                    <span className="rounded-full bg-[#a8c7fa] px-2 py-px font-medium text-[#062e6f]">
                      Next
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </PhoneFrame>
  )
}

// --- one conversation -----------------------------------------------------------------

type Message =
  | { key: string; from: 'them'; line: Line }
  | {
      key: string
      from: 'me'
      /** The answer as confirmed; null while it is being judged. */
      text: string | null
      /** What Whisper heard, shown only when it differs from the answer. */
      heard: string | null
      turnId: string | null
      /** The answers this was a reply to, for correcting it. */
      answers: DialogueAnswer[]
      /** listening: being judged. done: an answer. unanswered: heard but not
       *  yet placed. heard: what came before an answer picked afterwards --
       *  kept as it was, with the picked answer as its own bubble after the
       *  character's "sorry?", so the thread reads in the order it happened.
       *  retried: abandoned for another go. */
      status: 'listening' | 'done' | 'retried' | 'unanswered' | 'heard'
    }
  | { key: string; from: 'system'; text: string }
  | { key: string; from: 'typing' }

type Phase = 'speaking' | 'ready' | 'recording' | 'sending' | 'choice' | 'unclear' | 'list' | 'finished'

let keySeq = 0
const nextKey = () => `m${++keySeq}`

function Thread({
  start,
  colour,
  nextTitle,
  onClose,
  onNext,
}: {
  start: ConversationStart
  colour: string
  nextTitle: string | null
  onClose: () => void
  onNext: (() => void) | null
}) {
  const character = start.dialogue.character
  const [messages, setMessages] = useState<Message[]>([])
  const [node, setNode] = useState<DialogueNode>(start.node)
  const [phase, setPhase] = useState<Phase>('speaking')
  const [pending, setPending] = useState<TurnResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shownEn, setShownEn] = useState<Set<string>>(new Set())
  const [correcting, setCorrecting] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [scale, pickSpeed] = useCopySpeed()
  const recording = useRef<ActiveRecording | null>(null)
  const alive = useRef(0) // bumped on unmount and on every new playback chain
  const scroller = useRef<HTMLDivElement>(null)
  const mic = canRecord()

  // Keep the newest message in view, as a messaging app does.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, phase])

  const lineUrl = useCallback(
    (line: Line, at: number | null = scale) => speedUrl(line.speeds, at, line.audio_url),
    [scale],
  )

  /** The character "types", then each line lands and plays, one after another. */
  const say = useCallback(
    async (lines: Line[], then: Phase, at: number | null = null) => {
      const chain = ++alive.current
      setPhase('speaking')
      for (const line of lines) {
        const typing = nextKey()
        setMessages((m) => [...m, { key: typing, from: 'typing' }])
        await new Promise((r) => setTimeout(r, 450))
        if (chain !== alive.current) return
        setMessages((m) => [...m.filter((x) => x.key !== typing), { key: nextKey(), from: 'them', line }])
        await speakToEnd(line.text, lineUrl(line, at ?? scale))
        if (chain !== alive.current) return
      }
      setPhase(then)
    },
    [lineUrl, scale],
  )

  // Open with the character's first line. Through a ref so that changing
  // the speed (which rebuilds `say`) does not restart the conversation; and
  // the thread is cleared first, so StrictMode's mount-unmount-mount leaves
  // one opening line rather than an abandoned "typing" bubble.
  const sayRef = useRef(say)
  useEffect(() => {
    sayRef.current = say
  }, [say])
  useEffect(() => {
    setMessages([])
    void sayRef.current([start.node.line], 'ready')
    return () => {
      alive.current += 1
      recording.current?.cancel()
      recording.current = null
      stopSpeech()
    }
  }, [start.node.line])

  const updateMine = (key: string, patch: Partial<Extract<Message, { from: 'me' }>>) =>
    setMessages((m) => m.map((x) => (x.key === key && x.from === 'me' ? { ...x, ...patch } : x)))

  const myLast = (): string | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.from === 'me') return m.key
    }
    return null
  }

  async function follow(step: Step) {
    setPending(null)
    if (step.repeat && step.node) {
      // "Jeg forstår ikke" / "Kan du gjenta?": the same line, at the slowest rung.
      setNode(step.node)
      await say([step.node.line], 'ready', SLOWEST)
      return
    }
    const lines = [step.reply, step.node?.line].filter((l): l is Line => !!l)
    if (step.node) setNode(step.node)
    await say(lines, step.finished ? 'finished' : 'ready')
    if (step.finished) {
      setMessages((m) => [...m, { key: nextKey(), from: 'system', text: 'Samtalen er ferdig — well done!' }])
    }
  }

  async function toggleMic() {
    setError(null)
    if (phase === 'recording') {
      const active = recording.current
      recording.current = null
      if (!active) return
      setPhase('sending')
      const mine = nextKey()
      const answers = node.answers
      setMessages((m) => [
        ...m,
        { key: mine, from: 'me', text: null, heard: null, turnId: null, answers, status: 'listening' },
      ])
      try {
        const take = await active.stop()
        const result = await sendTurn(start.id, take)
        releaseTake(take)
        const heard = result.transcript
        if (result.decision === 'accepted' && result.picked && result.step) {
          updateMine(mine, {
            text: result.picked.text,
            heard: heard && normalise(heard) !== normalise(result.picked.text) ? heard : null,
            turnId: result.turn_id,
            status: 'done',
          })
          await follow(result.step)
          return
        }
        updateMine(mine, { text: heard || null, heard: null, turnId: result.turn_id, status: 'unanswered' })
        setPending(result)
        if (result.decision === 'choice') {
          await say([start.choice], 'choice')
        } else if (result.reason === 'transcript fits better') {
          // Heard clearly, just not an answer this line knows: "didn't
          // understand", never "didn't hear".
          await say([start.offscript], 'unclear')
        } else {
          await say([start.unclear], 'unclear')
        }
      } catch (e) {
        setMessages((m) => m.filter((x) => x.key !== mine))
        setError(e instanceof Error ? e.message : 'Could not send your answer')
        setPhase('ready')
      }
      return
    }
    if (phase !== 'ready') return
    stopSpeech()
    try {
      recording.current = await startRecording()
      setPhase('recording')
    } catch (e) {
      setError(describeMicError(e))
    }
  }

  /** Tap an answer: picked from the two offered, or from the full list. */
  async function choose(answer: DialogueAnswer, how: 'choice' | 'list') {
    const turnId = pending?.turn_id
    const mine = myLast()
    if (!turnId) return
    try {
      const step = await confirmTurn(start.id, turnId, { answer_id: answer.id, how })
      if (mine) updateMine(mine, { status: 'heard', turnId: null })
      // A slot answer ("Jeg heter …") is shown as what was actually said.
      const said = answer.text.includes('…') && pending?.transcript ? pending.transcript : answer.text
      setMessages((m) => [
        ...m,
        { key: nextKey(), from: 'me', text: said, heard: null, turnId, answers: node.answers, status: 'done' },
      ])
      await follow(step)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm')
    }
  }

  async function retry() {
    const turnId = pending?.turn_id
    const mine = myLast()
    if (turnId) await confirmTurn(start.id, turnId, { retry: true }).catch(() => undefined)
    if (mine) updateMine(mine, { status: 'retried' })
    setPending(null)
    setPhase('ready')
  }

  async function correct(message: Extract<Message, { from: 'me' }>, answer: DialogueAnswer) {
    setCorrecting(null)
    if (!message.turnId || answer.text === message.text) return
    try {
      await confirmTurn(start.id, message.turnId, { answer_id: answer.id })
      updateMine(message.key, { text: answer.text, heard: null })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not correct')
    }
  }

  function replay(line: Line) {
    stopSpeech()
    void speakToEnd(line.text, lineUrl(line))
  }

  // Space for the microphone, as the pronunciation screen does; Esc to leave.
  const toggleRef = useRef(toggleMic)
  useEffect(() => {
    toggleRef.current = toggleMic
  })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return
      if (e.key === ' ') {
        e.preventDefault()
        void toggleRef.current()
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const own = node.answers.filter((a) => !a.universal)
  const universal = node.answers.filter((a) => a.universal)

  return (
    <>
      {/* App bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-2 pb-2 pt-1">
        <button
          onClick={onClose}
          aria-label="Back to conversations"
          className="rounded-full p-2 text-[#c4c7c5] transition hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5m6-7-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Avatar name={character.name} colour={colour} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] text-[#e3e3e3]">{character.name}</p>
          <p className="truncate text-[12px] text-[#8e918f]">
            {start.dialogue.title} · {character.role}
          </p>
        </div>
        <button
          onClick={() => setMenu((v) => !v)}
          aria-label="Speech speed"
          aria-expanded={menu}
          className="rounded-full p-2 text-[#c4c7c5] transition hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>
      {menu && (
        <div className="shrink-0 border-b border-white/5 bg-[#1b1c1f] px-4 py-3">
          <SpeedChips speeds={start.node.line.speeds} scale={scale} onPick={pickSpeed} label={`${character.name} speaks at`} />
          <p className="mt-2 text-[11px] text-[#8e918f]">Tap a message to see it in English.</p>
        </div>
      )}

      {/* Messages */}
      <div ref={scroller} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4" data-testid="thread">
        <p className="pb-2 text-center text-[11px] text-[#8e918f]">
          {start.dialogue.title_en} — answer out loud with the microphone
        </p>
        {messages.map((m, i) => {
          if (m.from === 'typing') {
            return (
              <div key={m.key} className="flex items-end gap-2">
                <Avatar name={character.name} colour={colour} size={28} />
                <div className="flex gap-1 rounded-[20px] rounded-bl-[6px] bg-[#2b2d31] px-4 py-3" aria-label={`${character.name} is typing`}>
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-2 w-2 animate-bounce rounded-full bg-[#8e918f]"
                      style={{ animationDelay: `${d * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            )
          }
          if (m.from === 'system') {
            return (
              <p key={m.key} className="py-3 text-center text-[12px] text-[#81c995]">
                {m.text}
              </p>
            )
          }
          if (m.from === 'them') {
            // Group consecutive lines as a phone does: avatar on the last only.
            const nextIsThem = messages[i + 1]?.from === 'them' || messages[i + 1]?.from === 'typing'
            const en = shownEn.has(m.key)
            return (
              <div key={m.key} className="flex items-end gap-2">
                <span className={nextIsThem ? 'invisible' : ''}>
                  <Avatar name={character.name} colour={colour} size={28} />
                </span>
                <div className="max-w-[78%]">
                  <button
                    onClick={() =>
                      setShownEn((s) => {
                        const n = new Set(s)
                        if (n.has(m.key)) n.delete(m.key)
                        else n.add(m.key)
                        return n
                      })
                    }
                    className="block rounded-[20px] rounded-bl-[6px] bg-[#2b2d31] px-4 py-2.5 text-left text-[15px] leading-snug text-[#e3e3e3]"
                  >
                    {m.line.text}
                    {en && <span className="mt-1 block text-[12px] text-[#8e918f]">{m.line.en}</span>}
                  </button>
                </div>
                <button
                  onClick={() => replay(m.line)}
                  aria-label={`Play: ${m.line.text}`}
                  className="mb-1 rounded-full p-1 text-[#8e918f] transition hover:bg-white/10 hover:text-[#a8c7fa]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            )
          }
          // mine
          return (
            <div key={m.key} className="flex flex-col items-end">
              <button
                disabled={m.status !== 'done' || !m.turnId}
                onClick={() => setCorrecting((c) => (c === m.key ? null : m.key))}
                title={m.status === 'done' ? 'Not what you said? Tap to correct' : undefined}
                className={`max-w-[78%] rounded-[20px] rounded-br-[6px] px-4 py-2.5 text-left text-[15px] leading-snug transition ${
                  m.status === 'retried'
                    ? 'bg-[#a8c7fa]/25 text-[#c4c7c5] line-through decoration-[#8e918f]'
                    : m.status === 'unanswered' || m.status === 'heard'
                      ? 'bg-[#a8c7fa]/40 italic text-[#e3e3e3]'
                      : 'bg-[#a8c7fa] text-[#062e6f]'
                }`}
              >
                {m.status === 'listening' ? (
                  <span className="flex items-center gap-1" aria-label="Listening">
                    {[0, 1, 2, 3, 4].map((d) => (
                      <span
                        key={d}
                        className="w-1 animate-pulse rounded-full bg-[#062e6f]"
                        style={{ height: 8 + ((d * 7) % 12), animationDelay: `${d * 90}ms` }}
                      />
                    ))}
                    <span className="ml-2 text-[13px]">hører etter…</span>
                  </span>
                ) : (
                  (m.text ?? '🎤 …')
                )}
              </button>
              {m.heard && m.status === 'done' && (
                <span className="mr-2 mt-0.5 max-w-[78%] text-right text-[11px] text-[#8e918f]">
                  heard as “{m.heard}”
                </span>
              )}
              {correcting === m.key && (
                <div className="mt-1.5 flex max-w-[90%] flex-wrap justify-end gap-1.5">
                  <span className="w-full text-right text-[11px] text-[#8e918f]">What did you say?</span>
                  {m.answers.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => void correct(m, a)}
                      className="rounded-full border border-[#8e918f]/50 px-3 py-1 text-[13px] text-[#a8c7fa] transition hover:bg-[#a8c7fa]/10"
                    >
                      {a.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reply chips: the two close answers, or every answer to this line. */}
      {(phase === 'choice' || phase === 'unclear' || phase === 'list') && (
        <div className="shrink-0 border-t border-white/5 px-3 pb-1 pt-2" data-testid="chips">
          <div className="flex flex-wrap gap-1.5">
            {phase === 'choice' && pending
              ? pending.offered.map((a) => (
                  <Chip key={a.id} onClick={() => void choose(a, 'choice')} title={a.en}>
                    {a.text}
                  </Chip>
                ))
              : null}
            {phase === 'choice' && (
              <Chip muted onClick={() => setPhase('list')}>
                Noe annet…
              </Chip>
            )}
            {phase === 'unclear' && (
              <>
                {mic && (
                  <Chip strong onClick={() => void retry()}>
                    🎤 Prøv igjen
                  </Chip>
                )}
                <Chip muted onClick={() => setPhase('list')}>
                  Velg svaret ditt…
                </Chip>
              </>
            )}
            {phase === 'list' &&
              [...own, ...universal].map((a) => (
                <Chip key={a.id} muted={a.universal} onClick={() => void choose(a, 'list')} title={a.en}>
                  {a.text}
                </Chip>
              ))}
          </div>
          {phase === 'list' && mic && (
            <button onClick={() => void retry()} className="mt-1.5 text-[12px] text-[#8e918f] underline-offset-2 hover:underline">
              or try saying it again
            </button>
          )}
        </div>
      )}

      {error && <p className="shrink-0 px-4 pb-1 text-[12px] text-rose-300">{error}</p>}

      {/* Composer */}
      {phase === 'finished' ? (
        <div className="flex shrink-0 gap-2 border-t border-white/5 p-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-[#8e918f]/50 px-4 py-2.5 text-[14px] text-[#a8c7fa] transition hover:bg-white/5"
          >
            All conversations
          </button>
          {onNext && nextTitle && (
            <button
              onClick={onNext}
              className="flex-1 rounded-full bg-[#a8c7fa] px-4 py-2.5 text-[14px] font-medium text-[#062e6f] transition hover:bg-[#c2d7fb]"
            >
              Next: {nextTitle}
            </button>
          )}
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2 p-3">
          <div className="flex h-12 flex-1 items-center rounded-full bg-[#2b2d31] px-5 text-[14px] text-[#8e918f]">
            {phase === 'recording' ? (
              <span className="text-rose-300">● Speak now — tap to send</span>
            ) : phase === 'sending' ? (
              <span>Listening…</span>
            ) : phase === 'speaking' ? (
              <span>{character.name} is talking…</span>
            ) : !mic ? (
              <span>This conversation needs a microphone</span>
            ) : phase === 'ready' ? (
              <span>Tap the mic and answer in Norwegian</span>
            ) : (
              <span>Pick an answer above</span>
            )}
          </div>
          {mic && (
            <button
              onClick={() => void toggleMic()}
              disabled={phase !== 'ready' && phase !== 'recording'}
              aria-label={phase === 'recording' ? 'Stop and send' : 'Answer by voice'}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${
                phase === 'recording'
                  ? 'animate-pulse bg-rose-400 text-[#1f1f1f]'
                  : 'bg-[#a8c7fa] text-[#062e6f] enabled:hover:bg-[#c2d7fb]'
              }`}
            >
              {phase === 'recording' ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M3 20.5v-6l8-2.5-8-2.5v-6L22 12z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}
    </>
  )
}

function Chip({
  children,
  onClick,
  muted = false,
  strong = false,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  muted?: boolean
  strong?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-full px-3.5 py-1.5 text-[14px] transition ${
        strong
          ? 'bg-[#a8c7fa] font-medium text-[#062e6f] hover:bg-[#c2d7fb]'
          : muted
            ? 'border border-[#8e918f]/40 text-[#c4c7c5] hover:bg-white/5'
            : 'border border-[#a8c7fa]/60 text-[#a8c7fa] hover:bg-[#a8c7fa]/10'
      }`}
    >
      {children}
    </button>
  )
}
