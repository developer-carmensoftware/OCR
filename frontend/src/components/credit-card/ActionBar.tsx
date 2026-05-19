import { Bot } from 'lucide-react'

interface Props {
  loading: boolean
  status: string
  onProcess: () => void
}

export default function ActionBar({ loading, status, onProcess }: Props) {
  return (
    <div className="action-bar">
      <button id="btnProcess" onClick={onProcess} disabled={loading}>
        <Bot size={14} /> Extract Data (AI OCR)
      </button>
      {loading && <div className="loader" />}
      {status && <span className="status-text">{status}</span>}
    </div>
  )
}
