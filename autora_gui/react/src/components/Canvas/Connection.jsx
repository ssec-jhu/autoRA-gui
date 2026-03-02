import React, { memo } from 'react'

const NODE_WIDTH = 160
const NODE_HEIGHT = 80

function Connection({ connection, sourceNode, targetNode, isSelected, onSelect }) {
  // Use stored connection points if available, otherwise calculate defaults
  const x1 = connection.sourcePoint?.x ?? (sourceNode.x + NODE_WIDTH)
  const y1 = connection.sourcePoint?.y ?? (sourceNode.y + NODE_HEIGHT / 2)
  const x2 = connection.targetPoint?.x ?? targetNode.x
  const y2 = connection.targetPoint?.y ?? (targetNode.y + NODE_HEIGHT / 2)

  // Calculate control points for smooth parabolic curve
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy)
  const cpDist = Math.min(dist * 0.4, 100)

  // Determine curve direction based on relative positions
  let cp1x, cp1y, cp2x, cp2y

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal-ish connection
    cp1x = x1 + cpDist * Math.sign(dx || 1)
    cp1y = y1
    cp2x = x2 - cpDist * Math.sign(dx || 1)
    cp2y = y2
  } else {
    // Vertical-ish connection
    cp1x = x1
    cp1y = y1 + cpDist * Math.sign(dy || 1)
    cp2x = x2
    cp2y = y2 - cpDist * Math.sign(dy || 1)
  }

  const pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`

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
