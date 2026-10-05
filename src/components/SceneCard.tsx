import { Icon } from './Icon'
import s from './SceneCard.module.css'

type Props = {
  /** "09:40 · 경기전" 또는 간격 장면의 "14:00–16:50" */
  head: string
  title: string
  note: string
  thumbs?: string[]
  gap?: boolean
  onClick?: () => void
}

export function SceneCard({ head, title, note, thumbs = [], gap, onClick }: Props) {
  return (
    <div className={[s.card, gap && s.gap].filter(Boolean).join(' ')} onClick={onClick}>
      <div className={s.info}>
        <p className={s.time}>{head}</p>
        <p className={s.title}>{title}</p>
        <p className={s.note}>{note}</p>
      </div>
      {gap ? (
        <Icon name="quote" size={24} className={s.quote} />
      ) : (
        <div className={s.thumbs}>
          {thumbs.slice(0, 3).map((u, i) => (
            <span key={i} className={s.thumb} style={{ backgroundImage: `url(${u})` }} />
          ))}
        </div>
      )}
    </div>
  )
}
