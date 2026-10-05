import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import s from './TabBar.module.css'

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: '책장', icon: 'library', end: true },
  { to: '/today', label: '오늘', icon: 'moon-star' },
  { to: '/settings', label: '설정', icon: 'settings' },
]

/** 책장 · 사진 올리기 · 설정 화면 전용. 통화와 리더에는 쓰지 않는다. */
export function TabBar({ active }: { active?: '/' | '/today' | '/settings' }) {
  return (
    <nav className={s.bar} aria-label="하단 탭">
      {TABS.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => [s.tab, (active ? active === to : isActive) && s.active].filter(Boolean).join(' ')}
        >
          <Icon name={icon} size={21} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
