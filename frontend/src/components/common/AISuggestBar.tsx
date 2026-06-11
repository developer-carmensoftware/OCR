import { CheckCheck, Sparkles, RefreshCw, Loader2 } from 'lucide-react'

interface Props {
  onSuggest: () => void
  onAcceptAll?: () => void
  hasSuggestions?: boolean
  loading?: boolean
  disabled?: boolean
  onRefresh?: () => void
  refreshLoading?: boolean
}

export default function AISuggestBar({
  onSuggest,
  onAcceptAll,
  hasSuggestions = false,
  loading = false,
  disabled = false,
  onRefresh,
  refreshLoading = false,
}: Props) {
  const isDisabled = loading || disabled

  return (
    <div className="ai-suggest-bar">
      {hasSuggestions && onAcceptAll && (
        <button type="button" onClick={onAcceptAll} className="ai-suggest-bar__accept-btn">
          <CheckCheck size={14} />
          Accept All
        </button>
      )}
      <button
        type="button"
        onClick={onSuggest}
        disabled={isDisabled}
        className="ai-suggest-bar__suggest-btn"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        AI Suggest
      </button>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshLoading}
          className="ai-suggest-bar__refresh-btn"
        >
          <RefreshCw size={14} className={refreshLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      )}
    </div>
  )
}
