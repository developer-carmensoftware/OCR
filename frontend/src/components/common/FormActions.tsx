import { ArrowLeft, X, ArrowRight } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'

interface Props {
  onCancel: () => void
  onBack?: () => void
  onSubmit: () => void
  submitLabel?: string
  showBack?: boolean
}

export default function FormActions({ onCancel, onBack, onSubmit, submitLabel, showBack }: Props) {
  const { t } = useT()
  return (
    <div className="form-actions" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
      {showBack && (
        <button
          type="button"
          className="btn btn-outline"
          onClick={onBack}
          style={{ marginRight: 'auto' }}
        >
          <ArrowLeft size={14} /> {t('common.back')}
        </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        <X size={14} /> {t('common.cancel')}
      </button>
      <div className="form-actions-sep" />
      <button type="button" className="btn btn-primary" onClick={onSubmit}>
        <ArrowRight size={14} /> {submitLabel || t('common.submitData')}
      </button>
    </div>
  )
}
