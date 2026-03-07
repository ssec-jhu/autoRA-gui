import React, { memo } from 'react'

const NODE_WIDTH = 160
const NODE_HEIGHT = 80

function Connection({ connection, sourceNode, targetNode, isSelected, onSelect }) {
  // Use stored connection points if available, otherwise calculate defaults
  const x1 = connection.sourcePoint?.x ?? (sourceNode.x + NODE_WIDTH)
  const y1 = connection.sourcePoint?.y ?? (sourceNode.y + NODE_HEIGHT / 2)
  const x2 = connection.targetPoint?.x ?? targetNode.x
  const y2 = connection.targetPoint?.y ?? (targetNode.y + NODE_HEIGHT / 2)

  // Calculate parabolic curve with direction-based curvature
  const dx = x2 - x1
  const dist = Math.sqrt(dx * dx + (y2 - y1) ** 2)
  const curveOffset = Math.min(dist * 0.3, 60)

  // Midpoint
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  // Left-to-right: negative curvature (curve goes up/above)
  // Right-to-left: positive curvature (curve goes down/below)
  const direction = dx >= 0 ? -1 : 1
  const cpx = midX
  const cpy = midY + curveOffset * direction

  const pathD = `M ${x1} ${y1} Q ${cpx} ${cpy}, ${x2} ${y2}`

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
