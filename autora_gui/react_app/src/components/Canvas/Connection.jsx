/**
 * Renders a single connection (edge) between two workflow nodes in the AutoRA Workflow
 * Editor. Contains the orthogonal auto-routing engine that chooses optimal source/target
 * ports and computes an SVG path that avoids overlapping nodes and other connections.
 *
 * @module components/Canvas/Connection
 */
import React, { memo, useMemo, useEffect } from 'react'
import { getNodePorts, getPortType } from '../Node/Node'

// Node dimensions for collision detection
const NODE_WIDTH = 160
const NODE_HEIGHT = 80
const CONTROL_NODE_WIDTH = 100
const CONTROL_NODE_HEIGHT = 80
const DIAMOND_SIZE = 90
const PADDING = 20 // Padding around nodes for routing

/**
 * Computes the padded bounding box of a node, sized according to its shape/type
 * (diamond filter, control node, or standard node), for use in collision detection.
 *
 * @param {Object} node - The node to measure.
 * @param {string} node.type - The node type (e.g. 'filter_point', 'start_point').
 * @param {number} node.x - The node's x position.
 * @param {number} node.y - The node's y position.
 * @param {number} [extraPadding=0] - Additional padding to add beyond the default.
 * @returns {{x: number, y: number, width: number, height: number}} The bounding box.
 */
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

/**
 * Determines whether two line segments (x1,y1)-(x2,y2) and (x3,y3)-(x4,y4) cross,
 * using a slightly inset parametric test so endpoints that merely touch don't count.
 *
 * @param {number} x1 - First segment start x.
 * @param {number} y1 - First segment start y.
 * @param {number} x2 - First segment end x.
 * @param {number} y2 - First segment end y.
 * @param {number} x3 - Second segment start x.
 * @param {number} y3 - Second segment start y.
 * @param {number} x4 - Second segment end x.
 * @param {number} y4 - Second segment end y.
 * @returns {boolean} True if the segments intersect (excluding near-endpoint touches).
 */
// Check if two line segments intersect
function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  if (Math.abs(denom) < 0.0001) return false

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom

  return ua > 0.01 && ua < 0.99 && ub > 0.01 && ub < 0.99
}

/**
 * Checks whether a line segment crosses any of the four edges of a rectangle.
 *
 * @param {number} x1 - Segment start x.
 * @param {number} y1 - Segment start y.
 * @param {number} x2 - Segment end x.
 * @param {number} y2 - Segment end y.
 * @param {{x: number, y: number, width: number, height: number}} rect - The rectangle.
 * @returns {boolean} True if the segment intersects any edge of the rectangle.
 */
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

/**
 * Determines whether a routing segment passes through any node's padded bounds,
 * while tolerating the segment legitimately touching a node at the exact port
 * positions where the connection attaches.
 *
 * @param {number} x1 - Segment start x.
 * @param {number} y1 - Segment start y.
 * @param {number} x2 - Segment end x.
 * @param {number} y2 - Segment end y.
 * @param {Array<Object>} nodes - All nodes to test against.
 * @param {number} portX1 - Source port x (allowed touch point).
 * @param {number} portY1 - Source port y (allowed touch point).
 * @param {number} portX2 - Target port x (allowed touch point).
 * @param {number} portY2 - Target port y (allowed touch point).
 * @returns {boolean} True if the segment improperly crosses a node.
 */
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

/**
 * Builds a list of straight-line segment approximations for all connections except the
 * one currently being routed, resolving each connection's endpoints from its stored
 * points or its nodes' default ports.
 *
 * @param {Array<Object>} connections - All connections in the workflow.
 * @param {string} currentConnectionId - Id of the connection to exclude from the result.
 * @param {Array<Object>} allNodes - All nodes, used to resolve default port positions.
 * @returns {Array<{x1: number, y1: number, x2: number, y2: number, connId: string}>} Segment approximations.
 */
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

/**
 * Checks whether any segment of a candidate path crosses any existing connection segment.
 *
 * @param {Array<Array<number>>} path - Ordered list of [x, y] points forming the path.
 * @param {Array<{x1: number, y1: number, x2: number, y2: number}>} existingSegments - Existing connection segments.
 * @returns {boolean} True if the path crosses an existing connection.
 */
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

/**
 * Detects whether a candidate path runs along (overlaps) an existing connection by
 * comparing parallel horizontal or vertical segments that are close together and
 * share a meaningful span of overlap.
 *
 * @param {Array<Array<number>>} path - Ordered list of [x, y] points forming the path.
 * @param {Array<{x1: number, y1: number, x2: number, y2: number}>} existingSegments - Existing connection segments.
 * @param {number} [threshold=15] - Max perpendicular distance to treat segments as coinciding.
 * @returns {boolean} True if the path substantially overlaps an existing connection.
 */
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

/**
 * Returns the outward unit direction vector for a named port, used to build the initial
 * stub of a routed path leaving/entering a node.
 *
 * @param {string} portId - The port identifier ('top', 'bottom', 'left', or 'right').
 * @returns {{dx: number, dy: number}} The outward direction vector (defaults to right).
 */
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

/**
 * Finds the id of the port nearest to a given point (by Euclidean distance).
 *
 * @param {Object} node - The node owning the ports (unused for the lookup itself).
 * @param {{x: number, y: number}} point - The reference point.
 * @param {Array<{id: string, x: number, y: number}>} ports - Candidate ports.
 * @returns {string} The id of the closest port.
 */
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

/**
 * Determines whether a given port on a node is already used (within a small distance
 * threshold) as the source or target of any connection other than the current one.
 *
 * @param {string} nodeId - The id of the node owning the port.
 * @param {{x: number, y: number}} port - The port position to test.
 * @param {Array<Object>} connections - All connections in the workflow.
 * @param {string} currentConnectionId - Id of the connection to ignore.
 * @returns {boolean} True if the port is occupied by another connection.
 */
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

/**
 * Returns the node's ports that are both the correct type for the requested role
 * (output for source, input for target) and not already occupied by another connection.
 *
 * @param {Object} node - The node whose ports are considered.
 * @param {Array<Object>} connections - All connections in the workflow.
 * @param {string} currentConnectionId - Id of the connection being routed (ignored for occupancy).
 * @param {boolean} isSource - True to find output (source) ports, false for input (target) ports.
 * @returns {Array<{id: string, x: number, y: number}>} The available ports.
 */
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

/**
 * Generates a set of candidate orthogonal routes between a source and target point,
 * trying several stub lengths and routing strategies (direct, mid-split, and detours
 * around the top/bottom/left/right extents of all nodes) depending on port orientation.
 *
 * @param {number} x1 - Source point x.
 * @param {number} y1 - Source point y.
 * @param {number} x2 - Target point x.
 * @param {number} y2 - Target point y.
 * @param {{dx: number, dy: number}} sourceDir - Outward direction of the source port.
 * @param {{dx: number, dy: number}} targetDir - Outward direction of the target port.
 * @param {Array<Object>} nodes - All nodes, used to compute detour extents.
 * @returns {Array<Array<Array<number>>>} A list of candidate paths, each an ordered list of [x, y] points.
 */
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

/**
 * Converts a list of points into an SVG path string, removing duplicate points and
 * collapsing consecutive collinear (same horizontal or vertical) segments.
 *
 * @param {Array<Array<number>>} points - Ordered list of [x, y] points.
 * @returns {string} An SVG path "d" attribute string.
 */
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

/**
 * Assigns a cost to a candidate path (lower is better): heavy penalties for crossing
 * nodes, medium for crossing or coinciding with other connections, plus smaller costs
 * proportional to total length and number of bends.
 *
 * @param {Array<Array<number>>} path - Ordered list of [x, y] points forming the path.
 * @param {Array<Object>} nodes - All nodes, for collision checks.
 * @param {Array<Object>} existingSegments - Existing connection segments, for crossing/coincidence checks.
 * @param {number} x1 - Source port x (allowed touch point).
 * @param {number} y1 - Source port y (allowed touch point).
 * @param {number} x2 - Target port x (allowed touch point).
 * @param {number} y2 - Target port y (allowed touch point).
 * @returns {number} The path score; lower values are preferred.
 */
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

/**
 * The primary routing engine. Considers the original ports plus available alternative
 * source/target ports, generates candidate paths for each combination, scores them, and
 * returns the lowest-cost path together with the ports that produced it.
 *
 * @param {{x: number, y: number}} originalSourcePort - The connection's current source point.
 * @param {{x: number, y: number}} originalTargetPort - The connection's current target point.
 * @param {Object} sourceNode - The source node.
 * @param {Object} targetNode - The target node.
 * @param {Array<Object>} nodes - All nodes in the workflow.
 * @param {Array<Object>} connections - All connections in the workflow.
 * @param {string} currentConnectionId - Id of the connection being routed.
 * @returns {{pathD: string, sourcePort: Object, targetPort: Object}} The best SVG path string and the chosen source/target ports.
 */
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

/**
 * Legacy single-route builder kept for backward compatibility: generates candidate paths
 * for fixed source/target points and directions, then returns the best-scoring one as an
 * SVG path string (without alternative port selection).
 *
 * @param {number} x1 - Source point x.
 * @param {number} y1 - Source point y.
 * @param {number} x2 - Target point x.
 * @param {number} y2 - Target point y.
 * @param {{dx: number, dy: number}} sourceDir - Outward direction of the source port.
 * @param {{dx: number, dy: number}} targetDir - Outward direction of the target port.
 * @param {Array<Object>} nodes - All nodes in the workflow.
 * @param {Array<Object>} connections - All connections in the workflow.
 * @param {string} currentConnectionId - Id of the connection being routed.
 * @returns {string} The best-scoring SVG path "d" string.
 */
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

/**
 * Renders a single connection between two nodes as an auto-routed orthogonal SVG path,
 * with an invisible wide hit-area for easier selection, endpoint dots, and an arrowhead.
 * Recomputes the optimal route (memoized) and notifies the parent when the chosen ports
 * differ from the connection's stored points.
 *
 * @param {Object} props
 * @param {Object} props.connection - The connection data (id, sourceId, targetId, optional sourcePoint/targetPoint).
 * @param {Object} props.sourceNode - The source node.
 * @param {Object} props.targetNode - The target node.
 * @param {Array<Object>} props.allNodes - All nodes in the workflow, used for routing/collision.
 * @param {Array<Object>} props.allConnections - All connections, used for crossing/occupancy checks.
 * @param {boolean} props.isSelected - Whether this connection is currently selected.
 * @param {Function} props.onSelect - Called with the connection id when the connection is clicked.
 * @param {Function} props.onPortsChanged - Called with (id, sourcePoint, targetPoint) when routing selects new ports.
 * @returns {JSX.Element}
 */
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
