// Norwegian text-to-speech. Pre-generated audio (MinIO/Piper, M2) takes
// priority when a card carries an audio URL; otherwise fall back to the
// browser's speech synthesis with a Norwegian voice.

let norwegianVoice: SpeechSynthesisVoice | null = null

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? []
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith('nb')) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('no')) ??
    null
  )
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  norwegianVoice = pickVoice()
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    norwegianVoice = pickVoice()
  })
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Audio URLs that 404ed (clip not generated yet) — fall back to TTS for these.
const missingAudio = new Set<string>()

// Only one voice at a time: whatever is playing gets stopped before a new
// clip or utterance starts (React StrictMode double-fires the autoplay
// effect, and replay/speed clicks can land mid-clip).
let currentPlayer: HTMLAudioElement | null = null

export function stopSpeech(): void {
  if (currentPlayer) {
    currentPlayer.pause()
    currentPlayer = null
  }
  if (canSpeak()) window.speechSynthesis.cancel()
}

export function speak(text: string, audioUrl?: string | null): void {
  stopSpeech()
  if (audioUrl && !missingAudio.has(audioUrl)) {
    const player = new Audio(audioUrl)
    currentPlayer = player
    player.play().catch(() => {
      // A rejection from being stopped by a newer speak() isn't a missing clip.
      if (currentPlayer !== player) return
      currentPlayer = null
      missingAudio.add(audioUrl)
      speak(text)
    })
    return
  }
  if (!canSpeak()) return
  // Re-resolve at speak time: Chrome fills getVoices() asynchronously, and
  // without an explicit voice it falls back to the default voice (often an
  // English one) regardless of utterance.lang.
  if (!norwegianVoice) norwegianVoice = pickVoice()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'nb-NO'
  if (norwegianVoice) utterance.voice = norwegianVoice
  utterance.rate = 0.9 // slightly slower for learners
  window.speechSynthesis.speak(utterance)
}
