import React from 'react'
import { useWorkflow } from '../../context/WorkflowContext'
import './PropertiesPanel.css'

function PropertiesPanel() {
  const { state, dispatch } = useWorkflow()
  const selectedNode = state.nodes.find(n => n.id === state.selectedNodeId)

  const handleParameterChange = (paramName, value) => {
    dispatch({
      type: 'UPDATE_NODE',
      payload: {
        id: selectedNode.id,
        parameters: { ...selectedNode.parameters, [paramName]: value }
      }
    })
  }

  const parseValue = (value, datatype) => {
    if (value === '' || value === null || value === undefined) return null
    switch (datatype) {
      case 'integer':
        return parseInt(value, 10)
      case 'real':
        return parseFloat(value)
      case 'boolean':
        return value === 'true' || value === true
      default:
        return value
    }
  }

  const renderInput = (param) => {
    const currentValue = selectedNode.parameters[param.name]

    switch (param.datatype) {
      case 'integer':
        return (
          <input
            type="number"
            step="1"
            value={currentValue ?? ''}
            onChange={(e) => handleParameterChange(param.name, parseValue(e.target.value, 'integer'))}
            placeholder={param.default?.toString() || ''}
          />
        )
      case 'real':
        return (
          <input
            type="number"
            step="any"
            value={currentValue ?? ''}
            onChange={(e) => handleParameterChange(param.name, parseValue(e.target.value, 'real'))}
            placeholder={param.default?.toString() || ''}
          />
        )
      case 'boolean':
        return (
          <select
            value={currentValue?.toString() ?? ''}
            onChange={(e) => handleParameterChange(param.name, parseValue(e.target.value, 'boolean'))}
          >
            <option value="">Default</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        )
      case 'categorical':
        return (
          <select
            value={currentValue ?? ''}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
          >
            <option value="">Select...</option>
            {(param.validValues || []).map(val => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        )
      default:
        return (
          <input
            type="text"
            value={currentValue ?? ''}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            placeholder={param.default?.toString() || ''}
          />
        )
    }
  }

  if (!selectedNode) {
    return (
      <aside className="properties-panel">
        <div className="properties-empty">
          <div className="empty-icon">📋</div>
          <h3>No Selection</h3>
          <p>Select a node to view and edit its properties</p>
        </div>
      </aside>
    )
  }

  const parameters = Object.values(selectedNode.componentData?.parameters || {}).flat()

  return (
    <aside className="properties-panel">
      <div className="properties-header">
        <h2>Properties</h2>
      </div>
      <div className="properties-content">
        <div className="property-section">
          <div className="node-info">
            <h3 className="node-info-name">{selectedNode.name}</h3>
            <span className="node-info-type">{selectedNode.type.replace('_', ' ')}</span>
          </div>
          {selectedNode.description && (
            <p className="node-description">{selectedNode.description}</p>
          )}
        </div>

        {parameters.length > 0 && (
          <div className="property-section">
            <h4 className="section-title">Parameters</h4>
            <div className="parameters-list">
              {parameters.map(param => (
                <div key={param.name} className="parameter-row">
                  <label className="parameter-label">
                    {param.name}
                    {param.description && (
                      <span className="parameter-hint" title={param.description}>?</span>
                    )}
                  </label>
                  <div className="parameter-input">
                    {renderInput(param)}
                  </div>
                  {param.default !== undefined && param.default !== null && (
                    <span className="parameter-default">
                      Default: {param.default.toString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedNode.componentData?.inputDataType && (
          <div className="property-section">
            <h4 className="section-title">Inputs</h4>
            <div className="data-types">
              {selectedNode.componentData.inputDataType.map((input, idx) => (
                <div key={idx} className="data-type-item">
                  <span className="data-type-name">{input.name}</span>
                  <span className="data-type-type">{input.datatype}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedNode.componentData?.outputDataType && (
          <div className="property-section">
            <h4 className="section-title">Outputs</h4>
            <div className="data-types">
              {selectedNode.componentData.outputDataType.map((output, idx) => (
                <div key={idx} className="data-type-item">
                  <span className="data-type-name">{output.name}</span>
                  <span className="data-type-type">{output.datatype}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

export default PropertiesPanel
