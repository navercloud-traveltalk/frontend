let current: HTMLAudioElement | null = null

/** 저장된 음성 파일을 재생한다. mock 주소(mock://)면 브라우저 음성 합성으로 대신 읽어 준다. 재생이 끝나면 resolve. */
export function playVoice(audioUrl: string, fallbackText = ''): Promise<void> {
  stopVoice()
  if (audioUrl.startsWith('mock://')) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window) || !fallbackText) return window.setTimeout(resolve, 1200), undefined
      const u = new SpeechSynthesisUtterance(fallbackText)
      u.lang = 'ko-KR'
      u.onend = () => resolve()
      u.onerror = () => resolve()
      window.speechSynthesis.speak(u)
    })
  }
  return new Promise((resolve, reject) => {
    const a = new Audio(audioUrl)
    current = a
    a.onended = () => resolve()
    a.onerror = () => reject(new Error('audio'))
    a.play().catch(reject)
  })
}

export function stopVoice() {
  current?.pause()
  current = null
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
