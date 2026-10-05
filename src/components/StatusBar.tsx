import s from './StatusBar.module.css'

const SHOW = import.meta.env.VITE_FAKE_STATUS_BAR !== 'false'

/** Figma 프레임의 iOS 상태 막대. 실기기에서는 VITE_FAKE_STATUS_BAR=false 로 끈다. */
export function StatusBar({ tone = 'light', gap = 8 }: { tone?: 'light' | 'dark'; gap?: number }) {
  if (!SHOW) return null
  const suffix = tone === 'dark' ? '-w' : ''
  return (
    <div className={[s.bar, tone === 'dark' && s.dark].filter(Boolean).join(' ')}>
      <span className={s.time}>9:41</span>
      <span className={s.icons} style={{ gap }}>
        <img src={`/img/ios-signal${suffix}.svg`} width={16} height={16} alt="" />
        <img src={`/img/ios-wifi${suffix}.svg`} width={16} height={16} alt="" />
        <img src={`/img/ios-battery${suffix}.svg`} width={22} height={22} alt="" />
      </span>
    </div>
  )
}
