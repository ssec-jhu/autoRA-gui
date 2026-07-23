/**
 * Renders a single draggable node on the AutoRA Workflow Editor canvas and
 * provides the geometry helpers used to place and connect its ports. Handles
 * regular protocol nodes, control nodes (start/end) and the rotated diamond
 * filter node, including dragging, selection and port connection interactions.
 *
 * @module components/Node/Node
 */
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

/**
 * Determines whether a given port acts as an input or an output based on the
 * node type and the port's position.
 *
 * @param {string} nodeType - The node's type (e.g. 'filter_point', 'start_point', 'end_point').
 * @param {string} portId - The port identifier ('top', 'right', 'bottom' or 'left').
 * @returns {string} 'input' or 'output'.
 */
// Determine if a port is input or output based on node type and port position
export function getPortType(nodeType, portId) {
  if (nodeType === 'filter_point') {
    // Filter: top/left = input, bottom/right = output
    return (portId === 'top' || portId === 'left') ? 'input' : 'output'
  }
  if (nodeType === 'start_point') {
    // Start node: all ports are outputs (data flows out)
    return 'output'
  }
  if (nodeType === 'end_point') {
    // End node: all ports are inputs (data flows in)
    return 'input'
  }
  // Regular nodes: top/left = input, bottom/right = output
  return (portId === 'top' || portId === 'left') ? 'input' : 'output'
}

/**
 * Checks whether a given port participates in any connection and returns the
 * role it plays in that connection, by matching the port's absolute position
 * against connection endpoints within a distance threshold.
 *
 * @param {string} nodeId - The id of the node owning the port.
 * @param {string} portId - The port identifier ('top', 'right', 'bottom' or 'left').
 * @param {Array} connections - The list of connection objects to search.
 * @param {Array} portPositions - Absolute port positions for the node (as returned by getNodePorts).
 * @returns {string|null} 'output' if the port is a connection source, 'input' if a target, or null if unconnected.
 */
// Check if a port has a connection and return the connection role
// Returns: 'output' if port is source, 'input' if port is target, null if not connected
function getPortConnectionRole(nodeId, portId, connections, portPositions) {
  if (!connections || connections.length === 0) return null

  // Get the actual port position for this port
  const portPos = portPositions.find(p => p.id === portId)
  if (!portPos) return null

  const threshold = 20 // Distance threshold for matching

  for (const conn of connections) {
    // Check if this node is the source (output) and port matches
    if (conn.sourceId === nodeId && conn.sourcePoint) {
      const dist = Math.sqrt(
        Math.pow(conn.sourcePoint.x - portPos.x, 2) +
        Math.pow(conn.sourcePoint.y - portPos.y, 2)
      )
      if (dist < threshold) return 'output'
    }
    // Check if this node is the target (input) and port matches
    if (conn.targetId === nodeId && conn.targetPoint) {
      const dist = Math.sqrt(
        Math.pow(conn.targetPoint.x - portPos.x, 2) +
        Math.pow(conn.targetPoint.y - portPos.y, 2)
      )
      if (dist < threshold) return 'input'
    }
  }
  return null
}

/**
 * Computes the absolute visual/connection coordinates of a node's four ports
 * based on its type, accounting for the 45 degree rotation of diamond filter
 * nodes and the differing dimensions of control and regular nodes.
 *
 * @param {Object} node - The node object.
 * @param {string} node.type - The node's type.
 * @param {number} node.x - The node's x origin on the canvas.
 * @param {number} node.y - The node's y origin on the canvas.
 * @returns {Array} An array of port objects, each with { id, x, y }.
 */
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

/**
 * Finds the node port nearest to a given point in canvas coordinates.
 *
 * @param {Object} node - The node object whose ports are considered.
 * @param {Object} point - The reference point.
 * @param {number} point.x - The point's x coordinate.
 * @param {number} point.y - The point's y coordinate.
 * @returns {Object} The closest port object ({ id, x, y }).
 */
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

/**
 * Renders a single workflow node on the canvas, adapting its layout to the node
 * type (regular, control or diamond filter). Manages pointer-driven dragging,
 * selection, and renders interactive connection ports colored by their input/
 * output role and current connection state.
 *
 * @param {Object} props
 * @param {Object} props.node - The node data (id, type, name, x, y).
 * @param {boolean} props.isSelected - Whether this node is currently selected.
 * @param {boolean} props.isConnecting - Whether a connection is being drawn from/to this node.
 * @param {Array} props.connections - All current connections, used to color ports by role.
 * @param {Function} props.onSelect - Called with the node id when the node is selected.
 * @param {Function} props.onPositionChange - Called with (nodeId, newX, newY) while dragging.
 * @param {Function} props.onBorderClick - Called with (nodeId, point) when a port is clicked to connect.
 * @param {Function} props.onDragStart - Called when dragging of this node begins.
 * @param {Function} props.onDragEnd - Called when dragging of this node ends.
 * @param {number} props.zoom - Current canvas zoom factor, used to convert pointer coordinates.
 * @returns {JSX.Element}
 */
function Node({ node, isSelected, isConnecting, connections, onSelect, onPositionChange, onBorderClick, onDragStart, onDragEnd, zoom }) {
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
    // Only handle left-click for connections
    if (e.button !== 0) return
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
    // Only handle left-click for dragging
    if (e.button !== 0) return
    if (e.target.closest('.node-delete') || e.target.closest('.node-port')) return
    e.stopPropagation()

    setIsDragging(true)
    setDragOffset({
      x: e.clientX / zoom - node.x,
      y: e.clientY / zoom - node.y
    })
    onSelect(node.id)
    if (onDragStart) onDragStart()
  }, [node.id, node.x, node.y, zoom, onSelect, onDragStart])

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
    if (isDragging && onDragEnd) onDragEnd()
    setIsDragging(false)
  }, [isDragging, onDragEnd])

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
        <div className="diamond-inner">
          <div className="diamond-header" style={{ backgroundColor: config.color }}>
            <span className="node-icon">{config.icon}</span>
            <span className="node-title">{node.name}</span>
          </div>
          <div className="diamond-body">
            <span className="node-type">filter point</span>
          </div>
        </div>
      ) : (
        <>
          <div className="node-header" style={{ backgroundColor: config.color }}>
            <span className="node-icon">{config.icon}</span>
            <span className="node-title">{node.name}</span>
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
          {ports.map(port => {
            const portType = getPortType(node.type, port.id)
            const absolutePorts = getNodePorts(node)
            const connectionRole = getPortConnectionRole(node.id, port.id, connections, absolutePorts)
            // Filter bottom port is always output colored, others colored by connection role
            const isFilterBottom = node.type === 'filter_point' && port.id === 'bottom'
            const colorClass = isFilterBottom ? 'port-output' : (connectionRole ? `port-${connectionRole}` : 'port-neutral')
            return (
              <div
                key={port.id}
                className={`node-port node-port-${port.id} ${colorClass} ${hoveredPort === port.id ? 'hovered' : ''}`}
                style={{
                  left: port.x,
                  top: port.y
                }}
                onMouseDown={(e) => handlePortClick(e, port)}
                onMouseEnter={() => setHoveredPort(port.id)}
                onMouseLeave={() => setHoveredPort(null)}
                title={`${portType === 'input' ? 'Input' : 'Output'} - Click to connect`}
              />
            )
          })}
        </div>
      ) : (
        ports.map(port => {
          const portType = getPortType(node.type, port.id)
          const absolutePorts = getNodePorts(node)
          const connectionRole = getPortConnectionRole(node.id, port.id, connections, absolutePorts)
          // Start node: always output (coral), End node: always input (green), others: colored by connection role
          let colorClass
          if (node.type === 'start_point') {
            colorClass = 'port-output'
          } else if (node.type === 'end_point') {
            colorClass = 'port-input'
          } else {
            colorClass = connectionRole ? `port-${connectionRole}` : 'port-neutral'
          }
          return (
            <div
              key={port.id}
              className={`node-port node-port-${port.id} ${colorClass} ${hoveredPort === port.id ? 'hovered' : ''}`}
              style={{
                left: port.x,
                top: port.y
              }}
              onMouseDown={(e) => handlePortClick(e, port)}
              onMouseEnter={() => setHoveredPort(port.id)}
              onMouseLeave={() => setHoveredPort(null)}
              title={`${portType === 'input' ? 'Input' : 'Output'} - Click to connect`}
            />
          )
        })
      )}
      <div className="connection-hint">Click a port to connect</div>
    </div>
  )
}

export default memo(Node)
