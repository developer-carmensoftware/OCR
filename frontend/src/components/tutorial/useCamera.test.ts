import { describe, it, expect } from 'vitest'
import { computeView, CANVAS_WIDTH } from './useCamera'

/**
 * The camera is what replaces scrolling: if these hold, every step frames
 * something the reader can see without moving anything. It is pure arithmetic
 * over the stage size, so it is the one part of the stage a test can actually
 * check — the rest needs a browser.
 */

const STAGE_W = 1000
const STAGE_H = 700
/** Taller than the stage, like the real catalog page. */
const PAGE_H = 2000

const overview = (stageW = STAGE_W, stageH = STAGE_H, pageH = PAGE_H) =>
  computeView(stageW, stageH, CANVAS_WIDTH, pageH, null)

describe('computeView — overview', () => {
  it('fits the whole page inside the stage', () => {
    const v = overview()
    expect(CANVAS_WIDTH * v.scale).toBeLessThanOrEqual(STAGE_W)
    expect(PAGE_H * v.scale).toBeLessThanOrEqual(STAGE_H)
  })

  it('centres it', () => {
    const v = overview()
    expect(v.x).toBeCloseTo((STAGE_W - CANVAS_WIDTH * v.scale) / 2)
    expect(v.y).toBeCloseTo((STAGE_H - PAGE_H * v.scale) / 2)
  })

  it('never blows the page up past life size', () => {
    // A stage far larger than the page: still 1:1, not stretched.
    expect(overview(4000, 4000, 400).scale).toBe(1)
  })

  it('degrades to identity when the stage has not been measured yet', () => {
    expect(computeView(0, 0, 0, 0, null)).toEqual({ x: 0, y: 0, scale: 1 })
  })
})

describe('computeView — focus', () => {
  const small = { x: 800, y: 40, width: 200, height: 40 }

  it('zooms in on a small target', () => {
    const v = computeView(STAGE_W, STAGE_H, CANVAS_WIDTH, PAGE_H, small)
    expect(v.scale).toBeGreaterThan(overview().scale)
  })

  it('stops zooming before the target loses its surroundings', () => {
    const v = computeView(STAGE_W, STAGE_H, CANVAS_WIDTH, PAGE_H, small)
    expect(v.scale).toBeLessThanOrEqual(1.6)
  })

  it('centres the target in the stage', () => {
    // A target in the middle of the page, so no edge clamping applies.
    const mid = { x: 340, y: 900, width: 400, height: 200 }
    const v = computeView(STAGE_W, STAGE_H, CANVAS_WIDTH, PAGE_H, mid)
    expect(v.x + v.scale * (mid.x + mid.width / 2)).toBeCloseTo(STAGE_W / 2)
    expect(v.y + v.scale * (mid.y + mid.height / 2)).toBeCloseTo(STAGE_H / 2)
  })

  it('never pans past the edge of the page', () => {
    for (const rect of [
      { x: 0, y: 0, width: 180, height: 40 }, // top left corner
      { x: 900, y: 1960, width: 180, height: 40 }, // bottom right corner
    ]) {
      const v = computeView(STAGE_W, STAGE_H, CANVAS_WIDTH, PAGE_H, rect)
      // Left/top edge never drifts inside the stage while the page is wider or
      // taller than it; right/bottom never leaves a gap.
      expect(v.x).toBeLessThanOrEqual(0)
      expect(v.x + CANVAS_WIDTH * v.scale).toBeGreaterThanOrEqual(STAGE_W)
      expect(v.y).toBeLessThanOrEqual(0)
      expect(v.y + PAGE_H * v.scale).toBeGreaterThanOrEqual(STAGE_H)
    }
  })

  it('falls back to the overview for a target bigger than the stage', () => {
    const whole = { x: 0, y: 0, width: CANVAS_WIDTH, height: PAGE_H }
    expect(computeView(STAGE_W, STAGE_H, CANVAS_WIDTH, PAGE_H, whole).scale).toBeCloseTo(
      overview().scale
    )
  })
})
