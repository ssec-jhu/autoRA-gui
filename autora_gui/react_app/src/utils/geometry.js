/**
 * Geometry helpers for computing node port positions and converting between
 * screen and canvas coordinate spaces (accounting for zoom and pan).
 *
 * @module utils/geometry
 */

// Allowed zoom range, shared with the reducer's SET_ZOOM clamp so fit-to-screen
// never computes a zoom the store would silently reject.
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 2

/**
 * Return the rendered pixel size of a node, which depends on its type: filter
 * diamonds and start/end control nodes are smaller than regular components.
 *
 * @param {Object} node - A workflow node with a `type` field.
 * @returns {{width: number, height: number}} The node's width and height in canvas pixels.
 */
export function getNodeSize(node) {
  if (node.type === 'filter_point') return { width: 90, height: 90 }
  if (node.type === 'start_point' || node.type === 'end_point') return { width: 100, height: 80 }
  return { width: 160, height: 80 }
}

/**
 * Compute the zoom and pan that fit every node within the viewport, centered and
 * with a margin. Zoom is clamped to [ZOOM_MIN, ZOOM_MAX]; pan is derived from the
 * canvas mapping `screen = (canvas + pan) * zoom` so the node bounding box's
 * center lands at the viewport center.
 *
 * @param {Object[]} nodes - Workflow nodes with numeric `x`, `y` and a `type`.
 * @param {{width: number, height: number}} viewport - Visible canvas size in screen pixels.
 * @param {number} [padding=60] - Screen-pixel margin to leave on every side.
 * @returns {{zoom: number, pan: {x: number, y: number}}|null} The fit transform, or null when there are no nodes.
 */
export function computeFitToScreen(nodes, viewport, padding = 60) {
  if (!nodes || nodes.length === 0) return null

  // Bounding box of all nodes in canvas coordinates
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach(node => {
    const { width, height } = getNodeSize(node)
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + width)
    maxY = Math.max(maxY, node.y + height)
  })

  const boxWidth = maxX - minX
  const boxHeight = maxY - minY

  // Zoom so the padded box fits both dimensions; clamp to the allowed range.
  const zoomForWidth = (viewport.width - 2 * padding) / boxWidth
  const zoomForHeight = (viewport.height - 2 * padding) / boxHeight
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(zoomForWidth, zoomForHeight)))

  // Pan so the box center lands at the viewport center.
  // screen = (canvas + pan) * zoom  =>  pan = (screen / zoom) - canvas
  const boxCenterX = (minX + maxX) / 2
  const boxCenterY = (minY + maxY) / 2
  const pan = {
    x: (viewport.width / 2) / zoom - boxCenterX,
    y: (viewport.height / 2) / zoom - boxCenterY
  }

  return { zoom, pan }
}

/**
 * Compute the canvas coordinates of a node's input or output port.
 *
 * @param {Object} node - Node with numeric `x` and `y` top-left canvas coordinates.
 * @param {string} portType - Which port to locate; `'output'` for the right edge, otherwise the left edge.
 * @param {number} [nodeWidth=160] - Node width in canvas units.
 * @param {number} [nodeHeight=80] - Node height in canvas units.
 * @returns {Object} Point `{ x, y }` in canvas coordinates at the vertical center of the node's edge.
 */
export function getPortPosition(node, portType, nodeWidth = 160, nodeHeight = 80) {
  if (portType === 'output') {
    return {
      x: node.x + nodeWidth,
      y: node.y + nodeHeight / 2
    }
  }
  return {
    x: node.x,
    y: node.y + nodeHeight / 2
  }
}

/**
 * Convert a screen (viewport) point into canvas coordinates.
 *
 * @param {number} screenX - Horizontal screen coordinate (e.g. from a mouse event).
 * @param {number} screenY - Vertical screen coordinate.
 * @param {Object} canvasRect - Canvas bounding rectangle with `left` and `top` offsets.
 * @param {number} zoom - Current zoom factor.
 * @param {Object} pan - Current pan offset with `x` and `y` in canvas units.
 * @returns {Object} Point `{ x, y }` in canvas coordinates.
 */
export function screenToCanvas(screenX, screenY, canvasRect, zoom, pan) {
  return {
    x: (screenX - canvasRect.left) / zoom - pan.x,
    y: (screenY - canvasRect.top) / zoom - pan.y
  }
}

/**
 * Convert a canvas point into screen (viewport) coordinates.
 *
 * @param {number} canvasX - Horizontal canvas coordinate.
 * @param {number} canvasY - Vertical canvas coordinate.
 * @param {Object} canvasRect - Canvas bounding rectangle with `left` and `top` offsets.
 * @param {number} zoom - Current zoom factor.
 * @param {Object} pan - Current pan offset with `x` and `y` in canvas units.
 * @returns {Object} Point `{ x, y }` in screen coordinates.
 */
export function canvasToScreen(canvasX, canvasY, canvasRect, zoom, pan) {
  return {
    x: (canvasX + pan.x) * zoom + canvasRect.left,
    y: (canvasY + pan.y) * zoom + canvasRect.top
  }
}
