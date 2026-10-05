import s from './Waveform.module.css'

const HEIGHTS = [16, 30, 44, 26, 52, 36, 46, 24, 40, 28, 18]

type Props = { tone?: 'amber' | 'teal'; active?: boolean; dim?: boolean }

/** 인터뷰어 발화(amber) / 내 발화(teal). active면 막대가 움직인다. */
export function Waveform({ tone = 'amber', active = false, dim = false }: Props) {
  return (
    <div className={[s.wave, s[tone], active && s.active, dim && s.dim].filter(Boolean).join(' ')} aria-hidden="true">
      {HEIGHTS.map((h, i) => (
        <span key={i} style={{ height: h, animationDelay: `${(i % 5) * 0.12}s` }} />
      ))}
    </div>
  )
}

/** 생각하는 중 점 3개 */
export function ThinkingDots() {
  return (
    <div className={s.dots} aria-hidden="true">
      <span /><span /><span />
    </div>
  )
}
