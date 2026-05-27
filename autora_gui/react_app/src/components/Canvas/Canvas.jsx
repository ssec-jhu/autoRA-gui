import React, { useRef, useCallback, useState, useEffect } from 'react'
import { useWorkflow } from '../../context/WorkflowContext'
import Node from '../Node/Node'
import Connection from './Connection'
import './Canvas.css'

function Canvas() {
  const canvasRef = useRef(null)
  const { state, dispatch } = useWorkflow()
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [hasDragged, setHasDragged] = useState(false)
  const { connectingFrom } = state

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
    // Only deselect if user didn't drag (was a real click)
    if (!hasDragged && (e.target === canvasRef.current || e.target.classList.contains('canvas-inner'))) {
      dispatch({ type: 'DESELECT_ALL' })
    }
  }

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
