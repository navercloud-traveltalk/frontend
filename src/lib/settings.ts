const KEY = 'yhm.settings'

export type Voice = '차분한 목소리' | '밝은 목소리' | '담백한 목소리'
export const VOICES: Voice[] = ['차분한 목소리', '밝은 목소리', '담백한 목소리']

export interface Settings { voice: Voice; keepAudio: boolean; fontSize: 15 | 17 | 19 }
const DEFAULTS: Settings = { voice: '차분한 목소리', keepAudio: true, fontSize: 17 }

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* 저장 실패해도 화면은 계속 */
  }
  return next
}
