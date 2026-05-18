import { describe, it, expect } from 'vitest'
import {
  getPortPosition,
  screenToCanvas,
  canvasToScreen
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
