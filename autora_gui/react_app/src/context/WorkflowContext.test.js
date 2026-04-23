import { describe, it, expect, vi } from 'vitest'
import { workflowReducer, initialState } from './WorkflowContext'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mocked-uuid'
}))

describe('workflowReducer', () => {
  describe('SET_COMPONENTS', () => {
    it('sets components in state', () => {
      const components = { theorists: [{ name: 'Test' }] }
      const result = workflowReducer(initialState, {
        type: 'SET_COMPONENTS',
        payload: components
      })
      expect(result.components).toEqual(components)
    })
  })

  describe('ADD_NODE', () => {
    it('adds a new node and selects it', () => {
      const componentData = {
        uuid: 'proto-1',
        protocolType: 'theorist',
        name: 'Test Theorist',
        description: 'A test',
        parameters: {}
      }
      const result = workflowReducer(initialState, {
        type: 'ADD_NODE',
        payload: { componentData, x: 100, y: 200 }
      })

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].x).toBe(100)
      expect(result.nodes[0].y).toBe(200)
      expect(result.nodes[0].name).toBe('Test Theorist')
      expect(result.selectedNodeId).toBe('mocked-uuid')
    })

    it('adds filterParams for filter nodes', () => {
      const componentData = {
        uuid: 'filter-1',
        protocolType: 'filter_point',
        name: 'Filter',
        parameters: {}
      }
      const result = workflowReducer(initialState, {
        type: 'ADD_NODE',
        payload: { componentData, x: 0, y: 0 }
      })

      expect(result.nodes[0].filterParams).toEqual({
        maxCounter: 1,
        altTarget: null
      })
    })

    it('extracts default parameters from componentData', () => {
      const componentData = {
        uuid: 'proto-1',
        protocolType: 'theorist',
        name: 'Test',
        parameters: {
          __init__: [
            { name: 'epochs', default: 100 },
            { name: 'rate', default: 0.01 }
          ]
        }
      }
      const result = workflowReducer(initialState, {
        type: 'ADD_NODE',
        payload: { componentData, x: 0, y: 0 }
      })

      expect(result.nodes[0].parameters).toEqual({
        epochs: 100,
        rate: 0.01
      })
    })
  })

  describe('UPDATE_NODE', () => {
    it('updates node properties', () => {
      const state = {
        ...initialState,
        nodes: [{ id: 'node-1', name: 'Old Name', x: 0, y: 0 }]
      }
      const result = workflowReducer(state, {
        type: 'UPDATE_NODE',
        payload: { id: 'node-1', name: 'New Name' }
      })

      expect(result.nodes[0].name).toBe('New Name')
      expect(result.nodes[0].x).toBe(0) // unchanged
    })
  })

  describe('UPDATE_NODE_POSITION', () => {
    it('updates node position', () => {
      const state = {
        ...initialState,
        nodes: [{ id: 'node-1', x: 100, y: 100 }],
        connections: []
      }
      const result = workflowReducer(state, {
        type: 'UPDATE_NODE_POSITION',
        payload: { id: 'node-1', x: 200, y: 150 }
      })

      expect(result.nodes[0].x).toBe(200)
      expect(result.nodes[0].y).toBe(150)
    })

    it('updates connection points when node moves', () => {
      const state = {
        ...initialState,
        nodes: [{ id: 'node-1', x: 100, y: 100 }],
        connections: [{
          id: 'conn-1',
          sourceId: 'node-1',
          targetId: 'node-2',
          sourcePoint: { x: 150, y: 120 },
          targetPoint: { x: 200, y: 120 }
        }]
      }
      const result = workflowReducer(state, {
        type: 'UPDATE_NODE_POSITION',
        payload: { id: 'node-1', x: 150, y: 150 }
      })

      // dx=50, dy=50
      expect(result.connections[0].sourcePoint).toEqual({ x: 200, y: 170 })
      expect(result.connections[0].targetPoint).toEqual({ x: 200, y: 120 }) // unchanged
    })

    it('returns state unchanged if node not found', () => {
      const state = {
        ...initialState,
        nodes: [{ id: 'node-1', x: 100, y: 100 }]
      }
      const result = workflowReducer(state, {
        type: 'UPDATE_NODE_POSITION',
        payload: { id: 'nonexistent', x: 200, y: 200 }
      })

      expect(result).toBe(state)
    })
  })

  describe('DELETE_NODE', () => {
    it('removes node and its connections', () => {
      const state = {
        ...initialState,
        nodes: [
          { id: 'node-1', name: 'Node 1' },
          { id: 'node-2', name: 'Node 2' }
        ],
        connections: [
          { id: 'conn-1', sourceId: 'node-1', targetId: 'node-2' },
          { id: 'conn-2', sourceId: 'node-2', targetId: 'node-3' }
        ]
      }
      const result = workflowReducer(state, {
        type: 'DELETE_NODE',
        payload: 'node-1'
      })

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].id).toBe('node-2')
      expect(result.connections).toHaveLength(1)
      expect(result.connections[0].id).toBe('conn-2')
    })

    it('clears selection if deleted node was selected', () => {
      const state = {
        ...initialState,
        nodes: [{ id: 'node-1' }],
        selectedNodeId: 'node-1'
      }
      const result = workflowReducer(state, {
        type: 'DELETE_NODE',
        payload: 'node-1'
      })

      expect(result.selectedNodeId).toBeNull()
    })
  })

  describe('SELECT_NODE', () => {
    it('selects node and clears connection selection', () => {
      const state = {
        ...initialState,
        selectedConnectionId: 'conn-1'
      }
      const result = workflowReducer(state, {
        type: 'SELECT_NODE',
        payload: 'node-1'
      })

      expect(result.selectedNodeId).toBe('node-1')
      expect(result.selectedConnectionId).toBeNull()
    })
  })

  describe('ADD_CONNECTION', () => {
    it('adds a new connection', () => {
      const result = workflowReducer(initialState, {
        type: 'ADD_CONNECTION',
        payload: {
          sourceId: 'node-1',
          targetId: 'node-2',
          sourcePoint: { x: 100, y: 50 },
          targetPoint: { x: 200, y: 50 }
        }
      })

      expect(result.connections).toHaveLength(1)
      expect(result.connections[0].sourceId).toBe('node-1')
      expect(result.connections[0].targetId).toBe('node-2')
      expect(result.connectingFrom).toBeNull()
    })

    it('prevents duplicate connections', () => {
      const state = {
        ...initialState,
        connections: [{ id: 'conn-1', sourceId: 'node-1', targetId: 'node-2' }]
      }
      const result = workflowReducer(state, {
        type: 'ADD_CONNECTION',
        payload: { sourceId: 'node-1', targetId: 'node-2' }
      })

      expect(result.connections).toHaveLength(1)
    })

    it('prevents self-connections', () => {
      const result = workflowReducer(initialState, {
        type: 'ADD_CONNECTION',
        payload: { sourceId: 'node-1', targetId: 'node-1' }
      })

      expect(result.connections).toHaveLength(0)
    })
  })

  describe('DELETE_CONNECTION', () => {
    it('removes connection', () => {
      const state = {
        ...initialState,
        connections: [
          { id: 'conn-1', sourceId: 'a', targetId: 'b' },
          { id: 'conn-2', sourceId: 'b', targetId: 'c' }
        ]
      }
      const result = workflowReducer(state, {
        type: 'DELETE_CONNECTION',
        payload: 'conn-1'
      })

      expect(result.connections).toHaveLength(1)
      expect(result.connections[0].id).toBe('conn-2')
    })

    it('clears selection if deleted connection was selected', () => {
      const state = {
        ...initialState,
        connections: [{ id: 'conn-1' }],
        selectedConnectionId: 'conn-1'
      }
      const result = workflowReducer(state, {
        type: 'DELETE_CONNECTION',
        payload: 'conn-1'
      })

      expect(result.selectedConnectionId).toBeNull()
    })
  })

  describe('SELECT_CONNECTION', () => {
    it('selects connection and clears node selection', () => {
      const state = {
        ...initialState,
        selectedNodeId: 'node-1'
      }
      const result = workflowReducer(state, {
        type: 'SELECT_CONNECTION',
        payload: 'conn-1'
      })

      expect(result.selectedConnectionId).toBe('conn-1')
      expect(result.selectedNodeId).toBeNull()
    })
  })

  describe('START_CONNECTING', () => {
    it('sets connectingFrom', () => {
      const result = workflowReducer(initialState, {
        type: 'START_CONNECTING',
        payload: { nodeId: 'node-1', port: 'output' }
      })

      expect(result.connectingFrom).toEqual({ nodeId: 'node-1', port: 'output' })
    })
  })

  describe('CANCEL_CONNECTING', () => {
    it('clears connectingFrom', () => {
      const state = {
        ...initialState,
        connectingFrom: { nodeId: 'node-1' }
      }
      const result = workflowReducer(state, { type: 'CANCEL_CONNECTING' })

      expect(result.connectingFrom).toBeNull()
    })
  })

  describe('SET_ZOOM', () => {
    it('sets zoom within bounds', () => {
      const result = workflowReducer(initialState, {
        type: 'SET_ZOOM',
        payload: 1.5
      })
      expect(result.zoom).toBe(1.5)
    })

    it('clamps zoom to minimum 0.25', () => {
      const result = workflowReducer(initialState, {
        type: 'SET_ZOOM',
        payload: 0.1
      })
      expect(result.zoom).toBe(0.25)
    })

    it('clamps zoom to maximum 2', () => {
      const result = workflowReducer(initialState, {
        type: 'SET_ZOOM',
        payload: 5
      })
      expect(result.zoom).toBe(2)
    })
  })

  describe('SET_PAN', () => {
    it('sets pan position', () => {
      const result = workflowReducer(initialState, {
        type: 'SET_PAN',
        payload: { x: 100, y: -50 }
      })
      expect(result.pan).toEqual({ x: 100, y: -50 })
    })
  })

  describe('LOAD_WORKFLOW', () => {
    it('loads nodes and connections, clears selection', () => {
      const state = {
        ...initialState,
        selectedNodeId: 'old-node',
        selectedConnectionId: 'old-conn'
      }
      const nodes = [{ id: 'new-node' }]
      const connections = [{ id: 'new-conn' }]

      const result = workflowReducer(state, {
        type: 'LOAD_WORKFLOW',
        payload: { nodes, connections }
      })

      expect(result.nodes).toEqual(nodes)
      expect(result.connections).toEqual(connections)
      expect(result.selectedNodeId).toBeNull()
      expect(result.selectedConnectionId).toBeNull()
    })
  })

  describe('CLEAR_CANVAS', () => {
    it('clears all nodes, connections, and selection', () => {
      const state = {
        ...initialState,
        nodes: [{ id: 'node-1' }],
        connections: [{ id: 'conn-1' }],
        selectedNodeId: 'node-1',
        selectedConnectionId: 'conn-1'
      }
      const result = workflowReducer(state, { type: 'CLEAR_CANVAS' })

      expect(result.nodes).toEqual([])
      expect(result.connections).toEqual([])
      expect(result.selectedNodeId).toBeNull()
      expect(result.selectedConnectionId).toBeNull()
    })
  })

  describe('DESELECT_ALL', () => {
    it('clears all selection states', () => {
      const state = {
        ...initialState,
        selectedNodeId: 'node-1',
        selectedConnectionId: 'conn-1',
        connectingFrom: { nodeId: 'node-2' }
      }
      const result = workflowReducer(state, { type: 'DESELECT_ALL' })

      expect(result.selectedNodeId).toBeNull()
      expect(result.selectedConnectionId).toBeNull()
      expect(result.connectingFrom).toBeNull()
    })
  })

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const result = workflowReducer(initialState, { type: 'UNKNOWN' })
      expect(result).toBe(initialState)
    })
  })
})
