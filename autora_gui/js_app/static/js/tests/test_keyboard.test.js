/**
 * Tests for keyboard shortcut handling in app.js
 */

describe('handleKeyDown', () => {
  beforeEach(() => {
    state.nodes.clear();
    state.connections = [];
    state.selectedNode = null;
    state.selectedNodes.clear();
    state.selectedConnections.clear();
    state.connecting = null;
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  afterEach(() => {
    document.querySelectorAll('.workflow-node').forEach(el => el.remove());
  });

  test('ignores events from input elements', () => {
    const nodeId = createNode('theorists', { name: 'Test' }, 0, 0);
    state.selectedNodes.add(nodeId);

    const event = {
      key: 'Delete',
      target: { matches: (selector) => selector.includes('input') },
      preventDefault: jest.fn()
    };

    handleKeyDown(event);

    // Node should not be deleted
    expect(state.nodes.has(nodeId)).toBe(true);
  });

  test('ignores events from textarea elements', () => {
    const nodeId = createNode('theorists', { name: 'Test' }, 0, 0);
    state.selectedNodes.add(nodeId);

    const event = {
      key: 'Delete',
      target: { matches: (selector) => selector.includes('textarea') },
      preventDefault: jest.fn()
    };

    handleKeyDown(event);

    expect(state.nodes.has(nodeId)).toBe(true);
  });

  describe('Delete key', () => {
    test('deletes selected nodes', () => {
      const nodeId = createNode('theorists', { name: 'Test' }, 0, 0);
      state.selectedNodes.add(nodeId);

      const event = {
        key: 'Delete',
        target: { matches: () => false },
        preventDefault: jest.fn()
      };

      handleKeyDown(event);

      expect(state.nodes.has(nodeId)).toBe(false);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    test('deletes selected connections', () => {
      state.connections.push({ id: 'conn-1' });
      state.selectedConnections.add('conn-1');

      const event = {
        key: 'Delete',
        target: { matches: () => false },
        preventDefault: jest.fn()
      };

      handleKeyDown(event);

      expect(state.connections.length).toBe(0);
    });
  });

  describe('Backspace key', () => {
    test('deletes selected nodes', () => {
      const nodeId = createNode('theorists', { name: 'Test' }, 0, 0);
      state.selectedNodes.add(nodeId);

      const event = {
        key: 'Backspace',
        target: { matches: () => false },
        preventDefault: jest.fn()
      };

      handleKeyDown(event);

      expect(state.nodes.has(nodeId)).toBe(false);
    });
  });

  describe('Ctrl+A', () => {
    test('selects all nodes and connections', () => {
      const node1 = createNode('theorists', { name: 'Test1' }, 0, 0);
      const node2 = createNode('theorists', { name: 'Test2' }, 100, 0);
      state.connections.push({ id: 'conn-1' });

      const event = {
        key: 'a',
        ctrlKey: true,
        metaKey: false,
        target: { matches: () => false },
        preventDefault: jest.fn()
      };

      handleKeyDown(event);

      expect(state.selectedNodes.size).toBe(2);
      expect(state.selectedConnections.size).toBe(1);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    test('works with Cmd+A on Mac', () => {
      const node1 = createNode('theorists', { name: 'Test1' }, 0, 0);

      // Mock Mac platform
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true
      });

      const event = {
        key: 'a',
        ctrlKey: false,
        metaKey: true,
        target: { matches: () => false },
        preventDefault: jest.fn()
      };

      handleKeyDown(event);

      expect(state.selectedNodes.has(node1)).toBe(true);
    });
  });

  describe('Escape key', () => {
    test('cancels connection in progress', () => {
      state.connecting = { source: 'node-1' };

      const event = {
        key: 'Escape',
        target: { matches: () => false },
        preventDefault: jest.fn()
      };

      handleKeyDown(event);

      expect(state.connecting).toBeNull();
    });

    test('clears selection when no connection in progress', () => {
      const nodeId = createNode('theorists', { name: 'Test' }, 0, 0);
      state.selectedNode = nodeId;
      state.selectedNodes.add(nodeId);

      const event = {
        key: 'Escape',
        target: { matches: () => false },
        preventDefault: jest.fn()
      };

      handleKeyDown(event);

      expect(state.selectedNode).toBeNull();
      expect(state.selectedNodes.size).toBe(0);
    });

    test('deselects connections', () => {
      state.selectedConnection = 'conn-1';
      state.selectedConnections.add('conn-1');

      const event = {
        key: 'Escape',
        target: { matches: () => false },
        preventDefault: jest.fn()
      };

      handleKeyDown(event);

      expect(state.selectedConnection).toBeNull();
      expect(state.selectedConnections.size).toBe(0);
    });
  });
});
