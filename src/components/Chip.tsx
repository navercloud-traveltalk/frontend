import type { ButtonHTMLAttributes, ReactNode } from 'react'
import s from './Chip.module.css'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  selected?: boolean
  tone?: 'light' | 'dark'
  leading?: ReactNode
  children: ReactNode
}

export function Chip({ selected, tone = 'light', leading, children, className, ...rest }: Props) {
  const cls = [s.chip, selected && s.selected, tone === 'dark' && s.dark, className].filter(Boolean).join(' ')
  return (
    <button type="button" className={cls} aria-pressed={selected} {...rest}>
      {leading}
      {children}
    </button>
  )
}

/** 누를 수 없는 태그형 칩 (포착 순간 등) */
export function Tag({ children, tone = 'light', leading, size = 'sm' }: { children: ReactNode; tone?: 'light' | 'dark'; leading?: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <span className={[s.chip, size === 'sm' && s.tag, tone === 'dark' && s.dark].filter(Boolean).join(' ')}>
      {leading}
      {children}
    </span>
  )
}
