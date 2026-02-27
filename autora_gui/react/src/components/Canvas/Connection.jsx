import React, { memo } from 'react'

const NODE_WIDTH = 160
const NODE_HEIGHT = 80

function Connection({ connection, sourceNode, targetNode, isSelected, onSelect }) {
  const x1 = sourceNode.x + NODE_WIDTH
  const y1 = sourceNode.y + NODE_HEIGHT / 2
  const x2 = targetNode.x
  const y2 = targetNode.y + NODE_HEIGHT / 2

  const dx = x2 - x1
  const cpOffset = Math.min(Math.abs(dx) * 0.5, 100)

  const cp1x = x1 + cpOffset
  const cp1y = y1
  const cp2x = x2 - cpOffset
  const cp2y = y2

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
    </g>
  )
}

export default memo(Connection)
