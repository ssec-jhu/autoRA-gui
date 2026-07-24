/**
 * Unit tests for `utils/serialization`.
 *
 * Covers round-tripping a workflow between editor state and its persisted form:
 * serializeWorkflow (start/end/filter nodes, components, and links) and
 * deserializeWorkflow (reconstructing nodes and connections from saved data).
 *
 * @module utils/serialization.test
 */
import { describe, it, expect, vi } from 'vitest'
import { serializeWorkflow, deserializeWorkflow } from './serialization'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mocked-uuid'
}))

describe('serializeWorkflow', () => {
  it('serializes empty workflow', () => {
    const state = { nodes: [], connections: [] }
    const result = serializeWorkflow(state)

    expect(result.name).toBe('AutoRA Workflow')
    expect(result.start).toBeNull()
    expect(result.end).toBeNull()
    expect(result.components).toEqual([])
    expect(result.links).toEqual([])
  })

  it('serializes start and end nodes', () => {
    const state = {
      nodes: [
        { id: 'start-1', type: 'start_point', x: 100, y: 200 },
        { id: 'end-1', type: 'end_point', x: 500, y: 200 }
      ],
      connections: []
    }
    const result = serializeWorkflow(state)

    expect(result.start).toEqual({
      uuid: 'start-1',
      canvasLocation: { x: 100, y: 200 }
    })
    expect(result.end).toEqual({
      uuid: 'end-1',
      canvasLocation: { x: 500, y: 200 }
    })
  })

  it('serializes filter nodes', () => {
    const state = {
      nodes: [
        {
          id: 'filter-1',
          type: 'filter_point',
          x: 300,
          y: 200,
          filterParams: { maxCounter: 5, altTarget: 'node-2' }
        }
      ],
      connections: []
    }
    const result = serializeWorkflow(state)

    expect(result.filters).toHaveLength(1)
    expect(result.filters[0]).toEqual({
      uuid: 'filter-1',
      maxCounter: 5,
      altTarget: 'node-2',
      canvasLocation: { x: 300, y: 200 }
    })
  })

  it('serializes protocol components with parameters', () => {
    const state = {
      nodes: [
        {
          id: 'comp-1',
          type: 'theorist',
          protocolUuid: 'proto-123',
          x: 200,
          y: 100,
          parameters: { epochs: 1000, learning_rate: 0.01 }
        }
      ],
      connections: []
    }
    const result = serializeWorkflow(state)

    expect(result.components).toHaveLength(1)
    expect(result.components[0].uuid).toBe('comp-1')
    expect(result.components[0].protocolUuid).toBe('proto-123')
    expect(result.components[0].parameterSetting).toHaveLength(2)
  })

  it('serializes connections as links', () => {
    const state = {
      nodes: [],
      connections: [
        { sourceId: 'node-1', targetId: 'node-2', sourcePoint: 'right', targetPoint: 'left' }
      ]
    }
    const result = serializeWorkflow(state)

    expect(result.links).toHaveLength(1)
    expect(result.links[0]).toEqual({
      source: 'node-1',
      target: 'node-2',
      sourcePoint: 'right',
      targetPoint: 'left'
    })
  })
})

// Reconstructing editor state from persisted workflow data
describe('deserializeWorkflow', () => {
  const componentsMap = {
    theorists: [
      {
        uuid: 'proto-123',
        protocolType: 'theorist',
        name: 'Test Theorist',
        description: 'A test theorist',
        parameters: {
          __init__: [{ name: 'epochs', default: 100 }]
        }
      }
    ]
  }

  it('deserializes empty workflow', () => {
    const workflow = { components: [], links: [] }
    const result = deserializeWorkflow(workflow, {})

    expect(result.nodes).toEqual([])
    expect(result.connections).toEqual([])
  })

  it('deserializes start node', () => {
    const workflow = {
      start: { uuid: 'start-1', canvasLocation: { x: 100, y: 200 } },
      components: [],
      links: []
    }
    const result = deserializeWorkflow(workflow, {})

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe('start-1')
    expect(result.nodes[0].type).toBe('start_point')
    expect(result.nodes[0].x).toBe(100)
    expect(result.nodes[0].y).toBe(200)
  })

  it('deserializes end node', () => {
    const workflow = {
      end: { uuid: 'end-1', canvasLocation: { x: 500, y: 200 } },
      components: [],
      links: []
    }
    const result = deserializeWorkflow(workflow, {})

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe('end-1')
    expect(result.nodes[0].type).toBe('end_point')
  })

  it('deserializes filter nodes', () => {
    const workflow = {
      filters: [
        { uuid: 'filter-1', maxCounter: 3, altTarget: null, canvasLocation: { x: 300, y: 200 } }
      ],
      components: [],
      links: []
    }
    const result = deserializeWorkflow(workflow, {})

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].type).toBe('filter_point')
    expect(result.nodes[0].filterParams.maxCounter).toBe(3)
  })

  it('deserializes protocol components', () => {
    const workflow = {
      components: [
        {
          uuid: 'comp-1',
          protocolUuid: 'proto-123',
          canvasLocation: { x: 200, y: 100 },
          parameterSetting: [{ name: 'epochs', value: 500 }]
        }
      ],
      links: []
    }
    const result = deserializeWorkflow(workflow, componentsMap)

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].name).toBe('Test Theorist')
    expect(result.nodes[0].parameters.epochs).toBe(500)
  })

  it('deserializes links as connections', () => {
    const workflow = {
      start: { uuid: 'start-1', canvasLocation: { x: 0, y: 0 } },
      end: { uuid: 'end-1', canvasLocation: { x: 100, y: 0 } },
      components: [],
      links: [{ source: 'start-1', target: 'end-1' }]
    }
    const result = deserializeWorkflow(workflow, {})

    expect(result.connections).toHaveLength(1)
    expect(result.connections[0].sourceId).toBe('start-1')
    expect(result.connections[0].targetId).toBe('end-1')
  })

  it('filters out links with invalid node references', () => {
    const workflow = {
      start: { uuid: 'start-1', canvasLocation: { x: 0, y: 0 } },
      components: [],
      links: [{ source: 'start-1', target: 'nonexistent' }]
    }
    const result = deserializeWorkflow(workflow, {})

    expect(result.connections).toHaveLength(0)
  })
})
