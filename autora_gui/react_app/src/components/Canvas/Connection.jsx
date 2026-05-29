import React, { memo, useMemo, useEffect } from 'react'
import { getNodePorts, getPortType } from '../Node/Node'

// Node dimensions for collision detection
const NODE_WIDTH = 160
const NODE_HEIGHT = 80
const CONTROL_NODE_WIDTH = 100
const CONTROL_NODE_HEIGHT = 80
const DIAMOND_SIZE = 90
const PADDING = 20 // Padding around nodes for routing

// Get node bounding box with padding
function getNodeBounds(node, extraPadding = 0) {
  const isDiamond = node.type === 'filter_point'
  const isControl = node.type === 'start_point' || node.type === 'end_point'
  const pad = PADDING + extraPadding

  if (isDiamond) {
    return {
      x: node.x - pad,
      y: node.y - pad,
      width: DIAMOND_SIZE + pad * 2,
      height: DIAMOND_SIZE + pad * 2
    }
  } else if (isControl) {
    return {
      x: node.x - pad,
      y: node.y - pad,
      width: CONTROL_NODE_WIDTH + pad * 2,
      height: CONTROL_NODE_HEIGHT + pad * 2
    }
  } else {
    return {
      x: node.x - pad,
      y: node.y - pad,
      width: NODE_WIDTH + pad * 2,
      height: NODE_HEIGHT + pad * 2
    }
  }
}

// Check if two line segments intersect
function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  if (Math.abs(denom) < 0.0001) return false

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom

  return ua > 0.01 && ua < 0.99 && ub > 0.01 && ub < 0.99
}

// Check if a line segment intersects a rectangle
function lineIntersectsRect(x1, y1, x2, y2, rect) {
  const edges = [
    [rect.x, rect.y, rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height],
    [rect.x, rect.y, rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height]
  ]

  for (const [ex1, ey1, ex2, ey2] of edges) {
    if (segmentsIntersect(x1, y1, x2, y2, ex1, ey1, ex2, ey2)) {
      return true
    }
  }
  return false
}

// Check if segment crosses any node (except at port endpoints)
function segmentCrossesNodes(x1, y1, x2, y2, nodes, portX1, portY1, portX2, portY2) {
  for (const node of nodes) {
    const bounds = getNodeBounds(node)

    // Allow segment to touch node only at the exact port positions
    const touchesPortStart = Math.abs(x1 - portX1) < 2 && Math.abs(y1 - portY1) < 2
    const touchesPortEnd = Math.abs(x2 - portX2) < 2 && Math.abs(y2 - portY2) < 2

    // If segment starts at source port or ends at target port, use smaller bounds check
    if (touchesPortStart || touchesPortEnd) {
      // Check intersection but allow touching at ports
      if (lineIntersectsRect(x1, y1, x2, y2, bounds)) {
        // For segments touching ports, only fail if the OTHER end is inside the node
        const otherX = touchesPortStart ? x2 : x1
        const otherY = touchesPortStart ? y2 : y1
        const otherInside = otherX > bounds.x && otherX < bounds.x + bounds.width &&
                          otherY > bounds.y && otherY < bounds.y + bounds.height
        if (otherInside) return true

        // Also check if the middle of the segment goes through the node
        const midX = (x1 + x2) / 2
        const midY = (y1 + y2) / 2
        const midInside = midX > bounds.x && midX < bounds.x + bounds.width &&
                         midY > bounds.y && midY < bounds.y + bounds.height
        if (midInside) return true
      }
    } else {
      // For intermediate segments, strictly check intersection
      if (lineIntersectsRect(x1, y1, x2, y2, bounds)) {
        return true
      }
    }
  }
  return false
}

// Parse existing connection paths to get their segments
function getExistingConnectionSegments(connections, currentConnectionId, allNodes) {
  const segments = []

  for (const conn of connections) {
    if (conn.id === currentConnectionId) continue

    const sourceNode = allNodes.find(n => n.id === conn.sourceId)
    const targetNode = allNodes.find(n => n.id === conn.targetId)
    if (!sourceNode || !targetNode) continue

    const sourcePorts = getNodePorts(sourceNode)
    const targetPorts = getNodePorts(targetNode)
    const defaultSourcePort = sourcePorts.find(p => p.id === 'right') || sourcePorts[0]
    const defaultTargetPort = targetPorts.find(p => p.id === 'left') || targetPorts[0]

    const x1 = conn.sourcePoint?.x ?? defaultSourcePort.x
    const y1 = conn.sourcePoint?.y ?? defaultSourcePort.y
    const x2 = conn.targetPoint?.x ?? defaultTargetPort.x
    const y2 = conn.targetPoint?.y ?? defaultTargetPort.y

    // Store the connection endpoints for basic segment approximation
    segments.push({ x1, y1, x2, y2, connId: conn.id })
  }

  return segments
}

// Check if a path crosses existing connections
function pathCrossesConnections(path, existingSegments) {
  for (let i = 0; i < path.length - 1; i++) {
    const [px1, py1] = path[i]
    const [px2, py2] = path[i + 1]

    for (const seg of existingSegments) {
      // Simple check: does our segment cross the direct line between connection endpoints?
      // This is a simplification - ideally we'd check against actual routed paths
      if (segmentsIntersect(px1, py1, px2, py2, seg.x1, seg.y1, seg.x2, seg.y2)) {
        return true
      }
    }
  }
  return false
}

// Check if path coincides with another connection (same route)
function pathCoincides(path, existingSegments, threshold = 15) {
  for (let i = 0; i < path.length - 1; i++) {
    const [px1, py1] = path[i]
    const [px2, py2] = path[i + 1]

    for (const seg of existingSegments) {
      // Check if segments are nearly parallel and close
      const isHorizontal1 = Math.abs(py2 - py1) < 2
      const isHorizontal2 = Math.abs(seg.y2 - seg.y1) < 2
      const isVertical1 = Math.abs(px2 - px1) < 2
      const isVertical2 = Math.abs(seg.x2 - seg.x1) < 2

      if (isHorizontal1 && isHorizontal2) {
        // Both horizontal - check if same Y and overlapping X
        if (Math.abs(py1 - seg.y1) < threshold) {
          const overlap = Math.max(0,
            Math.min(Math.max(px1, px2), Math.max(seg.x1, seg.x2)) -
            Math.max(Math.min(px1, px2), Math.min(seg.x1, seg.x2)))
          if (overlap > 20) return true
        }
      }

      if (isVertical1 && isVertical2) {
        // Both vertical - check if same X and overlapping Y
        if (Math.abs(px1 - seg.x1) < threshold) {
          const overlap = Math.max(0,
            Math.min(Math.max(py1, py2), Math.max(seg.y1, seg.y2)) -
            Math.max(Math.min(py1, py2), Math.min(seg.y1, seg.y2)))
          if (overlap > 20) return true
        }
      }
    }
  }
  return false
}

// Get port direction
function getPortDirection(portId) {
  switch (portId) {
    case 'top': return { dx: 0, dy: -1 }
    case 'bottom': return { dx: 0, dy: 1 }
    case 'left': return { dx: -1, dy: 0 }
    case 'right': return { dx: 1, dy: 0 }
    default: return { dx: 1, dy: 0 }
  }
}

// Find closest port
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

// Check if a port is occupied by any connection (except the current one)
function isPortOccupied(nodeId, port, connections, currentConnectionId) {
  const threshold = 20
  for (const conn of connections) {
    if (conn.id === currentConnectionId) continue

    // Check if port is used as source
    if (conn.sourceId === nodeId && conn.sourcePoint) {
      const dist = Math.sqrt(
        (conn.sourcePoint.x - port.x) ** 2 + (conn.sourcePoint.y - port.y) ** 2
      )
      if (dist < threshold) return true
    }
    // Check if port is used as target
    if (conn.targetId === nodeId && conn.targetPoint) {
      const dist = Math.sqrt(
        (conn.targetPoint.x - port.x) ** 2 + (conn.targetPoint.y - port.y) ** 2
      )
      if (dist < threshold) return true
    }
  }
  return false
}

// Get available (unoccupied neutral) ports for a node that can be used as source or target
function getAvailablePorts(node, connections, currentConnectionId, isSource) {
  const ports = getNodePorts(node)
  const availablePorts = []

  for (const port of ports) {
    // Check port type matches expected role
    const portType = getPortType(node.type, port.id)
    const portMatchesRole = isSource ? portType === 'output' : portType === 'input'

    // For start/end nodes, all ports are output/input respectively
    const isValidPortType = portMatchesRole

    // Check if port is unoccupied
    const occupied = isPortOccupied(node.id, port, connections, currentConnectionId)

    if (isValidPortType && !occupied) {
      availablePorts.push(port)
    }
  }

  return availablePorts
}

// Generate multiple path options with different routing strategies
function generatePathOptions(x1, y1, x2, y2, sourceDir, targetDir, nodes) {
  const options = []
  const offsets = [15, 30, 50, 80, 120] // Different stub lengths to try

  // Get bounding box of all nodes to know canvas extent
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const node of nodes) {
    const bounds = getNodeBounds(node)
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }

  // Add margin for routing outside all nodes
  const routeTop = minY - 40
  const routeBottom = maxY + 40
  const routeLeft = minX - 40
  const routeRight = maxX + 40

  const sourceHorizontal = sourceDir.dx !== 0
  const targetHorizontal = targetDir.dx !== 0

  for (const offset of offsets) {
    const sx = x1 + sourceDir.dx * offset
    const sy = y1 + sourceDir.dy * offset
    const tx = x2 + targetDir.dx * offset
    const ty = y2 + targetDir.dy * offset

    // Direct path if aligned
    if (Math.abs(y1 - y2) < 2 && sourceHorizontal && targetHorizontal && sourceDir.dx !== targetDir.dx) {
      options.push([[x1, y1], [x2, y2]])
    }
    if (Math.abs(x1 - x2) < 2 && !sourceHorizontal && !targetHorizontal && sourceDir.dy !== targetDir.dy) {
      options.push([[x1, y1], [x2, y2]])
    }

    if (sourceHorizontal && targetHorizontal) {
      // Both horizontal
      const midX = (x1 + x2) / 2
      options.push([[x1, y1], [sx, sy], [midX, sy], [midX, ty], [tx, ty], [x2, y2]])
      // Route via top
      options.push([[x1, y1], [sx, sy], [sx, routeTop], [tx, routeTop], [tx, ty], [x2, y2]])
      // Route via bottom
      options.push([[x1, y1], [sx, sy], [sx, routeBottom], [tx, routeBottom], [tx, ty], [x2, y2]])
    } else if (!sourceHorizontal && !targetHorizontal) {
      // Both vertical
      const midY = (y1 + y2) / 2
      options.push([[x1, y1], [sx, sy], [sx, midY], [tx, midY], [tx, ty], [x2, y2]])
      // Route via left
      options.push([[x1, y1], [sx, sy], [routeLeft, sy], [routeLeft, ty], [tx, ty], [x2, y2]])
      // Route via right
      options.push([[x1, y1], [sx, sy], [routeRight, sy], [routeRight, ty], [tx, ty], [x2, y2]])
    } else if (sourceHorizontal && !targetHorizontal) {
      // Source horizontal, target vertical - L-shapes
      options.push([[x1, y1], [sx, sy], [x2, sy], [x2, y2]])
      options.push([[x1, y1], [sx, sy], [sx, y2], [x2, y2]])
      // Z-shapes
      const midY = (y1 + y2) / 2
      options.push([[x1, y1], [sx, sy], [sx, midY], [x2, midY], [x2, y2]])
      // Route around via top/bottom
      options.push([[x1, y1], [sx, sy], [sx, routeTop], [x2, routeTop], [x2, y2]])
      options.push([[x1, y1], [sx, sy], [sx, routeBottom], [x2, routeBottom], [x2, y2]])
    } else {
      // Source vertical, target horizontal - L-shapes
      options.push([[x1, y1], [sx, sy], [sx, y2], [x2, y2]])
      options.push([[x1, y1], [sx, sy], [x2, sy], [x2, y2]])
      // Z-shapes
      const midX = (x1 + x2) / 2
      options.push([[x1, y1], [sx, sy], [midX, sy], [midX, y2], [x2, y2]])
      // Route around via left/right
      options.push([[x1, y1], [sx, sy], [routeLeft, sy], [routeLeft, y2], [x2, y2]])
      options.push([[x1, y1], [sx, sy], [routeRight, sy], [routeRight, y2], [x2, y2]])
    }
  }

  return options
}

// Clean path - remove redundant points
function cleanPath(points) {
  if (points.length < 2) return 'M 0 0'

  const cleaned = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = cleaned[cleaned.length - 1]
    const curr = points[i]

    if (Math.abs(prev[0] - curr[0]) < 0.5 && Math.abs(prev[1] - curr[1]) < 0.5) continue

    if (cleaned.length >= 2) {
      const prevPrev = cleaned[cleaned.length - 2]
      const sameHorizontal = Math.abs(prevPrev[1] - prev[1]) < 0.5 && Math.abs(prev[1] - curr[1]) < 0.5
      const sameVertical = Math.abs(prevPrev[0] - prev[0]) < 0.5 && Math.abs(prev[0] - curr[0]) < 0.5

      if (sameHorizontal || sameVertical) {
        cleaned[cleaned.length - 1] = curr
        continue
      }
    }

    cleaned.push(curr)
  }

  return 'M ' + cleaned.map(p => `${p[0]} ${p[1]}`).join(' L ')
}

// Score a single path
function scorePath(path, nodes, existingSegments, x1, y1, x2, y2) {
  let score = 0

  // Check node collisions
  let crossesNode = false
  for (let i = 0; i < path.length - 1; i++) {
    if (segmentCrossesNodes(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1], nodes, x1, y1, x2, y2)) {
      crossesNode = true
      break
    }
  }
  if (crossesNode) {
    score += 1000 // Heavy penalty for crossing nodes
  }

  // Check connection crossings
  if (pathCrossesConnections(path, existingSegments)) {
    score += 500 // Penalty for crossing connections
  }

  // Check coinciding paths
  if (pathCoincides(path, existingSegments)) {
    score += 200 // Penalty for coinciding
  }

  // Prefer shorter paths
  let pathLength = 0
  for (let i = 0; i < path.length - 1; i++) {
    pathLength += Math.abs(path[i + 1][0] - path[i][0]) + Math.abs(path[i + 1][1] - path[i][1])
  }
  score += pathLength * 0.1

  // Prefer fewer bends
  score += (path.length - 2) * 5

  return score
}

// Main path builder - now returns both path and optimal ports
function buildOrthogonalPathWithPortSelection(
  originalSourcePort, originalTargetPort,
  sourceNode, targetNode,
  nodes, connections, currentConnectionId
) {
  const existingSegments = getExistingConnectionSegments(connections, currentConnectionId, nodes)

  // Get available alternative ports
  const availableSourcePorts = getAvailablePorts(sourceNode, connections, currentConnectionId, true)
  const availableTargetPorts = getAvailablePorts(targetNode, connections, currentConnectionId, false)

  // Always include the original ports in consideration
  const sourcePorts = getNodePorts(sourceNode)
  const targetPorts = getNodePorts(targetNode)

  // Find original port objects
  const origSourcePortObj = sourcePorts.find(p =>
    Math.abs(p.x - originalSourcePort.x) < 20 && Math.abs(p.y - originalSourcePort.y) < 20
  ) || sourcePorts.find(p => p.id === 'right') || sourcePorts[0]

  const origTargetPortObj = targetPorts.find(p =>
    Math.abs(p.x - originalTargetPort.x) < 20 && Math.abs(p.y - originalTargetPort.y) < 20
  ) || targetPorts.find(p => p.id === 'left') || targetPorts[0]

  // Build list of port combinations to try
  // Start with original ports, then try alternatives
  const portCombinations = []

  // Always try original first
  portCombinations.push({
    source: origSourcePortObj,
    target: origTargetPortObj
  })

  // Add combinations with available alternative ports
  for (const srcPort of availableSourcePorts) {
    for (const tgtPort of availableTargetPorts) {
      // Skip if same as original
      if (srcPort.id === origSourcePortObj.id && tgtPort.id === origTargetPortObj.id) continue
      portCombinations.push({ source: srcPort, target: tgtPort })
    }
  }

  // Also try original source with alternative targets
  for (const tgtPort of availableTargetPorts) {
    if (tgtPort.id !== origTargetPortObj.id) {
      portCombinations.push({ source: origSourcePortObj, target: tgtPort })
    }
  }

  // And alternative sources with original target
  for (const srcPort of availableSourcePorts) {
    if (srcPort.id !== origSourcePortObj.id) {
      portCombinations.push({ source: srcPort, target: origTargetPortObj })
    }
  }

  let bestPath = null
  let bestScore = Infinity
  let bestSourcePort = origSourcePortObj
  let bestTargetPort = origTargetPortObj

  for (const combo of portCombinations) {
    const x1 = combo.source.x
    const y1 = combo.source.y
    const x2 = combo.target.x
    const y2 = combo.target.y

    const sourceDir = getPortDirection(combo.source.id)
    const targetDir = getPortDirection(combo.target.id)

    const pathOptions = generatePathOptions(x1, y1, x2, y2, sourceDir, targetDir, nodes)

    for (const path of pathOptions) {
      const score = scorePath(path, nodes, existingSegments, x1, y1, x2, y2)

      if (score < bestScore) {
        bestScore = score
        bestPath = path
        bestSourcePort = combo.source
        bestTargetPort = combo.target
      }

      // If we found a perfect path (no crossings), we can stop early
      if (bestScore < 50) break
    }

    if (bestScore < 50) break
  }

  return {
    pathD: cleanPath(bestPath),
    sourcePort: bestSourcePort,
    targetPort: bestTargetPort
  }
}

// Legacy function for backward compatibility
function buildOrthogonalPath(x1, y1, x2, y2, sourceDir, targetDir, nodes, connections, currentConnectionId) {
  const pathOptions = generatePathOptions(x1, y1, x2, y2, sourceDir, targetDir, nodes)
  const existingSegments = getExistingConnectionSegments(connections, currentConnectionId, nodes)

  let bestPath = pathOptions[0]
  let bestScore = Infinity

  for (const path of pathOptions) {
    const score = scorePath(path, nodes, existingSegments, x1, y1, x2, y2)
    if (score < bestScore) {
      bestScore = score
      bestPath = path
    }
  }

  return cleanPath(bestPath)
}

function Connection({ connection, sourceNode, targetNode, allNodes, allConnections, isSelected, onSelect, onPortsChanged }) {
  const sourcePorts = getNodePorts(sourceNode)
  const targetPorts = getNodePorts(targetNode)

  const defaultSourcePort = sourcePorts.find(p => p.id === 'right') || sourcePorts[0]
  const defaultTargetPort = targetPorts.find(p => p.id === 'left') || targetPorts[0]

  const originalSourcePoint = {
    x: connection.sourcePoint?.x ?? defaultSourcePort.x,
    y: connection.sourcePoint?.y ?? defaultSourcePort.y
  }
  const originalTargetPoint = {
    x: connection.targetPoint?.x ?? defaultTargetPort.x,
    y: connection.targetPoint?.y ?? defaultTargetPort.y
  }

  // Use the new port selection algorithm to find optimal routing
  const { pathD, sourcePort, targetPort } = useMemo(() => {
    return buildOrthogonalPathWithPortSelection(
      originalSourcePoint,
      originalTargetPoint,
      sourceNode,
      targetNode,
      allNodes || [],
      allConnections || [],
      connection.id
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalSourcePoint.x, originalSourcePoint.y, originalTargetPoint.x, originalTargetPoint.y,
      sourceNode.x, sourceNode.y, sourceNode.type, sourceNode.id,
      targetNode.x, targetNode.y, targetNode.type, targetNode.id,
      allNodes, allConnections, connection.id])

  // Use the optimized port positions for drawing
  const x1 = sourcePort.x
  const y1 = sourcePort.y
  const x2 = targetPort.x
  const y2 = targetPort.y

  // Notify parent when optimal ports differ from stored connection points
  useEffect(() => {
    const sourceChanged = Math.abs(x1 - originalSourcePoint.x) > 5 || Math.abs(y1 - originalSourcePoint.y) > 5
    const targetChanged = Math.abs(x2 - originalTargetPoint.x) > 5 || Math.abs(y2 - originalTargetPoint.y) > 5

    if ((sourceChanged || targetChanged) && onPortsChanged) {
      onPortsChanged(connection.id, { x: x1, y: y1 }, { x: x2, y: y2 })
    }
  }, [connection.id, x1, y1, x2, y2, originalSourcePoint.x, originalSourcePoint.y, originalTargetPoint.x, originalTargetPoint.y, onPortsChanged])

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
      <circle cx={x1} cy={y1} r="4" fill={isSelected ? 'var(--accent-danger)' : 'var(--accent-primary)'} />
      <circle cx={x2} cy={y2} r="4" fill={isSelected ? 'var(--accent-danger)' : 'var(--accent-primary)'} />
    </g>
  )
}

export default memo(Connection)
