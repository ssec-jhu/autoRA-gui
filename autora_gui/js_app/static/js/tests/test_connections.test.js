/**
 * Tests for connection and bezier curve functions in app.js
 */

describe('getDefaultControlPoints', () => {
  test('returns object with cp1 and cp2', () => {
    const result = getDefaultControlPoints(0, 0, 100, 100);

    expect(result).toHaveProperty('cp1');
    expect(result).toHaveProperty('cp2');
    expect(result.cp1).toHaveProperty('x');
    expect(result.cp1).toHaveProperty('y');
    expect(result.cp2).toHaveProperty('x');
    expect(result.cp2).toHaveProperty('y');
  });

  test('control points are between start and end for horizontal line', () => {
    const x1 = 0, y1 = 50, x2 = 100, y2 = 50;
    const { cp1, cp2 } = getDefaultControlPoints(x1, y1, x2, y2);

    // cp1 should be closer to start
    expect(cp1.x).toBeGreaterThan(x1);
    expect(cp1.x).toBeLessThan(x2);

    // cp2 should be closer to end
    expect(cp2.x).toBeGreaterThan(cp1.x);
    expect(cp2.x).toBeLessThan(x2);
  });

  test('creates concave curve (control points offset perpendicularly)', () => {
    const x1 = 0, y1 = 0, x2 = 100, y2 = 0;
    const { cp1, cp2 } = getDefaultControlPoints(x1, y1, x2, y2);

    // For horizontal line, perpendicular offset should affect Y
    // Both control points should be on the same side (concave)
    expect(Math.sign(cp1.y)).toBe(Math.sign(cp2.y));
  });

  test('handles vertical line', () => {
    const x1 = 50, y1 = 0, x2 = 50, y2 = 100;
    const { cp1, cp2 } = getDefaultControlPoints(x1, y1, x2, y2);

    // For vertical line, perpendicular offset should affect X
    expect(cp1.y).toBeGreaterThan(y1);
    expect(cp2.y).toBeGreaterThan(cp1.y);
  });

  test('handles diagonal line', () => {
    const x1 = 0, y1 = 0, x2 = 100, y2 = 100;
    const { cp1, cp2 } = getDefaultControlPoints(x1, y1, x2, y2);

    // Both control points should exist and be different
    expect(cp1.x).not.toBe(cp2.x);
    expect(cp1.y).not.toBe(cp2.y);
  });

  test('handles same point (zero distance)', () => {
    const { cp1, cp2 } = getDefaultControlPoints(50, 50, 50, 50);

    // Should not throw, even with zero distance
    expect(cp1).toBeDefined();
    expect(cp2).toBeDefined();
  });

  test('curvature scales with distance', () => {
    const short = getDefaultControlPoints(0, 0, 50, 0);
    const long = getDefaultControlPoints(0, 0, 200, 0);

    // Longer distance should have larger offset
    const shortOffset = Math.abs(short.cp1.y);
    const longOffset = Math.abs(long.cp1.y);

    expect(longOffset).toBeGreaterThan(shortOffset);
  });
});

describe('createBezierPath', () => {
  test('creates valid SVG path string', () => {
    const path = createBezierPath(0, 0, 100, 100);

    expect(path).toMatch(/^M \d+\.?\d* \d+\.?\d* C/);
    expect(path).toContain('M 0 0');
    expect(path).toContain('100 100');
  });

  test('uses provided control points', () => {
    const controlPoints = {
      cp1: { x: 25, y: 50 },
      cp2: { x: 75, y: 50 }
    };
    const path = createBezierPath(0, 0, 100, 100, controlPoints);

    expect(path).toContain('C 25 50, 75 50,');
  });

  test('calculates default control points when none provided', () => {
    const path = createBezierPath(0, 0, 100, 100);

    // Should have all path components
    expect(path).toMatch(/M .* C .*, .*, .* .*/);
  });

  test('handles negative coordinates', () => {
    const path = createBezierPath(-50, -50, 50, 50);

    expect(path).toContain('M -50 -50');
    expect(path).toContain('50 50');
  });
});

describe('createConnection', () => {
  beforeEach(() => {
    // Reset state
    state.connections = [];
    state.nodes.clear();

    // Add test nodes
    state.nodes.set('source-node', {
      id: 'source-node',
      x: 100,
      y: 100,
      type: 'theorists',
      componentData: { name: 'Source' }
    });
    state.nodes.set('target-node', {
      id: 'target-node',
      x: 300,
      y: 100,
      type: 'experimentalists',
      componentData: { name: 'Target' }
    });

    // Create DOM elements for nodes
    const sourceEl = document.createElement('div');
    sourceEl.className = 'workflow-node';
    sourceEl.dataset.nodeId = 'source-node';
    sourceEl.style.left = '100px';
    sourceEl.style.top = '100px';
    document.getElementById('workflow-canvas').appendChild(sourceEl);

    const targetEl = document.createElement('div');
    targetEl.className = 'workflow-node';
    targetEl.dataset.nodeId = 'target-node';
    targetEl.style.left = '300px';
    targetEl.style.top = '100px';
    document.getElementById('workflow-canvas').appendChild(targetEl);
  });

  afterEach(() => {
    // Clean up DOM
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
    document.querySelectorAll('[data-connection-id]').forEach(el => el.remove());
  });

  test('creates connection and adds to state', () => {
    const connId = createConnection('source-node', 'target-node');

    expect(state.connections.length).toBe(1);
    expect(state.connections[0].source).toBe('source-node');
    expect(state.connections[0].target).toBe('target-node');
    expect(connId).toBe(state.connections[0].id);
  });

  test('connection has valid UUID', () => {
    createConnection('source-node', 'target-node');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(state.connections[0].id).toMatch(uuidRegex);
  });

  test('stores source and target anchors', () => {
    const sourcePoint = { x: 150, y: 100 };
    const targetPoint = { x: 300, y: 100 };

    createConnection('source-node', 'target-node', sourcePoint, targetPoint);

    expect(state.connections[0].sourceAnchor).toEqual(sourcePoint);
    expect(state.connections[0].targetAnchor).toEqual(targetPoint);
  });

  test('stores border information', () => {
    createConnection(
      'source-node', 'target-node',
      { x: 150, y: 100 }, { x: 300, y: 100 },
      'border-right', 'border-left'
    );

    expect(state.connections[0].sourceBorder).toBe('border-right');
    expect(state.connections[0].targetBorder).toBe('border-left');
  });

  test('initializes controlPoints as null', () => {
    createConnection('source-node', 'target-node');

    expect(state.connections[0].controlPoints).toBeNull();
  });
});

describe('deleteConnection', () => {
  beforeEach(() => {
    state.connections = [];
    state.selectedConnections.clear();
    state.selectedConnection = null;
  });

  test('removes connection from state', () => {
    state.connections.push({ id: 'conn-1', source: 'a', target: 'b' });
    state.connections.push({ id: 'conn-2', source: 'c', target: 'd' });

    deleteConnection('conn-1');

    expect(state.connections.length).toBe(1);
    expect(state.connections[0].id).toBe('conn-2');
  });

  test('does nothing for non-existent connection', () => {
    state.connections.push({ id: 'conn-1', source: 'a', target: 'b' });

    deleteConnection('non-existent');

    expect(state.connections.length).toBe(1);
  });

  test('clears selected connection if deleted', () => {
    state.connections.push({ id: 'conn-1', source: 'a', target: 'b' });
    state.selectedConnection = 'conn-1';
    state.selectedConnections.add('conn-1');

    deleteConnection('conn-1');

    expect(state.selectedConnection).toBeNull();
    expect(state.selectedConnections.has('conn-1')).toBe(false);
  });
});

describe('completeConnection', () => {
  beforeEach(() => {
    state.connections = [];
    state.connecting = {
      source: 'source-node',
      sourcePoint: { x: 150, y: 100 },
      sourceBorder: 'border-right'
    };
  });

  test('prevents self-connection', () => {
    completeConnection('source-node', 200, 100, 'border-left');

    // Connection should not be created
    expect(state.connections.length).toBe(0);
  });

  test('prevents duplicate connections', () => {
    state.connections.push({
      id: 'existing',
      source: 'source-node',
      target: 'target-node'
    });

    completeConnection('target-node', 300, 100, 'border-left');

    // Should still have only 1 connection
    expect(state.connections.length).toBe(1);
  });
});
