import React, { useRef, useCallback, useEffect } from 'react'
import { useWorkflow } from '../../context/WorkflowContext'
import { serializeWorkflow, deserializeWorkflow } from '../../utils/serialization'
import { generatePythonCode, generatePipInstalls } from '../../utils/pythonGenerator'
import './Toolbar.css'

// Canvas dimensions (should match the actual canvas size)
const getCanvasCenter = () => {
  const canvas = document.querySelector('.canvas')
  if (canvas) {
    const rect = canvas.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }
  return { width: 800, height: 600 } // fallback
}

function Toolbar() {
  const { state, dispatch } = useWorkflow()
  const fileInputRef = useRef(null)

  const handleSave = async () => {
    const workflow = serializeWorkflow(state)

    try {
      const response = await fetch('/api/workflow/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`Validation error: ${error.detail}`)
        return
      }
    } catch (err) {
      console.warn('Validation skipped:', err)
    }

    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workflow_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoad = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workflow = JSON.parse(event.target.result)
        const { nodes, connections } = deserializeWorkflow(workflow, state.components)
        dispatch({ type: 'LOAD_WORKFLOW', payload: { nodes, connections } })
      } catch (err) {
        alert('Failed to load workflow: ' + err.message)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClear = () => {
    if (state.nodes.length === 0 && state.connections.length === 0) return
    if (confirm('Clear the entire canvas?')) {
      dispatch({ type: 'CLEAR_CANVAS' })
    }
  }

  const handleGeneratePython = () => {
    try {
      const pythonCode = generatePythonCode(state)
      const pipInstalls = generatePipInstalls(state)

      // Create downloadable Python file
      const fullCode = `# ${pipInstalls}\n\n${pythonCode}`
      const blob = new Blob([fullCode], { type: 'text/x-python' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `workflow_${new Date().toISOString().slice(0, 10)}.py`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Failed to generate Python code: ${err.message}`)
    }
  }

  const handleUndo = () => {
    dispatch({ type: 'UNDO' })
  }

  const handleRedo = () => {
    dispatch({ type: 'REDO' })
  }

  const canUndo = state.past?.length > 0
  const canRedo = state.future?.length > 0

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) handleUndo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (canRedo) handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, canRedo])

  // Zoom relative to canvas center
  const zoomToCenter = useCallback((newZoom) => {
    // Clamp the new zoom value
    const clampedZoom = Math.max(0.25, Math.min(2, newZoom))
    if (clampedZoom === state.zoom) return

    // Get canvas dimensions
    const { width, height } = getCanvasCenter()

    // Calculate the canvas center point in canvas coordinates (before zoom)
    // The center of the viewport in screen coords is (width/2, height/2)
    // In canvas coords: centerX = (width/2) / oldZoom - pan.x
    const centerX = (width / 2) / state.zoom - state.pan.x
    const centerY = (height / 2) / state.zoom - state.pan.y

    // After zoom, we want the same canvas point to be at the viewport center
    // newPan.x = (width/2) / newZoom - centerX
    const newPanX = (width / 2) / clampedZoom - centerX
    const newPanY = (height / 2) / clampedZoom - centerY

    dispatch({ type: 'SET_ZOOM', payload: clampedZoom })
    dispatch({ type: 'SET_PAN', payload: { x: newPanX, y: newPanY } })
  }, [state.zoom, state.pan, dispatch])

  const handleZoomIn = () => {
    zoomToCenter(state.zoom + 0.1)
  }

  const handleZoomOut = () => {
    zoomToCenter(state.zoom - 0.1)
  }

  const handleZoomReset = () => {
    dispatch({ type: 'SET_ZOOM', payload: 1 })
    dispatch({ type: 'SET_PAN', payload: { x: 0, y: 0 } })
  }

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="brand-icon">🧪</span>
        <span className="brand-text">AutoRA Workflow Editor</span>
      </div>

      <div className="toolbar-actions">
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={handleSave} title="Save workflow (JSON)">
            <span className="btn-icon">💾</span>
            <span className="btn-text">Save</span>
          </button>
          <button className="toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Load workflow">
            <span className="btn-icon">📂</span>
            <span className="btn-text">Load</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleLoad}
            style={{ display: 'none' }}
          />
          <button className="toolbar-btn danger" onClick={handleClear} title="Clear canvas">
            <span className="btn-icon">🗑</span>
            <span className="btn-text">Clear</span>
          </button>
          <button
            className="toolbar-btn"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <span className="btn-icon">↩</span>
            <span className="btn-text">Undo</span>
          </button>
          <button
            className="toolbar-btn"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <span className="btn-icon">↪</span>
            <span className="btn-text">Redo</span>
          </button>
          <button className="toolbar-btn" onClick={handleGeneratePython} title="Generate Python code">
            <span className="btn-icon">🐍</span>
            <span className="btn-text">Generate Python</span>
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group zoom-controls">
          <button className="toolbar-btn icon-only" onClick={handleZoomOut} title="Zoom out">
            −
          </button>
          <button className="zoom-display" onClick={handleZoomReset} title="Reset zoom">
            {Math.round(state.zoom * 100)}%
          </button>
          <button className="toolbar-btn icon-only" onClick={handleZoomIn} title="Zoom in">
            +
          </button>
        </div>
      </div>

      <div className="toolbar-info">
        <span className="info-item">
          <span className="info-label">Nodes:</span>
          <span className="info-value">{state.nodes.length}</span>
        </span>
        <span className="info-item">
          <span className="info-label">Links:</span>
          <span className="info-value">{state.connections.length}</span>
        </span>
      </div>
    </header>
  )
}

export default Toolbar
