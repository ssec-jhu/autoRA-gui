import { v4 as uuidv4 } from 'uuid'

export function serializeWorkflow(state) {
  return {
    name: 'AutoRA Workflow',
    description: 'Workflow created with AutoRA GUI',
    components: state.nodes.map(node => ({
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
      target: conn.targetId
    }))
  }
}

export function deserializeWorkflow(workflow, componentsMap) {
  const allComponents = Object.values(componentsMap).flat()

  const nodes = (workflow.components || []).map(comp => {
    const protocol = allComponents.find(c => c.uuid === comp.protocolUuid)

    if (!protocol) {
      console.warn(`Protocol not found: ${comp.protocolUuid}`)
      return null
    }

    const parameters = {}
    ;(protocol.parameters || []).forEach(param => {
      parameters[param.name] = param.default ?? null
    })
    ;(comp.parameterSetting || []).forEach(setting => {
      if (setting.name) {
        parameters[setting.name] = setting.value
      }
    })

    return {
      id: comp.uuid,
      protocolUuid: comp.protocolUuid,
      type: protocol.protocolType,
      name: protocol.name,
      description: protocol.description,
      x: comp.canvasLocation?.x ?? 100,
      y: comp.canvasLocation?.y ?? 100,
      componentData: protocol,
      parameters
    }
  }).filter(Boolean)

  const nodeIds = new Set(nodes.map(n => n.id))

  const connections = (workflow.links || [])
    .filter(link => nodeIds.has(link.source) && nodeIds.has(link.target))
    .map(link => ({
      id: uuidv4(),
      sourceId: link.source,
      targetId: link.target
    }))

  return { nodes, connections }
}
