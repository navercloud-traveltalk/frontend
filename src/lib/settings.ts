import type { VoiceCode } from '../api/types'

const KEY = 'yhm.settings'

/** 화면 표시 이름 (서버에는 코드로 저장) */
export const VOICE_LABELS: Record<VoiceCode, string> = { CALM: '차분한 목소리', BRIGHT: '밝은 목소리', PLAIN: '담백한 목소리' }
export const VOICE_CODES = Object.keys(VOICE_LABELS) as VoiceCode[]

/** 리더 글자 크기는 이 기기에만 저장한다 */
export interface LocalSettings { fontSize: 15 | 17 | 19 }
const DEFAULTS: LocalSettings = { fontSize: 17 }

export function getSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LocalSettings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(patch: Partial<LocalSettings>): LocalSettings {
  const next = { ...getSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* 저장 실패해도 화면은 계속 */
  }
  return next
}
