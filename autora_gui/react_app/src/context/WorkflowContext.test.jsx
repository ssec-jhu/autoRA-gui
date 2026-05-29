import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { workflowReducer, initialState, WorkflowProvider, useWorkflow } from './WorkflowContext'

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

    it('clears previewedComponent when selecting node', () => {
      const state = {
        ...initialState,
        previewedComponent: { name: 'Test' }
      }
      const result = workflowReducer(state, {
        type: 'SELECT_NODE',
        payload: 'node-1'
      })

      expect(result.selectedNodeId).toBe('node-1')
      expect(result.previewedComponent).toBeNull()
    })
  })

  describe('SET_PREVIEWED_COMPONENT', () => {
    it('sets previewed component and clears selections', () => {
      const state = {
        ...initialState,
        selectedNodeId: 'node-1',
        selectedConnectionId: 'conn-1'
      }
      const component = { name: 'Test Component', uuid: 'test-1' }
      const result = workflowReducer(state, {
        type: 'SET_PREVIEWED_COMPONENT',
        payload: component
      })

      expect(result.previewedComponent).toEqual(component)
      expect(result.selectedNodeId).toBeNull()
      expect(result.selectedConnectionId).toBeNull()
    })

    it('clears previewed component when payload is null', () => {
      const state = {
        ...initialState,
        previewedComponent: { name: 'Test' }
      }
      const result = workflowReducer(state, {
        type: 'SET_PREVIEWED_COMPONENT',
        payload: null
      })

      expect(result.previewedComponent).toBeNull()
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

  describe('UPDATE_CONNECTION_PORTS', () => {
    it('updates connection source and target points', () => {
      const state = {
        ...initialState,
        connections: [{
          id: 'conn-1',
          sourceId: 'node-1',
          targetId: 'node-2',
          sourcePoint: { x: 100, y: 50 },
          targetPoint: { x: 200, y: 50 }
        }]
      }
      const result = workflowReducer(state, {
        type: 'UPDATE_CONNECTION_PORTS',
        payload: {
          id: 'conn-1',
          sourcePoint: { x: 110, y: 60 },
          targetPoint: { x: 210, y: 60 }
        }
      })

      expect(result.connections[0].sourcePoint).toEqual({ x: 110, y: 60 })
      expect(result.connections[0].targetPoint).toEqual({ x: 210, y: 60 })
    })

    it('does not modify other connections', () => {
      const state = {
        ...initialState,
        connections: [
          { id: 'conn-1', sourcePoint: { x: 100, y: 50 }, targetPoint: { x: 200, y: 50 } },
          { id: 'conn-2', sourcePoint: { x: 300, y: 50 }, targetPoint: { x: 400, y: 50 } }
        ]
      }
      const result = workflowReducer(state, {
        type: 'UPDATE_CONNECTION_PORTS',
        payload: {
          id: 'conn-1',
          sourcePoint: { x: 110, y: 60 },
          targetPoint: { x: 210, y: 60 }
        }
      })

      expect(result.connections[1].sourcePoint).toEqual({ x: 300, y: 50 })
      expect(result.connections[1].targetPoint).toEqual({ x: 400, y: 50 })
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
    it('clears all selection states including previewedComponent', () => {
      const state = {
        ...initialState,
        selectedNodeId: 'node-1',
        selectedConnectionId: 'conn-1',
        connectingFrom: { nodeId: 'node-2' },
        previewedComponent: { name: 'Test' }
      }
      const result = workflowReducer(state, { type: 'DESELECT_ALL' })

      expect(result.selectedNodeId).toBeNull()
      expect(result.selectedConnectionId).toBeNull()
      expect(result.connectingFrom).toBeNull()
      expect(result.previewedComponent).toBeNull()
    })
  })

  describe('START_DRAG', () => {
    it('saves current nodes and connections to dragStartState', () => {
      const state = {
        ...initialState,
        nodes: [{ id: 'node-1', x: 100, y: 100 }],
        connections: [{ id: 'conn-1', sourceId: 'node-1', targetId: 'node-2' }]
      }
      const result = workflowReducer(state, { type: 'START_DRAG' })

      expect(result.dragStartState).toEqual({
        nodes: state.nodes,
        connections: state.connections
      })
    })

    it('preserves other state properties', () => {
      const state = {
        ...initialState,
        nodes: [{ id: 'node-1', x: 100, y: 100 }],
        selectedNodeId: 'node-1',
        zoom: 1.5
      }
      const result = workflowReducer(state, { type: 'START_DRAG' })

      expect(result.selectedNodeId).toBe('node-1')
      expect(result.zoom).toBe(1.5)
    })
  })

  describe('END_DRAG', () => {
    it('clears dragStartState', () => {
      const state = {
        ...initialState,
        nodes: [{ id: 'node-1', x: 200, y: 200 }],
        dragStartState: {
          nodes: [{ id: 'node-1', x: 100, y: 100 }],
          connections: []
        }
      }
      const result = workflowReducer(state, { type: 'END_DRAG' })

      expect(result.dragStartState).toBeNull()
    })

    it('preserves current nodes and connections', () => {
      const state = {
        ...initialState,
        nodes: [{ id: 'node-1', x: 200, y: 200 }],
        connections: [{ id: 'conn-1' }],
        dragStartState: {
          nodes: [{ id: 'node-1', x: 100, y: 100 }],
          connections: []
        }
      }
      const result = workflowReducer(state, { type: 'END_DRAG' })

      expect(result.nodes).toEqual([{ id: 'node-1', x: 200, y: 200 }])
      expect(result.connections).toEqual([{ id: 'conn-1' }])
    })
  })

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const result = workflowReducer(initialState, { type: 'UNKNOWN' })
      expect(result).toBe(initialState)
    })
  })
})

describe('WorkflowProvider', () => {
  it('renders children', () => {
    render(
      <WorkflowProvider>
        <div data-testid="child">Test Child</div>
      </WorkflowProvider>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Test Child')).toBeInTheDocument()
  })

  it('provides state and dispatch to children', () => {
    function TestConsumer() {
      const { state, dispatch } = useWorkflow()
      return (
        <div>
          <span data-testid="zoom">{state.zoom}</span>
          <span data-testid="nodes-count">{state.nodes.length}</span>
        </div>
      )
    }

    render(
      <WorkflowProvider>
        <TestConsumer />
      </WorkflowProvider>
    )

    expect(screen.getByTestId('zoom')).toHaveTextContent('1')
    expect(screen.getByTestId('nodes-count')).toHaveTextContent('0')
  })

  it('allows dispatching actions through context', () => {
    function TestConsumer() {
      const { state, dispatch } = useWorkflow()
      return (
        <div>
          <span data-testid="zoom">{state.zoom}</span>
          <button onClick={() => dispatch({ type: 'SET_ZOOM', payload: 1.5 })}>
            Set Zoom
          </button>
        </div>
      )
    }

    render(
      <WorkflowProvider>
        <TestConsumer />
      </WorkflowProvider>
    )

    expect(screen.getByTestId('zoom')).toHaveTextContent('1')

    act(() => {
      screen.getByText('Set Zoom').click()
    })

    expect(screen.getByTestId('zoom')).toHaveTextContent('1.5')
  })
})

describe('useWorkflow', () => {
  it('throws error when used outside WorkflowProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useWorkflow())
    }).toThrow('useWorkflow must be used within a WorkflowProvider')

    consoleSpy.mockRestore()
  })

  it('returns state and dispatch when used inside WorkflowProvider', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    )

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    expect(result.current.state).toBeDefined()
    expect(result.current.dispatch).toBeDefined()
    expect(typeof result.current.dispatch).toBe('function')
  })

  it('returns initial state values', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    )

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    expect(result.current.state.nodes).toEqual([])
    expect(result.current.state.connections).toEqual([])
    expect(result.current.state.selectedNodeId).toBeNull()
    expect(result.current.state.zoom).toBe(1)
    expect(result.current.state.pan).toEqual({ x: 0, y: 0 })
    expect(result.current.state.dragStartState).toBeNull()
  })

  it('updates state when dispatch is called', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    )

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    act(() => {
      result.current.dispatch({ type: 'SET_ZOOM', payload: 0.5 })
    })

    expect(result.current.state.zoom).toBe(0.5)
  })

  it('can dispatch multiple actions', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    )

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    act(() => {
      result.current.dispatch({ type: 'SET_ZOOM', payload: 1.5 })
      result.current.dispatch({ type: 'SET_PAN', payload: { x: 100, y: 200 } })
    })

    expect(result.current.state.zoom).toBe(1.5)
    expect(result.current.state.pan).toEqual({ x: 100, y: 200 })
  })
})

describe('UNDO action', () => {
  it('restores previous state from history', () => {
    const state = {
      ...initialState,
      nodes: [{ id: 'node-2', name: 'Current' }],
      connections: [],
      past: [{ nodes: [{ id: 'node-1', name: 'Previous' }], connections: [] }],
      future: []
    }
    const result = workflowReducer(state, { type: 'UNDO' })

    expect(result.nodes).toEqual([{ id: 'node-1', name: 'Previous' }])
    expect(result.past).toHaveLength(0)
    expect(result.future).toHaveLength(1)
    expect(result.future[0].nodes).toEqual([{ id: 'node-2', name: 'Current' }])
  })

  it('returns state unchanged when past is empty', () => {
    const state = {
      ...initialState,
      nodes: [{ id: 'node-1' }],
      past: [],
      future: []
    }
    const result = workflowReducer(state, { type: 'UNDO' })

    expect(result).toBe(state)
  })

  it('clears selection on undo', () => {
    const state = {
      ...initialState,
      nodes: [{ id: 'node-2' }],
      selectedNodeId: 'node-2',
      selectedConnectionId: 'conn-1',
      past: [{ nodes: [{ id: 'node-1' }], connections: [] }],
      future: []
    }
    const result = workflowReducer(state, { type: 'UNDO' })

    expect(result.selectedNodeId).toBeNull()
    expect(result.selectedConnectionId).toBeNull()
  })

  it('can undo multiple times through history', () => {
    const state = {
      ...initialState,
      nodes: [{ id: 'node-3' }],
      connections: [],
      past: [
        { nodes: [{ id: 'node-1' }], connections: [] },
        { nodes: [{ id: 'node-2' }], connections: [] }
      ],
      future: []
    }

    // First undo
    let result = workflowReducer(state, { type: 'UNDO' })
    expect(result.nodes).toEqual([{ id: 'node-2' }])
    expect(result.past).toHaveLength(1)
    expect(result.future).toHaveLength(1)

    // Second undo
    result = workflowReducer(result, { type: 'UNDO' })
    expect(result.nodes).toEqual([{ id: 'node-1' }])
    expect(result.past).toHaveLength(0)
    expect(result.future).toHaveLength(2)
  })
})

describe('REDO action', () => {
  it('restores next state from future', () => {
    const state = {
      ...initialState,
      nodes: [{ id: 'node-1', name: 'Current' }],
      connections: [],
      past: [],
      future: [{ nodes: [{ id: 'node-2', name: 'Next' }], connections: [] }]
    }
    const result = workflowReducer(state, { type: 'REDO' })

    expect(result.nodes).toEqual([{ id: 'node-2', name: 'Next' }])
    expect(result.future).toHaveLength(0)
    expect(result.past).toHaveLength(1)
    expect(result.past[0].nodes).toEqual([{ id: 'node-1', name: 'Current' }])
  })

  it('returns state unchanged when future is empty', () => {
    const state = {
      ...initialState,
      nodes: [{ id: 'node-1' }],
      past: [],
      future: []
    }
    const result = workflowReducer(state, { type: 'REDO' })

    expect(result).toBe(state)
  })

  it('clears selection on redo', () => {
    const state = {
      ...initialState,
      nodes: [{ id: 'node-1' }],
      selectedNodeId: 'node-1',
      selectedConnectionId: 'conn-1',
      past: [],
      future: [{ nodes: [{ id: 'node-2' }], connections: [] }]
    }
    const result = workflowReducer(state, { type: 'REDO' })

    expect(result.selectedNodeId).toBeNull()
    expect(result.selectedConnectionId).toBeNull()
  })

  it('can redo multiple times through future', () => {
    const state = {
      ...initialState,
      nodes: [{ id: 'node-1' }],
      connections: [],
      past: [],
      future: [
        { nodes: [{ id: 'node-2' }], connections: [] },
        { nodes: [{ id: 'node-3' }], connections: [] }
      ]
    }

    // First redo
    let result = workflowReducer(state, { type: 'REDO' })
    expect(result.nodes).toEqual([{ id: 'node-2' }])
    expect(result.past).toHaveLength(1)
    expect(result.future).toHaveLength(1)

    // Second redo
    result = workflowReducer(result, { type: 'REDO' })
    expect(result.nodes).toEqual([{ id: 'node-3' }])
    expect(result.past).toHaveLength(2)
    expect(result.future).toHaveLength(0)
  })
})

describe('Undo/Redo integration with WorkflowProvider', () => {
  it('tracks history for undoable actions', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    )

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    // Initial state has empty history
    expect(result.current.state.past).toEqual([])
    expect(result.current.state.future).toEqual([])

    // Add a node (undoable action)
    act(() => {
      result.current.dispatch({
        type: 'ADD_NODE',
        payload: {
          componentData: {
            uuid: 'proto-1',
            protocolType: 'theorist',
            name: 'Test',
            parameters: {}
          },
          x: 100,
          y: 100
        }
      })
    })

    // History should have previous state
    expect(result.current.state.past).toHaveLength(1)
    expect(result.current.state.past[0].nodes).toEqual([])
    expect(result.current.state.nodes).toHaveLength(1)
  })

  it('clears future on new undoable action', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    )

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    // Add a node
    act(() => {
      result.current.dispatch({
        type: 'ADD_NODE',
        payload: {
          componentData: { uuid: 'proto-1', protocolType: 'theorist', name: 'Test', parameters: {} },
          x: 100, y: 100
        }
      })
    })

    // Undo
    act(() => {
      result.current.dispatch({ type: 'UNDO' })
    })

    expect(result.current.state.future).toHaveLength(1)

    // New action should clear future
    act(() => {
      result.current.dispatch({
        type: 'ADD_NODE',
        payload: {
          componentData: { uuid: 'proto-2', protocolType: 'theorist', name: 'Test 2', parameters: {} },
          x: 200, y: 200
        }
      })
    })

    expect(result.current.state.future).toEqual([])
  })

  it('does not track non-undoable actions in history', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    )

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    // SET_ZOOM is not undoable
    act(() => {
      result.current.dispatch({ type: 'SET_ZOOM', payload: 1.5 })
    })

    expect(result.current.state.past).toEqual([])

    // SET_PAN is not undoable
    act(() => {
      result.current.dispatch({ type: 'SET_PAN', payload: { x: 100, y: 100 } })
    })

    expect(result.current.state.past).toEqual([])

    // SELECT_NODE is not undoable
    act(() => {
      result.current.dispatch({ type: 'SELECT_NODE', payload: 'node-1' })
    })

    expect(result.current.state.past).toEqual([])
  })

  it('supports full undo/redo cycle', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    )

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    // Add first node
    act(() => {
      result.current.dispatch({
        type: 'ADD_NODE',
        payload: {
          componentData: { uuid: 'proto-1', protocolType: 'theorist', name: 'Node 1', parameters: {} },
          x: 100, y: 100
        }
      })
    })

    expect(result.current.state.nodes).toHaveLength(1)
    expect(result.current.state.nodes[0].name).toBe('Node 1')

    // Undo - should remove node
    act(() => {
      result.current.dispatch({ type: 'UNDO' })
    })

    expect(result.current.state.nodes).toHaveLength(0)
    expect(result.current.state.future).toHaveLength(1)

    // Redo - should restore node
    act(() => {
      result.current.dispatch({ type: 'REDO' })
    })

    expect(result.current.state.nodes).toHaveLength(1)
    expect(result.current.state.nodes[0].name).toBe('Node 1')
    expect(result.current.state.future).toHaveLength(0)
  })

  it('batches drag operations into single undo step', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    )

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    // Add a node first
    act(() => {
      result.current.dispatch({
        type: 'ADD_NODE',
        payload: {
          componentData: { uuid: 'proto-1', protocolType: 'theorist', name: 'Node 1', parameters: {} },
          x: 100, y: 100
        }
      })
    })

    const nodeId = result.current.state.nodes[0].id
    const historyLengthAfterAdd = result.current.state.past.length

    // Simulate drag: START_DRAG, multiple UPDATE_NODE_POSITION, END_DRAG
    act(() => {
      result.current.dispatch({ type: 'START_DRAG' })
    })

    // Multiple position updates during drag
    act(() => {
      result.current.dispatch({ type: 'UPDATE_NODE_POSITION', payload: { id: nodeId, x: 150, y: 150 } })
      result.current.dispatch({ type: 'UPDATE_NODE_POSITION', payload: { id: nodeId, x: 200, y: 200 } })
      result.current.dispatch({ type: 'UPDATE_NODE_POSITION', payload: { id: nodeId, x: 250, y: 250 } })
    })

    // Position updates should NOT add to history
    expect(result.current.state.past.length).toBe(historyLengthAfterAdd)

    // End drag
    act(() => {
      result.current.dispatch({ type: 'END_DRAG' })
    })

    // Only one history entry should be added for the entire drag
    expect(result.current.state.past.length).toBe(historyLengthAfterAdd + 1)
    expect(result.current.state.nodes[0].x).toBe(250)
    expect(result.current.state.nodes[0].y).toBe(250)

    // Undo should restore to position before drag started
    act(() => {
      result.current.dispatch({ type: 'UNDO' })
    })

    expect(result.current.state.nodes[0].x).toBe(100)
    expect(result.current.state.nodes[0].y).toBe(100)
  })

  it('does not add history entry for drag with no position change', () => {
    const wrapper = ({ children }) => (
      <WorkflowProvider>{children}</WorkflowProvider>
    )

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    // Add a node first
    act(() => {
      result.current.dispatch({
        type: 'ADD_NODE',
        payload: {
          componentData: { uuid: 'proto-1', protocolType: 'theorist', name: 'Node 1', parameters: {} },
          x: 100, y: 100
        }
      })
    })

    const historyLengthAfterAdd = result.current.state.past.length

    // Start and end drag without any position changes
    act(() => {
      result.current.dispatch({ type: 'START_DRAG' })
      result.current.dispatch({ type: 'END_DRAG' })
    })

    // No new history entry should be added
    expect(result.current.state.past.length).toBe(historyLengthAfterAdd)
  })
})
