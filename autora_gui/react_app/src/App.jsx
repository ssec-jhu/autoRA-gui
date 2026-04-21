import React, { useEffect, useCallback, useState, useRef } from 'react'
import { useWorkflow } from './context/WorkflowContext'
import ComponentPalette from './components/ComponentPalette/ComponentPalette'
import Canvas from './components/Canvas/Canvas'
import PropertiesPanel from './components/PropertiesPanel/PropertiesPanel'
import Toolbar from './components/Toolbar/Toolbar'
import './App.css'

const MIN_PANEL_WIDTH = 200
const MAX_PANEL_WIDTH = 500

function App() {
  const { state, dispatch } = useWorkflow()
  const [leftWidth, setLeftWidth] = useState(280)
  const [rightWidth, setRightWidth] = useState(300)
  const resizingRef = useRef(null)

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName === 'INPUT') return
      if (state.selectedNodeId) {
        dispatch({ type: 'DELETE_NODE', payload: state.selectedNodeId })
      }
      if (state.selectedConnectionId) {
        dispatch({ type: 'DELETE_CONNECTION', payload: state.selectedConnectionId })
      }
    }
    if (e.key === 'Escape') {
      dispatch({ type: 'DESELECT_ALL' })
    }
  }, [state.selectedNodeId, state.selectedConnectionId, dispatch])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleMouseDown = useCallback((side) => (e) => {
    e.preventDefault()
    resizingRef.current = { side, startX: e.clientX, startWidth: side === 'left' ? leftWidth : rightWidth }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [leftWidth, rightWidth])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingRef.current) return
      const { side, startX, startWidth } = resizingRef.current
      const delta = e.clientX - startX
      const newWidth = side === 'left' ? startWidth + delta : startWidth - delta
      const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth))
      if (side === 'left') {
        setLeftWidth(clampedWidth)
      } else {
        setRightWidth(clampedWidth)
      }
    }

    const handleMouseUp = () => {
      resizingRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <div className="app">
      <Toolbar />
      <div className="main-content">
        <div className="panel-left" style={{ width: leftWidth }}>
          <ComponentPalette />
        </div>
        <div className="resize-handle" onMouseDown={handleMouseDown('left')} />
        <Canvas />
        <div className="resize-handle" onMouseDown={handleMouseDown('right')} />
        <div className="panel-right" style={{ width: rightWidth }}>
          <PropertiesPanel />
        </div>
      </div>
    </div>
  )
}

export default App
