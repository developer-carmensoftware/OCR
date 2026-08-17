import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Waves, X } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { SpotProvider } from './Spot'
import { CANVAS_WIDTH, useCamera } from './useCamera'
import type { TutorialStep } from './types'

/**
 * The standard guided-tour modal. One per module: pass it the steps, it owns the
 * chrome — the camera, the highlight, progress, navigation, keyboard, focus.
 *
 * To add a tutorial to a module:
 *   1. write the step copy as `TutorialStepDefinition[]` in content/tutorials/
 *   2. build the figures, marking anything a step points at with <Spot id="…">
 *   3. render <TutorialModal open onClose steps title /> from the page
 *
 * The stage never scrolls. Each figure is a page-sized picture and the camera
 * frames it: a step with no `spot` shows the whole thing, a step with one zooms
 * to it, and the move between the two is the transition. Scrolling a picture the
 * reader cannot act on is friction, and it hides the thing being pointed at.
 *
 * Native <dialog>, so focus trapping, Escape, inertness of the page behind, and
 * top-layer painting are the platform's job rather than ours — the same reason
 * AppHeader uses the popover API for its overflow menu.
 */

/** `**bold**` → <strong>. A whole markdown parser is not the ask; this is. */
export function boldify(line: string): ReactNode[] {
  return line
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}

const BULLET = '•'

/**
 * Whether the tour animates, remembered per device.
 *
 * A camera that zooms and pans across a full-bleed picture is exactly the
 * large-field optical flow that makes some people motion-sick, and someone
 * feeling ill will not go looking through OS settings for relief. So: the
 * default follows `prefers-reduced-motion`, the switch is in the tour's own
 * header, and the choice sticks.
 *
 * A raw key, like `theme` and `lang`: this is a device-level preference about
 * the person, not tenant data.
 */
const CALM_KEY = 'tutorial:calm'

function readCalm(): boolean | null {
  const saved = localStorage.getItem(CALM_KEY)
  return saved === null ? null : saved === '1'
}

/**
 * How long the modal takes to fade out. The parent unmounts on `onClose`, so the
 * exit has to finish before that call, not after it.
 */
const EXIT_MS = 180

/** Smallest corner the highlight will draw, in stage px. */
const MIN_RADIUS = 12

interface Props {
  open: boolean
  onClose: () => void
  /** Modal heading, already translated. */
  title: string
  steps: TutorialStep[]
  /**
   * Optional call to action on the last step, e.g. "Buy a package". The modal
   * closes itself afterwards — a tour's last action is always "let me get on
   * with it" — so `onClick` is only for what the module wants to do first.
   */
  finish?: { label: string; onClick?: () => void }
}

export default function TutorialModal({ open, onClose, title, steps, finish }: Props) {
  const { t, lang } = useT()
  const systemReduce = useReducedMotion()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const exitTimer = useRef<number>(undefined)
  const [index, setIndex] = useState(0)
  const [closing, setClosing] = useState(false)
  // null = follow the system; true/false = the reader said so, here, explicitly.
  const [calm, setCalm] = useState<boolean | null>(readCalm)
  const still = calm ?? !!systemReduce

  const total = steps.length
  const step = steps[index]
  const copy = step?.[lang]
  const Icon = step?.icon
  const isLast = index === total - 1

  // Consecutive steps often share one figure (the catalog carries the overview,
  // the plans and the top-ups). Keying the crossfade on the figure — not the
  // step — is what lets the camera move across a screen that stays put.
  const figureKey = steps.findIndex(s => s.figure === step?.figure)
  const canvasWidth = step?.canvasWidth ?? CANVAS_WIDTH
  const { stageRef, canvasRef, view, rect, radius } = useCamera(step?.spot, figureKey, canvasWidth)

  const go = useCallback((to: number) => setIndex(Math.min(Math.max(to, 0), total - 1)), [total])

  const toggleCalm = () => {
    const next = !still
    localStorage.setItem(CALM_KEY, next ? '1' : '0')
    setCalm(next)
  }

  // Closing is the modal's own business, so every route out of it goes through
  // here: the fade has to play while the dialog is still mounted, and calling
  // `onClose` is what unmounts it. Calm skips straight to the end.
  const requestClose = useCallback(() => {
    if (still) {
      onClose()
      return
    }
    setClosing(true)
    exitTimer.current = window.setTimeout(onClose, EXIT_MS)
  }, [still, onClose])

  useEffect(() => () => window.clearTimeout(exitTimer.current), [])

  // Optional calls: jsdom implements no <dialog> methods, and rendering inline
  // is the right fallback wherever they are missing.
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      setIndex(0)
      if (!el.open) el.showModal?.()
    } else if (el.open) {
      el.close?.()
    }
  }, [open])

  // Arrow keys walk the tour; Escape is the dialog's own. Body scroll is locked
  // the same way OrderDrawer does it — a modal dialog makes the page inert but
  // not unscrollable, and the page sliding behind the backdrop reads as a bug.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, index, go])

  if (!step || !copy) return null

  // A short ease-out tween, not a spring: a spring overshoots, and the settle at
  // the end of a full-bleed zoom is the part that turns the stomach.
  const glide = still
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }

  // The highlight lives in the stage's coordinates, not the canvas's, so its
  // ring keeps the same weight at every zoom instead of being scaled with the
  // page. Same transition as the camera, so the two travel together.
  const frame = rect && {
    x: view.x + view.scale * rect.x,
    y: view.y + view.scale * rect.y,
    width: view.scale * rect.width,
    height: view.scale * rect.height,
  }

  return (
    <dialog
      ref={dialogRef}
      className={`tut${still ? ' is-calm' : ''}${closing ? ' is-closing' : ''}`}
      aria-label={title}
      // Escape closes a native dialog instantly; take it over so it fades like
      // every other way out.
      onCancel={e => {
        e.preventDefault()
        requestClose()
      }}
      onClose={onClose}
    >
      <header className="tut-head">
        <h2 className="tut-title">{title}</h2>
        <span className="tut-count">{t('tutorial.stepOf', { n: index + 1, total })}</span>
        <button
          type="button"
          className={`tut-calm${still ? ' is-on' : ''}`}
          onClick={toggleCalm}
          aria-pressed={still}
          title={t('tutorial.calmHint')}
        >
          <Waves size={15} />
          <span>{t('tutorial.calm')}</span>
        </button>
        <button
          type="button"
          className="tut-close"
          onClick={requestClose}
          aria-label={t('tutorial.close')}
        >
          <X size={16} />
        </button>
      </header>

      <div className="tut-body">
        <aside className="tut-narration">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={index}
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={still ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: still ? 0 : 0.16, ease: 'easeOut' }}
            >
              <div className="tut-narration-icon" aria-hidden="true">
                {Icon ? <Icon size={18} /> : null}
              </div>
              <h3 className="tut-heading">{copy.heading}</h3>
              {copy.body.map(line => (
                <p
                  key={line}
                  className={line.startsWith(BULLET) ? 'tut-line tut-line--bullet' : 'tut-line'}
                >
                  {boldify(line.startsWith(BULLET) ? line.slice(1).trim() : line)}
                </p>
              ))}
              {isLast && finish && (
                <button
                  type="button"
                  className="tut-cta"
                  onClick={() => {
                    finish.onClick?.()
                    requestClose()
                  }}
                >
                  {finish.label}
                </button>
              )}
            </m.div>
          </AnimatePresence>
        </aside>

        <div className="tut-stage" ref={stageRef}>
          {/* Crossfade layer: opacity and nothing else. It must not own a
              transform — framer writes `transform` for any animated `scale`,
              and it would fight the camera below for the same property. */}
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={figureKey}
              className="tut-canvas-fade"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={still ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: still ? 0 : 0.18, ease: 'easeOut' }}
            >
              <m.div
                ref={canvasRef}
                className="tut-canvas"
                // One attribute kills every click, focus stop and key press in
                // the figure — the real components inside would otherwise print,
                // open a file picker, or fire a request.
                inert
                style={{ width: canvasWidth }}
                // `initial={false}`: a figure that has just mounted starts where
                // the camera already is, so entering a screen is a crossfade and
                // only moving within one is a zoom.
                initial={false}
                animate={{ x: view.x, y: view.y, scale: view.scale }}
                transition={glide}
              >
                <SpotProvider value={step.spot ?? ''}>{step.figure}</SpotProvider>
              </m.div>
            </m.div>
          </AnimatePresence>

          {frame && (
            <m.div
              className="tut-highlight"
              aria-hidden="true"
              data-spot-active={step.spot}
              // The highlight copies the target's corners, but a square-cornered
              // target (a bare <section>, a toolbar) gets a floor: in stage px,
              // so it stays the same softness at every zoom.
              style={{ borderRadius: Math.max(radius * view.scale, MIN_RADIUS) }}
              initial={{ ...frame, opacity: 0 }}
              animate={{ ...frame, opacity: 1 }}
              transition={glide}
            />
          )}
        </div>
      </div>

      <footer className="tut-foot">
        <ol className="tut-pips">
          {steps.map((s, i) => (
            <li key={`${s.spot ?? 'overview'}-${i}`}>
              <button
                type="button"
                className={`tut-pip${i === index ? ' is-current' : ''}${i < index ? ' is-done' : ''}`}
                aria-label={s[lang].title}
                aria-current={i === index ? 'step' : undefined}
                onClick={() => go(i)}
              />
            </li>
          ))}
        </ol>

        <div className="tut-nav">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <ChevronLeft size={14} /> {t('tutorial.prev')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => (isLast ? requestClose() : go(index + 1))}
          >
            {isLast ? t('tutorial.done') : t('tutorial.next')}
            {!isLast && <ChevronRight size={14} />}
          </button>
        </div>
      </footer>
    </dialog>
  )
}
