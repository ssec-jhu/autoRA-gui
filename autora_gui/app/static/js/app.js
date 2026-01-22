/**
 * AutoRA Workflow Builder - Main Application
 */

// ============================================================================
// State Management
// ============================================================================

const state = {
    components: {},          // Available components from API
    nodes: new Map(),        // Nodes on canvas: Map<nodeId, nodeData>
    connections: [],         // Connections between nodes
    selectedNode: null,      // Currently selected node (for properties panel)
    selectedNodes: new Set(), // Multiple selected nodes for group operations
    selectedConnection: null, // Currently selected connection (for properties panel)
    selectedConnections: new Set(), // Multiple selected connections for group operations
    draggedComponent: null,  // Component being dragged from palette
    connecting: null,        // Connection in progress
    zoom: 1,                 // Canvas zoom level
    pan: { x: 0, y: 0 },    // Canvas pan offset
};

// ============================================================================
// Utility Functions
// ============================================================================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getNodeTypeIcon(type) {
    const icons = {
        theorists: '🧠',
        experimentalists: '🔬',
        experiment_runners: '⚡',
        data_processors: '📊',
        models: '🤖',
        optimizers: '🎯',
        samplers: '🎲',
        analyzers: '📈'
    };
    return icons[type] || '📦';
}

function getNodeTypeClass(type) {
    // Convert type to a valid CSS class name
    return type.replace(/_/g, '-').toLowerCase();
}

function formatTypeName(type) {
    // Convert snake_case to Title Case with spaces
    return type
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function formatNodeName(name) {
    // Convert snake_case or kebab-case to Title Case
    return name
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function updateStatus(message) {
    document.getElementById('status-message').textContent = message;
}

function updateCounts() {
    document.getElementById('node-count').textContent = `Nodes: ${state.nodes.size}`;
    document.getElementById('connection-count').textContent = `Connections: ${state.connections.length}`;
}

// ============================================================================
// API Functions
// ============================================================================

async function loadComponents() {
    try {
        const response = await fetch('/api/components');
        state.components = await response.json();
        renderComponentPalette();
        updateStatus('Components loaded successfully');
    } catch (error) {
        console.error('Failed to load components:', error);
        updateStatus('Failed to load components - check if server is running');
        // Set empty components - API should be the source of truth
        state.components = {};
        renderComponentPalette();
    }
}

// ============================================================================
// Component Palette
// ============================================================================

function renderComponentPalette() {
    const container = document.getElementById('components-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sort types alphabetically for consistent ordering
    const sortedTypes = Object.keys(state.components).sort();
    
    for (const type of sortedTypes) {
        const components = state.components[type];
        if (!components || components.length === 0) continue;
        
        // Create section element
        const section = document.createElement('div');
        section.className = 'component-section';
        section.dataset.section = type;
        
        // Create section header
        const header = document.createElement('div');
        header.className = 'section-header';
        header.onclick = () => toggleSection(type);
        header.innerHTML = `
            <span class="section-icon">${getNodeTypeIcon(type)}</span>
            <span class="section-title">${formatTypeName(type)}</span>
            <span class="section-count">(${components.length})</span>
            <span class="section-toggle">▶</span>
        `;
        section.appendChild(header);
        
        // Create section content (collapsed by default)
        const content = document.createElement('div');
        content.className = 'section-content collapsed';
        content.id = `${type}-list`;
        
        // Add components to section
        components.forEach((component, index) => {
            const item = document.createElement('div');
            item.className = `component-item ${getNodeTypeClass(type)}`;
            item.draggable = true;
            item.dataset.type = type;
            item.dataset.index = index;

            // Use filename without .json extension as the display name
            const name = component._file?.replace('.json', '') || 
                        component.name ||
                        component.properties?.name?.default || 
                        'Unknown Component';
            
            const description = component.description ||
                               component.properties?.description?.default || 
                               '';

            item.innerHTML = `
                <span class="item-icon">${getNodeTypeIcon(type)}</span>
                <div class="item-info">
                    <div class="item-name">${formatNodeName(name)}</div>
                </div>
            `;

            item.title = description;

            // Drag events
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);

            content.appendChild(item);
        });
        
        section.appendChild(content);
        container.appendChild(section);
    }
}

function toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}-list`);
    const section = content.closest('.component-section');
    const toggle = section.querySelector('.section-toggle');
    
    content.classList.toggle('collapsed');
    toggle.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
}

// Make toggleSection available globally
window.toggleSection = toggleSection;

// ============================================================================
// Drag and Drop
// ============================================================================

function handleDragStart(e) {
    const item = e.target.closest('.component-item');
    const type = item.dataset.type;
    const index = parseInt(item.dataset.index);
    
    state.draggedComponent = {
        type: type,
        data: state.components[type][index]
    };

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', JSON.stringify(state.draggedComponent));
    
    item.style.opacity = '0.5';
    updateStatus(`Dragging ${state.draggedComponent.data.properties?.name?.default || 'component'}...`);
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
    state.draggedComponent = null;
}

function handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
}

function handleCanvasDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleCanvasDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!state.draggedComponent) return;

    const canvas = document.getElementById('workflow-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom - state.pan.x;
    const y = (e.clientY - rect.top) / state.zoom - state.pan.y;

    createNode(state.draggedComponent.type, state.draggedComponent.data, x, y);
    
    // Hide hint
    document.getElementById('canvas-hint')?.classList.add('hidden');
    
    updateStatus('Node added to workflow');
}

// ============================================================================
// Node Management
// ============================================================================

function createNode(type, componentData, x, y) {
    const nodeId = generateUUID();
    
    const nodeData = {
        id: nodeId,
        type: type,
        componentData: componentData,
        x: x,
        y: y,
        parameters: extractParameters(componentData)
    };

    state.nodes.set(nodeId, nodeData);
    
    renderNode(nodeData);
    updateCounts();
    
    return nodeId;
}

function extractParameters(componentData) {
    const params = {};
    
    // Extract parameters from the parameters array (new format)
    if (componentData.parameters && Array.isArray(componentData.parameters)) {
        for (const param of componentData.parameters) {
            if (param.name) {
                params[param.name] = param.default !== null && param.default !== undefined ? param.default : '';
            }
        }
    }
    
    // Also keep name and description editable
    params.name = componentData.name || '';
    params.description = componentData.description || '';
    
    return params;
}

function renderNode(nodeData) {
    const template = document.getElementById('node-template');
    const node = template.content.cloneNode(true).querySelector('.workflow-node');
    
    // Use filename without .json extension as the display name
    const name = nodeData.componentData._file?.replace('.json', '') || 
                nodeData.componentData.properties?.name?.default || 
                'Unknown';
    
    node.dataset.nodeId = nodeData.id;
    node.className = `workflow-node ${getNodeTypeClass(nodeData.type)} new`;
    node.style.left = `${nodeData.x}px`;
    node.style.top = `${nodeData.y}px`;
    
    node.querySelector('.node-icon').textContent = getNodeTypeIcon(nodeData.type);
    node.querySelector('.node-title').textContent = formatNodeName(name);
    node.querySelector('.node-type').textContent = ''; // Remove type text from body
    
    // Node events
    node.addEventListener('mousedown', handleNodeMouseDown);
    node.addEventListener('click', handleNodeClick);
    
    // Delete button
    node.querySelector('.node-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNode(nodeData.id);
    });
    
    // Port events for connections (click-to-click)
    const inputPort = node.querySelector('.port-input');
    const outputPort = node.querySelector('.port-output');
    
    inputPort.addEventListener('click', (e) => handlePortClick(e, nodeData.id, 'input'));
    outputPort.addEventListener('click', (e) => handlePortClick(e, nodeData.id, 'output'));
    
    document.getElementById('workflow-canvas').appendChild(node);
    
    // Remove animation class after animation completes
    setTimeout(() => node.classList.remove('new'), 200);
}

function deleteNode(nodeId) {
    // Remove connections involving this node
    state.connections = state.connections.filter(conn => {
        if (conn.source === nodeId || conn.target === nodeId) {
            removeConnectionLine(conn.id);
            return false;
        }
        return true;
    });
    
    // Remove node from DOM
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (nodeElement) {
        nodeElement.remove();
    }
    
    // Remove from state
    state.nodes.delete(nodeId);
    
    // Clear selection if this was selected
    if (state.selectedNode === nodeId) {
        state.selectedNode = null;
        renderPropertiesPanel(null);
    }
    
    updateCounts();
    updateStatus('Node deleted');
    
    // Show hint if no nodes left
    if (state.nodes.size === 0) {
        document.getElementById('canvas-hint')?.classList.remove('hidden');
    }
}

// ============================================================================
// Node Dragging
// ============================================================================

let isDraggingNode = false;
let dragOffset = { x: 0, y: 0 };
let draggedNodeId = null;
let dragStartPositions = new Map(); // Store initial positions of all selected nodes

function handleNodeMouseDown(e) {
    if (e.target.closest('.node-port') || e.target.closest('.node-delete')) return;
    
    const node = e.target.closest('.workflow-node');
    if (!node) return;
    
    const nodeId = node.dataset.nodeId;
    
    // If this node is not in the selection, select only this node (unless Shift is held)
    if (!state.selectedNodes.has(nodeId) && !e.shiftKey) {
        state.selectedNodes.clear();
        document.querySelectorAll('.workflow-node.selected').forEach(n => {
            n.classList.remove('selected');
        });
    }
    
    // Add this node to selection
    state.selectedNodes.add(nodeId);
    node.classList.add('selected');
    
    isDraggingNode = true;
    draggedNodeId = nodeId;
    
    const rect = node.getBoundingClientRect();
    dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    // Store initial positions of all selected nodes for group dragging
    dragStartPositions.clear();
    state.selectedNodes.forEach(id => {
        const nodeData = state.nodes.get(id);
        if (nodeData) {
            dragStartPositions.set(id, { x: nodeData.x, y: nodeData.y });
        }
    });
    
    // Also store the initial position of the dragged node for delta calculation
    const draggedNodeData = state.nodes.get(nodeId);
    dragStartPositions.set('_dragStart', { 
        x: draggedNodeData ? draggedNodeData.x : 0, 
        y: draggedNodeData ? draggedNodeData.y : 0 
    });
    
    // Raise all selected nodes
    state.selectedNodes.forEach(id => {
        const n = document.querySelector(`[data-node-id="${id}"]`);
        if (n) n.style.zIndex = '100';
    });
    
    document.addEventListener('mousemove', handleNodeDrag);
    document.addEventListener('mouseup', handleNodeDragEnd);
}

function handleNodeDrag(e) {
    if (!isDraggingNode || !draggedNodeId) return;
    
    const canvas = document.getElementById('workflow-canvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate new position of the dragged node
    const newX = (e.clientX - canvasRect.left - dragOffset.x) / state.zoom;
    const newY = (e.clientY - canvasRect.top - dragOffset.y) / state.zoom;
    
    // Calculate delta from the drag start position
    const dragStart = dragStartPositions.get('_dragStart');
    const deltaX = newX - dragStart.x;
    const deltaY = newY - dragStart.y;
    
    // Move all selected nodes by the delta
    state.selectedNodes.forEach(nodeId => {
        const startPos = dragStartPositions.get(nodeId);
        if (!startPos) return;
        
        const node = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (node) {
            const x = Math.max(0, startPos.x + deltaX);
            const y = Math.max(0, startPos.y + deltaY);
            
            node.style.left = `${x}px`;
            node.style.top = `${y}px`;
            
            // Update state
            const nodeData = state.nodes.get(nodeId);
            if (nodeData) {
                nodeData.x = x;
                nodeData.y = y;
            }
        }
    });
    
    // Update connections
    updateConnectionLines();
}

function handleNodeDragEnd(e) {
    // Reset z-index for all selected nodes
    state.selectedNodes.forEach(id => {
        const node = document.querySelector(`[data-node-id="${id}"]`);
        if (node) node.style.zIndex = '10';
    });
    
    isDraggingNode = false;
    draggedNodeId = null;
    dragStartPositions.clear();
    
    document.removeEventListener('mousemove', handleNodeDrag);
    document.removeEventListener('mouseup', handleNodeDragEnd);
}

// ============================================================================
// Node Selection
// ============================================================================

function handleNodeClick(e) {
    if (e.target.closest('.node-port') || e.target.closest('.node-delete')) return;
    
    const node = e.target.closest('.workflow-node');
    if (!node) return;
    
    selectNode(node.dataset.nodeId, e.shiftKey);
}

function selectNode(nodeId, addToSelection = false) {
    if (!addToSelection) {
        // Deselect previous
        document.querySelectorAll('.workflow-node.selected').forEach(n => {
            n.classList.remove('selected');
        });
        state.selectedNodes.clear();
    }
    
    state.selectedNode = nodeId;
    state.selectedNodes.add(nodeId);
    
    const node = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (node) {
        node.classList.add('selected');
    }
    
    const nodeData = state.nodes.get(nodeId);
    renderPropertiesPanel(nodeData);
}

function selectAllNodes() {
    // Select all nodes
    document.querySelectorAll('.workflow-node').forEach(n => {
        n.classList.add('selected');
    });
    state.selectedNodes.clear();
    state.nodes.forEach((nodeData, nodeId) => {
        state.selectedNodes.add(nodeId);
    });
    
    // Select all connections
    document.querySelectorAll('.connection-line').forEach(c => {
        c.classList.add('selected');
    });
    state.selectedConnections.clear();
    state.connections.forEach(conn => {
        state.selectedConnections.add(conn.id);
    });
    
    // Set the first node as the "main" selected node for properties panel
    const firstNodeId = state.nodes.keys().next().value;
    if (firstNodeId) {
        state.selectedNode = firstNodeId;
    }
    
    updateStatus(`Selected all: ${state.selectedNodes.size} nodes, ${state.selectedConnections.size} connections.`);
}

function handleCanvasClick(e) {
    if (e.target.id === 'workflow-canvas' || e.target.classList.contains('canvas-hint')) {
        // Only deselect if not just finished a rectangle selection
        if (!justFinishedSelecting) {
            // Clicked on canvas background - deselect nodes and connections
            document.querySelectorAll('.workflow-node.selected').forEach(n => {
                n.classList.remove('selected');
            });
            document.querySelectorAll('.connection-line.selected').forEach(c => {
                c.classList.remove('selected');
            });
            state.selectedNode = null;
            state.selectedNodes.clear();
            state.selectedConnection = null;
            state.selectedConnections.clear();
            renderPropertiesPanel(null);
            updateStatus('Ready');
        }
        justFinishedSelecting = false;
    }
}

// ============================================================================
// Rectangle Selection (Marquee)
// ============================================================================

let isSelecting = false;
let justFinishedSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionRect = null;

function handleCanvasMouseDown(e) {
    // Only start selection if clicking directly on canvas (not on a node)
    if (e.target.id !== 'workflow-canvas' && !e.target.classList.contains('canvas-hint')) return;
    
    const canvas = document.getElementById('workflow-canvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    isSelecting = true;
    selectionStart = {
        x: (e.clientX - canvasRect.left) / state.zoom,
        y: (e.clientY - canvasRect.top) / state.zoom
    };
    
    // Create selection rectangle element
    selectionRect = document.createElement('div');
    selectionRect.className = 'selection-rect';
    selectionRect.style.left = `${selectionStart.x}px`;
    selectionRect.style.top = `${selectionStart.y}px`;
    selectionRect.style.width = '0px';
    selectionRect.style.height = '0px';
    canvas.appendChild(selectionRect);
    
    // If not holding Shift, clear previous selection
    if (!e.shiftKey) {
        document.querySelectorAll('.workflow-node.selected').forEach(n => {
            n.classList.remove('selected');
        });
        state.selectedNodes.clear();
    }
    
    document.addEventListener('mousemove', handleSelectionDrag);
    document.addEventListener('mouseup', handleSelectionEnd);
}

function handleSelectionDrag(e) {
    if (!isSelecting || !selectionRect) return;
    
    const canvas = document.getElementById('workflow-canvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    const currentX = (e.clientX - canvasRect.left) / state.zoom;
    const currentY = (e.clientY - canvasRect.top) / state.zoom;
    
    // Calculate rectangle dimensions (handle dragging in any direction)
    const left = Math.min(selectionStart.x, currentX);
    const top = Math.min(selectionStart.y, currentY);
    const width = Math.abs(currentX - selectionStart.x);
    const height = Math.abs(currentY - selectionStart.y);
    
    selectionRect.style.left = `${left}px`;
    selectionRect.style.top = `${top}px`;
    selectionRect.style.width = `${width}px`;
    selectionRect.style.height = `${height}px`;
    
    // Highlight nodes that intersect with the selection rectangle
    const selectBounds = {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height
    };
    
    document.querySelectorAll('.workflow-node').forEach(node => {
        const nodeId = node.dataset.nodeId;
        const nodeData = state.nodes.get(nodeId);
        if (!nodeData) return;
        
        const nodeBounds = {
            left: nodeData.x,
            top: nodeData.y,
            right: nodeData.x + node.offsetWidth,
            bottom: nodeData.y + node.offsetHeight
        };
        
        // Check if rectangles intersect
        const intersects = !(selectBounds.right < nodeBounds.left || 
                            selectBounds.left > nodeBounds.right || 
                            selectBounds.bottom < nodeBounds.top || 
                            selectBounds.top > nodeBounds.bottom);
        
        if (intersects) {
            node.classList.add('selected');
            state.selectedNodes.add(nodeId);
        } else if (!e.shiftKey) {
            // Only remove selection if not holding Shift
            node.classList.remove('selected');
            state.selectedNodes.delete(nodeId);
        }
    });
    
    // Also check connections for intersection
    const svg = document.getElementById('connections-svg');
    const svgRect = svg.getBoundingClientRect();
    
    document.querySelectorAll('.connection-line').forEach(path => {
        const connectionId = path.dataset.connectionId;
        const connection = state.connections.find(c => c.id === connectionId);
        if (!connection) return;
        
        // Get the bounding box of the path
        const pathBBox = path.getBBox();
        
        // Convert to canvas coordinates (accounting for zoom)
        const pathBounds = {
            left: pathBBox.x,
            top: pathBBox.y,
            right: pathBBox.x + pathBBox.width,
            bottom: pathBBox.y + pathBBox.height
        };
        
        // Check if rectangles intersect
        const intersects = !(selectBounds.right < pathBounds.left || 
                            selectBounds.left > pathBounds.right || 
                            selectBounds.bottom < pathBounds.top || 
                            selectBounds.top > pathBounds.bottom);
        
        if (intersects) {
            path.classList.add('selected');
            state.selectedConnections.add(connectionId);
        } else if (!e.shiftKey) {
            path.classList.remove('selected');
            state.selectedConnections.delete(connectionId);
        }
    });
}

function handleSelectionEnd(e) {
    const hadSelection = selectionRect !== null;
    
    if (selectionRect) {
        selectionRect.remove();
        selectionRect = null;
    }
    
    isSelecting = false;
    
    // Set flag to prevent click event from clearing selection
    if (hadSelection && (state.selectedNodes.size > 0 || state.selectedConnections.size > 0)) {
        justFinishedSelecting = true;
    }
    
    document.removeEventListener('mousemove', handleSelectionDrag);
    document.removeEventListener('mouseup', handleSelectionEnd);
    
    const nodeCount = state.selectedNodes.size;
    const connCount = state.selectedConnections.size;
    
    if (nodeCount > 0 || connCount > 0) {
        // Set the first selected node as the "main" selected node for properties panel
        if (nodeCount > 0) {
            const firstNodeId = state.selectedNodes.values().next().value;
            state.selectedNode = firstNodeId;
            const nodeData = state.nodes.get(firstNodeId);
            renderPropertiesPanel(nodeData);
        }
        
        let msg = 'Selected ';
        if (nodeCount > 0) msg += `${nodeCount} node(s)`;
        if (nodeCount > 0 && connCount > 0) msg += ' and ';
        if (connCount > 0) msg += `${connCount} connection(s)`;
        msg += '. Drag nodes to move, Delete to remove.';
        updateStatus(msg);
    }
}

// ============================================================================
// Connections (Click-to-Click)
// ============================================================================

let tempLine = null;
let tempLineStart = null;

function handlePortClick(e, nodeId, portType) {
    e.stopPropagation();
    e.preventDefault();
    
    const port = e.target.closest('.node-port');
    
    // If we're not currently connecting, start a new connection from output port
    if (!state.connecting) {
        if (portType !== 'output') {
            updateStatus('Click on an output port (right side) to start a connection');
            return;
        }
        
        // Start connection
        const portRect = port.getBoundingClientRect();
        const svg = document.getElementById('connections-svg');
        const svgRect = svg.getBoundingClientRect();
        
        tempLineStart = {
            nodeId: nodeId,
            x: portRect.left + portRect.width / 2 - svgRect.left,
            y: portRect.top + portRect.height / 2 - svgRect.top
        };
        
        state.connecting = { source: nodeId };
        port.classList.add('connecting');
        
        // Highlight all valid input ports
        document.querySelectorAll('.workflow-node').forEach(node => {
            if (node.dataset.nodeId !== nodeId) {
                node.querySelector('.port-input')?.classList.add('valid-target');
            }
        });
        
        // Start following mouse
        document.addEventListener('mousemove', handleConnectionMouseMove);
        document.addEventListener('click', handleConnectionCancel, true);
        document.addEventListener('keydown', handleConnectionEscape);
        
        updateStatus('Click on an input port (left side) of another node to complete the connection. Press Escape to cancel.');
        
    } else {
        // We're connecting - check if this is a valid target (input port)
        if (portType !== 'input') {
            updateStatus('Click on an input port (left side) to complete the connection');
            return;
        }
        
        // Can't connect to self
        if (nodeId === state.connecting.source) {
            updateStatus('Cannot connect a node to itself');
            return;
        }
        
        // Check if connection already exists
        const exists = state.connections.some(c => 
            c.source === state.connecting.source && c.target === nodeId
        );
        
        if (exists) {
            updateStatus('Connection already exists');
            cancelConnection();
            return;
        }
        
        // Create the connection
        createConnection(state.connecting.source, nodeId);
        cancelConnection();
    }
}

function handleConnectionMouseMove(e) {
    if (!tempLineStart) return;
    
    const svg = document.getElementById('connections-svg');
    const svgRect = svg.getBoundingClientRect();
    
    const endX = e.clientX - svgRect.left;
    const endY = e.clientY - svgRect.top;
    
    if (!tempLine) {
        tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempLine.classList.add('connection-line', 'temp');
        addArrowMarker(svg);
        tempLine.setAttribute('marker-end', 'url(#arrowhead-temp)');
        svg.appendChild(tempLine);
    }
    
    const path = createConnectionPath(tempLineStart.x, tempLineStart.y, endX, endY);
    tempLine.setAttribute('d', path);
}

function handleConnectionCancel(e) {
    // Only cancel if clicking outside a port
    const port = e.target.closest('.node-port');
    if (!port) {
        cancelConnection();
    }
}

function handleConnectionEscape(e) {
    if (e.key === 'Escape') {
        cancelConnection();
    }
}

function cancelConnection() {
    document.removeEventListener('mousemove', handleConnectionMouseMove);
    document.removeEventListener('click', handleConnectionCancel, true);
    document.removeEventListener('keydown', handleConnectionEscape);
    
    // Remove temp line
    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }
    
    // Reset port styling
    document.querySelectorAll('.node-port.connecting').forEach(p => {
        p.classList.remove('connecting');
    });
    document.querySelectorAll('.node-port.valid-target').forEach(p => {
        p.classList.remove('valid-target');
    });
    
    tempLineStart = null;
    state.connecting = null;
    updateStatus('Ready');
}

function createConnection(sourceId, targetId) {
    const connectionId = generateUUID();
    
    const connection = {
        id: connectionId,
        source: sourceId,
        target: targetId,
        controlPoints: null  // User-defined control points {cp1: {x, y}, cp2: {x, y}}
    };
    
    state.connections.push(connection);
    renderConnectionLine(connection);
    updateCounts();
    updateStatus('Nodes connected');
}

function renderConnectionLine(connection) {
    const svg = document.getElementById('connections-svg');
    const sourceNode = document.querySelector(`[data-node-id="${connection.source}"]`);
    const targetNode = document.querySelector(`[data-node-id="${connection.target}"]`);
    
    if (!sourceNode || !targetNode) return;
    
    const sourcePort = sourceNode.querySelector('.port-output');
    
    const svgRect = svg.getBoundingClientRect();
    const sourceRect = sourcePort.getBoundingClientRect();
    const targetNodeRect = targetNode.getBoundingClientRect();
    
    // Start from center of output port
    const startX = sourceRect.left + sourceRect.width / 2 - svgRect.left;
    const startY = sourceRect.top + sourceRect.height / 2 - svgRect.top;
    
    // End at left border of target node, vertically centered
    const endX = targetNodeRect.left - svgRect.left;
    const endY = targetNodeRect.top + targetNodeRect.height / 2 - svgRect.top;
    
    // Create or update path
    let path = svg.querySelector(`[data-connection-id="${connection.id}"]`);
    if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('connection-line');
        path.dataset.connectionId = connection.id;
        
        // Click to select, double-click to delete
        path.addEventListener('click', (e) => {
            e.stopPropagation();
            selectConnection(connection.id);
        });
        path.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            deleteConnection(connection.id);
        });
        svg.appendChild(path);
    }
    
    // Calculate default control points if not set
    const controlPoints = connection.controlPoints || getDefaultControlPoints(startX, startY, endX, endY);
    
    const pathD = `M ${startX} ${startY} C ${controlPoints.cp1.x} ${controlPoints.cp1.y}, ${controlPoints.cp2.x} ${controlPoints.cp2.y}, ${endX} ${endY}`;
    path.setAttribute('d', pathD);
    
    // Add arrow marker
    addArrowMarker(svg);
    path.setAttribute('marker-end', 'url(#arrowhead)');
    
    // Render control point handles if connection is selected
    renderControlPointHandles(connection, startX, startY, endX, endY, controlPoints, svg, svgRect);
}

function getDefaultControlPoints(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    // Normal case: target is to the right of source
    if (dx > 50) {
        const cp = Math.min(Math.abs(dx) * 0.5, 100);
        return {
            cp1: { x: x1 + cp, y: y1 },
            cp2: { x: x2 - cp, y: y2 }
        };
    }
    
    // Target is to the left or very close - route around the nodes
    const offset = 80;
    const verticalOffset = Math.max(60, Math.abs(dy) * 0.3);
    const goUp = dy <= 0;
    const curveDirection = goUp ? -1 : 1;
    const midY = (y1 + y2) / 2 + curveDirection * verticalOffset;
    
    return {
        cp1: { x: x1 + offset, y: midY },
        cp2: { x: x2 - offset, y: midY }
    };
}

function renderControlPointHandles(connection, startX, startY, endX, endY, controlPoints, svg, svgRect) {
    // Remove existing handles for this connection
    svg.querySelectorAll(`[data-cp-connection="${connection.id}"]`).forEach(el => el.remove());
    
    // Only show handles if this connection is selected
    if (state.selectedConnection !== connection.id) return;
    
    // Create control point 1 handle
    createControlPointHandle(svg, svgRect, connection, controlPoints.cp1, 'cp1', startX, startY);
    
    // Create control point 2 handle  
    createControlPointHandle(svg, svgRect, connection, controlPoints.cp2, 'cp2', endX, endY);
    
    // Draw guide lines from endpoints to control points
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', startX);
    line1.setAttribute('y1', startY);
    line1.setAttribute('x2', controlPoints.cp1.x);
    line1.setAttribute('y2', controlPoints.cp1.y);
    line1.classList.add('control-line');
    line1.dataset.cpConnection = connection.id;
    svg.appendChild(line1);
    
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', endX);
    line2.setAttribute('y1', endY);
    line2.setAttribute('x2', controlPoints.cp2.x);
    line2.setAttribute('y2', controlPoints.cp2.y);
    line2.classList.add('control-line');
    line2.dataset.cpConnection = connection.id;
    svg.appendChild(line2);
}

function createControlPointHandle(svg, svgRect, connection, point, cpName, anchorX, anchorY) {
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.setAttribute('cx', point.x);
    handle.setAttribute('cy', point.y);
    handle.setAttribute('r', '8');
    handle.classList.add('waypoint-handle');
    handle.dataset.cpConnection = connection.id;
    handle.dataset.cpName = cpName;
    
    // Make handle draggable
    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startDraggingControlPoint(e, connection, cpName, svg, svgRect);
    });
    
    svg.appendChild(handle);
}

let draggingControlPoint = null;

function startDraggingControlPoint(e, connection, cpName, svg, svgRect) {
    // Get fresh bounding rect
    const freshSvgRect = svg.getBoundingClientRect();
    
    draggingControlPoint = {
        connection: connection,
        cpName: cpName,
        svg: svg,
        svgRect: freshSvgRect
    };
    
    document.addEventListener('mousemove', handleControlPointDrag);
    document.addEventListener('mouseup', stopDraggingControlPoint);
}

function handleControlPointDrag(e) {
    if (!draggingControlPoint) return;
    
    const { connection, cpName, svg, svgRect } = draggingControlPoint;
    
    // Calculate new position
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;
    
    // Get source/target positions for default control points
    const sourceNode = document.querySelector(`[data-node-id="${connection.source}"]`);
    const targetNode = document.querySelector(`[data-node-id="${connection.target}"]`);
    if (!sourceNode || !targetNode) return;
    
    const sourcePort = sourceNode.querySelector('.port-output');
    const sourceRect = sourcePort.getBoundingClientRect();
    const targetNodeRect = targetNode.getBoundingClientRect();
    
    const startX = sourceRect.left + sourceRect.width / 2 - svgRect.left;
    const startY = sourceRect.top + sourceRect.height / 2 - svgRect.top;
    const endX = targetNodeRect.left - svgRect.left;
    const endY = targetNodeRect.top + targetNodeRect.height / 2 - svgRect.top;
    
    // Initialize control points if not set
    if (!connection.controlPoints) {
        connection.controlPoints = getDefaultControlPoints(startX, startY, endX, endY);
    }
    
    // Update the specific control point
    connection.controlPoints[cpName] = { x, y };
    
    // Re-render the connection
    renderConnectionLine(connection);
}

function stopDraggingControlPoint() {
    draggingControlPoint = null;
    document.removeEventListener('mousemove', handleControlPointDrag);
    document.removeEventListener('mouseup', stopDraggingControlPoint);
    updateStatus('Control point updated');
}

function addArrowMarker(svg) {
    if (svg.querySelector('#arrowhead')) return;
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <marker id="arrowhead" markerWidth="16" markerHeight="12" 
                refX="14" refY="6" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 16 6 L 0 12 L 4 6 Z" fill="#6366f1" />
        </marker>
        <marker id="arrowhead-temp" markerWidth="14" markerHeight="10" 
                refX="12" refY="5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 14 5 L 0 10 L 3 5 Z" fill="#808090" />
        </marker>
    `;
    svg.insertBefore(defs, svg.firstChild);
}

function updateConnectionLines() {
    state.connections.forEach(connection => {
        renderConnectionLine(connection);
    });
}

function selectConnection(connectionId) {
    // If clicking on the already selected connection, deselect it (toggle off)
    if (state.selectedConnection === connectionId) {
        deselectConnection();
        renderPropertiesPanel(null);
        updateStatus('Connection deselected');
        return;
    }
    
    // Deselect all nodes
    document.querySelectorAll('.workflow-node.selected').forEach(n => {
        n.classList.remove('selected');
    });
    state.selectedNode = null;
    
    // Remove all waypoint handles first
    document.querySelectorAll('.waypoint-handle').forEach(h => h.remove());
    
    // Deselect all connections
    document.querySelectorAll('.connection-line.selected').forEach(c => {
        c.classList.remove('selected');
    });
    
    // Select this connection
    state.selectedConnection = connectionId;
    const path = document.querySelector(`[data-connection-id="${connectionId}"]`);
    if (path) {
        path.classList.add('selected');
    }
    
    // Render waypoint handle for the selected connection
    const connection = state.connections.find(c => c.id === connectionId);
    if (connection) {
        renderConnectionLine(connection);
    }
    
    renderPropertiesPanel(null);
    updateStatus('Connection selected. Drag the yellow dot to reshape, Delete to remove.');
}

function deselectConnection() {
    const previousSelected = state.selectedConnection;
    document.querySelectorAll('.connection-line.selected').forEach(c => {
        c.classList.remove('selected');
    });
    state.selectedConnection = null;
    
    // Remove control point handles and lines
    if (previousSelected) {
        document.querySelectorAll(`[data-cp-connection="${previousSelected}"]`).forEach(el => el.remove());
        document.querySelectorAll('.waypoint-handle').forEach(h => h.remove());
        document.querySelectorAll('.control-line').forEach(l => l.remove());
    }
}

function deleteConnection(connectionId) {
    state.connections = state.connections.filter(c => c.id !== connectionId);
    removeConnectionLine(connectionId);
    state.selectedConnection = null;
    updateCounts();
    updateStatus('Connection removed');
}

function removeConnectionLine(connectionId) {
    const path = document.querySelector(`[data-connection-id="${connectionId}"]`);
    if (path) path.remove();
    // Also remove control point handles and lines
    document.querySelectorAll(`[data-cp-connection="${connectionId}"]`).forEach(el => el.remove());
}

// ============================================================================
// Properties Panel
// ============================================================================

function renderPropertiesPanel(nodeData) {
    const panel = document.getElementById('properties-panel');
    
    if (!nodeData) {
        panel.innerHTML = `
            <div class="no-selection">
                <p>Select a node to view and edit its properties</p>
            </div>
        `;
        return;
    }
    
    const componentData = nodeData.componentData;
    // Read name and description directly from the Protocol instance data
    const name = componentData.name || 'Unknown';
    const description = componentData.description || 'No description available';
    
    let html = `
        <div class="properties-content">
            <div class="property-section">
                <div class="property-section-title">General</div>
                <div class="property-group">
                    <label class="property-label">Name</label>
                    <input type="text" class="property-input" value="${escapeHtml(name)}" data-param="name">
                </div>
                <div class="property-group">
                    <label class="property-label">Description</label>
                    <textarea class="property-input" rows="3" data-param="description">${escapeHtml(description)}</textarea>
                </div>
                <div class="property-group">
                    <label class="property-label">Type</label>
                    <input type="text" class="property-input" value="${componentData.protocolType || nodeData.type.replace('_', ' ')}" disabled>
                </div>
            </div>
    `;
    
    // Render parameters from the parameters array
    if (componentData.parameters && Array.isArray(componentData.parameters) && componentData.parameters.length > 0) {
        html += `
            <div class="property-section">
                <div class="property-section-title">Parameters</div>
        `;
        
        for (const param of componentData.parameters) {
            const paramName = param.name || 'unknown';
            const paramDesc = param.description || '';
            const paramDefault = param.default !== null && param.default !== undefined ? param.default : '';
            const paramType = param.datatype || 'string';
            const validValues = param.validValues;
            
            html += `
                <div class="property-group">
                    <label class="property-label">${formatNodeName(paramName)}</label>
                    ${renderParameterInput(paramName, paramType, nodeData.parameters[paramName] ?? paramDefault, validValues)}
                    ${paramDesc ? `<div class="property-description">${escapeHtml(paramDesc)}</div>` : ''}
                </div>
            `;
        }
        
        html += `</div>`;
    }
    
    // Render inputDataType if available
    if (componentData.inputDataType && Array.isArray(componentData.inputDataType) && componentData.inputDataType.length > 0) {
        html += `
            <div class="property-section">
                <div class="property-section-title">Input Data</div>
        `;
        
        for (const input of componentData.inputDataType) {
            html += `
                <div class="property-group">
                    <label class="property-label">${input.name}</label>
                    <input type="text" class="property-input" value="${input.datatype}" disabled>
                    ${input.description ? `<div class="property-description">${escapeHtml(input.description)}</div>` : ''}
                </div>
            `;
        }
        
        html += `</div>`;
    }
    
    // Render outputDataType if available
    if (componentData.outputDataType && Array.isArray(componentData.outputDataType) && componentData.outputDataType.length > 0) {
        html += `
            <div class="property-section">
                <div class="property-section-title">Output Data</div>
        `;
        
        for (const output of componentData.outputDataType) {
            html += `
                <div class="property-group">
                    <label class="property-label">${output.name}</label>
                    <input type="text" class="property-input" value="${output.datatype}" disabled>
                    ${output.description ? `<div class="property-description">${escapeHtml(output.description)}</div>` : ''}
                </div>
            `;
        }
        
        html += `</div>`;
    }
    
    html += `</div>`;
    
    panel.innerHTML = html;
    
    // Add event listeners for property changes
    panel.querySelectorAll('.property-input:not([disabled]), .property-select').forEach(input => {
        input.addEventListener('change', (e) => {
            const param = e.target.dataset.param;
            const value = e.target.value;
            if (param && nodeData.parameters) {
                nodeData.parameters[param] = value;
                updateStatus(`Updated ${param}`);
            }
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderParameterInput(key, type, value, validValues) {
    // If there are valid values, render as select
    if (validValues && Array.isArray(validValues) && validValues.length > 0) {
        const options = validValues.map(v => 
            `<option value="${v}" ${v === value ? 'selected' : ''}>${v}</option>`
        ).join('');
        return `<select class="property-select" data-param="${key}">${options}</select>`;
    }
    
    // Based on datatype
    if (type === 'integer') {
        return `<input type="number" class="property-input" value="${value}" data-param="${key}" step="1">`;
    }
    
    if (type === 'real') {
        return `<input type="number" class="property-input" value="${value}" data-param="${key}" step="any">`;
    }
    
    if (type === 'boolean') {
        return `
            <select class="property-select" data-param="${key}">
                <option value="true" ${value === true || value === 'true' ? 'selected' : ''}>True</option>
                <option value="false" ${value === false || value === 'false' ? 'selected' : ''}>False</option>
            </select>
        `;
    }
    
    if (type === 'list' || type === 'dict') {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
        return `<input type="text" class="property-input" value="${escapeHtml(String(displayValue))}" data-param="${key}" placeholder="JSON format">`;
    }
    
    // Default: string input
    return `<input type="text" class="property-input" value="${escapeHtml(String(value))}" data-param="${key}">`;
}

// ============================================================================
// Zoom Controls
// ============================================================================

function handleZoomIn() {
    state.zoom = Math.min(state.zoom + 0.1, 2);
    applyZoom();
}

function handleZoomOut() {
    state.zoom = Math.max(state.zoom - 0.1, 0.5);
    applyZoom();
}

function handleZoomReset() {
    state.zoom = 1;
    applyZoom();
}

function applyZoom() {
    const canvas = document.getElementById('workflow-canvas');
    canvas.style.transform = `scale(${state.zoom})`;
    canvas.style.transformOrigin = 'top left';
    document.getElementById('zoom-level').textContent = `${Math.round(state.zoom * 100)}%`;
    updateConnectionLines();
}

// ============================================================================
// Toolbar Actions
// ============================================================================

async function saveWorkflow() {
    const workflowData = {
        name: 'workflow',
        nodes: Array.from(state.nodes.values()).map(node => ({
            id: node.id,
            type: node.type,
            x: node.x,
            y: node.y,
            componentFile: node.componentData._file,
            componentType: node.componentData._type,
            parameters: node.parameters
        })),
        connections: state.connections.map(c => ({
            id: c.id,
            source: c.source,
            target: c.target,
            controlPoints: c.controlPoints || null
        }))
    };
    
    // Try to use the modern File System Access API for native save dialog
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'my_workflow.json',
                types: [{
                    description: 'JSON Workflow Files',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            
            const writable = await handle.createWritable();
            workflowData.name = handle.name.replace('.json', '');
            await writable.write(JSON.stringify(workflowData, null, 2));
            await writable.close();
            
            updateStatus(`Workflow saved as: ${handle.name}`);
            
            // Also save a copy to server's JSON/workflows folder
            const filename = handle.name.endsWith('.json') ? handle.name : `${handle.name}.json`;
            try {
                await fetch(`/api/workflow/save/${encodeURIComponent(filename)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(workflowData)
                });
            } catch (e) {
                // Server save is optional, don't show error
                console.log('Could not save to server folder:', e);
            }
            
            return;
        } catch (error) {
            if (error.name === 'AbortError') {
                updateStatus('Save cancelled');
                return;
            }
            console.error('File System API failed:', error);
            // Fall through to legacy method
        }
    }
    
    // Fallback for browsers without File System Access API
    const defaultName = 'my_workflow';
    const filename = prompt('Enter workflow name:', defaultName);
    
    if (!filename) {
        updateStatus('Save cancelled');
        return;
    }
    
    const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
    workflowData.name = filename.replace('.json', '');
    
    try {
        const response = await fetch(`/api/workflow/save/${encodeURIComponent(finalFilename)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workflowData)
        });
        const result = await response.json();
        if (result.success) {
            updateStatus(`Workflow saved as: ${result.filename}`);
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        console.error('Save failed:', error);
        updateStatus('Failed to save workflow');
        downloadWorkflow(workflowData, finalFilename);
    }
}

function downloadWorkflow(workflowData, filename = 'workflow.json') {
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    updateStatus('Workflow downloaded');
}

async function loadWorkflow() {
    // Try to use the modern File System Access API for native open dialog
    if ('showOpenFilePicker' in window) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'JSON Workflow Files',
                    accept: { 'application/json': ['.json'] }
                }],
                multiple: false
            });
            
            const file = await handle.getFile();
            const content = await file.text();
            const workflowData = JSON.parse(content);
            
            applyWorkflowData(workflowData);
            updateStatus(`Workflow loaded: ${handle.name}`);
            return;
        } catch (error) {
            if (error.name === 'AbortError') {
                updateStatus('Load cancelled');
                return;
            }
            console.error('File System API failed:', error);
            // Fall through to legacy method
        }
    }
    
    // Fallback for browsers without File System Access API
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const content = await file.text();
            const workflowData = JSON.parse(content);
            applyWorkflowData(workflowData);
            updateStatus(`Workflow loaded: ${file.name}`);
        } catch (error) {
            console.error('Failed to load workflow:', error);
            updateStatus('Failed to load workflow: Invalid JSON');
        }
    };
    
    input.click();
}

function applyWorkflowData(workflowData) {
    // Clear existing canvas first
    document.querySelectorAll('.workflow-node').forEach(n => n.remove());
    const svg = document.getElementById('connections-svg');
    svg.querySelectorAll('.connection-line, .waypoint-handle, .control-line').forEach(el => el.remove());
    state.nodes.clear();
    state.connections = [];
    state.selectedNode = null;
    state.selectedConnection = null;
    
    // Show canvas hint if no nodes
    const hint = document.getElementById('canvas-hint');
    
    // Load nodes
    if (workflowData.nodes && workflowData.nodes.length > 0) {
        hint.classList.add('hidden');
        
        workflowData.nodes.forEach(nodeData => {
            // Find the component data from loaded components
            const componentType = nodeData.componentType || nodeData.type;
            const components = state.components[componentType] || [];
            const componentData = components.find(c => c._file === nodeData.componentFile);
            
            if (componentData) {
                const node = {
                    id: nodeData.id,
                    type: componentType,
                    x: nodeData.x,
                    y: nodeData.y,
                    componentData: componentData,
                    parameters: nodeData.parameters || {}
                };
                
                state.nodes.set(node.id, node);
                renderNode(node);
            } else {
                console.warn(`Component not found: ${nodeData.componentFile} in ${componentType}`);
            }
        });
    } else {
        hint.classList.remove('hidden');
    }
    
    // Load connections
    if (workflowData.connections) {
        workflowData.connections.forEach(connData => {
            const connection = {
                id: connData.id || generateUUID(),
                source: connData.source,
                target: connData.target,
                controlPoints: connData.controlPoints || null
            };
            
            state.connections.push(connection);
            renderConnectionLine(connection);
        });
    }
    
    updateCounts();
    renderPropertiesPanel(null);
}

function clearCanvas() {
    if (!confirm('Are you sure you want to clear the canvas?')) return;
    
    // Remove all nodes
    document.querySelectorAll('.workflow-node').forEach(n => n.remove());
    
    // Remove all connection lines
    const svg = document.getElementById('connections-svg');
    svg.querySelectorAll('.connection-line').forEach(p => p.remove());
    
    // Clear state
    state.nodes.clear();
    state.connections = [];
    state.selectedNode = null;
    
    renderPropertiesPanel(null);
    updateCounts();
    
    // Show hint
    document.getElementById('canvas-hint')?.classList.remove('hidden');
    
    updateStatus('Canvas cleared');
}

function exportJSON() {
    const workflowData = {
        name: 'My Workflow',
        nodes: Array.from(state.nodes.values()),
        connections: state.connections
    };
    downloadWorkflow(workflowData);
}

// ============================================================================
// Search
// ============================================================================

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    
    document.querySelectorAll('.component-item').forEach(item => {
        const name = item.querySelector('.item-name').textContent.toLowerCase();
        const type = item.querySelector('.item-type').textContent.toLowerCase();
        
        if (name.includes(query) || type.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
    // Load components
    loadComponents();
    
    // Canvas events
    const canvas = document.getElementById('workflow-canvas');
    canvas.addEventListener('dragover', handleCanvasDragOver);
    canvas.addEventListener('dragleave', handleCanvasDragLeave);
    canvas.addEventListener('drop', handleCanvasDrop);
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    
    // Toolbar events
    document.getElementById('btn-save').addEventListener('click', saveWorkflow);
    document.getElementById('btn-load').addEventListener('click', loadWorkflow);
    document.getElementById('btn-clear').addEventListener('click', clearCanvas);
    document.getElementById('btn-export').addEventListener('click', exportJSON);
    
    // Zoom events
    document.getElementById('zoom-in').addEventListener('click', handleZoomIn);
    document.getElementById('zoom-out').addEventListener('click', handleZoomOut);
    document.getElementById('zoom-reset').addEventListener('click', handleZoomReset);
    
    // Mouse wheel zoom on canvas
    const canvasContainer = document.querySelector('.canvas-container');
    canvasContainer.addEventListener('wheel', (e) => {
        // Only zoom if Ctrl/Cmd is held, or if it's a pinch gesture (ctrlKey is true for pinch on trackpad)
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                // Scroll up = zoom in
                state.zoom = Math.min(state.zoom + 0.05, 2);
            } else {
                // Scroll down = zoom out
                state.zoom = Math.max(state.zoom - 0.05, 0.5);
            }
            applyZoom();
        }
    }, { passive: false });
    
    // Search
    document.getElementById('component-search').addEventListener('input', handleSearch);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Don't handle shortcuts if user is typing in an input field
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.isContentEditable
        );
        
        // Ctrl+A or Cmd+A to select all nodes
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isTyping) {
            e.preventDefault();
            selectAllNodes();
        }
        
        if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping && (state.selectedNodes.size > 0 || state.selectedConnections.size > 0)) {
            e.preventDefault();
            // Delete all selected connections first
            const connsToDelete = [...state.selectedConnections];
            connsToDelete.forEach(connId => deleteConnection(connId));
            state.selectedConnections.clear();
            // Delete all selected nodes
            const nodesToDelete = [...state.selectedNodes];
            nodesToDelete.forEach(nodeId => deleteNode(nodeId));
            state.selectedNodes.clear();
        }
        if (e.key === 'Escape') {
            state.selectedNode = null;
            state.selectedNodes.clear();
            state.selectedConnection = null;
            state.selectedConnections.clear();
            document.querySelectorAll('.workflow-node.selected').forEach(n => {
                n.classList.remove('selected');
            });
            document.querySelectorAll('.connection-line.selected').forEach(c => {
                c.classList.remove('selected');
            });
            renderPropertiesPanel(null);
            updateStatus('Ready');
        }
    });
    
    updateStatus('Ready');
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
