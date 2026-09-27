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

export function speak(text: string, audioUrl?: string | null): void {
  if (audioUrl) {
    void new Audio(audioUrl).play()
    return
  }
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'nb-NO'
  if (norwegianVoice) utterance.voice = norwegianVoice
  utterance.rate = 0.9 // slightly slower for learners
  window.speechSynthesis.speak(utterance)
}
