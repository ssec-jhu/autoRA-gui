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
