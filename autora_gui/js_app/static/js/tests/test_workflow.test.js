/**
 * Tests for save/load workflow functions in app.js
 */

describe('saveWorkflow', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let originalCreateElement;
  let clickSpy;
  let createdBlob;

  beforeEach(() => {
    state.nodes.clear();
    state.connections = [];

    // Store originals
    originalCreateObjectURL = global.URL.createObjectURL;
    originalRevokeObjectURL = global.URL.revokeObjectURL;
    originalCreateElement = document.createElement.bind(document);

    // Mock URL methods
    createdBlob = null;
    global.URL.createObjectURL = jest.fn((blob) => {
      createdBlob = blob;
      return 'blob:test';
    });
    global.URL.revokeObjectURL = jest.fn();

    // Mock anchor click
    clickSpy = jest.fn();
    document.createElement = function(tag) {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: clickSpy
        };
      }
      return originalCreateElement(tag);
    };
  });

  afterEach(() => {
    // Restore originals
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
    document.createElement = originalCreateElement;
  });

  test('creates a Blob with JSON content', () => {
    saveWorkflow();

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(createdBlob).toBeInstanceOf(Blob);
    expect(createdBlob.type).toBe('application/json');
  });

  test('triggers download', () => {
    saveWorkflow();

    expect(clickSpy).toHaveBeenCalled();
  });

  test('revokes object URL after download', () => {
    saveWorkflow();

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  test('updates status message', () => {
    saveWorkflow();

    const statusBar = document.getElementById('status-bar');
    expect(statusBar.textContent).toBe('Workflow saved');
  });
});

describe('workflow data structure', () => {
  // Helper to build workflow object the same way saveWorkflow does
  function buildWorkflowObject() {
    return {
      name: 'workflow',
      description: null,
      independentVariables: {
        name: 'X',
        description: 'Independent variables',
        datatype: 'real',
        minOccurs: 1,
        maxOccurs: -1,
        validValues: null,
        default: null
      },
      dependentVariables: {
        name: 'Y',
        description: 'Dependent variables',
        datatype: 'real',
        minOccurs: 1,
        maxOccurs: -1,
        validValues: null,
        default: null
      },
      components: Array.from(state.nodes.values()).map(node => ({
        uuid: node.id,
        protocolUuid: node.componentData.uuid || node.id,
        componentType: node.type,
        parameterSetting: Object.entries(node.parameters)
          .filter(([key, _]) => !key.startsWith('_'))
          .map(([name, value]) => ({
            name: name,
            value: String(value)
          })),
        canvasLocation: {
          x: Math.round(node.x),
          y: Math.round(node.y)
        }
      })),
      links: state.connections.map(conn => ({
        source: conn.source,
        target: conn.target,
        sourceBorder: conn.sourceBorder || null,
        targetBorder: conn.targetBorder || null,
        controlPoints: conn.controlPoints || null
      }))
    };
  }

  beforeEach(() => {
    state.nodes.clear();
    state.connections = [];
  });

  test('includes name field', () => {
    const workflow = buildWorkflowObject();

    expect(workflow.name).toBe('workflow');
  });

  test('includes independentVariables', () => {
    const workflow = buildWorkflowObject();

    expect(workflow.independentVariables).toBeDefined();
    expect(workflow.independentVariables.name).toBe('X');
    expect(workflow.independentVariables.datatype).toBe('real');
  });

  test('includes dependentVariables', () => {
    const workflow = buildWorkflowObject();

    expect(workflow.dependentVariables).toBeDefined();
    expect(workflow.dependentVariables.name).toBe('Y');
    expect(workflow.dependentVariables.datatype).toBe('real');
  });

  test('includes components array', () => {
    const workflow = buildWorkflowObject();

    expect(Array.isArray(workflow.components)).toBe(true);
  });

  test('includes links array', () => {
    const workflow = buildWorkflowObject();

    expect(Array.isArray(workflow.links)).toBe(true);
  });

  test('serializes nodes as components', () => {
    state.nodes.set('node-1', {
      id: 'node-1',
      type: 'theorists',
      x: 100,
      y: 200,
      componentData: {
        uuid: 'proto-1',
        name: 'Test'
      },
      parameters: {
        _name: 'Test',
        rate: 0.1
      }
    });

    const workflow = buildWorkflowObject();

    expect(workflow.components.length).toBe(1);
    expect(workflow.components[0].uuid).toBe('node-1');
    expect(workflow.components[0].protocolUuid).toBe('proto-1');
    expect(workflow.components[0].componentType).toBe('theorists');
    expect(workflow.components[0].canvasLocation).toEqual({ x: 100, y: 200 });
  });

  test('serializes parameters correctly', () => {
    state.nodes.set('node-1', {
      id: 'node-1',
      type: 'theorists',
      x: 0,
      y: 0,
      componentData: { uuid: 'proto-1' },
      parameters: {
        _name: 'Test',
        _description: 'Desc',
        learning_rate: 0.01,
        epochs: 100
      }
    });

    const workflow = buildWorkflowObject();

    const paramSettings = workflow.components[0].parameterSetting;
    expect(paramSettings).toHaveLength(2);

    const rateParam = paramSettings.find(p => p.name === 'learning_rate');
    expect(rateParam.value).toBe('0.01');

    const epochsParam = paramSettings.find(p => p.name === 'epochs');
    expect(epochsParam.value).toBe('100');
  });

  test('excludes underscore-prefixed parameters', () => {
    state.nodes.set('node-1', {
      id: 'node-1',
      type: 'theorists',
      x: 0,
      y: 0,
      componentData: { uuid: 'proto-1' },
      parameters: {
        _name: 'Test',
        _description: 'Desc',
        rate: 0.1
      }
    });

    const workflow = buildWorkflowObject();

    const paramSettings = workflow.components[0].parameterSetting;
    const underscoreParams = paramSettings.filter(p => p.name.startsWith('_'));
    expect(underscoreParams).toHaveLength(0);
  });

  test('serializes connections as links', () => {
    state.connections.push({
      id: 'conn-1',
      source: 'node-1',
      target: 'node-2',
      sourceBorder: 'border-right',
      targetBorder: 'border-left',
      controlPoints: null
    });

    const workflow = buildWorkflowObject();

    expect(workflow.links.length).toBe(1);
    expect(workflow.links[0].source).toBe('node-1');
    expect(workflow.links[0].target).toBe('node-2');
    expect(workflow.links[0].sourceBorder).toBe('border-right');
    expect(workflow.links[0].targetBorder).toBe('border-left');
  });

  test('serializes control points', () => {
    state.connections.push({
      id: 'conn-1',
      source: 'node-1',
      target: 'node-2',
      sourceBorder: 'border-right',
      targetBorder: 'border-left',
      controlPoints: {
        cp1: { x: 150, y: 100 },
        cp2: { x: 250, y: 100 }
      }
    });

    const workflow = buildWorkflowObject();

    expect(workflow.links[0].controlPoints).toEqual({
      cp1: { x: 150, y: 100 },
      cp2: { x: 250, y: 100 }
    });
  });
});

describe('clearCanvas', () => {
  beforeEach(() => {
    state.nodes.clear();
    state.connections = [];
    state.selectedNode = null;
    state.selectedNodes.clear();
    state.selectedConnections.clear();
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  afterEach(() => {
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  test('clears all nodes from state', () => {
    createNode('theorists', { name: 'Test' }, 0, 0);
    createNode('theorists', { name: 'Test2' }, 100, 0);

    clearCanvas();

    expect(state.nodes.size).toBe(0);
  });

  test('removes all node DOM elements', () => {
    createNode('theorists', { name: 'Test' }, 0, 0);
    createNode('theorists', { name: 'Test2' }, 100, 0);

    clearCanvas();

    const nodes = document.querySelectorAll('.workflow-node');
    expect(nodes.length).toBe(0);
  });

  test('clears all connections', () => {
    state.connections.push({ id: 'conn-1' });
    state.connections.push({ id: 'conn-2' });

    clearCanvas();

    expect(state.connections.length).toBe(0);
  });

  test('clears selections', () => {
    const nodeId = createNode('theorists', { name: 'Test' }, 0, 0);
    state.selectedNode = nodeId;
    state.selectedNodes.add(nodeId);
    state.selectedConnections.add('conn-1');

    clearCanvas();

    expect(state.selectedNode).toBeNull();
    expect(state.selectedNodes.size).toBe(0);
    expect(state.selectedConnections.size).toBe(0);
  });

  test('shows canvas hint', () => {
    const hint = document.getElementById('canvas-hint');
    hint.classList.add('hidden');

    clearCanvas();

    expect(hint.classList.contains('hidden')).toBe(false);
  });

  test('updates status message', () => {
    clearCanvas();

    const statusBar = document.getElementById('status-bar');
    expect(statusBar.textContent).toBe('Canvas cleared');
  });
});

describe('findComponentDataByProtocolUuid', () => {
  beforeEach(() => {
    state.components = {
      theorists: [
        { uuid: 'uuid-1', name: 'Theorist 1' },
        { uuid: 'uuid-2', name: 'Theorist 2' }
      ]
    };
  });

  test('finds component by UUID', () => {
    const result = findComponentDataByProtocolUuid('uuid-2', 'theorists');

    expect(result.name).toBe('Theorist 2');
  });

  test('returns first component as fallback', () => {
    const result = findComponentDataByProtocolUuid('non-existent', 'theorists');

    expect(result.name).toBe('Theorist 1');
  });

  test('returns unknown component for missing type', () => {
    const result = findComponentDataByProtocolUuid('uuid-1', 'nonexistent');

    expect(result.name).toBe('Unknown');
    expect(result.parameters).toEqual([]);
  });
});

describe('findComponentData', () => {
  beforeEach(() => {
    state.components = {
      theorists: [
        { file: 'comp1.json', name: 'Component One' },
        { file: 'comp2.json', name: 'Component Two' }
      ]
    };
  });

  test('finds by file name', () => {
    const result = findComponentData('theorists', {}, 'comp2.json');

    expect(result.name).toBe('Component Two');
  });

  test('finds by name in parameters', () => {
    const result = findComponentData('theorists', { _name: 'Component One' });

    expect(result.file).toBe('comp1.json');
  });

  test('returns first component as fallback', () => {
    const result = findComponentData('theorists', { _name: 'Unknown Name' });

    expect(result.name).toBe('Component One');
  });

  test('returns placeholder for missing type', () => {
    const result = findComponentData('nonexistent', { _name: 'Test', _description: 'Desc' });

    expect(result.name).toBe('Test');
    expect(result.description).toBe('Desc');
  });
});
