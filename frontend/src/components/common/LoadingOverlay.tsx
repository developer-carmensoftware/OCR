import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  show: boolean
  title?: string
  status?: string
}

export default function LoadingOverlay({
  show,
  title = 'AI is extracting data...',
  status,
}: Props) {
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          className="ocr-loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div
            className="ocr-loading-box"
            initial={{ opacity: 0, transform: 'scale(0.95) translateY(12px)' }}
            animate={{ opacity: 1, transform: 'scale(1) translateY(0px)' }}
            exit={{ opacity: 0, transform: 'scale(0.95) translateY(8px)' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ocr-loading-spinner" />
            <div className="ocr-loading-title">{title}</div>
            <div className="ocr-loading-status">{status || 'Please wait...'}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
