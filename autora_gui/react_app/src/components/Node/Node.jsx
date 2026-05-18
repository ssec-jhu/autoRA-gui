import React, { memo, useRef, useState, useCallback, useMemo } from 'react'
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
const CONTROL_NODE_WIDTH = 100
const CONTROL_NODE_HEIGHT = 80
const DIAMOND_SIZE = 90

// Get port positions for a node based on its type (visual/connection coordinates)
export function getNodePorts(node) {
  const isDiamond = node.type === 'filter_point'
  const isControlNode = node.type === 'start_point' || node.type === 'end_point'

  if (isDiamond) {
    // Diamond ports at corners, converted to visual positions after 45° rotation
    const margin = 8
    const topMargin = 4  // Smaller margin for top port to move it closer to tip
    const sideMargin = 6  // Smaller margin for left/right ports
    const cx = DIAMOND_SIZE / 2
    const cy = DIAMOND_SIZE / 2
    const cos45 = Math.SQRT1_2
    const sin45 = Math.SQRT1_2

    // Pre-rotation positions (corners with margin)
    const preRotationPorts = [
      { id: 'top', x: topMargin, y: topMargin },  // Top port closer to tip
      { id: 'right', x: DIAMOND_SIZE - sideMargin, y: sideMargin },  // Right port more right and up
      { id: 'bottom', x: DIAMOND_SIZE - margin, y: DIAMOND_SIZE - margin },
      { id: 'left', x: sideMargin, y: DIAMOND_SIZE - sideMargin }  // Left port more left and up
    ]

    // Convert to visual positions
    return preRotationPorts.map(p => {
      const dx = p.x - cx
      const dy = p.y - cy
      return {
        id: p.id,
        x: node.x + cx + dx * cos45 - dy * sin45,
        y: node.y + cy + dx * sin45 + dy * cos45
      }
    })
  } else if (isControlNode) {
    // Control nodes: middle of each edge
    const w = CONTROL_NODE_WIDTH
    const h = CONTROL_NODE_HEIGHT
    return [
      { id: 'top', x: node.x + w / 2, y: node.y },
      { id: 'right', x: node.x + w, y: node.y + h / 2 },
      { id: 'bottom', x: node.x + w / 2, y: node.y + h },
      { id: 'left', x: node.x, y: node.y + h / 2 }
    ]
  } else {
    // Regular component nodes: middle of each edge
    return [
      { id: 'top', x: node.x + NODE_WIDTH / 2, y: node.y },
      { id: 'right', x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 },
      { id: 'bottom', x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT },
      { id: 'left', x: node.x, y: node.y + NODE_HEIGHT / 2 }
    ]
  }
}

// Find closest port to a given point
export function findClosestPort(node, point) {
  const ports = getNodePorts(node)
  let closest = ports[0]
  let minDist = Infinity

  for (const port of ports) {
    const dist = Math.sqrt((port.x - point.x) ** 2 + (port.y - point.y) ** 2)
    if (dist < minDist) {
      minDist = dist
      closest = port
    }
  }

  return closest
}

function Node({ node, isSelected, isConnecting, onSelect, onDelete, onPositionChange, onBorderClick, zoom }) {
  const nodeRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [hoveredPort, setHoveredPort] = useState(null)

  const config = typeConfig[node.type] || { color: '#666', icon: '●' }

  const isDiamond = node.type === 'filter_point'
  const isControlNode = node.type === 'start_point' || node.type === 'end_point'

  // Get port positions relative to node origin (visual positions for all node types)
  const ports = useMemo(() => {
    if (isDiamond) {
      // Place ports inside the 90x90 bounding box, near each corner
      // These positions are in pre-rotation coordinates
      // After 45° rotation: top-left corner -> top tip, top-right -> right tip, etc.
      const margin = 8
      const topMargin = 4  // Smaller margin for top port to move it closer to tip
      const sideMargin = 6  // Smaller margin for left/right ports
      return [
        { id: 'top', x: topMargin, y: topMargin },                        // top-left corner -> top tip (closer to tip)
        { id: 'right', x: DIAMOND_SIZE - sideMargin, y: sideMargin },     // right port more right and up
        { id: 'bottom', x: DIAMOND_SIZE - margin, y: DIAMOND_SIZE - margin }, // bottom-right -> bottom tip
        { id: 'left', x: sideMargin, y: DIAMOND_SIZE - sideMargin }       // left port more left and up
      ]
    } else if (isControlNode) {
      const w = CONTROL_NODE_WIDTH
      const h = CONTROL_NODE_HEIGHT
      return [
        { id: 'top', x: w / 2, y: 0 },
        { id: 'right', x: w, y: h / 2 },
        { id: 'bottom', x: w / 2, y: h },
        { id: 'left', x: 0, y: h / 2 }
      ]
    } else {
      return [
        { id: 'top', x: NODE_WIDTH / 2, y: 0 },
        { id: 'right', x: NODE_WIDTH, y: NODE_HEIGHT / 2 },
        { id: 'bottom', x: NODE_WIDTH / 2, y: NODE_HEIGHT },
        { id: 'left', x: 0, y: NODE_HEIGHT / 2 }
      ]
    }
  }, [isDiamond, isControlNode])

  const handlePortClick = useCallback((e, port) => {
    e.stopPropagation()
    e.preventDefault()
    if (onBorderClick) {
      if (isDiamond) {
        // Convert pre-rotation coordinates to visual coordinates after 45° rotation
        // Rotation formula around center (45, 45):
        // x' = cx + (x-cx)*cos(θ) - (y-cy)*sin(θ)
        // y' = cy + (x-cx)*sin(θ) + (y-cy)*cos(θ)
        const cx = DIAMOND_SIZE / 2
        const cy = DIAMOND_SIZE / 2
        const cos45 = Math.SQRT1_2  // cos(45°) = sin(45°) = √2/2
        const sin45 = Math.SQRT1_2
        const dx = port.x - cx
        const dy = port.y - cy
        const visualX = cx + dx * cos45 - dy * sin45
        const visualY = cy + dx * sin45 + dy * cos45
        onBorderClick(node.id, { x: node.x + visualX, y: node.y + visualY })
      } else {
        onBorderClick(node.id, { x: node.x + port.x, y: node.y + port.y })
      }
    }
  }, [node.id, node.x, node.y, isDiamond, onBorderClick])

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.node-delete') || e.target.closest('.node-port')) return
    e.stopPropagation()

    setIsDragging(true)
    setDragOffset({
      x: e.clientX / zoom - node.x,
      y: e.clientY / zoom - node.y
    })
    onSelect(node.id)
  }, [node.id, node.x, node.y, zoom, onSelect])

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
  }, [])

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
      {/* Connection ports - rendered in a non-rotating container for diamond */}
      {isDiamond ? (
        <div className="diamond-ports-container">
          {ports.map(port => (
            <div
              key={port.id}
              className={`node-port node-port-${port.id} ${hoveredPort === port.id ? 'hovered' : ''}`}
              style={{
                left: port.x,
                top: port.y
              }}
              onMouseDown={(e) => handlePortClick(e, port)}
              onMouseEnter={() => setHoveredPort(port.id)}
              onMouseLeave={() => setHoveredPort(null)}
              title="Click to connect"
            />
          ))}
        </div>
      ) : (
        ports.map(port => (
          <div
            key={port.id}
            className={`node-port node-port-${port.id} ${hoveredPort === port.id ? 'hovered' : ''}`}
            style={{
              left: port.x,
              top: port.y
            }}
            onMouseDown={(e) => handlePortClick(e, port)}
            onMouseEnter={() => setHoveredPort(port.id)}
            onMouseLeave={() => setHoveredPort(null)}
            title="Click to connect"
          />
        ))
      )}
      <div className="connection-hint">Click a port to connect</div>
    </div>
  )
}

export default memo(Node)
