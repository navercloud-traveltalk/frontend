import s from './DayNavigation.module.css'

type Props = {
  label: string
  previousLabel?: string
  nextLabel?: string
  onPrevious?: () => void
  onNext?: () => void
}

export function DayNavigation({ label, previousLabel = '이전 일차 이야기', nextLabel = '다음 일차 이야기', onPrevious, onNext }: Props) {
  return (
    <nav className={s.nav} aria-label="일차별 이야기 이동">
      <button type="button" disabled={!onPrevious} onClick={onPrevious} aria-label={previousLabel}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
      </button>
      <span>{label}</span>
      <button type="button" disabled={!onNext} onClick={onNext} aria-label={nextLabel}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
      </button>
    </nav>
  )
}
