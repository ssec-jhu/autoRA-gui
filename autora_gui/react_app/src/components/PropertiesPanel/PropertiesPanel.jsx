/**
 * Right-hand properties panel for the AutoRA Workflow Editor. Displays the
 * editable parameters, filter settings, inputs, and outputs of the currently
 * selected node, or a read-only preview of a component hovered/clicked in the
 * palette when no node is selected.
 *
 * @module components/PropertiesPanel/PropertiesPanel
 */

import React from 'react'
import { useWorkflow } from '../../context/WorkflowContext'
import './PropertiesPanel.css'

/**
 * Clickable "?" hint that toggles a description popover on click.
 *
 * @param {Object} props
 * @param {string} props.description - Parameter description shown in the popover; renders nothing when falsy
 * @returns {JSX.Element|null}
 */
// Clickable "?" hint that toggles a description popover on click
function ParameterHint({ description }) {
  const [open, setOpen] = React.useState(false)
  if (!description) return null
  return (
    <span className="parameter-hint-wrapper">
      <button
        type="button"
        className={`parameter-hint${open ? ' active' : ''}`}
        aria-expanded={open}
        aria-label="Show parameter description"
        onClick={() => setOpen(o => !o)}
      >
        ?
      </button>
      {open && (
        <span className="parameter-hint-popover" role="tooltip">
          {description}
        </span>
      )}
    </span>
  )
}

/**
 * External-link icon that opens the component's github_io documentation page
 * in a new browser tab. Rendered in the upper-right corner of the component
 * name; renders nothing when no url is provided.
 *
 * @param {Object} props
 * @param {string} props.url - The github_io documentation URL; renders nothing when falsy
 * @returns {JSX.Element|null}
 */
// External-link icon linking to the component's github_io documentation page
function GithubIoLink({ url }) {
  if (!url) return null
  return (
    <a
      className="github-io-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open component documentation in a new tab"
      title="Open component documentation"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 4h6v6" />
        <line x1="10" y1="14" x2="20" y2="4" />
        <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
      </svg>
    </a>
  )
}

/**
 * Determine a human-readable datatype string from a variable type structure,
 * recursing through list wrappers and summarizing dict variants.
 *
 * @param {Object} varType - Variable type descriptor (primitive, dict, or list shaped)
 * @returns {string} The resolved datatype (e.g. 'integer', 'dict[real]', 'list[real]', or 'unknown')
 */
// Helper to determine datatype from variable type structure
const getDataType = (varType) => {
  if (!varType) return 'unknown'
  // PrimitiveVariableType: has 'datatype' directly
  if (varType.datatype) return varType.datatype
  // DictVariableType: has 'variables' (array or single object)
  if (varType.variables) {
    if (Array.isArray(varType.variables)) {
      const innerTypes = varType.variables.map(v => v.datatype || 'unknown')
      const uniqueTypes = [...new Set(innerTypes)]
      return `dict[${uniqueTypes.join(', ')}]`
    } else {
      // Single object (legacy format)
      const innerType = varType.variables.datatype || 'unknown'
      return `dict[${innerType}]`
    }
  }
  // ListVariableType: has 'variable' (singular)
  if (varType.variable) return `list[${getDataType(varType.variable)}]`
  return 'unknown'
}

/**
 * Find the display name of a variable, descending through list wrappers.
 *
 * @param {Object} varType - Variable type descriptor
 * @returns {string} The variable's name, or 'unknown' if none is found
 */
// Find the display name of a variable, descending through list wrappers
const getVariableName = (varType) => {
  if (!varType) return 'unknown'
  if (varType.name) return varType.name
  if (varType.variable) return getVariableName(varType.variable)
  return 'unknown'
}

/**
 * Normalize a data type spec (null, single variable, dict {variables},
 * list {variable}, or legacy array) into a list of {name, type} entries.
 *
 * @param {Object|Array} dataType - Data type descriptor to normalize
 * @returns {Array<{name: string, type: string}>} List of display entries for rendering
 */
// Normalize a data type spec (null, single variable, dict {variables},
// list {variable}, or legacy array) into a list of {name, type} entries
const getVariableEntries = (dataType) => {
  if (!dataType) return []
  if (Array.isArray(dataType)) {
    return dataType.map(v => ({ name: getVariableName(v), type: getDataType(v) }))
  }
  if (Array.isArray(dataType.variables)) {
    return dataType.variables.map(v => ({ name: getVariableName(v), type: getDataType(v) }))
  }
  return [{ name: getVariableName(dataType), type: getDataType(dataType) }]
}

/**
 * Modal editor for long text/expression parameters (e.g. IV/DV declarations),
 * which don't fit comfortably in the inline single-line field. Edits a local
 * draft seeded from the current value; the change is only pushed to the node
 * when the user clicks "Update". Cancel, the close button, the Escape key, and
 * clicking the backdrop all discard the draft.
 *
 * @param {Object} props
 * @param {Object} props.param - Parameter descriptor (name, description, default)
 * @param {string} props.initialValue - The parameter's current value
 * @param {(value: string) => void} props.onUpdate - Commit the edited value
 * @param {() => void} props.onClose - Dismiss without committing
 * @returns {JSX.Element}
 */
function ExpressionEditorModal({ param, initialValue, onUpdate, onClose }) {
  const [draft, setDraft] = React.useState(initialValue ?? '')

  return (
    <div
      className="expr-editor-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${param.name}`}
      onMouseDown={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <div className="expr-editor" onMouseDown={(e) => e.stopPropagation()}>
        <div className="expr-editor-header">
          <h3 className="expr-editor-title">Edit <code>{param.name}</code></h3>
          <button
            type="button"
            className="expr-editor-close"
            aria-label="Close editor"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {param.description && (
          <p className="expr-editor-description">{param.description}</p>
        )}
        <textarea
          className="expr-editor-textarea"
          value={draft}
          spellCheck={false}
          autoFocus
          placeholder={param.default != null ? param.default.toString() : ''}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="expr-editor-actions">
          <button type="button" className="expr-editor-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="expr-editor-update" onClick={() => onUpdate(draft)}>
            Update
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Properties panel component. Reads the workflow state from context and renders
 * one of three views: the selected node's editable properties, a read-only
 * preview of a palette component, or an empty-state prompt. Defines local
 * helpers for parameter editing, value parsing, and input rendering.
 *
 * @returns {JSX.Element}
 */
function PropertiesPanel() {
  const { state, dispatch } = useWorkflow()
  const selectedNode = state.nodes.find(n => n.id === state.selectedNodeId)
  const previewedComponent = state.previewedComponent

  // The parameter currently being edited in the expanded modal editor, if any.
  const [editorParam, setEditorParam] = React.useState(null)
  // Close the modal if the selection changes, so an Update can't land on the
  // wrong node.
  React.useEffect(() => { setEditorParam(null) }, [state.selectedNodeId])

  /**
   * Dispatch an update to a single parameter on the selected node.
   *
   * @param {string} paramName - Name of the parameter to update
   * @param {*} value - New value for the parameter
   * @returns {void}
   */
  const handleParameterChange = (paramName, value) => {
    dispatch({
      type: 'UPDATE_NODE',
      payload: {
        id: selectedNode.id,
        parameters: { ...selectedNode.parameters, [paramName]: value }
      }
    })
  }

  /**
   * Coerce a raw input string into the correct JS type for the given datatype.
   *
   * @param {string} value - Raw value from the input element
   * @param {string} datatype - Target datatype ('integer', 'real', 'boolean', or other)
   * @returns {number|boolean|string|null} Parsed value, or null when the input is empty
   */
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

  /**
   * Render the appropriate input control for a parameter based on its datatype
   * (number, boolean/categorical select, or text).
   *
   * @param {Object} param - Parameter descriptor with name, datatype, default, and validValues
   * @returns {JSX.Element} The input or select element for editing the parameter
   */
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
      case 'IV':
      case 'DV':
        // IV/DV declarations are long Python literals; offer an expand button
        // that opens the larger modal editor alongside the inline field.
        return (
          <div className="expression-field">
            <input
              type="text"
              value={currentValue ?? ''}
              onChange={(e) => handleParameterChange(param.name, e.target.value)}
              placeholder={param.default?.toString() || ''}
            />
            <button
              type="button"
              className="expression-expand-btn"
              aria-label={`Open a larger editor for ${param.name}`}
              title="Open larger editor"
              onClick={() => setEditorParam(param)}
            >
              ⤢
            </button>
          </div>
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

  // Show previewed component when no node is selected
  if (!selectedNode && previewedComponent) {
    const previewParams = Object.values(previewedComponent.parameters || {}).flat()
    const previewInputs = getVariableEntries(previewedComponent.inputDataType)
    const previewOutputs = getVariableEntries(previewedComponent.outputDataType)
    return (
      <aside className="properties-panel">
        <div className="properties-header">
          <h2>Component Preview</h2>
        </div>
        <div className="properties-content">
          <div className="property-section">
            <div className="node-info">
              <GithubIoLink url={previewedComponent.github_io} />
              <h3 className="node-info-name">{previewedComponent.name}</h3>
              <span className="node-info-type">{previewedComponent.protocolType?.replace('_', ' ')}</span>
            </div>
            {previewedComponent.description && (
              <p className="node-description">{previewedComponent.description}</p>
            )}
          </div>

          {previewParams.length > 0 && (
            <div className="property-section">
              <h4 className="section-title">Parameters</h4>
              <div className="parameters-list">
                {previewParams.map(param => (
                  <div key={param.name} className="parameter-row preview-only">
                    <label className="parameter-label">
                      {param.name}
                      <ParameterHint description={param.description} />
                    </label>
                    <div className="parameter-value">
                      <span className="parameter-datatype">{param.datatype}</span>
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

          {previewInputs.length > 0 && (
            <div className="property-section">
              <h4 className="section-title">Inputs</h4>
              <div className="data-types">
                {previewInputs.map((input, idx) => (
                  <div key={idx} className="data-type-item">
                    <span className="data-type-name">{input.name}</span>
                    <span className="data-type-type">{input.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewOutputs.length > 0 && (
            <div className="property-section">
              <h4 className="section-title">Outputs</h4>
              <div className="data-types">
                {previewOutputs.map((output, idx) => (
                  <div key={idx} className="data-type-item">
                    <span className="data-type-name">{output.name}</span>
                    <span className="data-type-type">{output.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="preview-hint">
            <p>Drag this component to the canvas to use it</p>
          </div>
        </div>
      </aside>
    )
  }

  if (!selectedNode) {
    return (
      <aside className="properties-panel">
        <div className="properties-empty">
          <div className="empty-icon">📋</div>
          <h3>No Selection</h3>
          <p>Select a node or click a component to view its properties</p>
        </div>
      </aside>
    )
  }

  const parameters = Object.values(selectedNode.componentData?.parameters || {}).flat()
  const nodeInputs = getVariableEntries(selectedNode.componentData?.inputDataType)
  const nodeOutputs = getVariableEntries(selectedNode.componentData?.outputDataType)
  const isFilterNode = selectedNode.type === 'filter_point'

  /**
   * Dispatch an update to a single filter parameter on the selected filter node.
   *
   * @param {string} paramName - Name of the filter parameter to update
   * @param {*} value - New value for the filter parameter
   * @returns {void}
   */
  const handleFilterParameterChange = (paramName, value) => {
    dispatch({
      type: 'UPDATE_NODE',
      payload: {
        id: selectedNode.id,
        filterParams: { ...selectedNode.filterParams, [paramName]: value }
      }
    })
  }

  return (
    <aside className="properties-panel">
      <div className="properties-header">
        <h2>Properties</h2>
      </div>
      <div className="properties-content">
        <div className="property-section">
          <div className="node-info">
            <GithubIoLink url={selectedNode.componentData?.github_io} />
            <h3 className="node-info-name">{selectedNode.name}</h3>
            <span className="node-info-type">{selectedNode.type.replace('_', ' ')}</span>
          </div>
          {selectedNode.description && (
            <p className="node-description">{selectedNode.description}</p>
          )}
          <button
            className="delete-node-btn"
            onClick={() => dispatch({ type: 'DELETE_NODE', payload: selectedNode.id })}
          >
            Delete Node
          </button>
        </div>

        {isFilterNode && (
          <div className="property-section">
            <h4 className="section-title">Filter Settings</h4>
            <div className="parameters-list">
              <div className="parameter-row">
                <label className="parameter-label">
                  Max Counter
                  <ParameterHint description="Maximum number of loop iterations before taking the alternative path" />
                </label>
                <div className="parameter-input">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={selectedNode.filterParams?.maxCounter ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      handleFilterParameterChange('maxCounter', val === '' ? '' : parseInt(val, 10))
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!val || val < 1) {
                        handleFilterParameterChange('maxCounter', 1)
                      }
                    }}
                  />
                </div>
                <span className="parameter-default">Default: 1</span>
              </div>
            </div>
          </div>
        )}

        {parameters.length > 0 && (
          <div className="property-section">
            <h4 className="section-title">Parameters</h4>
            <div className="parameters-list">
              {parameters.map(param => (
                <div key={param.name} className="parameter-row">
                  <label className="parameter-label">
                    {param.name}
                    <ParameterHint description={param.description} />
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

        {nodeInputs.length > 0 && (
          <div className="property-section">
            <h4 className="section-title">Inputs</h4>
            <div className="data-types">
              {nodeInputs.map((input, idx) => (
                <div key={idx} className="data-type-item">
                  <span className="data-type-name">{input.name}</span>
                  <span className="data-type-type">{input.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nodeOutputs.length > 0 && (
          <div className="property-section">
            <h4 className="section-title">Outputs</h4>
            <div className="data-types">
              {nodeOutputs.map((output, idx) => (
                <div key={idx} className="data-type-item">
                  <span className="data-type-name">{output.name}</span>
                  <span className="data-type-type">{output.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editorParam && (
        <ExpressionEditorModal
          param={editorParam}
          initialValue={selectedNode.parameters[editorParam.name]}
          onUpdate={(value) => {
            handleParameterChange(editorParam.name, value)
            setEditorParam(null)
          }}
          onClose={() => setEditorParam(null)}
        />
      )}
    </aside>
  )
}

export default PropertiesPanel
