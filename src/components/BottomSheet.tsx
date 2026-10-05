import { useEffect, type ReactNode } from 'react'
import s from './BottomSheet.module.css'

type Props = { open: boolean; onClose: () => void; title?: string; children: ReactNode; minHeight?: number }

export function BottomSheet({ open, onClose, title, children, minHeight }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className={s.root}>
      <div className={s.dim} onClick={onClose} />
      <div className={s.sheet} style={minHeight ? { minHeight } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div className={s.handle} />
        {title && <h2 className={s.title}>{title}</h2>}
        {children}
      </div>
    </div>
  )
}
