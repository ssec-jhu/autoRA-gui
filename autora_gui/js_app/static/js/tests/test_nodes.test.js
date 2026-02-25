/**
 * Tests for node management functions in app.js
 */

describe('createNode', () => {
  beforeEach(() => {
    state.nodes.clear();
    state.connections = [];
    // Clean up any existing nodes in DOM
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  afterEach(() => {
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  test('creates node and adds to state', () => {
    const componentData = {
      name: 'Test Component',
      description: 'A test',
      parameters: []
    };

    const nodeId = createNode('theorists', componentData, 100, 200);

    expect(state.nodes.has(nodeId)).toBe(true);
    expect(state.nodes.size).toBe(1);
  });

  test('returns valid UUID', () => {
    const nodeId = createNode('theorists', { name: 'Test' }, 0, 0);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(nodeId).toMatch(uuidRegex);
  });

  test('stores correct position', () => {
    const nodeId = createNode('theorists', { name: 'Test' }, 150, 250);

    const node = state.nodes.get(nodeId);
    expect(node.x).toBe(150);
    expect(node.y).toBe(250);
  });

  test('stores component data', () => {
    const componentData = {
      name: 'My Theorist',
      description: 'Does theory',
      uuid: 'comp-uuid'
    };

    const nodeId = createNode('theorists', componentData, 0, 0);

    const node = state.nodes.get(nodeId);
    expect(node.componentData).toEqual(componentData);
  });

  test('extracts parameters from component data', () => {
    const componentData = {
      name: 'Test',
      parameters: [
        { name: 'rate', default: 0.1 }
      ]
    };

    const nodeId = createNode('theorists', componentData, 0, 0);

    const node = state.nodes.get(nodeId);
    expect(node.parameters.rate).toBe(0.1);
  });

  test('creates DOM element', () => {
    const nodeId = createNode('theorists', { name: 'Test' }, 100, 100);

    const element = document.querySelector(`[data-node-id="${nodeId}"]`);
    expect(element).not.toBeNull();
    expect(element.classList.contains('workflow-node')).toBe(true);
  });

  test('sets correct type class on DOM element', () => {
    const nodeId = createNode('experiment_runners', { name: 'Test' }, 0, 0);

    const element = document.querySelector(`[data-node-id="${nodeId}"]`);
    expect(element.classList.contains('experiment-runners')).toBe(true);
  });

  test('updates node count', () => {
    createNode('theorists', { name: 'Test' }, 0, 0);

    expect(document.getElementById('node-count').textContent).toBe('Nodes: 1');
  });
});

describe('deleteNode', () => {
  let testNodeId;

  beforeEach(() => {
    state.nodes.clear();
    state.connections = [];
    state.selectedNode = null;
    state.selectedNodes.clear();
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());

    // Create a test node
    testNodeId = createNode('theorists', { name: 'Test' }, 100, 100);
  });

  afterEach(() => {
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  test('removes node from state', () => {
    deleteNode(testNodeId);

    expect(state.nodes.has(testNodeId)).toBe(false);
    expect(state.nodes.size).toBe(0);
  });

  test('removes node from DOM', () => {
    deleteNode(testNodeId);

    const element = document.querySelector(`[data-node-id="${testNodeId}"]`);
    expect(element).toBeNull();
  });

  test('removes connections involving the node', () => {
    const node2Id = createNode('experimentalists', { name: 'Test2' }, 300, 100);

    state.connections.push({
      id: 'conn-1',
      source: testNodeId,
      target: node2Id
    });

    deleteNode(testNodeId);

    expect(state.connections.length).toBe(0);
  });

  test('clears selection if deleted node was selected', () => {
    state.selectedNode = testNodeId;
    state.selectedNodes.add(testNodeId);

    deleteNode(testNodeId);

    expect(state.selectedNode).toBeNull();
    expect(state.selectedNodes.has(testNodeId)).toBe(false);
  });

  test('updates node count', () => {
    deleteNode(testNodeId);

    expect(document.getElementById('node-count').textContent).toBe('Nodes: 0');
  });
});

describe('deleteSelectedNodes', () => {
  beforeEach(() => {
    state.nodes.clear();
    state.connections = [];
    state.selectedNodes.clear();
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  afterEach(() => {
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  test('does nothing when no nodes selected', () => {
    createNode('theorists', { name: 'Test' }, 0, 0);

    deleteSelectedNodes();

    expect(state.nodes.size).toBe(1);
  });

  test('deletes all selected nodes', () => {
    const node1 = createNode('theorists', { name: 'Test1' }, 0, 0);
    const node2 = createNode('theorists', { name: 'Test2' }, 100, 0);
    const node3 = createNode('theorists', { name: 'Test3' }, 200, 0);

    state.selectedNodes.add(node1);
    state.selectedNodes.add(node2);

    deleteSelectedNodes();

    expect(state.nodes.size).toBe(1);
    expect(state.nodes.has(node3)).toBe(true);
  });

  test('clears selectedNodes set', () => {
    const node1 = createNode('theorists', { name: 'Test1' }, 0, 0);
    state.selectedNodes.add(node1);

    deleteSelectedNodes();

    expect(state.selectedNodes.size).toBe(0);
  });
});

describe('clearSelection', () => {
  beforeEach(() => {
    state.nodes.clear();
    state.selectedNode = null;
    state.selectedNodes.clear();
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  afterEach(() => {
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  test('clears selectedNode', () => {
    const nodeId = createNode('theorists', { name: 'Test' }, 0, 0);
    state.selectedNode = nodeId;

    clearSelection();

    expect(state.selectedNode).toBeNull();
  });

  test('clears selectedNodes set', () => {
    const node1 = createNode('theorists', { name: 'Test1' }, 0, 0);
    const node2 = createNode('theorists', { name: 'Test2' }, 100, 0);
    state.selectedNodes.add(node1);
    state.selectedNodes.add(node2);

    clearSelection();

    expect(state.selectedNodes.size).toBe(0);
  });

  test('removes selected class from DOM elements', () => {
    const nodeId = createNode('theorists', { name: 'Test' }, 0, 0);
    const element = document.querySelector(`[data-node-id="${nodeId}"]`);
    element.classList.add('selected');
    state.selectedNodes.add(nodeId);

    clearSelection();

    expect(element.classList.contains('selected')).toBe(false);
  });
});

describe('selectAll', () => {
  beforeEach(() => {
    state.nodes.clear();
    state.connections = [];
    state.selectedNodes.clear();
    state.selectedConnections.clear();
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  afterEach(() => {
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  test('selects all nodes', () => {
    const node1 = createNode('theorists', { name: 'Test1' }, 0, 0);
    const node2 = createNode('theorists', { name: 'Test2' }, 100, 0);

    selectAll();

    expect(state.selectedNodes.size).toBe(2);
    expect(state.selectedNodes.has(node1)).toBe(true);
    expect(state.selectedNodes.has(node2)).toBe(true);
  });

  test('adds selected class to all node elements', () => {
    const node1 = createNode('theorists', { name: 'Test1' }, 0, 0);
    const node2 = createNode('theorists', { name: 'Test2' }, 100, 0);

    selectAll();

    const el1 = document.querySelector(`[data-node-id="${node1}"]`);
    const el2 = document.querySelector(`[data-node-id="${node2}"]`);

    expect(el1.classList.contains('selected')).toBe(true);
    expect(el2.classList.contains('selected')).toBe(true);
  });

  test('selects all connections', () => {
    state.connections.push({ id: 'conn-1' });
    state.connections.push({ id: 'conn-2' });

    selectAll();

    expect(state.selectedConnections.size).toBe(2);
    expect(state.selectedConnections.has('conn-1')).toBe(true);
    expect(state.selectedConnections.has('conn-2')).toBe(true);
  });
});
