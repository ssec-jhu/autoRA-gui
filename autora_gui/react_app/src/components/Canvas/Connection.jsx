import React, { memo } from 'react'
import { getNodePorts } from '../Node/Node'

function Connection({ connection, sourceNode, targetNode, isSelected, onSelect }) {
  // Use stored connection points if available, otherwise use default ports
  const sourcePorts = getNodePorts(sourceNode)
  const targetPorts = getNodePorts(targetNode)

  // Default to right port for source and left port for target
  const defaultSourcePort = sourcePorts.find(p => p.id === 'right') || sourcePorts[0]
  const defaultTargetPort = targetPorts.find(p => p.id === 'left') || targetPorts[0]

  const x1 = connection.sourcePoint?.x ?? defaultSourcePort.x
  const y1 = connection.sourcePoint?.y ?? defaultSourcePort.y
  const x2 = connection.targetPoint?.x ?? defaultTargetPort.x
  const y2 = connection.targetPoint?.y ?? defaultTargetPort.y

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
