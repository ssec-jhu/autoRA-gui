/**
 * Tests for utility functions in app.js
 */

describe('generateUUID', () => {
  test('returns a string', () => {
    const uuid = generateUUID();
    expect(typeof uuid).toBe('string');
  });

  test('returns a valid UUID v4 format', () => {
    const uuid = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  test('generates unique UUIDs', () => {
    const uuids = new Set();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(100);
  });

  test('UUID has correct version number (4)', () => {
    const uuid = generateUUID();
    expect(uuid.charAt(14)).toBe('4');
  });

  test('UUID has correct variant bits (8, 9, a, or b)', () => {
    const uuid = generateUUID();
    expect(['8', '9', 'a', 'b']).toContain(uuid.charAt(19).toLowerCase());
  });
});

describe('getTypeIcon', () => {
  test('returns brain emoji for theorists', () => {
    expect(getTypeIcon('theorists')).toBe('\u{1F9E0}');
  });

  test('returns microscope emoji for experimentalists', () => {
    expect(getTypeIcon('experimentalists')).toBe('\u{1F52C}');
  });

  test('returns runner emoji for experiment_runners', () => {
    expect(getTypeIcon('experiment_runners')).toBe('\u{1F3C3}');
  });

  test('returns package emoji for unknown types', () => {
    expect(getTypeIcon('unknown')).toBe('\u{1F4E6}');
  });

  test('returns package emoji for undefined type', () => {
    expect(getTypeIcon(undefined)).toBe('\u{1F4E6}');
  });

  test('returns package emoji for null type', () => {
    expect(getTypeIcon(null)).toBe('\u{1F4E6}');
  });
});

describe('formatTypeName', () => {
  test('capitalizes single word', () => {
    expect(formatTypeName('theorists')).toBe('Theorists');
  });

  test('replaces underscores with spaces and capitalizes', () => {
    expect(formatTypeName('experiment_runners')).toBe('Experiment Runners');
  });

  test('handles multiple underscores', () => {
    expect(formatTypeName('some_long_type_name')).toBe('Some Long Type Name');
  });

  test('handles empty string', () => {
    expect(formatTypeName('')).toBe('');
  });

  test('handles single character', () => {
    expect(formatTypeName('a')).toBe('A');
  });
});

describe('updateStatus', () => {
  test('updates status bar text content', () => {
    updateStatus('Test message');
    const statusBar = document.getElementById('status-bar');
    expect(statusBar.textContent).toBe('Test message');
  });

  test('handles empty message', () => {
    updateStatus('');
    const statusBar = document.getElementById('status-bar');
    expect(statusBar.textContent).toBe('');
  });
});

describe('updateCounts', () => {
  beforeEach(() => {
    // Reset state
    state.nodes.clear();
    state.connections = [];
  });

  test('shows zero counts when empty', () => {
    updateCounts();
    expect(document.getElementById('node-count').textContent).toBe('Nodes: 0');
    expect(document.getElementById('connection-count').textContent).toBe('Connections: 0');
  });

  test('shows correct node count', () => {
    state.nodes.set('node1', {});
    state.nodes.set('node2', {});
    updateCounts();
    expect(document.getElementById('node-count').textContent).toBe('Nodes: 2');
  });

  test('shows correct connection count', () => {
    state.connections.push({ id: 'conn1' });
    state.connections.push({ id: 'conn2' });
    state.connections.push({ id: 'conn3' });
    updateCounts();
    expect(document.getElementById('connection-count').textContent).toBe('Connections: 3');
  });
});
