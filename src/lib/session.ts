const KEY = 'yhm.user'

export interface Session { userId: string; nickname: string }

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(s: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* 저장 실패해도 화면은 계속 */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}
