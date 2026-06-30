import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { m, AnimatePresence } from 'framer-motion'
import { FileText, Info, CheckCircle2, XCircle, Lock, ArrowLeft } from 'lucide-react'
import { getCarmenUrl } from '../../lib/url'
import '../../styles/components/user-consent.css'

type Lang = 'th' | 'en'

const COPY = {
  th: {
    title: 'การอัปเดตเงื่อนไขการให้บริการ และ ขอความยินยอมการใช้งานฟีเจอร์ AI',
    intro:
      'เพื่อเป็นการยกระดับประสิทธิภาพและลดระยะเวลาในการทำงาน ระบบได้เพิ่มคุณสมบัติ AI (Optical Character Recognition) ซึ่งเป็นเทคโนโลยีปัญญาประดิษฐ์ที่ช่วยในการอ่าน ดึงข้อมูล และแปลงข้อความจากไฟล์ภาพหรือเอกสารเข้าสู่ระบบโดยอัตโนมัติ',
    purposeHead: 'วัตถุประสงค์ของการประมวลผล',
    purposeBody:
      'ข้อมูลที่ท่านอัปโหลดผ่านฟีเจอร์นี้ (เช่น ใบแจ้งหนี้, ใบเสร็จรับเงิน, หรือเอกสารสายยืนตัวตน) จะถูกส่งไปประมวลผลผ่านระบบ AI เพื่อแปลงเป็นข้อมูลดิจิทัลสำหรับการใช้งานในระบบ ERP ของท่านเท่านั้น',
    privacyHead: 'การคุ้มครองข้อมูลส่วนบุคคล (Data Privacy & Security)',
    bullet1:
      'ระบบจะทำการประมวลผลข้อมูลตามคำสั่งของท่านเท่านั้น และจะไม่มีการนำข้อมูลของท่านไปใช้เพื่อวัตถุประสงค์อื่น',
    bullet2: 'ข้อมูลของท่าน จะไม่ถูกนำไปใช้เพื่อการฝึกฝน (Train) โมเดล AI สาธารณะภายนอก',
    bullet3:
      'ข้อมูลทั้งหมดจะถูกเข้ารหัสความปลอดภัยทั้งระหว่างการรับส่งข้อมูล (In-transit) และการจัดเก็บ (At-rest) ตามมาตรฐานความปลอดภัยของบริษัท',
    callout:
      'ฟีเจอร์ AI เป็นทางเลือกเสริม (Optional) เพื่ออำนวยความสะดวก ระบบไม่ได้บังคับการใช้งาน ท่านยังสามารถใช้งานในรูปแบบปกติต่อไปได้ทันที',
    checkLabel: (
      <>
        ข้าพเจ้าในฐานะผู้มีอำนาจขององค์กร ได้อ่านและทำความเข้าใจเงื่อนไขดังกล่าว และ{' '}
        <strong>ยินยอม</strong> ให้ระบบประมวลผลเอกสารผ่านฟีเจอร์ AI
      </>
    ),
    confirmBtn: 'ยินยอม',
    backBtn: 'กลับไปยัง Carmen',
  },
  en: {
    title: 'Terms of Service Update & AI Consent',
    intro:
      'To enhance efficiency and reduce processing time, the system has introduced the AI (Optical Character Recognition) feature. This artificial intelligence technology automatically reads, extracts data, and converts text from image files or documents into the system.',
    purposeHead: 'Purpose of Processing',
    purposeBody:
      'The data you upload through this feature will be processed via the AI system to convert it into digital data strictly for use within your Carmen Cloud system only.',
    privacyHead: 'Data Privacy & Security',
    bullet1:
      'The system will process the data solely based on your instructions and will not use your data for any other purposes.',
    bullet2: 'Your data will NOT be used to train external public AI models.',
    bullet3:
      "All data will be securely encrypted both during transmission (In-transit) and storage (At-rest) in accordance with the company's security standards.",
    callout:
      'The AI feature is an optional add-on provided for your convenience. Its usage is not mandatory, and you may continue using the system in its standard format immediately.',
    checkLabel: (
      <>
        As an authorized representative of the organization, I have read, understood, and{' '}
        <strong>consent</strong> to the processing of documents via the AI feature.
      </>
    ),
    confirmBtn: 'Confirm',
    backBtn: 'Back to Carmen',
  },
} as const

interface Props {
  show: boolean
  onConfirm: () => void
}

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 480
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 480px)')
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return mobile
}

export default function UserConsentModal({ show, onConfirm }: Props) {
  const [lang, setLang] = useState<Lang>('en')
  const [checked, setChecked] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  const c = COPY[lang]

  // Focus trap: Tab wraps within the dialog; Escape is blocked
  useEffect(() => {
    if (!show) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        return
      }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"])'
        )
      )
      if (focusable.length < 2) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [show])

  return createPortal(
    <AnimatePresence>
      {show && (
        <m.div
          className="uc-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <m.div
            ref={dialogRef}
            className="uc-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="uc-title"
            initial={isMobile ? { opacity: 0, y: '4%' } : { opacity: 0, scale: 0.95, y: 16 }}
            animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { opacity: 0, y: '4%' } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="uc-header">
              <div className="uc-icon" aria-hidden="true">
                <FileText size={20} strokeWidth={1.75} />
              </div>
              <h2 className="uc-title" id="uc-title">
                {c.title}
              </h2>
              <section className="uc-lang-toggle" aria-label="Language">
                <button
                  type="button"
                  className={`uc-lang-btn${lang === 'th' ? ' active' : ''}`}
                  onClick={() => setLang('th')}
                  aria-pressed={lang === 'th'}
                >
                  TH
                </button>
                <button
                  type="button"
                  className={`uc-lang-btn${lang === 'en' ? ' active' : ''}`}
                  onClick={() => setLang('en')}
                  aria-pressed={lang === 'en'}
                >
                  EN
                </button>
              </section>
            </div>

            {/* Body */}
            <div className="uc-body">
              <p className="uc-intro">{c.intro}</p>

              <div className="uc-section">
                <p className="uc-section-heading">{c.purposeHead}</p>
                <p className="uc-section-body">{c.purposeBody}</p>
              </div>

              <div className="uc-section">
                <p className="uc-section-heading">{c.privacyHead}</p>
                <div className="uc-icon-list">
                  <div className="uc-icon-bullet">
                    <CheckCircle2
                      size={16}
                      strokeWidth={2}
                      className="uc-ibullet-icon uc-ibullet-icon--emerald"
                      aria-hidden="true"
                    />
                    <span>{c.bullet1}</span>
                  </div>
                  <div className="uc-icon-bullet">
                    <XCircle
                      size={16}
                      strokeWidth={2}
                      className="uc-ibullet-icon uc-ibullet-icon--rose"
                      aria-hidden="true"
                    />
                    <span className="uc-bullet-highlight">{c.bullet2}</span>
                  </div>
                  <div className="uc-icon-bullet">
                    <Lock
                      size={16}
                      strokeWidth={2}
                      className="uc-ibullet-icon uc-ibullet-icon--primary"
                      aria-hidden="true"
                    />
                    <span>{c.bullet3}</span>
                  </div>
                </div>
              </div>

              <div className="uc-callout" role="note">
                <Info size={16} strokeWidth={1.75} className="uc-callout-icon" aria-hidden="true" />
                <p className="uc-callout-text">{c.callout}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="uc-footer">
              <div className="uc-check-area">
                <label className="uc-check-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => setChecked(e.target.checked)}
                    aria-describedby="uc-check-label"
                  />
                  <span className="uc-check-label" id="uc-check-label">
                    {c.checkLabel}
                  </span>
                </label>
              </div>

              <div className="uc-actions">
                <a href={getCarmenUrl('/')} className="uc-back-btn">
                  <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
                  {c.backBtn}
                </a>
                <button
                  type="button"
                  className="uc-confirm-btn"
                  disabled={!checked}
                  onClick={onConfirm}
                >
                  {c.confirmBtn}
                </button>
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
