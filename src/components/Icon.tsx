import type { CSSProperties } from 'react'

export type IconName =
  | 'library' | 'moon-star' | 'settings' | 'plus' | 'chevron-left'
  | 'map-pin' | 'calendar-days' | 'book-open' | 'check' | 'image' | 'quote' | 'sliders-horizontal'
  | 'call-book-24' | 'call-book-46' | 'phone-off-25' | 'phone-off-28' | 'phone-28'
  | 'pen-line' | 'file-down' | 'book-image' | 'bookmark' | 'play' | 'chevron-right'

/** Figma에서 받은 SVG를 마스크로 써서 currentColor로 칠한다. */
export function Icon({ name, size, className, style }: { name: IconName; size: number; className?: string; style?: CSSProperties }) {
  const url = `url(/img/${name}.svg)`
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        flex: 'none',
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        WebkitMask: `${url} center / 100% 100% no-repeat`,
        mask: `${url} center / 100% 100% no-repeat`,
        ...style,
      }}
    />
  )
}
