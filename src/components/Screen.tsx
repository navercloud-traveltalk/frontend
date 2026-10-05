import type { ReactNode } from 'react'
import { StatusBar } from './StatusBar'
import { Icon } from './Icon'
import s from './Screen.module.css'

/** 모든 화면의 뼈대: 상태 막대 + 세로 flex. 390px 기준, 높이는 최소 한 화면. */
export function Screen({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <div className={[s.screen, tone === 'dark' && s.dark].filter(Boolean).join(' ')}>
      <StatusBar tone={tone} />
      {children}
    </div>
  )
}

/** 머리글: 제목(+부제) 또는 뒤로가기 + 제목 */
export function Header({ title, sub, onBack, height }: { title: string; sub?: string; onBack?: () => void; height?: number }) {
  return (
    <header className={s.header} style={height ? { height } : undefined}>
      {onBack && (
        <button type="button" className={s.back} onClick={onBack} aria-label="뒤로">
          <Icon name="chevron-left" size={24} />
        </button>
      )}
      <div className={s.titles}>
        <h1 className={s.title}>{title}</h1>
        {sub && <p className={s.sub}>{sub}</p>}
      </div>
    </header>
  )
}
