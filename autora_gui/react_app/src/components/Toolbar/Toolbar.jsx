/**
 * Top toolbar for the AutoRA Workflow Editor. Provides workflow actions
 * (save/load JSON, clear, undo/redo), code generation (Python and Jupyter
 * notebook), zoom controls, and live counts of nodes and connections.
 *
 * @module components/Toolbar/Toolbar
 */

import React, { useRef, useCallback, useEffect } from 'react'
import { useWorkflow } from '../../context/WorkflowContext'
import { serializeWorkflow, deserializeWorkflow } from '../../utils/serialization'
import { generatePythonCode, generatePipInstalls } from '../../utils/pythonGenerator'
import { generateNotebookString } from '../../utils/notebookGenerator'
import { computeFitToScreen } from '../../utils/geometry'
import './Toolbar.css'

/**
 * Read the current canvas element's dimensions, falling back to a default size
 * when the canvas is not present in the DOM.
 *
 * @returns {{width: number, height: number}} The canvas width and height in pixels
 */
// Canvas dimensions (should match the actual canvas size)
const getCanvasCenter = () => {
  const canvas = document.querySelector('.canvas')
  if (canvas) {
    const rect = canvas.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }
  return { width: 800, height: 600 } // fallback
}

/**
 * Toolbar component. Reads and dispatches workflow state via context and
 * exposes the editor's top-level actions. Registers global keyboard shortcuts
 * for undo/redo while mounted.
 *
 * The three regions (brand, actions, info) are sized to mirror the columns
 * below (left panel, canvas, right panel) so the first action button lines up
 * with the canvas's left edge and the zoom controls with its right edge.
 *
 * @param {Object} props
 * @param {number} props.leftWidth - Width of the left component palette panel, in pixels.
 * @param {number} props.rightWidth - Width of the right properties panel, in pixels.
 * @returns {JSX.Element}
 */
function Toolbar({ leftWidth, rightWidth }) {
  const { state, dispatch } = useWorkflow()
  const fileInputRef = useRef(null)

  /**
   * Serialize the current workflow, validate it against the backend (skipping
   * silently on network failure), then download it as a timestamped JSON file.
   *
   * @returns {Promise<void>}
   */
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

    await saveFile(JSON.stringify(workflow, null, 2), { type: 'application/json', extension: 'json' })
  }

  /**
   * Read a selected JSON file, deserialize it into nodes and connections, and
   * load it into the workflow state. Alerts on parse/deserialize failure.
   *
   * @param {Event} e - Change event from the hidden file input
   * @returns {void}
   */
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

  /**
   * Clear the entire canvas after user confirmation, unless it is already empty.
   *
   * @returns {void}
   */
  const handleClear = () => {
    if (state.nodes.length === 0 && state.connections.length === 0) return
    if (confirm('Clear the entire canvas?')) {
      dispatch({ type: 'CLEAR_CANVAS' })
    }
  }

  /**
   * Save content to a file. Where supported (Chromium browsers) this opens a
   * native Save dialog so the user can pick the name and location; elsewhere
   * (Firefox/Safari) it falls back to a download named with a unique timestamp
   * (date + time) so repeated saves don't collide.
   *
   * @param {string} content - File contents
   * @param {Object} opts - Options
   * @param {string} opts.type - MIME type for the blob
   * @param {string} opts.extension - File extension (without the dot)
   * @returns {Promise<void>}
   */
  const saveFile = async (content, { type, extension }) => {
    // Filesystem-safe timestamp, e.g. "2026-08-10_16-06-43"
    const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
    const suggestedName = `workflow_${stamp}.${extension}`
    const blob = new Blob([content], { type })

    // Chromium: native Save dialog lets the user choose/rename the file
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: `${extension.toUpperCase()} file`, accept: { [type]: [`.${extension}`] } }]
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        return
      } catch (err) {
        if (err.name === 'AbortError') return // user cancelled the dialog
        console.warn('Save dialog unavailable, falling back to download:', err)
      }
    }

    // Fallback (Firefox/Safari): download with a unique, timestamped name
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = suggestedName
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Generate Python source for the current workflow (with pip install header)
   * and download it as a .py file. Alerts on generation failure.
   *
   * @returns {Promise<void>}
   */
  const handleGeneratePython = async () => {
    try {
      const pythonCode = generatePythonCode(state)
      const pipInstalls = generatePipInstalls(state)

      // Create downloadable Python file
      const fullCode = `# ${pipInstalls}\n\n${pythonCode}`
      await saveFile(fullCode, { type: 'text/x-python', extension: 'py' })
    } catch (err) {
      alert(`Failed to generate Python code: ${err.message}`)
    }
  }

  /**
   * Generate a Jupyter notebook for the current workflow and download it as an
   * .ipynb file. Alerts on generation failure.
   *
   * @returns {Promise<void>}
   */
  const handleGenerateNotebook = async () => {
    try {
      const notebook = generateNotebookString(state)
      await saveFile(notebook, { type: 'application/x-ipynb+json', extension: 'ipynb' })
    } catch (err) {
      alert(`Failed to generate notebook: ${err.message}`)
    }
  }

  /**
   * Dispatch an undo action.
   *
   * @returns {void}
   */
  const handleUndo = () => {
    dispatch({ type: 'UNDO' })
  }

  /**
   * Dispatch a redo action.
   *
   * @returns {void}
   */
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

  /**
   * Zoom the canvas to a new level while keeping the viewport center fixed,
   * clamping the zoom to the allowed range and adjusting pan accordingly.
   *
   * @param {number} newZoom - Desired zoom level before clamping
   * @returns {void}
   */
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

  /**
   * Increase the zoom level by one step, centered on the viewport.
   *
   * @returns {void}
   */
  const handleZoomIn = () => {
    zoomToCenter(state.zoom + 0.1)
  }

  /**
   * Decrease the zoom level by one step, centered on the viewport.
   *
   * @returns {void}
   */
  const handleZoomOut = () => {
    zoomToCenter(state.zoom - 0.1)
  }

  /**
   * Reset zoom to 100% and recenter the pan to the origin.
   *
   * @returns {void}
   */
  const handleZoomReset = () => {
    dispatch({ type: 'SET_ZOOM', payload: 1 })
    dispatch({ type: 'SET_PAN', payload: { x: 0, y: 0 } })
  }

  /**
   * Fit the whole workflow into the visible canvas by computing the zoom and pan
   * that center all nodes within the viewport (see `computeFitToScreen`).
   *
   * @returns {void}
   */
  const handleFitToScreen = () => {
    const fit = computeFitToScreen(state.nodes, getCanvasCenter())
    if (!fit) return
    dispatch({ type: 'SET_ZOOM', payload: fit.zoom })
    dispatch({ type: 'SET_PAN', payload: fit.pan })
  }

  return (
    <header className="toolbar">
      <div className="toolbar-brand" style={{ width: leftWidth }}>
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
          <button className="toolbar-btn" onClick={handleGenerateNotebook} title="Generate Jupyter notebook">
            <span className="btn-icon">📓</span>
            <span className="btn-text">Generate Notebook</span>
          </button>
        </div>

        {/* Push the view controls to the canvas's right edge */}
        <div className="toolbar-spacer" />

        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={handleFitToScreen} title="Fit workflow to canvas">
            <span className="btn-icon">🖥</span>
            <span className="btn-text">Fit to Screen</span>
          </button>

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
      </div>

      <div className="toolbar-info" style={{ width: rightWidth }}>
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
