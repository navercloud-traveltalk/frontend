import type { CSSProperties } from 'react'
import s from './BookCover.module.css'

export type CoverType = 'photo' | 'frame' | 'cloth' | 'type'
export type CoverColor = 'red' | 'teal' | 'navy' | 'slate'

type Props = {
  type: CoverType
  color?: CoverColor
  title: string
  subtitle: string
  photoUrl?: string
  /** 표지 크기. 책 표지 보드 146×184, 책장 선반 92×132 / 76×104 */
  width?: number
  height?: number
  titleSize?: number
  subSize?: number
  brandSize?: number
  className?: string
}

export function BookCover({ type, color = 'red', title, subtitle, photoUrl, width = 146, height = 184, titleSize = 15, subSize = 9, brandSize = 8, className }: Props) {
  const photo: CSSProperties | undefined = photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined
  const vars = { '--w': `${width}px`, '--h': `${height}px`, '--title': `${titleSize}px`, '--sub': `${subSize}px`, '--brand': `${brandSize}px` } as CSSProperties
  const cls = [s.cover, s[type], type !== 'photo' && s[color], className].filter(Boolean).join(' ')
  return (
    <div className={cls} style={vars}>
      {type === 'photo' && <div className={s.bg} style={photo} />}
      <span className={s.band} />
      {type === 'frame' && <div className={s.framePic} style={photo} />}
      {type === 'cloth' && <div className={s.circle} style={photo} />}
      <div className={s.text}>
        <p className={s.title}>{title}</p>
        <p className={s.sub}>{subtitle}</p>
      </div>
      <span className={s.brand}>여행말</span>
    </div>
  )
}
