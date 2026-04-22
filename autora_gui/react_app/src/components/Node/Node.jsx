import React, { memo, useRef, useState, useCallback } from 'react'
import './Node.css'

const typeConfig = {
  theorist: { color: 'var(--node-theorists)', icon: '🧠' },
  experimentalist: { color: 'var(--node-experimentalists)', icon: '🔬' },
  experiment_runner: { color: 'var(--node-experiment-runners)', icon: '⚡' },
  start_point: { color: 'var(--node-controls)', icon: '▶' },
  end_point: { color: 'var(--node-controls)', icon: '⏹' },
  filter_point: { color: 'var(--node-controls)', icon: '◆' }
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 80

function Node({ node, isSelected, isConnecting, onSelect, onDelete, onPositionChange, onBorderClick, zoom }) {
  const nodeRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const config = typeConfig[node.type] || { color: '#666', icon: '●' }

  const getClickPositionOnBorder = useCallback((e) => {
    if (!nodeRef.current) return null
    const rect = nodeRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom

    // Determine which edge is closest
    const distToLeft = x
    const distToRight = NODE_WIDTH - x
    const distToTop = y
    const distToBottom = NODE_HEIGHT - y

    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom)

    // Snap to the closest edge
    if (minDist === distToLeft) {
      return { x: node.x, y: node.y + y }
    } else if (minDist === distToRight) {
      return { x: node.x + NODE_WIDTH, y: node.y + y }
    } else if (minDist === distToTop) {
      return { x: node.x + x, y: node.y }
    } else {
      return { x: node.x + x, y: node.y + NODE_HEIGHT }
    }
  }, [node.x, node.y, zoom])

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.node-delete')) return
    e.stopPropagation()

    // Alt+click or right-click to start connection
    if (e.altKey || e.button === 2) {
      e.preventDefault()
      const borderPoint = getClickPositionOnBorder(e)
      if (borderPoint && onBorderClick) {
        onBorderClick(node.id, borderPoint)
      }
      return
    }

    setIsDragging(true)
    setDragOffset({
      x: e.clientX / zoom - node.x,
      y: e.clientY / zoom - node.y
    })
    onSelect(node.id)
  }, [node.id, node.x, node.y, zoom, onSelect, getClickPositionOnBorder, onBorderClick])

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    const borderPoint = getClickPositionOnBorder(e)
    if (borderPoint && onBorderClick) {
      onBorderClick(node.id, borderPoint)
    }
  }, [node.id, getClickPositionOnBorder, onBorderClick])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    const newX = e.clientX / zoom - dragOffset.x
    const newY = e.clientY / zoom - dragOffset.y
    onPositionChange(node.id, newX, newY)
  }, [isDragging, dragOffset, zoom, node.id, onPositionChange])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const isDiamond = node.type === 'filter_point'
  const isControlNode = node.type === 'start_point' || node.type === 'end_point'

  return (
    <div
      ref={nodeRef}
      className={`node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isConnecting ? 'connecting' : ''} ${isDiamond ? 'diamond' : ''} ${isControlNode ? 'control-node' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        '--node-color': config.color
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      {isDiamond ? (
        <>
          <div className="diamond-inner">
            <div className="diamond-header" style={{ backgroundColor: config.color }}>
              <span className="node-icon">{config.icon}</span>
              <span className="node-title">{node.name}</span>
            </div>
            <div className="diamond-body">
              <span className="node-type">filter point</span>
            </div>
          </div>
          <button
            className="node-delete"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(node.id)
            }}
            title="Delete node"
          >
            ×
          </button>
        </>
      ) : (
        <>
          <div className="node-header" style={{ backgroundColor: config.color }}>
            <span className="node-icon">{config.icon}</span>
            <span className="node-title">{node.name}</span>
            <button
              className="node-delete"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(node.id)
              }}
              title="Delete node"
            >
              ×
            </button>
          </div>
          <div className="node-body">
            <div className="node-content">
              <span className="node-type">{node.type.replace('_', ' ')}</span>
            </div>
          </div>
        </>
      )}
      <div className="connection-hint">Alt+Click or Right-Click to connect</div>
    </div>
  )
}

export default memo(Node)
