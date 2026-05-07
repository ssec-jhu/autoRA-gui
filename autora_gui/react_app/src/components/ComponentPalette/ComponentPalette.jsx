import React, { useState, useMemo, useEffect } from 'react'
import { useWorkflow } from '../../context/WorkflowContext'
import './ComponentPalette.css'

const typeConfig = {
  controls: { label: 'Controls', icon: '⚙', color: 'var(--node-controls)' },
  theorists: { label: 'Theorists', icon: '🧠', color: 'var(--node-theorists)' },
  experimentalists: { label: 'Experimentalists', icon: '🔬', color: 'var(--node-experimentalists)' },
  experiment_runners: { label: 'Experiment Runners', icon: '⚡', color: 'var(--node-experiment-runners)' }
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

function ComponentPalette() {
  const { state, dispatch } = useWorkflow()
  const [searchTerm, setSearchTerm] = useState('')
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

  return (
    <aside className="component-palette">
      <div className="palette-header">
        <h2>Components</h2>
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
