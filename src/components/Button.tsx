import type { ButtonHTMLAttributes } from 'react'
import s from './Button.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'text' | 'teal' | 'amber' | 'ghostDark'
}

export function Button({ variant = 'primary', className, ...rest }: Props) {
  return <button className={[s.btn, s[variant], className].filter(Boolean).join(' ')} {...rest} />
}
