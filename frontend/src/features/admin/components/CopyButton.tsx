import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import Button from '@/shared/components/ui/Button'
import { useT } from '@/i18n/LanguageContext'

interface CopyButtonProps {
  value: string
  /** Visible label. Omit for an icon-only button, which then needs `ariaLabel`. */
  label?: string
  ariaLabel?: string
  variant?: 'primary' | 'outline'
  className?: string
}

/** Copies `value`; the icon turns into a check for a moment and a live region says "Copied". */
export default function CopyButton({
  value,
  label,
  ariaLabel,
  variant = 'outline',
  className,
}: CopyButtonProps) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      toast.error(t('admin.common.copyFailed'))
      return
    }
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1400)
  }

  const Icon = copied ? Check : Copy
  return (
    <Button
      size="sm"
      variant={variant}
      onClick={copy}
      aria-label={label ? undefined : (ariaLabel ?? t('admin.common.copy'))}
      title={label ? undefined : (ariaLabel ?? t('admin.common.copy'))}
      className={`copy-btn${label ? '' : ' copy-btn--icon'}${copied ? ' is-copied' : ''}${className ? ` ${className}` : ''}`}
    >
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      {label && <span>{copied ? t('admin.common.copied') : label}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? t('admin.common.copied') : ''}
      </span>
    </Button>
  )
}
