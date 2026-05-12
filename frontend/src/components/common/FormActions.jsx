import { ArrowLeft, X, ArrowRight } from 'lucide-react'

export default function FormActions({ onCancel, onBack, onSubmit, submitLabel, showBack }) {
  return (
    <div className="form-actions" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
      {showBack && (
        <button className="btn btn-outline" onClick={onBack} style={{ marginRight: 'auto' }}>
          <ArrowLeft size={14} /> Back
        </button>
      )}
      <button className="btn btn-secondary" onClick={onCancel}>
        <X size={14} /> Cancel
      </button>
      <div className="form-actions-sep" />
      <button className="btn btn-primary" onClick={onSubmit}>
        <ArrowRight size={14} /> {submitLabel || 'Submit Data'}
      </button>
    </div>
  )
}
