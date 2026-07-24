/**
 * Geometry helpers for computing node port positions and converting between
 * screen and canvas coordinate spaces (accounting for zoom and pan).
 *
 * @module utils/geometry
 */

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
