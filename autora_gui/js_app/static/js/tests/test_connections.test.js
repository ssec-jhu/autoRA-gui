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

    // Without control points, uses quadratic bezier (Q)
    expect(path).toMatch(/^M \d+\.?\d* \d+\.?\d* Q/);
    expect(path).toContain('M 0 0');
    expect(path).toContain('100 100');
  });

  test('uses provided control points', () => {
    const controlPoints = {
      cp1: { x: 25, y: 50 },
      cp2: { x: 75, y: 50 }
    };
    const path = createBezierPath(0, 0, 100, 100, controlPoints);

    // With control points, uses cubic bezier (C)
    expect(path).toContain('C 25 50, 75 50,');
  });

  test('uses quadratic bezier when no control points provided', () => {
    const path = createBezierPath(0, 0, 100, 100);

    // Should use quadratic bezier (Q) with single control point
    expect(path).toMatch(/M .* Q .*, .* .*/);
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

describe('createConnectionPath', () => {
  test('creates straight line for short distances', () => {
    const path = createConnectionPath(0, 0, 20, 20);

    expect(path).toMatch(/^M .* L .*/);
  });

  test('uses parabolic path for longer distances with offset', () => {
    // Create path points that deviate significantly from straight line
    // Need at least 3 points and large deviation (>15px after scaling)
    const pathPoints = [
      { x: 0, y: 0 },
      { x: 25, y: 60 },   // Deviate significantly
      { x: 50, y: 80 },   // More deviation
      { x: 75, y: 60 },   // Continue deviating
      { x: 100, y: 0 }
    ];
    const path = createConnectionPath(0, 0, 100, 0, pathPoints);

    // Should use quadratic bezier due to deviation
    expect(path).toMatch(/^M .* Q .*/);
  });

  test('uses straight line when path is mostly direct', () => {
    // Path points that stay close to the straight line
    const pathPoints = [
      { x: 0, y: 0 },
      { x: 50, y: 2 },  // Small deviation
      { x: 100, y: 0 }
    ];
    const path = createConnectionPath(0, 0, 100, 0, pathPoints);

    expect(path).toMatch(/^M .* L .*/);
  });

  test('handles null path points', () => {
    const path = createConnectionPath(0, 0, 100, 100, null);

    // Should still produce valid path
    expect(path).toBeTruthy();
    expect(path).toMatch(/^M/);
  });
});

describe('createStraightPath', () => {
  test('creates L command path', () => {
    const path = createStraightPath(10, 20, 30, 40);

    expect(path).toBe('M 10 20 L 30 40');
  });

  test('handles zero coordinates', () => {
    const path = createStraightPath(0, 0, 0, 0);

    expect(path).toBe('M 0 0 L 0 0');
  });

  test('handles negative coordinates', () => {
    const path = createStraightPath(-10, -20, 30, 40);

    expect(path).toBe('M -10 -20 L 30 40');
  });
});

describe('createParabolicPath', () => {
  test('creates Q command path', () => {
    const path = createParabolicPath(0, 0, 100, 0, 50);

    expect(path).toMatch(/^M 0 0 Q .*, 100 0$/);
  });

  test('control point is perpendicular to line direction', () => {
    // Horizontal line with positive offset
    // Perpendicular vector for horizontal line (dx=100, dy=0) is (0, 1)
    // So control point is offset in positive Y direction
    const path = createParabolicPath(0, 0, 100, 0, 50);

    // Extract control point from Q command
    const match = path.match(/Q ([\d.-]+) ([\d.-]+),/);
    expect(match).toBeTruthy();
    const cpX = parseFloat(match[1]);
    const cpY = parseFloat(match[2]);

    // Control point should be at midpoint X, offset Y
    expect(cpX).toBe(50);  // midpoint
    expect(cpY).toBe(50);  // perpendicular offset (+Y for horizontal line)
  });

  test('handles zero distance gracefully', () => {
    const path = createParabolicPath(50, 50, 50, 50, 20);

    // Should fall back to straight line
    expect(path).toMatch(/^M .* L .*/);
  });

  test('negative offset curves opposite direction', () => {
    const pathPositive = createParabolicPath(0, 0, 100, 0, 50);
    const pathNegative = createParabolicPath(0, 0, 100, 0, -50);

    // Extract Y control points
    const matchPos = pathPositive.match(/Q [\d.-]+ ([\d.-]+),/);
    const matchNeg = pathNegative.match(/Q [\d.-]+ ([\d.-]+),/);

    const cpYPos = parseFloat(matchPos[1]);
    const cpYNeg = parseFloat(matchNeg[1]);

    // Should be opposite signs
    expect(Math.sign(cpYPos)).toBe(-Math.sign(cpYNeg));
  });
});

describe('calculateCurveOffset', () => {
  test('returns 0 for null path points', () => {
    const offset = calculateCurveOffset(0, 0, 100, 100, null);

    expect(offset).toBe(0);
  });

  test('returns 0 for empty path points', () => {
    const offset = calculateCurveOffset(0, 0, 100, 100, []);

    expect(offset).toBe(0);
  });

  test('returns 0 for single path point', () => {
    const offset = calculateCurveOffset(0, 0, 100, 100, [{ x: 50, y: 50 }]);

    expect(offset).toBe(0);
  });

  test('calculates positive offset for deviation one side', () => {
    // Points deviating to one side of the straight line
    const pathPoints = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },  // Above the line y = x
      { x: 100, y: 0 }
    ];
    const offset = calculateCurveOffset(0, 0, 100, 0, pathPoints);

    expect(offset).not.toBe(0);
  });

  test('handles zero distance between endpoints', () => {
    const offset = calculateCurveOffset(50, 50, 50, 50, [{ x: 60, y: 60 }]);

    expect(offset).toBe(0);  // Should not throw, returns 0
  });
});
