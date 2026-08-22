/**
 * Global state store for the workflow editor. Holds all editor state (nodes,
 * connections, selection, zoom/pan, and undo/redo history) via a reducer and
 * exposes it to the component tree through a React Context provider and the
 * useWorkflow hook.
 *
 * @module context/WorkflowContext
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { EMBEDDED_COMPONENTS } from '../data/components.js'

const WorkflowContext = createContext(null)

/**
 * Action types that should be recorded in the undo/redo history.
 */
// Actions that should be tracked in undo/redo history
const UNDOABLE_ACTIONS = [
  'ADD_NODE',
  'DELETE_NODE',
  'UPDATE_NODE',
  'ADD_CONNECTION',
  'DELETE_CONNECTION',
  'LOAD_WORKFLOW',
  'CLEAR_CANVAS',
  'END_DRAG'  // Commits drag as single undo step
]

/**
 * Maximum number of history entries retained for undo/redo.
 */
const MAX_HISTORY_SIZE = 50

/**
 * Initial reducer state for a fresh, empty workflow editor session.
 */
export const initialState = {
  components: {},
  nodes: [],
  connections: [],
  selectedNodeId: null,
  selectedConnectionId: null,
  connectingFrom: null,
  previewedComponent: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  // Undo/Redo history
  past: [],
  future: [],
  // Drag state for batching position updates
  dragStartState: null
}

/**
 * Core reducer that applies a single action to the workflow state. Handles node
 * lifecycle (ADD_NODE, UPDATE_NODE, UPDATE_NODE_POSITION, DELETE_NODE),
 * connection lifecycle (ADD_CONNECTION, DELETE_CONNECTION, UPDATE_CONNECTION_PORTS),
 * selection (SELECT_NODE, SELECT_CONNECTION, DESELECT_ALL), connecting/drag
 * gestures, viewport (SET_ZOOM, SET_PAN), workflow load/clear, and undo/redo.
 *
 * @param {Object} state - The current workflow state.
 * @param {Object} action - The dispatched action with a `type` and optional `payload`.
 * @returns {Object} The next workflow state.
 */
export function workflowReducer(state, action) {
  switch (action.type) {
    case 'SET_COMPONENTS':
      return { ...state, components: action.payload }

    case 'ADD_COMPONENT': {
      // Add (or replace by uuid) a single component in its category, keeping the
      // list sorted by name so it matches the backend-loaded ordering.
      const { category, component } = action.payload
      const existing = state.components[category] || []
      const merged = [
        ...existing.filter(c => c.uuid !== component.uuid),
        component
      ].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      return { ...state, components: { ...state.components, [category]: merged } }
    }

    case 'ADD_NODE': {
      const { componentData, x, y } = action.payload
      const isFilter = componentData.protocolType === 'filter_point'
      const newNode = {
        id: uuidv4(),
        protocolUuid: componentData.uuid,
        type: componentData.protocolType,
        name: componentData.name,
        description: componentData.description,
        x,
        y,
        componentData,
        parameters: Object.values(componentData.parameters || {}).flat().reduce((acc, param) => {
          acc[param.name] = param.default !== undefined ? param.default : null
          return acc
        }, {}),
        ...(isFilter && { filterParams: { maxCounter: 1, altTarget: null } })
      }
      return { ...state, nodes: [...state.nodes, newNode], selectedNodeId: newNode.id }
    }

    case 'UPDATE_NODE': {
      const { id, ...updates } = action.payload
      return {
        ...state,
        nodes: state.nodes.map(node =>
          node.id === id ? { ...node, ...updates } : node
        )
      }
    }

    case 'UPDATE_NODE_POSITION': {
      const { id, x, y } = action.payload
      const oldNode = state.nodes.find(n => n.id === id)
      if (!oldNode) return state

      const dx = x - oldNode.x
      const dy = y - oldNode.y

      // Update node position
      const newNodes = state.nodes.map(node =>
        node.id === id ? { ...node, x, y } : node
      )

      // Update connection points attached to this node
      const newConnections = state.connections.map(conn => {
        let updated = { ...conn }
        if (conn.sourceId === id && conn.sourcePoint) {
          updated.sourcePoint = {
            x: conn.sourcePoint.x + dx,
            y: conn.sourcePoint.y + dy
          }
        }
        if (conn.targetId === id && conn.targetPoint) {
          updated.targetPoint = {
            x: conn.targetPoint.x + dx,
            y: conn.targetPoint.y + dy
          }
        }
        return updated
      })

      return {
        ...state,
        nodes: newNodes,
        connections: newConnections
      }
    }

    case 'DELETE_NODE': {
      const nodeId = action.payload
      return {
        ...state,
        nodes: state.nodes.filter(n => n.id !== nodeId),
        connections: state.connections.filter(
          c => c.sourceId !== nodeId && c.targetId !== nodeId
        ),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
      }
    }

    case 'SELECT_NODE':
      return {
        ...state,
        selectedNodeId: action.payload,
        selectedConnectionId: null,
        previewedComponent: null
      }

    case 'SET_PREVIEWED_COMPONENT':
      return {
        ...state,
        previewedComponent: action.payload,
        selectedNodeId: null,
        selectedConnectionId: null
      }

    case 'ADD_CONNECTION': {
      const { sourceId, targetId, sourcePoint, targetPoint } = action.payload
      const exists = state.connections.some(
        c => c.sourceId === sourceId && c.targetId === targetId
      )
      if (exists || sourceId === targetId) return state
      const newConnection = {
        id: uuidv4(),
        sourceId,
        targetId,
        sourcePoint,
        targetPoint
      }
      return {
        ...state,
        connections: [...state.connections, newConnection],
        connectingFrom: null
      }
    }

    case 'DELETE_CONNECTION':
      return {
        ...state,
        connections: state.connections.filter(c => c.id !== action.payload),
        selectedConnectionId: state.selectedConnectionId === action.payload ? null : state.selectedConnectionId
      }

    case 'UPDATE_CONNECTION_PORTS': {
      const { id, sourcePoint, targetPoint } = action.payload
      return {
        ...state,
        connections: state.connections.map(conn =>
          conn.id === id ? { ...conn, sourcePoint, targetPoint } : conn
        )
      }
    }

    case 'SELECT_CONNECTION':
      return {
        ...state,
        selectedConnectionId: action.payload,
        selectedNodeId: null
      }

    case 'START_CONNECTING':
      return { ...state, connectingFrom: action.payload }

    case 'CANCEL_CONNECTING':
      return { ...state, connectingFrom: null }

    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(0.25, Math.min(2, action.payload)) }

    case 'SET_PAN':
      return { ...state, pan: action.payload }

    case 'LOAD_WORKFLOW': {
      const { nodes, connections } = action.payload
      return {
        ...state,
        nodes,
        connections,
        selectedNodeId: null,
        selectedConnectionId: null
      }
    }

    case 'CLEAR_CANVAS':
      return {
        ...state,
        nodes: [],
        connections: [],
        selectedNodeId: null,
        selectedConnectionId: null
      }

    case 'DESELECT_ALL':
      return {
        ...state,
        selectedNodeId: null,
        selectedConnectionId: null,
        connectingFrom: null,
        previewedComponent: null
      }

    case 'START_DRAG':
      // Save current state before drag begins (for undo)
      return {
        ...state,
        dragStartState: { nodes: state.nodes, connections: state.connections }
      }

    case 'END_DRAG':
      // Clear drag state - history entry is added by undoableReducer
      return { ...state, dragStartState: null }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      const newPast = state.past.slice(0, -1)
      return {
        ...state,
        nodes: previous.nodes,
        connections: previous.connections,
        past: newPast,
        future: [{ nodes: state.nodes, connections: state.connections }, ...state.future],
        selectedNodeId: null,
        selectedConnectionId: null
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      const newFuture = state.future.slice(1)
      return {
        ...state,
        nodes: next.nodes,
        connections: next.connections,
        past: [...state.past, { nodes: state.nodes, connections: state.connections }],
        future: newFuture,
        selectedNodeId: null,
        selectedConnectionId: null
      }
    }

    default:
      return state
  }
}

/**
 * Reducer wrapper that layers undo/redo history management over
 * workflowReducer. UNDO/REDO are delegated directly; END_DRAG commits the
 * pre-drag snapshot as a single history entry; other undoable actions push the
 * prior state onto the history stack (capped at MAX_HISTORY_SIZE) and clear the
 * redo future when nodes or connections actually change. Non-undoable actions
 * pass through unchanged.
 *
 * @param {Object} state - The current workflow state.
 * @param {Object} action - The dispatched action with a `type` and optional `payload`.
 * @returns {Object} The next workflow state, including updated history.
 */
// Wrapper reducer that handles history for undoable actions
function undoableReducer(state, action) {
  // Handle undo/redo directly
  if (action.type === 'UNDO' || action.type === 'REDO') {
    return workflowReducer(state, action)
  }

  // Special handling for END_DRAG - use saved dragStartState for history
  if (action.type === 'END_DRAG') {
    const newState = workflowReducer(state, action)

    // Only add to history if we have a saved drag start state and something changed
    if (state.dragStartState) {
      const nodesChanged = state.nodes !== state.dragStartState.nodes
      const connectionsChanged = state.connections !== state.dragStartState.connections

      if (nodesChanged || connectionsChanged) {
        const pastEntry = state.dragStartState
        const newPast = [...state.past, pastEntry].slice(-MAX_HISTORY_SIZE)
        return {
          ...newState,
          past: newPast,
          future: [] // Clear future on new action
        }
      }
    }
    return newState
  }

  // For other undoable actions, save current state to history before applying
  if (UNDOABLE_ACTIONS.includes(action.type)) {
    const newState = workflowReducer(state, action)

    // Only add to history if nodes or connections actually changed
    const nodesChanged = newState.nodes !== state.nodes
    const connectionsChanged = newState.connections !== state.connections

    if (nodesChanged || connectionsChanged) {
      const pastEntry = { nodes: state.nodes, connections: state.connections }
      const newPast = [...state.past, pastEntry].slice(-MAX_HISTORY_SIZE)
      return {
        ...newState,
        past: newPast,
        future: [] // Clear future on new action
      }
    }
    return newState
  }

  // Non-undoable actions pass through normally
  return workflowReducer(state, action)
}

/**
 * Context provider that owns the workflow reducer state and dispatch, making
 * them available to descendant components. On mount it seeds the component
 * catalog from embedded data when present, otherwise fetching it from the API.
 *
 * @param {Object} props - Component props.
 * @param {JSX.Element} props.children - The subtree that consumes the context.
 * @returns {JSX.Element} The provider wrapping its children.
 */
export function WorkflowProvider({ children }) {
  const [state, dispatch] = useReducer(undoableReducer, initialState)

  useEffect(() => {
    // Use embedded data if available, otherwise fetch from API
    if (EMBEDDED_COMPONENTS && Object.keys(EMBEDDED_COMPONENTS).length > 0) {
      dispatch({ type: 'SET_COMPONENTS', payload: EMBEDDED_COMPONENTS })
    } else {
      fetch('/api/components')
        .then(res => res.json())
        .then(data => dispatch({ type: 'SET_COMPONENTS', payload: data }))
        .catch(err => console.error('Failed to load components:', err))
    }
  }, [])

  return (
    <WorkflowContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkflowContext.Provider>
  )
}

/**
 * Custom hook for accessing the workflow context. Must be called within a
 * WorkflowProvider, otherwise it throws.
 *
 * @returns {Object} The context value: `{ state, dispatch }`.
 */
export function useWorkflow() {
  const context = useContext(WorkflowContext)
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider')
  }
  return context
}
