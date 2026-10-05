import type { CoverColor } from './BookCover'
import s from './BookSpine.module.css'

/** 여행 일수 → 책등 두께: 1–2일 24px, 3–5일 34px, 6일 이상 46px */
export function spineWidth(days: number) {
  return days <= 2 ? 24 : days <= 5 ? 34 : 46
}

type Props = { title: string; label: string; days?: number; width?: number; height?: number; color?: CoverColor; onClick?: () => void }

/** 책등. 글자는 Figma처럼 90° 돌려서 위→아래로 읽힌다. */
export function BookSpine({ title, label, days = 3, width, height = 148, color = 'red', onClick }: Props) {
  const w = width ?? spineWidth(days)
  const titleLen = height - 58
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={[s.spine, s[color]].join(' ')} style={{ width: w, height }} onClick={onClick} aria-label={`${title}, ${label}`}>
      <div className={s.tbox} style={{ width: w - 8, height: titleLen }}>
        <div className={s.rot}>
          <div className={s.title} style={{ width: titleLen, height: w - 8 }}>
            <p>{title}</p>
          </div>
        </div>
      </div>
      <div className={s.lbox}>
        <div className={s.rot}>
          <p className={s.label}>{label}</p>
        </div>
      </div>
    </Tag>
  )
}
