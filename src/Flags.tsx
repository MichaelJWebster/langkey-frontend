// Which way a card is being asked, shown as flag → flag so it can't be missed.

function NorwegianFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 44" className={className} role="img" aria-label="Norwegian">
      <rect width="60" height="44" fill="#BA0C2F" />
      <path d="M16 0h12v44H16z M0 16h60v12H0z" fill="#fff" />
      <path d="M19 0h6v44h-6z M0 19h60v6H0z" fill="#00205B" />
    </svg>
  )
}

function BritishFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 44" className={className} role="img" aria-label="English">
      <rect width="60" height="44" fill="#012169" />
      <path d="M0 0l60 44M60 0L0 44" stroke="#fff" strokeWidth="9" />
      <path d="M0 0l60 44M60 0L0 44" stroke="#C8102E" strokeWidth="4.5" />
      <path d="M30 0v44M0 22h60" stroke="#fff" strokeWidth="15" />
      <path d="M30 0v44M0 22h60" stroke="#C8102E" strokeWidth="9" />
    </svg>
  )
}

/**
 * `direction` is the card's FSRS direction: recognition asks Norwegian and
 * wants English, production the other way round.
 */
export default function DirectionBanner({ direction }: { direction: string }) {
  const toEnglish = direction === 'recognition'
  const From = toEnglish ? NorwegianFlag : BritishFlag
  const To = toEnglish ? BritishFlag : NorwegianFlag
  const label = toEnglish ? 'Write the English' : 'Write the Norwegian'

  return (
    <div className="flex items-center justify-center gap-3">
      <From className="h-7 w-10 rounded-[3px] shadow ring-1 ring-white/20" />
      <svg
        viewBox="0 0 44 20"
        className="h-5 w-11 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 10h36M30 2l8 8-8 8" />
      </svg>
      <To className="h-7 w-10 rounded-[3px] shadow ring-1 ring-white/20" />
      <span className="ml-1 text-xs font-semibold tracking-wide text-slate-400">{label}</span>
    </div>
  )
}
