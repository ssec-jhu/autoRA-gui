/**
 * Global State Management
 */

export const state = {
    components: {},           // Available components from API
    nodes: new Map(),         // Nodes on canvas: Map<nodeId, nodeData>
    connections: [],          // Connections between nodes
    selectedNode: null,       // Currently selected node ID
    selectedNodes: new Set(), // Multi-selected node IDs
    selectedConnection: null, // Selected connection ID
    selectedConnections: new Set(), // Multi-selected connection IDs
    draggedComponent: null,   // Component being dragged from palette
    connecting: null,         // Connection in progress {source: nodeId}
    zoom: 1,                  // Canvas zoom level
    pan: { x: 0, y: 0 }       // Canvas pan offset
};
