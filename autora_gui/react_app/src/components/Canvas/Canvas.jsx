import React, { useRef, useCallback, useState, useEffect } from 'react'
import { useWorkflow } from '../../context/WorkflowContext'
import Node from '../Node/Node'
import Connection from './Connection'
import './Canvas.css'

function Canvas() {
  const canvasRef = useRef(null)
  const { state, dispatch } = useWorkflow()
  const [tempLine, setTempLine] = useState(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [connectingFrom, setConnectingFrom] = useState(null) // { nodeId, point: {x, y} }

  const screenToCanvas = useCallback((screenX, screenY) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (screenX - rect.left) / state.zoom - state.pan.x,
      y: (screenY - rect.top) / state.zoom - state.pan.y
    }
  }, [state.zoom, state.pan])

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

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

  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current || e.target.classList.contains('canvas-inner')) {
      dispatch({ type: 'DESELECT_ALL' })
      setConnectingFrom(null)
      setTempLine(null)
    }
  }

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      dispatch({ type: 'SET_ZOOM', payload: state.zoom + delta })
    }
  }, [state.zoom, dispatch])

  const handleMouseDown = (e) => {
    if (e.button === 1) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - state.pan.x * state.zoom, y: e.clientY - state.pan.y * state.zoom })
    }
  }

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      dispatch({
        type: 'SET_PAN',
        payload: {
          x: (e.clientX - panStart.x) / state.zoom,
          y: (e.clientY - panStart.y) / state.zoom
        }
      })
    }

    if (connectingFrom) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY)
      setTempLine({
        x1: connectingFrom.point.x,
        y1: connectingFrom.point.y,
        x2: x,
        y2: y
      })
    }
  }, [isPanning, panStart, state.zoom, connectingFrom, screenToCanvas, dispatch])

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })
      return () => canvas.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  const handleBorderClick = useCallback((nodeId, point) => {
    if (!connectingFrom) {
      // Start new connection
      setConnectingFrom({ nodeId, point })
    } else if (connectingFrom.nodeId !== nodeId) {
      // Complete connection to different node
      dispatch({
        type: 'ADD_CONNECTION',
        payload: {
          sourceId: connectingFrom.nodeId,
          targetId: nodeId,
          sourcePoint: connectingFrom.point,
          targetPoint: point
        }
      })
      setConnectingFrom(null)
      setTempLine(null)
    }
  }, [connectingFrom, dispatch])

  // Calculate parabolic curve for temp line
  const getTempLinePath = () => {
    if (!tempLine) return ''
    const { x1, y1, x2, y2 } = tempLine
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

    return `M ${x1} ${y1} Q ${cpx} ${cpy}, ${x2} ${y2}`
  }

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
                isSelected={state.selectedConnectionId === connection.id}
                onSelect={(id) => dispatch({ type: 'SELECT_CONNECTION', payload: id })}
              />
            )
          })}
          {tempLine && (
            <path
              className="temp-connection"
              d={getTempLinePath()}
              stroke="var(--accent-primary)"
              strokeWidth="2"
              strokeDasharray="5,5"
              fill="none"
            />
          )}
        </svg>
        {state.nodes.map(node => (
          <Node
            key={node.id}
            node={node}
            isSelected={state.selectedNodeId === node.id}
            isConnecting={connectingFrom?.nodeId === node.id}
            onSelect={(id) => dispatch({ type: 'SELECT_NODE', payload: id })}
            onDelete={(id) => dispatch({ type: 'DELETE_NODE', payload: id })}
            onPositionChange={(id, x, y) => dispatch({ type: 'UPDATE_NODE_POSITION', payload: { id, x, y } })}
            onBorderClick={handleBorderClick}
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
