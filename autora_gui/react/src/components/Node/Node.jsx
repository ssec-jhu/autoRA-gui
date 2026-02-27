import React, { memo, useRef, useState, useCallback } from 'react'
import './Node.css'

const typeConfig = {
  theorist: { color: 'var(--node-theorists)', icon: '🧠' },
  experimentalist: { color: 'var(--node-experimentalists)', icon: '🔬' },
  experiment_runner: { color: 'var(--node-experiment-runners)', icon: '⚡' },
  start_point: { color: 'var(--node-controls)', icon: '▶' },
  end_point: { color: 'var(--node-controls)', icon: '⏹' },
  filter_point: { color: 'var(--node-controls)', icon: '🔁' }
}

function Node({ node, isSelected, isConnecting, onSelect, onDelete, onPositionChange, onPortClick, zoom }) {
  const nodeRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const config = typeConfig[node.type] || { color: '#666', icon: '●' }

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.port') || e.target.closest('.node-delete')) return
    e.stopPropagation()
    setIsDragging(true)
    setDragOffset({
      x: e.clientX / zoom - node.x,
      y: e.clientY / zoom - node.y
    })
    onSelect(node.id)
  }, [node.id, node.x, node.y, zoom, onSelect])

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

  return (
    <div
      ref={nodeRef}
      className={`node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isConnecting ? 'connecting' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        '--node-color': config.color
      }}
      onMouseDown={handleMouseDown}
    >
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
        <div
          className="port port-input"
          onClick={(e) => {
            e.stopPropagation()
            onPortClick(node.id, 'input')
          }}
          title="Input"
        >
          <span className="port-dot" />
        </div>
        <div className="node-content">
          <span className="node-type">{node.type.replace('_', ' ')}</span>
        </div>
        <div
          className="port port-output"
          onClick={(e) => {
            e.stopPropagation()
            onPortClick(node.id, 'output')
          }}
          title="Output - Click to connect"
        >
          <span className="port-dot" />
        </div>
      </div>
    </div>
  )
}

export default memo(Node)
