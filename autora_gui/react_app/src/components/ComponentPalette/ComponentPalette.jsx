/**
 * Left-hand sidebar of the AutoRA Workflow Editor that lists the available
 * workflow building blocks. Groups control nodes and protocol components
 * (theorists, experimentalists, experiment runners) into collapsible,
 * searchable sections that can be dragged onto the canvas or clicked to preview.
 *
 * @module components/ComponentPalette/ComponentPalette
 */
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useWorkflow } from '../../context/WorkflowContext'
import './ComponentPalette.css'

const typeConfig = {
  controls: { label: 'Controls', icon: '⚙', color: 'var(--node-controls)' },
  theorists: { label: 'Theorists', icon: '🧠', color: 'var(--node-theorists)' },
  experimentalists: { label: 'Experimentalists', icon: '🔬', color: 'var(--node-experimentalists)' },
  experiment_runners: { label: 'Experiment Runners', icon: '⚡', color: 'var(--node-experiment-runners)' }
}

// Maps a component's protocolType (singular) to its palette/category key (plural).
const protocolTypeToCategory = {
  theorist: 'theorists',
  experimentalist: 'experimentalists',
  experiment_runner: 'experiment_runners'
}

const controlNodes = [
  {
    uuid: 'start-node',
    protocolType: 'start_point',
    name: 'Start',
    description: 'Starting point of the workflow',
    isControlNode: true,
    icon: '▶'
  },
  {
    uuid: 'end-node',
    protocolType: 'end_point',
    name: 'End',
    description: 'Ending point of the workflow',
    isControlNode: true,
    icon: '⏹'
  },
  {
    uuid: 'filter-node',
    protocolType: 'filter_point',
    name: 'Filter',
    description: 'Filter/decision point in the workflow',
    isControlNode: true,
    icon: '◆'
  }
]

/**
 * Renders the component palette sidebar: a search box plus collapsible sections
 * of control nodes and protocol components. Auto-expands the section containing
 * the currently selected/previewed component, and supports drag-to-canvas and
 * click-to-preview interactions.
 *
 * @returns {JSX.Element}
 */
function ComponentPalette() {
  const { state, dispatch } = useWorkflow()
  const [searchTerm, setSearchTerm] = useState('')
  const fileInputRef = useRef(null)
  const [expandedSections, setExpandedSections] = useState({
    controls: true,
    theorists: false,
    experimentalists: false,
    experiment_runners: false
  })

  // Get the selected/previewed component UUID
  const selectedNode = state.nodes.find(n => n.id === state.selectedNodeId)
  const selectedComponentUuid = selectedNode?.protocolUuid || state.previewedComponent?.uuid

  // Auto-expand section containing the selected component, collapse others
  useEffect(() => {
    if (!selectedComponentUuid) return

    // Check control nodes first
    if (controlNodes.some(c => c.uuid === selectedComponentUuid)) {
      setExpandedSections({
        controls: true,
        theorists: false,
        experimentalists: false,
        experiment_runners: false
      })
      return
    }

    // Check other component types
    if (state.components) {
      for (const [type, components] of Object.entries(state.components)) {
        if (Array.isArray(components) && components.some(c => c.uuid === selectedComponentUuid)) {
          setExpandedSections({
            controls: false,
            theorists: false,
            experimentalists: false,
            experiment_runners: false,
            [type]: true
          })
          break
        }
      }
    }
  }, [selectedComponentUuid, state.components])

  const filteredComponents = useMemo(() => {
    const result = {}

    // Add control nodes (Start, End)
    const filteredControls = controlNodes.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(searchTerm.toLowerCase())
      const descMatch = c.description?.toLowerCase().includes(searchTerm.toLowerCase())
      return nameMatch || descMatch
    })
    if (filteredControls.length > 0) {
      result.controls = filteredControls.sort((a, b) => a.name.localeCompare(b.name))
    }

    // Add protocol components from state
    if (!state.components) return result
    Object.entries(state.components).forEach(([type, components]) => {
      if (!Array.isArray(components)) return
      const filtered = components.filter(c => {
        if (!c || !c.name) return false
        const nameMatch = c.name.toLowerCase().includes(searchTerm.toLowerCase())
        const descMatch = c.description?.toLowerCase().includes(searchTerm.toLowerCase())
        return nameMatch || descMatch
      })
      if (filtered.length > 0) {
        result[type] = filtered.sort((a, b) => a.name.localeCompare(b.name))
      }
    })
    return result
  }, [state.components, searchTerm])

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleDragStart = (e, component) => {
    e.dataTransfer.setData('application/json', JSON.stringify(component))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleComponentClick = (component) => {
    dispatch({ type: 'SET_PREVIEWED_COMPONENT', payload: component })
  }

  /**
   * Upload a component JSON file. Tries to persist it to disk via the backend
   * (dev mode); if the backend is unreachable (e.g. standalone build), falls
   * back to adding it to the palette for the current session only.
   *
   * @param {Event} e - Change event from the hidden file input
   */
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    let component
    try {
      component = JSON.parse(await file.text())
    } catch (err) {
      alert('Invalid JSON file: ' + err.message)
      return
    }

    const category = protocolTypeToCategory[component?.protocolType]
    if (!category) {
      alert(
        `Unknown or missing protocolType: ${component?.protocolType}. ` +
        'Expected one of: theorist, experimentalist, experiment_runner.'
      )
      return
    }
    if (!component.uuid || !component.name) {
      alert('Component is missing a required "uuid" or "name" field.')
      return
    }

    try {
      const res = await fetch('/api/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(component)
      })
      if (res.ok) {
        const data = await res.json()
        dispatch({ type: 'ADD_COMPONENT', payload: data })
        setExpandedSections(prev => ({ ...prev, [category]: true }))
        alert(`Added "${data.component.name}" to ${category} (saved to disk).`)
        return
      }
      // 404/405 mean there is no persistence endpoint (e.g. the standalone build
      // served by a static host) — fall back to a session-only add.
      if (res.status === 404 || res.status === 405) {
        throw new Error('no-backend')
      }
      // Backend reachable but rejected the component — surface why, don't fall back.
      let detail = `${res.status} ${res.statusText}`
      try { detail = (await res.json()).detail || detail } catch { /* keep status */ }
      alert('Could not save component: ' + detail)
    } catch {
      // Backend unreachable or no upload endpoint — add for this session only.
      dispatch({ type: 'ADD_COMPONENT', payload: { category, component } })
      setExpandedSections(prev => ({ ...prev, [category]: true }))
      alert(
        `Added "${component.name}" to ${category} for this session only ` +
        '(no backend available, not saved to disk).'
      )
    }
  }

  return (
    <aside className="component-palette">
      <div className="palette-header">
        <div className="palette-title-row">
          <h2>Components</h2>
          <button
            type="button"
            className="add-component-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload a component JSON file"
          >
            + Add
          </button>
        </div>
        <input
          type="file"
          accept=".json,application/json"
          ref={fileInputRef}
          onChange={handleFileSelected}
          style={{ display: 'none' }}
        />
        <input
          type="text"
          placeholder="Search components..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      <div className="palette-content">
        {Object.entries(filteredComponents).map(([type, components]) => {
          const config = typeConfig[type] || { label: type, icon: '●', color: '#666' }
          return (
            <div key={type} className="component-section">
              <button
                className="section-header"
                onClick={() => toggleSection(type)}
              >
                <span className="section-icon" style={{ color: config.color }}>
                  {config.icon}
                </span>
                <span className="section-title">{config.label}</span>
                <span className="section-count">{components.length}</span>
                <span className={`section-toggle ${expandedSections[type] ? 'expanded' : ''}`}>
                  ▼
                </span>
              </button>
              {expandedSections[type] && (
                <div className="component-list">
                  {components.map(component => (
                    <div
                      key={component.uuid}
                      className={`component-item ${selectedComponentUuid === component.uuid ? 'selected' : ''}`}
                      draggable
                      onClick={() => handleComponentClick(component)}
                      onDragStart={(e) => handleDragStart(e, component)}
                      title={component.description}
                    >
                      <span className="component-icon" style={{ backgroundColor: config.color }}>
                        {component.icon || config.icon}
                      </span>
                      <span className="component-name">{component.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {Object.keys(filteredComponents).length === 0 && (
          <div className="no-results">No components found</div>
        )}
      </div>
    </aside>
  )
}

export default ComponentPalette
