import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import s from './Avatar.module.css'

/** 인터뷰어 아바타: 호박색→붉은색 방사형 그라데이션 + 펼친 책 */
export function Avatar({ size }: { size: 68 | 132 }) {
  return (
    <div className={s.avatar} style={{ '--s': `${size}px` } as CSSProperties}>
      <Icon name={size === 132 ? 'call-book-46' : 'call-book-24'} size={size === 132 ? 46 : 24} style={{ color: '#fffcf6' }} />
    </div>
  )
}
