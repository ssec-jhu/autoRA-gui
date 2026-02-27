import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'

const WorkflowContext = createContext(null)

const initialState = {
  components: {},
  nodes: [],
  connections: [],
  selectedNodeId: null,
  selectedConnectionId: null,
  connectingFrom: null,
  zoom: 1,
  pan: { x: 0, y: 0 }
}

function workflowReducer(state, action) {
  switch (action.type) {
    case 'SET_COMPONENTS':
      return { ...state, components: action.payload }

    case 'ADD_NODE': {
      const { componentData, x, y } = action.payload
      const newNode = {
        id: uuidv4(),
        protocolUuid: componentData.uuid,
        type: componentData.protocolType,
        name: componentData.name,
        description: componentData.description,
        x,
        y,
        componentData,
        parameters: (componentData.parameters || []).reduce((acc, param) => {
          acc[param.name] = param.default !== undefined ? param.default : null
          return acc
        }, {})
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
      return {
        ...state,
        nodes: state.nodes.map(node =>
          node.id === id ? { ...node, x, y } : node
        )
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
        selectedConnectionId: null
      }

    case 'ADD_CONNECTION': {
      const { sourceId, targetId } = action.payload
      const exists = state.connections.some(
        c => c.sourceId === sourceId && c.targetId === targetId
      )
      if (exists || sourceId === targetId) return state
      const newConnection = {
        id: uuidv4(),
        sourceId,
        targetId
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
        connectingFrom: null
      }

    default:
      return state
  }
}

export function WorkflowProvider({ children }) {
  const [state, dispatch] = useReducer(workflowReducer, initialState)

  useEffect(() => {
    fetch('/api/components')
      .then(res => res.json())
      .then(data => dispatch({ type: 'SET_COMPONENTS', payload: data }))
      .catch(err => console.error('Failed to load components:', err))
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
