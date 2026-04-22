import { v4 as uuidv4 } from 'uuid'

const CONTROL_NODE_TYPES = ['start_point', 'end_point', 'filter_point']

export function serializeWorkflow(state) {
  const startNode = state.nodes.find(n => n.type === 'start_point')
  const endNode = state.nodes.find(n => n.type === 'end_point')
  const filterNodes = state.nodes.filter(n => n.type === 'filter_point')
  const protocolNodes = state.nodes.filter(n => !CONTROL_NODE_TYPES.includes(n.type))

  // Debug logging
  console.log('DEBUG serializeWorkflow:')
  console.log('  All nodes:', state.nodes.map(n => ({ id: n.id, type: n.type, name: n.name })))
  console.log('  startNode:', startNode ? { id: startNode.id, type: startNode.type } : null)
  console.log('  endNode:', endNode ? { id: endNode.id, type: endNode.type } : null)
  console.log('  filterNodes:', filterNodes.map(n => ({ id: n.id, type: n.type })))

  return {
    name: 'AutoRA Workflow',
    description: 'Workflow created with AutoRA GUI',
    start: startNode ? {
      uuid: startNode.id,
      canvasLocation: {
        x: Math.round(startNode.x),
        y: Math.round(startNode.y)
      }
    } : null,
    end: endNode ? {
      uuid: endNode.id,
      canvasLocation: {
        x: Math.round(endNode.x),
        y: Math.round(endNode.y)
      }
    } : null,
    filters: filterNodes.map(node => ({
      uuid: node.id,
      canvasLocation: {
        x: Math.round(node.x),
        y: Math.round(node.y)
      }
    })),
    components: protocolNodes.map(node => ({
      uuid: node.id,
      protocolUuid: node.protocolUuid,
      parameterSetting: Object.entries(node.parameters || {})
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([name, value]) => ({
          uuid: uuidv4(),
          name,
          value
        })),
      canvasLocation: {
        x: Math.round(node.x),
        y: Math.round(node.y)
      }
    })),
    links: state.connections.map(conn => ({
      source: conn.sourceId,
      target: conn.targetId,
      sourcePoint: conn.sourcePoint,
      targetPoint: conn.targetPoint
    }))
  }
}

export function deserializeWorkflow(workflow, componentsMap) {
  const allComponents = Object.values(componentsMap).flat()
  const nodes = []

  // Add start node if present
  if (workflow.start) {
    nodes.push({
      id: workflow.start.uuid,
      protocolUuid: 'start-node',
      type: 'start_point',
      name: 'Start',
      description: 'Starting point of the workflow',
      x: workflow.start.canvasLocation?.x ?? 100,
      y: workflow.start.canvasLocation?.y ?? 100,
      componentData: { uuid: 'start-node', protocolType: 'start_point', name: 'Start', isControlNode: true },
      parameters: {}
    })
  }

  // Add end node if present
  if (workflow.end) {
    nodes.push({
      id: workflow.end.uuid,
      protocolUuid: 'end-node',
      type: 'end_point',
      name: 'End',
      description: 'Ending point of the workflow',
      x: workflow.end.canvasLocation?.x ?? 100,
      y: workflow.end.canvasLocation?.y ?? 100,
      componentData: { uuid: 'end-node', protocolType: 'end_point', name: 'End', isControlNode: true },
      parameters: {}
    })
  }

  // Add filter nodes if present
  ;(workflow.filters || []).forEach(filter => {
    nodes.push({
      id: filter.uuid,
      protocolUuid: 'filter-node',
      type: 'filter_point',
      name: 'Filter',
      description: 'Filter/decision point in the workflow',
      x: filter.canvasLocation?.x ?? 100,
      y: filter.canvasLocation?.y ?? 100,
      componentData: { uuid: 'filter-node', protocolType: 'filter_point', name: 'Filter', isControlNode: true },
      parameters: {}
    })
  })

  // Add protocol components
  ;(workflow.components || []).forEach(comp => {
    const protocol = allComponents.find(c => c.uuid === comp.protocolUuid)

    if (!protocol) {
      console.warn(`Protocol not found: ${comp.protocolUuid}`)
      return
    }

    const parameters = {}
    // parameters is now a dict with function names as keys and arrays of params as values
    const allParams = protocol.parameters
      ? Object.values(protocol.parameters).flat()
      : []
    allParams.forEach(param => {
      parameters[param.name] = param.default ?? null
    })
    ;(comp.parameterSetting || []).forEach(setting => {
      if (setting.name) {
        parameters[setting.name] = setting.value
      }
    })

    nodes.push({
      id: comp.uuid,
      protocolUuid: comp.protocolUuid,
      type: protocol.protocolType,
      name: protocol.name,
      description: protocol.description,
      x: comp.canvasLocation?.x ?? 100,
      y: comp.canvasLocation?.y ?? 100,
      componentData: protocol,
      parameters
    })
  })

  const nodeIds = new Set(nodes.map(n => n.id))

  const connections = (workflow.links || [])
    .filter(link => nodeIds.has(link.source) && nodeIds.has(link.target))
    .map(link => ({
      id: uuidv4(),
      sourceId: link.source,
      targetId: link.target,
      sourcePoint: link.sourcePoint,
      targetPoint: link.targetPoint
    }))

  return { nodes, connections }
}
