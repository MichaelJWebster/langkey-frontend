// What the model heard, word by word.
//
// Never a score. A transcript can lose a word for reasons that have nothing to
// do with the speaker, so a single take only ever shows what happened; the
// running tally beside a word is what turns that into something worth acting
// on (ADR-036).

import type { Transcript, WordMark, WordRecord } from './api'

const STYLE: Record<WordMark['verdict'], string> = {
  said: 'text-emerald-300',
  slipped: 'text-amber-300 underline decoration-amber-400/50 decoration-dotted underline-offset-4',
  missed: 'text-rose-300 line-through decoration-rose-400/50',
}

export default function WordFeedback({ transcript }: { transcript: Transcript }) {
  const byWord = new Map<string, WordRecord>(transcript.history.map((h) => [h.word, h]))
  const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const patterns = transcript.history.filter((h) => h.pattern)
  const heard = transcript.text.trim()

  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-slate-500">
        What the model heard
      </p>

      <p className="mt-1.5 leading-relaxed">
        {transcript.words.map((w, i) => {
          const record = byWord.get(bare(w.word))
          const enough = record && record.attempts >= transcript.attempts_for_pattern
          return (
            <span key={`${w.word}-${i}`} className="mr-1.5 inline-block">
              <span className={STYLE[w.verdict]} title={w.heard ? `heard “${w.heard}”` : undefined}>
                {w.word}
              </span>
              {w.heard && w.verdict !== 'said' && (
                <span className="ml-1 text-xs text-slate-500">→ {w.heard}</span>
              )}
              {enough && (
                <span
                  className={`ml-1 text-[10px] tabular-nums ${
                    record.pattern ? 'text-amber-400/80' : 'text-slate-600'
                  }`}
                  title={`${record.said} of ${record.attempts} attempts came through`}
                >
                  {record.said}/{record.attempts}
                </span>
              )}
            </span>
          )
        })}
      </p>

      {heard && heard.toLowerCase() !== transcript.target.toLowerCase() && (
        <p className="mt-1.5 text-xs italic text-slate-500">“{heard}”</p>
      )}

      {patterns.length > 0 && (
        <p className="mt-2 border-t border-white/10 pt-2 text-xs text-amber-300/90">
          Worth practising:{' '}
          {patterns.map((p, i) => (
            <span key={p.word}>
              {i > 0 && ', '}
              <span className="font-medium">{p.word}</span>{' '}
              <span className="tabular-nums text-amber-400/60">
                {p.said}/{p.attempts}
              </span>
            </span>
          ))}
        </p>
      )}

      <p className="mt-2 text-[10px] text-slate-600">
        A guide, not a grade — the model mishears for its own reasons too. The counts are
        what to trust.
      </p>
    </div>
  )
}
