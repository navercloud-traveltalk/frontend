import { IconCheck } from './icons'
import s from './Toast.module.css'

export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className={s.wrap} role="status">
      <div className={s.toast}>
        <IconCheck size={16} />
        {message}
      </div>
    </div>
  )
}
