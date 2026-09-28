import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/** Default page width for a figure: `.pricing-page`'s max-width. */
export const CANVAS_WIDTH = 1080

/** Breathing room around a focused target, in canvas pixels. */
const FOCUS_PAD = 56

/** Room between the page and the edge of the stage, in stage pixels. */
const STAGE_PAD = 24

/**
 * How far in the camera will go. Without a ceiling a small target (the Buy chip
 * is ~200×40) would fill the stage at 5× and lose every landmark around it —
 * the reader needs to see *where* the thing is, not just what it says.
 */
const MAX_ZOOM = 1.6

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface View {
  x: number
  y: number
  scale: number
}

const IDENTITY: View = { x: 0, y: 0, scale: 1 }

/** Centre when the content is smaller than the viewport, otherwise stay inside it. */
function clampAxis(offset: number, viewport: number, content: number): number {
  if (content <= viewport) return (viewport - content) / 2
  return Math.min(0, Math.max(viewport - content, offset))
}

export function computeView(
  stageW: number,
  stageH: number,
  canvasW: number,
  canvasH: number,
  rect: Rect | null
): View {
  if (stageW <= 0 || stageH <= 0 || canvasW <= 0 || canvasH <= 0) return IDENTITY

  const availW = Math.max(stageW - STAGE_PAD * 2, 1)
  const availH = Math.max(stageH - STAGE_PAD * 2, 1)
  // The whole page, never blown up past life size.
  const overview = Math.min(1, availW / canvasW, availH / canvasH)

  if (!rect) {
    return {
      scale: overview,
      x: (stageW - canvasW * overview) / 2,
      y: (stageH - canvasH * overview) / 2,
    }
  }

  const scale = Math.min(
    MAX_ZOOM,
    Math.max(
      overview,
      Math.min(availW / (rect.width + FOCUS_PAD * 2), availH / (rect.height + FOCUS_PAD * 2))
    )
  )

  return {
    scale,
    x: clampAxis(stageW / 2 - scale * (rect.x + rect.width / 2), stageW, canvasW * scale),
    y: clampAxis(stageH / 2 - scale * (rect.y + rect.height / 2), stageH, canvasH * scale),
  }
}

/**
 * The stage's camera.
 *
 * The figure is a fixed-width page that never scrolls; the camera frames it. A
 * step with no spot is an overview — the whole page, fitted. A step with a spot
 * zooms and pans to it, and moving between the two is the transition the tour is
 * made of.
 *
 * Everything is measured in canvas pixels (the page's own coordinates), so the
 * numbers mean the same thing at any zoom. The rendered scale is read back off
 * the canvas itself rather than trusted from state, which keeps a measurement
 * taken mid-animation honest.
 */
export function useCamera(spot: string | undefined, figureKey: unknown, canvasW: number) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>(IDENTITY)
  const [rect, setRect] = useState<Rect | null>(null)
  const [radius, setRadius] = useState(0)

  const measure = useCallback(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return

    const canvasBox = canvas.getBoundingClientRect()
    if (!canvasBox.width) return
    const rendered = canvasBox.width / canvasW

    const target = spotTarget(canvas, spot)
    let next: Rect | null = null
    if (target) {
      const r = target.getBoundingClientRect()
      // jsdom reports zeroes for every rect; framing nothing helps nobody.
      if (r.width || r.height) {
        next = {
          x: (r.left - canvasBox.left) / rendered,
          y: (r.top - canvasBox.top) / rendered,
          width: r.width / rendered,
          height: r.height / rendered,
        }
        setRadius(parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0)
      }
    }

    setRect(next)
    setView(computeView(stage.clientWidth, stage.clientHeight, canvasW, canvas.scrollHeight, next))
  }, [spot, canvasW])

  // Re-runs when the figure changes too: that is a different DOM node, so both
  // the measurement and the observer have to move with it.
  useLayoutEffect(() => {
    measure()
    // Optional: jsdom has no ResizeObserver, and measuring once is the right
    // fallback where it is missing.
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    if (stageRef.current) ro.observe(stageRef.current)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [measure, figureKey])

  return { stageRef, canvasRef, view, rect, radius }
}

/**
 * The element a step points at.
 *
 * `<Spot>` is `display: contents` so wrapping something never changes the
 * figure's layout — which also means the marker has no box, so measure the child
 * it wraps. A spot that starts with `.` or `#` is a plain selector: the escape
 * hatch for product markup a figure cannot wrap, like the proforma's own print
 * toolbar.
 */
export function spotTarget(root: HTMLElement | null, spot: string | undefined): HTMLElement | null {
  if (!root || !spot) return null
  const marker = root.querySelector<HTMLElement>(`[data-spot="${spot}"]`)
  if (marker) return (marker.firstElementChild as HTMLElement | null) ?? marker
  return /^[.#]/.test(spot) ? root.querySelector<HTMLElement>(spot) : null
}
