import React, { memo } from 'react'
import { getNodePorts } from '../Node/Node'

// Determine port direction based on port id
function getPortDirection(portId) {
  switch (portId) {
    case 'top': return { dx: 0, dy: -1 }
    case 'bottom': return { dx: 0, dy: 1 }
    case 'left': return { dx: -1, dy: 0 }
    case 'right': return { dx: 1, dy: 0 }
    default: return { dx: 1, dy: 0 }
  }
}

// Find which port a point is closest to
function findPortId(node, point, ports) {
  let closest = ports[0]
  let minDist = Infinity
  for (const port of ports) {
    const dist = Math.sqrt((port.x - point.x) ** 2 + (port.y - point.y) ** 2)
    if (dist < minDist) {
      minDist = dist
      closest = port
    }
  }
  return closest.id
}

// Build orthogonal path (only horizontal and vertical segments)
function buildOrthogonalPath(x1, y1, x2, y2, sourceDir, targetDir) {
  const offset = 20 // How far to extend from port before turning

  // Start point extended in source direction
  const sx = x1 + sourceDir.dx * offset
  const sy = y1 + sourceDir.dy * offset

  // End point extended in target direction (going backwards from target)
  const tx = x2 + targetDir.dx * offset
  const ty = y2 + targetDir.dy * offset

  // Build path segments
  let points = [[x1, y1], [sx, sy]]

  // Determine routing based on port directions
  const sourceHorizontal = sourceDir.dx !== 0
  const targetHorizontal = targetDir.dx !== 0

  if (sourceHorizontal && targetHorizontal) {
    // Both horizontal: route with vertical middle segment
    const midX = (sx + tx) / 2
    points.push([midX, sy], [midX, ty])
  } else if (!sourceHorizontal && !targetHorizontal) {
    // Both vertical: route with horizontal middle segment
    const midY = (sy + ty) / 2
    points.push([sx, midY], [tx, midY])
  } else if (sourceHorizontal && !targetHorizontal) {
    // Source horizontal, target vertical: L-shape or Z-shape
    points.push([tx, sy])
  } else {
    // Source vertical, target horizontal: L-shape or Z-shape
    points.push([sx, ty])
  }

  points.push([tx, ty], [x2, y2])

  // Build SVG path string
  return 'M ' + points.map(p => `${p[0]} ${p[1]}`).join(' L ')
}

function Connection({ connection, sourceNode, targetNode, isSelected, onSelect }) {
  const sourcePorts = getNodePorts(sourceNode)
  const targetPorts = getNodePorts(targetNode)

  const defaultSourcePort = sourcePorts.find(p => p.id === 'right') || sourcePorts[0]
  const defaultTargetPort = targetPorts.find(p => p.id === 'left') || targetPorts[0]

  const x1 = connection.sourcePoint?.x ?? defaultSourcePort.x
  const y1 = connection.sourcePoint?.y ?? defaultSourcePort.y
  const x2 = connection.targetPoint?.x ?? defaultTargetPort.x
  const y2 = connection.targetPoint?.y ?? defaultTargetPort.y

  // Determine port directions
  const sourcePortId = connection.sourcePoint
    ? findPortId(sourceNode, connection.sourcePoint, sourcePorts)
    : 'right'
  const targetPortId = connection.targetPoint
    ? findPortId(targetNode, connection.targetPoint, targetPorts)
    : 'left'

  const sourceDir = getPortDirection(sourcePortId)
  const targetDir = getPortDirection(targetPortId)

  const pathD = buildOrthogonalPath(x1, y1, x2, y2, sourceDir, targetDir)

  return (
    <g className="connection-group">
      <path
        className="connection-hitarea"
        d={pathD}
        stroke="transparent"
        strokeWidth="20"
        fill="none"
        onClick={(e) => {
          e.stopPropagation()
          onSelect(connection.id)
        }}
      />
      <path
        className={`connection ${isSelected ? 'selected' : ''}`}
        d={pathD}
        stroke={isSelected ? 'var(--accent-danger)' : 'var(--accent-primary)'}
        strokeWidth={isSelected ? 3 : 2}
        fill="none"
        markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(connection.id)
        }}
      />
      {/* Connection endpoints */}
      <circle cx={x1} cy={y1} r="4" fill={isSelected ? 'var(--accent-danger)' : 'var(--accent-primary)'} />
      <circle cx={x2} cy={y2} r="4" fill={isSelected ? 'var(--accent-danger)' : 'var(--accent-primary)'} />
    </g>
  )
}

export default memo(Connection)
