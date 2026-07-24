/**
 * The main workspace of the AutoRA Workflow Editor. Renders the pannable/zoomable
 * canvas that hosts workflow nodes and the SVG connections between them, and handles
 * drag-and-drop node creation, panning, zooming, selection, and port-to-port connecting.
 *
 * @module components/Canvas/Canvas
 */
import React, { useRef, useCallback, useState, useEffect } from 'react'
import { useWorkflow } from '../../context/WorkflowContext'
import Node from '../Node/Node'
import Connection from './Connection'
import './Canvas.css'

/**
 * Renders the interactive workflow canvas, including all nodes, connections, and the
 * live zoom/node/connection info overlay. Wires up drop, pan, zoom, click-to-deselect,
 * and connection-creation interactions against the shared workflow state.
 *
 * @returns {JSX.Element}
 */
function Canvas() {
  const canvasRef = useRef(null)
  const { state, dispatch } = useWorkflow()
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [hasDragged, setHasDragged] = useState(false)
  const { connectingFrom } = state

  /**
   * Converts screen (viewport) coordinates into canvas-space coordinates, accounting
   * for the current zoom level and pan offset.
   *
   * @param {number} screenX - The x coordinate in screen pixels (e.g. e.clientX).
   * @param {number} screenY - The y coordinate in screen pixels (e.g. e.clientY).
   * @returns {{x: number, y: number}} The equivalent point in canvas space.
   */
  const screenToCanvas = useCallback((screenX, screenY) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (screenX - rect.left) / state.zoom - state.pan.x,
      y: (screenY - rect.top) / state.zoom - state.pan.y
    }
  }, [state.zoom, state.pan])

  /**
   * Allows dropping palette components onto the canvas by preventing the default
   * behavior and signalling a "copy" drop effect.
   *
   * @param {DragEvent} e - The dragover event.
   * @returns {void}
   */
  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  /**
   * Handles dropping a component from the palette onto the canvas: reads the dragged
   * component JSON, converts the drop point to canvas coordinates, and dispatches an
   * ADD_NODE action (offset so the node is centered on the cursor).
   *
   * @param {DragEvent} e - The drop event carrying the component JSON payload.
   * @returns {void}
   */
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/json')
    if (!data) return

    const componentData = JSON.parse(data)
    const { x, y } = screenToCanvas(e.clientX, e.clientY)

    dispatch({
      type: 'ADD_NODE',
      payload: { componentData, x: x - 80, y: y - 30 }
    })
  }, [screenToCanvas, dispatch])

  /**
   * Deselects all nodes/connections when the user clicks empty canvas space, but only
   * if the interaction was a genuine click rather than the end of a pan drag.
   *
   * @param {MouseEvent} e - The click event.
   * @returns {void}
   */
  const handleCanvasClick = (e) => {
    // Only deselect if user didn't drag (was a real click)
    if (!hasDragged && (e.target === canvasRef.current || e.target.classList.contains('canvas-inner'))) {
      dispatch({ type: 'DESELECT_ALL' })
    }
  }

  /**
   * Zooms the canvas in/out on mouse wheel, clamped to the range 0.25x-2x, and adjusts
   * the pan so the canvas point under the cursor stays fixed during the zoom.
   *
   * @param {WheelEvent} e - The wheel event.
   * @returns {void}
   */
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newZoom = Math.max(0.25, Math.min(2, state.zoom + delta))
    if (newZoom === state.zoom) return

    // Get canvas rect for calculations
    const rect = canvasRef.current.getBoundingClientRect()

    // Calculate the point under the mouse in canvas coordinates (before zoom)
    const mouseX = (e.clientX - rect.left) / state.zoom - state.pan.x
    const mouseY = (e.clientY - rect.top) / state.zoom - state.pan.y

    // After zoom, adjust pan so the same canvas point stays under the mouse
    const newPanX = (e.clientX - rect.left) / newZoom - mouseX
    const newPanY = (e.clientY - rect.top) / newZoom - mouseY

    dispatch({ type: 'SET_ZOOM', payload: newZoom })
    dispatch({ type: 'SET_PAN', payload: { x: newPanX, y: newPanY } })
  }, [state.zoom, state.pan, dispatch])

  /**
   * Begins panning the canvas when the user presses the middle mouse button, or the
   * left button on empty canvas space or with Alt held. Records the starting offset.
   *
   * @param {MouseEvent} e - The mousedown event.
   * @returns {void}
   */
  const handleMouseDown = (e) => {
    // Left click on empty canvas, middle mouse button, or Alt + left click - start panning
    const isCanvasClick = e.target === canvasRef.current || e.target.classList.contains('canvas-inner')
    if (e.button === 1 || (e.button === 0 && (isCanvasClick || e.altKey))) {
      e.preventDefault()
      setIsPanning(true)
      setHasDragged(false)
      setPanStart({ x: e.clientX - state.pan.x * state.zoom, y: e.clientY - state.pan.y * state.zoom })
    }
  }

  /**
   * While panning is active, updates the pan offset to follow the cursor and marks
   * that a drag occurred (so the subsequent click is not treated as a deselect).
   *
   * @param {MouseEvent} e - The mousemove event.
   * @returns {void}
   */
  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      setHasDragged(true)
      dispatch({
        type: 'SET_PAN',
        payload: {
          x: (e.clientX - panStart.x) / state.zoom,
          y: (e.clientY - panStart.y) / state.zoom
        }
      })
    }
  }, [isPanning, panStart, state.zoom, dispatch])

  /**
   * Ends panning and clears the drag flag on the next tick, giving the click handler
   * a chance to read hasDragged before it resets.
   *
   * @returns {void}
   */
  const handleMouseUp = () => {
    setIsPanning(false)
    // Reset hasDragged after a short delay to allow click handler to check it
    setTimeout(() => setHasDragged(false), 0)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })
      return () => canvas.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  /**
   * Handles clicking a node's border port. If no connection is in progress, starts one
   * from the clicked port; otherwise, if the click is on a different node, completes the
   * connection from the pending source to this target.
   *
   * @param {string} nodeId - The id of the clicked node.
   * @param {{x: number, y: number}} point - The clicked port position in canvas space.
   * @returns {void}
   */
  const handleBorderClick = useCallback((nodeId, point) => {
    if (!connectingFrom) {
      // Start new connection
      dispatch({ type: 'START_CONNECTING', payload: { nodeId, point } })
    } else if (connectingFrom.nodeId !== nodeId) {
      // Complete connection to different node (ADD_CONNECTION clears connectingFrom)
      dispatch({
        type: 'ADD_CONNECTION',
        payload: {
          sourceId: connectingFrom.nodeId,
          targetId: nodeId,
          sourcePoint: connectingFrom.point,
          targetPoint: point
        }
      })
    }
  }, [connectingFrom, dispatch])

  /**
   * Persists updated source/target port positions for a connection when its auto-routing
   * selects different ports than were previously stored.
   *
   * @param {string} connectionId - The id of the connection whose ports changed.
   * @param {{x: number, y: number}} sourcePoint - The new source port position.
   * @param {{x: number, y: number}} targetPoint - The new target port position.
   * @returns {void}
   */
  const handlePortsChanged = useCallback((connectionId, sourcePoint, targetPoint) => {
    dispatch({
      type: 'UPDATE_CONNECTION_PORTS',
      payload: { id: connectionId, sourcePoint, targetPoint }
    })
  }, [dispatch])

  return (
    <div
      ref={canvasRef}
      className={`canvas ${isPanning ? 'panning' : ''} ${connectingFrom ? 'connecting-mode' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="canvas-inner"
        style={{
          transform: `scale(${state.zoom}) translate(${state.pan.x}px, ${state.pan.y}px)`
        }}
      >
        <svg className="connections-layer">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-primary)" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-danger)" />
            </marker>
          </defs>
          {state.connections.map(connection => {
            const sourceNode = state.nodes.find(n => n.id === connection.sourceId)
            const targetNode = state.nodes.find(n => n.id === connection.targetId)
            if (!sourceNode || !targetNode) return null
            return (
              <Connection
                key={connection.id}
                connection={connection}
                sourceNode={sourceNode}
                targetNode={targetNode}
                allNodes={state.nodes}
                allConnections={state.connections}
                isSelected={state.selectedConnectionId === connection.id}
                onSelect={(id) => dispatch({ type: 'SELECT_CONNECTION', payload: id })}
                onPortsChanged={handlePortsChanged}
              />
            )
          })}
        </svg>
        {state.nodes.map(node => (
          <Node
            key={node.id}
            node={node}
            isSelected={state.selectedNodeId === node.id}
            isConnecting={connectingFrom?.nodeId === node.id}
            connections={state.connections}
            onSelect={(id) => dispatch({ type: 'SELECT_NODE', payload: id })}
            onPositionChange={(id, x, y) => dispatch({ type: 'UPDATE_NODE_POSITION', payload: { id, x, y } })}
            onBorderClick={handleBorderClick}
            onDragStart={() => dispatch({ type: 'START_DRAG' })}
            onDragEnd={() => dispatch({ type: 'END_DRAG' })}
            zoom={state.zoom}
          />
        ))}
      </div>
      <div className="canvas-info">
        <span>Zoom: {Math.round(state.zoom * 100)}%</span>
        <span>Nodes: {state.nodes.length}</span>
        <span>Connections: {state.connections.length}</span>
        {connectingFrom && <span className="connecting-hint">Click a port on another node to connect</span>}
      </div>
    </div>
  )
}

export default Canvas
