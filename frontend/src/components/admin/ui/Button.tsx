import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'outline' | 'danger' | 'success' | 'secondary'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'default' | 'sm'
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  danger: 'btn-danger',
  success: 'btn-success',
  secondary: 'btn-secondary',
}

export default function Button({
  variant = 'outline',
  size = 'default',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = ['btn', VARIANT_CLASS[variant], size === 'sm' ? 'btn-sm' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={cls} {...rest} />
}
