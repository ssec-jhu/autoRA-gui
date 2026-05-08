import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { EMBEDDED_COMPONENTS } from '../data/components.js'

const WorkflowContext = createContext(null)

export const initialState = {
  components: {},
  nodes: [],
  connections: [],
  selectedNodeId: null,
  selectedConnectionId: null,
  connectingFrom: null,
  previewedComponent: null,
  zoom: 1,
  pan: { x: 0, y: 0 }
}

export function workflowReducer(state, action) {
  switch (action.type) {
    case 'SET_COMPONENTS':
      return { ...state, components: action.payload }

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

    default:
      return state
  }
}

export function WorkflowProvider({ children }) {
  const [state, dispatch] = useReducer(workflowReducer, initialState)

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

export function useWorkflow() {
  const context = useContext(WorkflowContext)
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider')
  }
  return context
}
