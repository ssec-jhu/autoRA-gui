import React, { useEffect, useCallback } from 'react'
import { useWorkflow } from './context/WorkflowContext'
import ComponentPalette from './components/ComponentPalette/ComponentPalette'
import Canvas from './components/Canvas/Canvas'
import PropertiesPanel from './components/PropertiesPanel/PropertiesPanel'
import Toolbar from './components/Toolbar/Toolbar'
import './App.css'

function App() {
  const { state, dispatch } = useWorkflow()

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

  return (
    <div className="app">
      <Toolbar />
      <div className="main-content">
        <ComponentPalette />
        <Canvas />
        <PropertiesPanel />
      </div>
    </div>
  )
}

export default App
