import { TriangleAlert } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { warningText, type ExtractionWarning } from '../../lib/reviewReasons'

interface Props {
  /** Strings are what documents extracted before the codes existed still carry. */
  warnings: (ExtractionWarning | string)[]
}

export default function ExtractionWarningBanner({ warnings }: Props) {
  const { t } = useT()
  if (warnings.length === 0) return null

  return (
    <div className="extraction-warning-banner" role="alert">
      <div className="extraction-warning-icon">
        <TriangleAlert size={15} strokeWidth={2.5} />
      </div>
      <div className="extraction-warning-body">
        <span className="extraction-warning-label">{t('cc.extractionWarning')}</span>
        {warnings.map((w, i) => (
          <p key={i} className="extraction-warning-text">
            {warningText(w, t)}
          </p>
        ))}
      </div>
    </div>
  )
}
