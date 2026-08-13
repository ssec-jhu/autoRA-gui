/**
 * Unit tests for `utils/geometry`.
 *
 * Covers node port placement (getPortPosition) and coordinate conversions between
 * screen and canvas space (screenToCanvas, canvasToScreen), including zoom and pan
 * handling and custom node dimensions.
 *
 * @module utils/geometry.test
 */
import { describe, it, expect } from 'vitest'
import {
  getPortPosition,
  screenToCanvas,
  canvasToScreen,
  computeFitToScreen,
  getNodeSize,
  ZOOM_MIN,
  ZOOM_MAX
} from './geometry'

describe('getPortPosition', () => {
  const node = { x: 100, y: 200 }

  it('returns output port at right edge', () => {
    const pos = getPortPosition(node, 'output')
    expect(pos.x).toBe(260) // 100 + 160 (default width)
    expect(pos.y).toBe(240) // 200 + 80/2 (default height / 2)
  })

  it('returns input port at left edge', () => {
    const pos = getPortPosition(node, 'input')
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(240)
  })

  it('respects custom node dimensions', () => {
    const pos = getPortPosition(node, 'output', 200, 100)
    expect(pos.x).toBe(300) // 100 + 200
    expect(pos.y).toBe(250) // 200 + 100/2
  })
})

describe('screenToCanvas', () => {
  const canvasRect = { left: 50, top: 100 }

  it('converts screen coordinates without zoom/pan', () => {
    const result = screenToCanvas(150, 200, canvasRect, 1, { x: 0, y: 0 })
    expect(result.x).toBe(100) // 150 - 50
    expect(result.y).toBe(100) // 200 - 100
  })

  it('accounts for zoom', () => {
    const result = screenToCanvas(150, 200, canvasRect, 2, { x: 0, y: 0 })
    expect(result.x).toBe(50) // (150 - 50) / 2
    expect(result.y).toBe(50) // (200 - 100) / 2
  })

  it('accounts for pan', () => {
    const result = screenToCanvas(150, 200, canvasRect, 1, { x: 20, y: 30 })
    expect(result.x).toBe(80) // 100 - 20
    expect(result.y).toBe(70) // 100 - 30
  })
})

describe('canvasToScreen', () => {
  const canvasRect = { left: 50, top: 100 }

  it('converts canvas coordinates without zoom/pan', () => {
    const result = canvasToScreen(100, 100, canvasRect, 1, { x: 0, y: 0 })
    expect(result.x).toBe(150) // 100 + 50
    expect(result.y).toBe(200) // 100 + 100
  })

  it('accounts for zoom', () => {
    const result = canvasToScreen(50, 50, canvasRect, 2, { x: 0, y: 0 })
    expect(result.x).toBe(150) // 50 * 2 + 50
    expect(result.y).toBe(200) // 50 * 2 + 100
  })

  it('accounts for pan', () => {
    const result = canvasToScreen(80, 70, canvasRect, 1, { x: 20, y: 30 })
    expect(result.x).toBe(150) // (80 + 20) + 50
    expect(result.y).toBe(200) // (70 + 30) + 100
  })
})

describe('getNodeSize', () => {
  // Import lazily via the shared module to keep the mapping in one place.
  it('uses the diamond size for filter nodes', () => {
    expect(getNodeSize({ type: 'filter_point' })).toEqual({ width: 90, height: 90 })
  })

  it('uses the control-node size for start and end points', () => {
    expect(getNodeSize({ type: 'start_point' })).toEqual({ width: 100, height: 80 })
    expect(getNodeSize({ type: 'end_point' })).toEqual({ width: 100, height: 80 })
  })

  it('defaults to the component size for regular nodes', () => {
    expect(getNodeSize({ type: 'component' })).toEqual({ width: 160, height: 80 })
  })
})

describe('computeFitToScreen', () => {
  const viewport = { width: 800, height: 600 }

  // The box center must land at the viewport center: (center + pan) * zoom === viewport/2.
  const expectCentered = (fit, boxCenterX, boxCenterY, vp) => {
    expect((boxCenterX + fit.pan.x) * fit.zoom).toBeCloseTo(vp.width / 2)
    expect((boxCenterY + fit.pan.y) * fit.zoom).toBeCloseTo(vp.height / 2)
  }

  it('returns null when there are no nodes', () => {
    expect(computeFitToScreen([], viewport)).toBeNull()
    expect(computeFitToScreen(undefined, viewport)).toBeNull()
  })

  it('computes zoom and centered pan for a workflow that fits within range', () => {
    // Two components: box spans x[0,800], y[0,80]; center (400, 40).
    const nodes = [
      { type: 'component', x: 0, y: 0 },
      { type: 'component', x: 640, y: 0 }
    ]
    const vp = { width: 1080, height: 600 }
    const fit = computeFitToScreen(nodes, vp) // padding 60
    // availW=960, boxW=800 -> 1.2 ; availH=480, boxH=80 -> 6 ; min -> 1.2 (in range)
    expect(fit.zoom).toBeCloseTo(1.2)
    expect(fit.pan.x).toBeCloseTo(50)
    expect(fit.pan.y).toBeCloseTo(210)
    expectCentered(fit, 400, 40, vp)
  })

  it('clamps to ZOOM_MAX for a tiny workflow and still centers it', () => {
    // Single node would need zoom > 2 to fill the viewport.
    const nodes = [{ type: 'component', x: 0, y: 0 }] // box 160x80, center (80, 40)
    const fit = computeFitToScreen(nodes, viewport)
    expect(fit.zoom).toBe(ZOOM_MAX)
    expectCentered(fit, 80, 40, viewport)
  })

  it('clamps to ZOOM_MIN for a sprawling workflow and still centers it', () => {
    // Nodes far apart need zoom < 0.25 to fit; it clamps up to the minimum.
    const nodes = [
      { type: 'component', x: 0, y: 0 },
      { type: 'component', x: 5000, y: 3000 }
    ]
    const fit = computeFitToScreen(nodes, viewport)
    expect(fit.zoom).toBe(ZOOM_MIN)
    expectCentered(fit, (0 + 5160) / 2, (0 + 3080) / 2, viewport)
  })

  it('accounts for per-type node sizes in the bounding box', () => {
    // A filter diamond (90x90) extends the box further than its x/y origin.
    const nodes = [
      { type: 'start_point', x: 0, y: 0 },   // 100x80
      { type: 'filter_point', x: 400, y: 300 } // 90x90 -> box max (490, 390)
    ]
    const fit = computeFitToScreen(nodes, viewport)
    expect(fit.zoom).toBeGreaterThanOrEqual(ZOOM_MIN)
    expect(fit.zoom).toBeLessThanOrEqual(ZOOM_MAX)
    expectCentered(fit, (0 + 490) / 2, (0 + 390) / 2, viewport)
  })
})
