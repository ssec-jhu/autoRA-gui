export function calculateBezierPath(x1, y1, x2, y2) {
  const dx = x2 - x1
  const cpOffset = Math.min(Math.abs(dx) * 0.5, 100)

  const cp1x = x1 + cpOffset
  const cp1y = y1
  const cp2x = x2 - cpOffset
  const cp2y = y2

  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
}

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

export function screenToCanvas(screenX, screenY, canvasRect, zoom, pan) {
  return {
    x: (screenX - canvasRect.left) / zoom - pan.x,
    y: (screenY - canvasRect.top) / zoom - pan.y
  }
}

export function canvasToScreen(canvasX, canvasY, canvasRect, zoom, pan) {
  return {
    x: (canvasX + pan.x) * zoom + canvasRect.left,
    y: (canvasY + pan.y) * zoom + canvasRect.top
  }
}
