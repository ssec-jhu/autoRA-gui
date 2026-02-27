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
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
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

    if (state.connectingFrom) {
      const sourceNode = state.nodes.find(n => n.id === state.connectingFrom)
      if (sourceNode) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY)
        setTempLine({
          x1: sourceNode.x + 160,
          y1: sourceNode.y + 40,
          x2: x,
          y2: y
        })
      }
    }
  }, [isPanning, panStart, state.zoom, state.connectingFrom, state.nodes, screenToCanvas, dispatch])

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

  useEffect(() => {
    if (!state.connectingFrom) {
      setTempLine(null)
    }
  }, [state.connectingFrom])

  const handlePortClick = useCallback((nodeId, portType) => {
    if (portType === 'output') {
      dispatch({ type: 'START_CONNECTING', payload: nodeId })
    } else if (portType === 'input' && state.connectingFrom) {
      dispatch({
        type: 'ADD_CONNECTION',
        payload: { sourceId: state.connectingFrom, targetId: nodeId }
      })
    }
  }, [state.connectingFrom, dispatch])

  return (
    <div
      ref={canvasRef}
      className={`canvas ${isPanning ? 'panning' : ''}`}
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
              d={`M ${tempLine.x1} ${tempLine.y1} C ${tempLine.x1 + 60} ${tempLine.y1}, ${tempLine.x2 - 60} ${tempLine.y2}, ${tempLine.x2} ${tempLine.y2}`}
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
            isConnecting={state.connectingFrom === node.id}
            onSelect={(id) => dispatch({ type: 'SELECT_NODE', payload: id })}
            onDelete={(id) => dispatch({ type: 'DELETE_NODE', payload: id })}
            onPositionChange={(id, x, y) => dispatch({ type: 'UPDATE_NODE_POSITION', payload: { id, x, y } })}
            onPortClick={handlePortClick}
            zoom={state.zoom}
          />
        ))}
      </div>
      <div className="canvas-info">
        <span>Zoom: {Math.round(state.zoom * 100)}%</span>
        <span>Nodes: {state.nodes.length}</span>
        <span>Connections: {state.connections.length}</span>
      </div>
    </div>
  )
}

export default Canvas
