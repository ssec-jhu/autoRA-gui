/**
 * Workflow Editor - Drag & Drop Node-Based Interface
 * Vanilla JavaScript Implementation
 */

// ===== State Management =====
const state = {
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

// ===== Utility Functions =====

/**
 * Generate a UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Update status bar message
 */
function updateStatus(message) {
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.textContent = message;
    }
}

/**
 * Update node and connection counts in toolbar
 */
function updateCounts() {
    document.getElementById('node-count').textContent = `Nodes: ${state.nodes.size}`;
    document.getElementById('connection-count').textContent = `Connections: ${state.connections.length}`;
}

/**
 * Get icon for component type
 */
function getTypeIcon(type) {
    const icons = {
        theorists: '\u{1F9E0}',           // Brain
        experimentalists: '\u{1F52C}',     // Microscope
        experiment_runners: '\u{1F3C3}'    // Runner
    };
    return icons[type] || '\u{1F4E6}';     // Package
}

/**
 * Format type name for display
 */
function formatTypeName(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ===== Component Palette =====

/**
 * Load components from API and render palette
 */
async function loadComponents() {
    try {
        const response = await fetch('/api/components');
        if (!response.ok) throw new Error('Failed to load components');

        state.components = await response.json();
        renderComponentPalette();
        updateStatus('Components loaded');
    } catch (error) {
        console.error('Error loading components:', error);
        updateStatus('Error loading components');
    }
}

/**
 * Render the component palette with sections
 */
function renderComponentPalette() {
    const palette = document.getElementById('component-palette');
    palette.innerHTML = '';

    for (const [type, components] of Object.entries(state.components)) {
        const section = document.createElement('div');
        section.className = 'component-section';
        section.dataset.type = type;

        // Section header - collapsed by default
        const header = document.createElement('div');
        header.className = 'section-header collapsed';
        header.innerHTML = `
            <span class="section-title">
                <span class="section-icon">${getTypeIcon(type)}</span>
                ${formatTypeName(type)}
            </span>
            <span class="section-count">${components.length}</span>
            <span class="section-toggle">\u25BC</span>
        `;
        header.addEventListener('click', () => {
            header.classList.toggle('collapsed');
        });

        // Section items
        const items = document.createElement('div');
        items.className = 'section-items';

        components.forEach((component, index) => {
            const item = document.createElement('div');
            item.className = 'component-item';
            item.draggable = true;
            item.dataset.type = type;
            item.dataset.index = index;

            const name = component.name || component.title || `Component ${index + 1}`;
            const description = component.description || '';

            item.innerHTML = `
                <div class="component-name">${name}</div>
                ${description ? `<div class="component-description">${description}</div>` : ''}
            `;

            // Drag events
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);

            items.appendChild(item);
        });

        section.appendChild(header);
        section.appendChild(items);
        palette.appendChild(section);
    }
}

/**
 * Filter components by search query
 */
function filterComponents(query) {
    const items = document.querySelectorAll('.component-item');
    const lowerQuery = query.toLowerCase();

    items.forEach(item => {
        const name = item.querySelector('.component-name').textContent.toLowerCase();
        const desc = item.querySelector('.component-description')?.textContent.toLowerCase() || '';
        const matches = name.includes(lowerQuery) || desc.includes(lowerQuery);
        item.style.display = matches ? '' : 'none';
    });

    // Show/hide sections based on visible items
    document.querySelectorAll('.component-section').forEach(section => {
        const visibleItems = section.querySelectorAll('.component-item:not([style*="display: none"])');
        section.style.display = visibleItems.length > 0 ? '' : 'none';
    });
}

// ===== Drag and Drop: Palette to Canvas =====

/**
 * Handle drag start from component palette
 */
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
    item.classList.add('dragging');

    updateStatus(`Dragging ${state.draggedComponent.data.name || 'component'}...`);
}

/**
 * Handle drag end
 */
function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    state.draggedComponent = null;
}

/**
 * Handle drag over canvas
 */
function handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
}

/**
 * Handle drag leave canvas
 */
function handleCanvasDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

/**
 * Handle drop on canvas
 */
function handleCanvasDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!state.draggedComponent) return;

    // Calculate position accounting for zoom and pan
    const canvas = document.getElementById('workflow-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom - state.pan.x;
    const y = (e.clientY - rect.top) / state.zoom - state.pan.y;

    createNode(state.draggedComponent.type, state.draggedComponent.data, x, y);

    // Hide hint
    document.getElementById('canvas-hint')?.classList.add('hidden');
    updateStatus('Node added to workflow');
}

// ===== Node Management =====

/**
 * Extract editable parameters from component data
 */
function extractParameters(componentData) {
    const params = {};

    if (componentData.parameters && Array.isArray(componentData.parameters)) {
        componentData.parameters.forEach(param => {
            params[param.name] = param.default !== undefined ? param.default : null;
        });
    }

    // Include basic info
    params._name = componentData.name || '';
    params._description = componentData.description || '';

    return params;
}

/**
 * Create a new node on the canvas
 */
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

/**
 * Render a node element on the canvas
 */
function renderNode(nodeData) {
    const template = document.getElementById('node-template');
    const clone = template.content.cloneNode(true);
    const node = clone.querySelector('.workflow-node');

    // Set attributes
    node.dataset.nodeId = nodeData.id;
    node.classList.add(nodeData.type.replace(/_/g, '-'));

    // Set position
    node.style.left = `${nodeData.x}px`;
    node.style.top = `${nodeData.y}px`;

    // Set content
    const name = nodeData.componentData.name || 'Unnamed';
    node.querySelector('.node-icon').textContent = getTypeIcon(nodeData.type);
    node.querySelector('.node-title').textContent = name;
    node.querySelector('.node-type').textContent = formatTypeName(nodeData.type);

    // Event listeners
    node.addEventListener('mousedown', handleNodeMouseDown);
    node.querySelector('.node-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNode(nodeData.id);
    });

    // Connection border event listeners
    node.querySelectorAll('.connection-border').forEach(border => {
        border.addEventListener('mousedown', (e) => handleBorderMouseDown(e, nodeData.id, border));
    });

    document.getElementById('workflow-canvas').appendChild(node);
}

/**
 * Delete a node and its connections
 */
function deleteNode(nodeId) {
    // Remove connections involving this node
    state.connections = state.connections.filter(conn => {
        if (conn.source === nodeId || conn.target === nodeId) {
            removeConnectionLine(conn.id);
            return false;
        }
        return true;
    });

    // Remove from DOM
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (nodeElement) nodeElement.remove();

    // Remove from state
    state.nodes.delete(nodeId);
    state.selectedNodes.delete(nodeId);

    if (state.selectedNode === nodeId) {
        state.selectedNode = null;
        renderPropertiesPanel(null);
    }

    updateCounts();
    updateStatus('Node deleted');
}

/**
 * Delete all selected nodes
 */
function deleteSelectedNodes() {
    if (state.selectedNodes.size === 0) return;

    const nodesToDelete = [...state.selectedNodes];
    nodesToDelete.forEach(nodeId => deleteNode(nodeId));

    state.selectedNodes.clear();
}

// ===== Node Dragging =====

let isDraggingNode = false;
let dragStartPos = { x: 0, y: 0 };
let dragStartNodePos = { x: 0, y: 0 };
let dragStartPositions = new Map();

/**
 * Handle mouse down on a node
 */
function handleNodeMouseDown(e) {
    if (e.target.closest('.connection-border') || e.target.closest('.node-delete')) return;

    const node = e.target.closest('.workflow-node');
    const nodeId = node.dataset.nodeId;
    const nodeData = state.nodes.get(nodeId);

    // Handle selection
    if (e.shiftKey) {
        // Multi-select: toggle selection
        if (state.selectedNodes.has(nodeId)) {
            state.selectedNodes.delete(nodeId);
            node.classList.remove('selected');
        } else {
            state.selectedNodes.add(nodeId);
            node.classList.add('selected');
        }
    } else if (!state.selectedNodes.has(nodeId)) {
        // Single select: clear others and select this one
        clearSelection();
        state.selectedNodes.add(nodeId);
        node.classList.add('selected');
    }

    state.selectedNode = nodeId;
    renderPropertiesPanel(nodeData);

    // Deselect connections
    deselectConnections();

    // Start dragging
    isDraggingNode = true;
    dragStartPos = { x: e.clientX, y: e.clientY };
    dragStartNodePos = { x: nodeData.x, y: nodeData.y };

    // Store initial positions for all selected nodes
    dragStartPositions.clear();
    state.selectedNodes.forEach(id => {
        const data = state.nodes.get(id);
        dragStartPositions.set(id, { x: data.x, y: data.y });
        document.querySelector(`[data-node-id="${id}"]`)?.classList.add('dragging');
    });

    document.addEventListener('mousemove', handleNodeDrag);
    document.addEventListener('mouseup', handleNodeDragEnd);

    e.preventDefault();
}

/**
 * Handle node dragging
 */
function handleNodeDrag(e) {
    if (!isDraggingNode) return;

    const deltaX = (e.clientX - dragStartPos.x) / state.zoom;
    const deltaY = (e.clientY - dragStartPos.y) / state.zoom;

    // Move all selected nodes
    state.selectedNodes.forEach(nodeId => {
        const startPos = dragStartPositions.get(nodeId);
        const newX = Math.max(0, startPos.x + deltaX);
        const newY = Math.max(0, startPos.y + deltaY);

        // Update state
        const nodeData = state.nodes.get(nodeId);
        nodeData.x = newX;
        nodeData.y = newY;

        // Update DOM
        const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeElement) {
            nodeElement.style.left = `${newX}px`;
            nodeElement.style.top = `${newY}px`;
        }
    });

    // Update connection lines
    updateConnectionLines();
}

/**
 * Handle node drag end
 */
function handleNodeDragEnd(e) {
    isDraggingNode = false;
    dragStartPositions.clear();

    state.selectedNodes.forEach(nodeId => {
        document.querySelector(`[data-node-id="${nodeId}"]`)?.classList.remove('dragging');
    });

    document.removeEventListener('mousemove', handleNodeDrag);
    document.removeEventListener('mouseup', handleNodeDragEnd);
}

// ===== Selection =====

/**
 * Clear all node selections
 */
function clearSelection() {
    state.selectedNodes.forEach(nodeId => {
        document.querySelector(`[data-node-id="${nodeId}"]`)?.classList.remove('selected');
    });
    state.selectedNodes.clear();
    state.selectedNode = null;
}

/**
 * Deselect all connections
 */
function deselectConnections() {
    state.selectedConnections.forEach(connId => {
        const line = document.querySelector(`[data-connection-id="${connId}"]`);
        if (line) line.classList.remove('selected');
    });
    state.selectedConnections.clear();
    state.selectedConnection = null;

    // Remove control point handles
    document.querySelectorAll('.waypoint-handle, .control-line').forEach(el => el.remove());
}

/**
 * Select all nodes and connections
 */
function selectAll() {
    state.nodes.forEach((_, nodeId) => {
        state.selectedNodes.add(nodeId);
        document.querySelector(`[data-node-id="${nodeId}"]`)?.classList.add('selected');
    });

    state.connections.forEach(conn => {
        state.selectedConnections.add(conn.id);
        document.querySelector(`[data-connection-id="${conn.id}"]`)?.classList.add('selected');
    });

    updateStatus(`Selected ${state.selectedNodes.size} nodes and ${state.selectedConnections.size} connections`);
}

// ===== Rectangle Selection =====

let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionRect = null;

/**
 * Handle canvas mouse down for rectangle selection
 */
function handleCanvasMouseDown(e) {
    if (e.target.id !== 'workflow-canvas') return;

    // Click on canvas: deselect all
    if (!e.shiftKey) {
        clearSelection();
        deselectConnections();
        renderPropertiesPanel(null);
    }

    // Start rectangle selection
    isSelecting = true;
    const canvas = document.getElementById('workflow-canvas');
    const rect = canvas.getBoundingClientRect();

    selectionStart = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };

    selectionRect = document.createElement('div');
    selectionRect.className = 'selection-rect';
    selectionRect.style.left = `${selectionStart.x}px`;
    selectionRect.style.top = `${selectionStart.y}px`;
    canvas.appendChild(selectionRect);

    document.addEventListener('mousemove', handleSelectionDrag);
    document.addEventListener('mouseup', handleSelectionEnd);
}

/**
 * Handle selection rectangle dragging
 */
function handleSelectionDrag(e) {
    if (!isSelecting || !selectionRect) return;

    const canvas = document.getElementById('workflow-canvas');
    const rect = canvas.getBoundingClientRect();

    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const left = Math.min(selectionStart.x, currentX);
    const top = Math.min(selectionStart.y, currentY);
    const width = Math.abs(currentX - selectionStart.x);
    const height = Math.abs(currentY - selectionStart.y);

    selectionRect.style.left = `${left}px`;
    selectionRect.style.top = `${top}px`;
    selectionRect.style.width = `${width}px`;
    selectionRect.style.height = `${height}px`;

    // Check intersection with nodes
    const selectionBounds = {
        left: left / state.zoom,
        top: top / state.zoom,
        right: (left + width) / state.zoom,
        bottom: (top + height) / state.zoom
    };

    state.nodes.forEach((nodeData, nodeId) => {
        const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (!nodeEl) return;

        const nodeBounds = {
            left: nodeData.x,
            top: nodeData.y,
            right: nodeData.x + nodeEl.offsetWidth,
            bottom: nodeData.y + nodeEl.offsetHeight
        };

        const intersects = !(
            nodeBounds.right < selectionBounds.left ||
            nodeBounds.left > selectionBounds.right ||
            nodeBounds.bottom < selectionBounds.top ||
            nodeBounds.top > selectionBounds.bottom
        );

        if (intersects) {
            state.selectedNodes.add(nodeId);
            nodeEl.classList.add('selected');
        } else if (!e.shiftKey) {
            state.selectedNodes.delete(nodeId);
            nodeEl.classList.remove('selected');
        }
    });
}

/**
 * Handle selection rectangle end
 */
function handleSelectionEnd(e) {
    isSelecting = false;

    if (selectionRect) {
        selectionRect.remove();
        selectionRect = null;
    }

    document.removeEventListener('mousemove', handleSelectionDrag);
    document.removeEventListener('mouseup', handleSelectionEnd);

    if (state.selectedNodes.size > 0) {
        updateStatus(`Selected ${state.selectedNodes.size} nodes`);
    }
}

// ===== Connection System =====

let tempLine = null;
let tempLineStart = null;

/**
 * Handle mouse down on node border for creating connections
 */
function handleBorderMouseDown(e, nodeId, border) {
    e.stopPropagation();
    e.preventDefault();

    // If there's an existing connection in progress, cancel it first
    if (state.connecting) {
        cancelConnection();
    }

    const node = document.querySelector(`[data-node-id="${nodeId}"]`);
    const svg = document.getElementById('connections-svg');
    const svgRect = svg.getBoundingClientRect();

    // Calculate connection point based on where user clicked on the border
    const borderRect = border.getBoundingClientRect();
    let startX, startY;
    const borderClass = border.classList.contains('border-top') ? 'border-top' :
                        border.classList.contains('border-bottom') ? 'border-bottom' :
                        border.classList.contains('border-left') ? 'border-left' : 'border-right';

    if (borderClass === 'border-top') {
        startX = e.clientX - svgRect.left;
        startY = borderRect.bottom - svgRect.top;
    } else if (borderClass === 'border-bottom') {
        startX = e.clientX - svgRect.left;
        startY = borderRect.top - svgRect.top;
    } else if (borderClass === 'border-left') {
        startX = borderRect.right - svgRect.left;
        startY = e.clientY - svgRect.top;
    } else {
        startX = borderRect.left - svgRect.left;
        startY = e.clientY - svgRect.top;
    }

    // Start new connection
    tempLineStart = {
        nodeId: nodeId,
        x: startX,
        y: startY,
        border: borderClass
    };

    state.connecting = {
        source: nodeId,
        sourcePoint: { x: startX, y: startY },
        sourceBorder: borderClass
    };

    node.classList.add('connecting-source');

    // Highlight valid target nodes
    document.querySelectorAll('.workflow-node').forEach(n => {
        if (n.dataset.nodeId !== nodeId) {
            n.classList.add('valid-target');
        }
    });

    document.addEventListener('mousemove', handleConnectionMouseMove);
    document.addEventListener('mouseup', handleConnectionMouseUp);
    document.addEventListener('keydown', handleConnectionEscape);

    updateStatus('Drag to another node to create connection');
}

/**
 * Handle mouse up to complete connection
 */
function handleConnectionMouseUp(e) {
    if (!state.connecting) return;

    // Check if we're over a valid target node (check the node itself, not just border)
    const targetNode = e.target.closest('.workflow-node');

    if (targetNode) {
        const targetNodeId = targetNode.dataset.nodeId;

        if (targetNodeId !== state.connecting.source) {
            const svg = document.getElementById('connections-svg');
            const svgRect = svg.getBoundingClientRect();
            const nodeRect = targetNode.getBoundingClientRect();

            // Determine which border is closest to the mouse position
            const mouseX = e.clientX;
            const mouseY = e.clientY;

            const distTop = Math.abs(mouseY - nodeRect.top);
            const distBottom = Math.abs(mouseY - nodeRect.bottom);
            const distLeft = Math.abs(mouseX - nodeRect.left);
            const distRight = Math.abs(mouseX - nodeRect.right);

            const minDist = Math.min(distTop, distBottom, distLeft, distRight);

            let targetBorder, endX, endY;

            if (minDist === distTop) {
                targetBorder = 'border-top';
                endX = mouseX - svgRect.left;
                endY = nodeRect.top - svgRect.top;
            } else if (minDist === distBottom) {
                targetBorder = 'border-bottom';
                endX = mouseX - svgRect.left;
                endY = nodeRect.bottom - svgRect.top;
            } else if (minDist === distLeft) {
                targetBorder = 'border-left';
                endX = nodeRect.left - svgRect.left;
                endY = mouseY - svgRect.top;
            } else {
                targetBorder = 'border-right';
                endX = nodeRect.right - svgRect.left;
                endY = mouseY - svgRect.top;
            }

            completeConnection(targetNodeId, endX, endY, targetBorder);
            return;
        }
    }

    // No valid target - cancel
    cancelConnection();
    updateStatus('Connection cancelled');
}

/**
 * Complete a connection to target node
 */
function completeConnection(targetNodeId, endX, endY, targetBorder) {
    // Prevent self-connection
    if (targetNodeId === state.connecting.source) {
        updateStatus('Cannot connect a node to itself');
        cancelConnection();
        return;
    }

    // Prevent duplicate connections
    const exists = state.connections.some(c =>
        c.source === state.connecting.source && c.target === targetNodeId
    );

    if (exists) {
        updateStatus('Connection already exists');
        cancelConnection();
        return;
    }

    // Create connection with anchor points
    createConnection(
        state.connecting.source,
        targetNodeId,
        state.connecting.sourcePoint,
        { x: endX, y: endY },
        state.connecting.sourceBorder,
        targetBorder
    );
    cancelConnection();
    updateStatus('Connection created');
}

/**
 * Handle mouse move during connection creation
 */
function handleConnectionMouseMove(e) {
    if (!tempLineStart) return;

    const svg = document.getElementById('connections-svg');
    const svgRect = svg.getBoundingClientRect();

    const endX = e.clientX - svgRect.left;
    const endY = e.clientY - svgRect.top;

    if (!tempLine) {
        tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempLine.classList.add('connection-line', 'temp');
        ensureArrowMarker(svg, 'temp');
        tempLine.setAttribute('marker-end', 'url(#arrowhead-temp)');
        svg.appendChild(tempLine);
    }

    // Use same convex curve algorithm for preview
    const path = createBezierPath(tempLineStart.x, tempLineStart.y, endX, endY);
    tempLine.setAttribute('d', path);
}

/**
 * Cancel connection in progress
 */
function cancelConnection() {
    state.connecting = null;
    tempLineStart = null;

    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }

    // Remove highlights
    document.querySelectorAll('.connecting-source, .valid-target').forEach(el => {
        el.classList.remove('connecting-source', 'valid-target');
    });

    document.removeEventListener('mousemove', handleConnectionMouseMove);
    document.removeEventListener('mouseup', handleConnectionMouseUp);
    document.removeEventListener('keydown', handleConnectionEscape);
}

/**
 * Handle escape key to cancel connection
 */
function handleConnectionEscape(e) {
    if (e.key === 'Escape') {
        cancelConnection();
        updateStatus('Connection cancelled');
    }
}

/**
 * Create a connection between two nodes
 */
function createConnection(sourceId, targetId, sourcePoint = null, targetPoint = null, sourceBorder = null, targetBorder = null) {
    const connection = {
        id: generateUUID(),
        source: sourceId,
        target: targetId,
        sourceAnchor: sourcePoint,  // Relative anchor point on source node
        targetAnchor: targetPoint,  // Relative anchor point on target node
        sourceBorder: sourceBorder, // Which border the connection starts from
        targetBorder: targetBorder, // Which border the connection ends at
        controlPoints: null         // Will use defaults
    };

    state.connections.push(connection);
    renderConnectionLine(connection);
    updateCounts();

    return connection.id;
}

/**
 * Delete a connection
 */
function deleteConnection(connectionId) {
    const index = state.connections.findIndex(c => c.id === connectionId);
    if (index === -1) return;

    state.connections.splice(index, 1);
    removeConnectionLine(connectionId);

    state.selectedConnections.delete(connectionId);
    if (state.selectedConnection === connectionId) {
        state.selectedConnection = null;
    }

    updateCounts();
    updateStatus('Connection deleted');
}

/**
 * Delete all selected connections
 */
function deleteSelectedConnections() {
    const toDelete = [...state.selectedConnections];
    toDelete.forEach(connId => deleteConnection(connId));
}

/**
 * Remove connection line from SVG
 */
function removeConnectionLine(connectionId) {
    const svg = document.getElementById('connections-svg');
    svg.querySelectorAll(`[data-connection-id="${connectionId}"], [data-cp-connection="${connectionId}"]`).forEach(el => el.remove());
}

/**
 * Select a connection
 */
function selectConnection(connectionId) {
    // Deselect nodes
    clearSelection();
    renderPropertiesPanel(null);

    // Toggle selection
    if (state.selectedConnection === connectionId) {
        deselectConnections();
        return;
    }

    deselectConnections();

    state.selectedConnection = connectionId;
    state.selectedConnections.add(connectionId);

    const line = document.querySelector(`[data-connection-id="${connectionId}"]`);
    if (line) line.classList.add('selected');

    // Render control point handles
    const connection = state.connections.find(c => c.id === connectionId);
    if (connection) {
        renderConnectionLine(connection); // Re-render to show handles
    }

    updateStatus('Connection selected - drag control points to reshape');
}

/**
 * Create bezier path string
 */
function createBezierPath(x1, y1, x2, y2, controlPoints = null) {
    const cp = controlPoints || getDefaultControlPoints(x1, y1, x2, y2);
    return `M ${x1} ${y1} C ${cp.cp1.x} ${cp.cp1.y}, ${cp.cp2.x} ${cp.cp2.y}, ${x2} ${y2}`;
}

/**
 * Calculate default control points for bezier curve
 * Creates concave (inward-curving) arcs - curves bow counter-clockwise
 */
function getDefaultControlPoints(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate perpendicular offset for concave curve
    // The curve will bow inward (counter-clockwise direction)
    const curvature = Math.max(30, distance * 0.3); // How much the curve bows

    // Perpendicular direction (rotate 90 degrees counter-clockwise)
    // Normalized perpendicular vector - negated for opposite direction
    const perpX = dy / distance;
    const perpY = -dx / distance;

    // Control points are offset perpendicular to the line, creating concave arc
    // Both control points go in the same perpendicular direction for a smooth arc
    const cp1 = {
        x: x1 + dx * 0.25 + perpX * curvature,
        y: y1 + dy * 0.25 + perpY * curvature
    };

    const cp2 = {
        x: x1 + dx * 0.75 + perpX * curvature,
        y: y1 + dy * 0.75 + perpY * curvature
    };

    return { cp1, cp2 };
}

/**
 * Ensure arrow marker exists in SVG
 * Arrow tip points exactly at the endpoint (refX = 0 means tip is at the path end)
 */
function ensureArrowMarker(svg, suffix = '') {
    const id = suffix ? `arrowhead-${suffix}` : 'arrowhead';
    if (svg.querySelector(`#${id}`)) return;

    const defs = svg.querySelector('defs') || svg.insertBefore(
        document.createElementNS('http://www.w3.org/2000/svg', 'defs'),
        svg.firstChild
    );

    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '12');
    marker.setAttribute('markerHeight', '12');
    marker.setAttribute('refX', '12');  // Arrow tip at the end
    marker.setAttribute('refY', '6');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L12,6 L0,12 L3,6 Z');  // Arrow shape pointing right
    path.setAttribute('fill', suffix === 'temp' ? '#22c55e' : '#4a90d9');

    marker.appendChild(path);
    defs.appendChild(marker);
}

/**
 * Calculate connection anchor point on a node
 */
function getConnectionAnchor(nodeElement, svgRect, border, relativePos = 0.5) {
    const nodeRect = nodeElement.getBoundingClientRect();
    let x, y;

    switch (border) {
        case 'border-top':
            x = nodeRect.left + nodeRect.width * relativePos - svgRect.left;
            y = nodeRect.top - svgRect.top;
            break;
        case 'border-bottom':
            x = nodeRect.left + nodeRect.width * relativePos - svgRect.left;
            y = nodeRect.bottom - svgRect.top;
            break;
        case 'border-left':
            x = nodeRect.left - svgRect.left;
            y = nodeRect.top + nodeRect.height * relativePos - svgRect.top;
            break;
        case 'border-right':
        default:
            x = nodeRect.right - svgRect.left;
            y = nodeRect.top + nodeRect.height * relativePos - svgRect.top;
            break;
    }

    return { x, y };
}

/**
 * Determine best border for connecting two nodes
 */
function determineBestBorder(sourceNode, targetNode, svgRect) {
    const sourceRect = sourceNode.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();

    const sourceCenterX = sourceRect.left + sourceRect.width / 2;
    const sourceCenterY = sourceRect.top + sourceRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;

    let sourceBorder, targetBorder;

    // Determine source border (exit point)
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal connection
        sourceBorder = dx > 0 ? 'border-right' : 'border-left';
        targetBorder = dx > 0 ? 'border-left' : 'border-right';
    } else {
        // Vertical connection
        sourceBorder = dy > 0 ? 'border-bottom' : 'border-top';
        targetBorder = dy > 0 ? 'border-top' : 'border-bottom';
    }

    return { sourceBorder, targetBorder };
}

/**
 * Render a connection line
 */
function renderConnectionLine(connection) {
    const svg = document.getElementById('connections-svg');
    const sourceNode = document.querySelector(`[data-node-id="${connection.source}"]`);
    const targetNode = document.querySelector(`[data-node-id="${connection.target}"]`);

    if (!sourceNode || !targetNode) return;

    const svgRect = svg.getBoundingClientRect();

    // Use stored anchors or calculate best borders
    let startX, startY, endX, endY;

    if (connection.sourceBorder && connection.targetBorder) {
        // Use stored border preferences
        const sourceAnchor = getConnectionAnchor(sourceNode, svgRect, connection.sourceBorder);
        const targetAnchor = getConnectionAnchor(targetNode, svgRect, connection.targetBorder);
        startX = sourceAnchor.x;
        startY = sourceAnchor.y;
        endX = targetAnchor.x;
        endY = targetAnchor.y;
    } else {
        // Auto-determine best borders based on node positions
        const { sourceBorder, targetBorder } = determineBestBorder(sourceNode, targetNode, svgRect);
        const sourceAnchor = getConnectionAnchor(sourceNode, svgRect, sourceBorder);
        const targetAnchor = getConnectionAnchor(targetNode, svgRect, targetBorder);
        startX = sourceAnchor.x;
        startY = sourceAnchor.y;
        endX = targetAnchor.x;
        endY = targetAnchor.y;

        // Store for future renders
        connection.sourceBorder = sourceBorder;
        connection.targetBorder = targetBorder;
    }

    // Get or create path element
    let path = svg.querySelector(`[data-connection-id="${connection.id}"]`);
    if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('connection-line');
        path.dataset.connectionId = connection.id;

        path.addEventListener('click', (e) => {
            e.stopPropagation();
            selectConnection(connection.id);
        });

        path.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            deleteConnection(connection.id);
        });

        ensureArrowMarker(svg);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        svg.appendChild(path);
    }

    // Calculate control points
    const controlPoints = connection.controlPoints || getDefaultControlPoints(startX, startY, endX, endY);
    const pathD = createBezierPath(startX, startY, endX, endY, controlPoints);
    path.setAttribute('d', pathD);

    // Render control point handles if selected
    if (state.selectedConnection === connection.id) {
        renderControlPointHandles(connection, startX, startY, endX, endY, controlPoints, svg);
    }
}

/**
 * Render control point handles for a selected connection
 */
function renderControlPointHandles(connection, startX, startY, endX, endY, controlPoints, svg) {
    // Remove existing handles for this connection
    svg.querySelectorAll(`[data-cp-connection="${connection.id}"]`).forEach(el => el.remove());

    // Draw guide lines
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

    // Create draggable handles
    createControlPointHandle(connection, controlPoints.cp1, 'cp1', svg, startX, startY, endX, endY);
    createControlPointHandle(connection, controlPoints.cp2, 'cp2', svg, startX, startY, endX, endY);
}

/**
 * Create a draggable control point handle
 */
function createControlPointHandle(connection, point, cpName, svg, startX, startY, endX, endY) {
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.setAttribute('cx', point.x);
    handle.setAttribute('cy', point.y);
    handle.setAttribute('r', '8');
    handle.classList.add('waypoint-handle');
    handle.dataset.cpConnection = connection.id;
    handle.dataset.cpName = cpName;

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startDraggingControlPoint(e, connection, cpName, svg, startX, startY, endX, endY);
    });

    svg.appendChild(handle);
}

let draggingControlPoint = null;

/**
 * Start dragging a control point
 */
function startDraggingControlPoint(e, connection, cpName, svg, startX, startY, endX, endY) {
    const svgRect = svg.getBoundingClientRect();

    draggingControlPoint = {
        connection,
        cpName,
        svg,
        svgRect,
        startX,
        startY,
        endX,
        endY
    };

    document.addEventListener('mousemove', handleControlPointDrag);
    document.addEventListener('mouseup', handleControlPointDragEnd);
}

/**
 * Handle control point dragging
 */
function handleControlPointDrag(e) {
    if (!draggingControlPoint) return;

    const { connection, cpName, svg, svgRect, startX, startY, endX, endY } = draggingControlPoint;

    // Calculate new position
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;

    // Initialize control points if not set
    if (!connection.controlPoints) {
        connection.controlPoints = getDefaultControlPoints(startX, startY, endX, endY);
    }

    // Update specific control point
    connection.controlPoints[cpName] = { x, y };

    // Re-render connection
    renderConnectionLine(connection);
}

/**
 * Handle control point drag end
 */
function handleControlPointDragEnd(e) {
    draggingControlPoint = null;
    document.removeEventListener('mousemove', handleControlPointDrag);
    document.removeEventListener('mouseup', handleControlPointDragEnd);
}

/**
 * Update all connection lines (e.g., after node drag)
 */
function updateConnectionLines() {
    state.connections.forEach(conn => renderConnectionLine(conn));
}

// ===== Properties Panel =====

/**
 * Render the properties panel for a selected node
 */
function renderPropertiesPanel(nodeData) {
    const panel = document.getElementById('properties-panel');

    if (!nodeData) {
        panel.innerHTML = '<div class="no-selection">Select a node to edit properties</div>';
        return;
    }

    const componentData = nodeData.componentData;
    const params = nodeData.parameters;

    // Use protocolType from JSON if available, otherwise use folder type
    const displayType = componentData.protocolType || nodeData.type;

    let html = `
        <!-- General Section -->
        <div class="property-section">
            <div class="property-section-title">General</div>
            <div class="property-row">
                <label class="property-label">Name</label>
                <div class="property-value">${componentData.name || 'Unnamed'}</div>
            </div>
            <div class="property-row">
                <label class="property-label">Type</label>
                <span class="property-type-badge">${formatTypeName(displayType)}</span>
            </div>
            ${componentData.description ? `
            <div class="property-row">
                <label class="property-label">Description</label>
                <div class="property-value" style="font-size: 12px; color: var(--text-muted);">${componentData.description}</div>
            </div>
            ` : ''}
            ${componentData.githubCommit ? `
            <div class="property-row">
                <label class="property-label">Source</label>
                <div class="property-value"><a href="${componentData.githubCommit}" target="_blank" style="color: var(--accent-primary);">View on GitHub</a></div>
            </div>
            ` : ''}
        </div>
    `;

    // Parameters section
    if (componentData.parameters && componentData.parameters.length > 0) {
        html += `
            <div class="property-section">
                <div class="property-section-title">Parameters</div>
        `;

        componentData.parameters.forEach(param => {
            const value = params[param.name];
            html += renderParameterInput(param, value, nodeData.id);
        });

        html += '</div>';
    }

    // Input/Output types if available (support both naming conventions)
    const inputTypes = componentData.inputDataType || componentData.inputDataTypes;
    const outputTypes = componentData.outputDataType || componentData.outputDataTypes;

    if (inputTypes || outputTypes) {
        html += `
            <div class="property-section">
                <div class="property-section-title">Data Types</div>
        `;

        if (inputTypes) {
            html += `
                <div class="property-row">
                    <label class="property-label">Input</label>
                    <div class="property-value">${formatDataTypes(inputTypes)}</div>
                </div>
            `;
        }

        if (outputTypes) {
            html += `
                <div class="property-row">
                    <label class="property-label">Output</label>
                    <div class="property-value">${formatDataTypes(outputTypes)}</div>
                </div>
            `;
        }

        html += '</div>';
    }

    panel.innerHTML = html;

    // Add event listeners to inputs
    panel.querySelectorAll('.property-input, .property-select').forEach(input => {
        input.addEventListener('change', (e) => {
            const paramName = e.target.dataset.param;
            let value = e.target.value;

            // Type conversion
            if (e.target.type === 'number') {
                value = e.target.step === '1' ? parseInt(value) : parseFloat(value);
            } else if (e.target.tagName === 'SELECT' && (value === 'true' || value === 'false')) {
                value = value === 'true';
            }

            params[paramName] = value;
            updateStatus(`Updated ${paramName}`);
        });
    });
}

/**
 * Render a parameter input based on datatype (from JSON schema)
 */
function renderParameterInput(param, value, nodeId) {
    const name = param.name;
    // Support both 'datatype' (from JSON files) and 'type' (fallback)
    const datatype = param.datatype || param.type || 'string';
    const displayValue = value !== null && value !== undefined ? value : param.default || '';
    const description = param.description || '';

    let input = '';

    switch (datatype) {
        case 'integer':
            input = `<input type="number" step="1" class="property-input" data-param="${name}" value="${displayValue}">`;
            break;

        case 'real':
        case 'float':
        case 'number':
            input = `<input type="number" step="any" class="property-input" data-param="${name}" value="${displayValue}">`;
            break;

        case 'boolean':
            input = `
                <select class="property-select" data-param="${name}">
                    <option value="true" ${displayValue === true ? 'selected' : ''}>True</option>
                    <option value="false" ${displayValue === false ? 'selected' : ''}>False</option>
                </select>
            `;
            break;

        case 'categorical':
            const options = param.validValues || [];
            input = `
                <select class="property-select" data-param="${name}">
                    ${options.map(opt => `<option value="${opt}" ${displayValue === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            `;
            break;

        default:
            input = `<input type="text" class="property-input" data-param="${name}" value="${displayValue}">`;
    }

    return `
        <div class="property-row">
            <label class="property-label" title="${description}">${name}</label>
            ${input}
        </div>
    `;
}

/**
 * Format data types for display
 * Handles both simple arrays and array of objects with name/datatype
 */
function formatDataTypes(types) {
    if (!types) return '';

    if (Array.isArray(types)) {
        // Check if it's an array of objects (like inputDataType in JSON)
        if (types.length > 0 && typeof types[0] === 'object') {
            return types.map(t => `${t.name || 'unnamed'}: ${t.datatype || 'any'}`).join(', ');
        }
        return types.join(', ');
    }

    if (typeof types === 'object') {
        return `${types.name || 'unnamed'}: ${types.datatype || 'any'}`;
    }

    return String(types);
}

// ===== Zoom and Pan =====

/**
 * Update zoom level
 */
function setZoom(newZoom) {
    state.zoom = Math.max(0.25, Math.min(2, newZoom));

    const canvas = document.getElementById('workflow-canvas');
    canvas.style.transform = `scale(${state.zoom}) translate(${state.pan.x}px, ${state.pan.y}px)`;

    document.getElementById('zoom-level').textContent = `${Math.round(state.zoom * 100)}%`;

    // Update connection lines
    updateConnectionLines();
}

/**
 * Handle mouse wheel for zooming
 */
function handleWheel(e) {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(state.zoom + delta);
    }
}

// ===== Save and Load =====

/**
 * Save workflow to JSON file
 * Follows the workflow_model.json schema
 */
function saveWorkflow() {
    const workflow = {
        name: 'workflow',
        description: null,
        // Variables - placeholder structure, to be defined by user
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
        // Components (nodes on canvas)
        components: Array.from(state.nodes.values()).map(node => ({
            uuid: node.id,
            protocolUuid: node.componentData.uuid || node.id,
            componentType: node.type,  // theorists, experimentalists, experiment_runners
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
        // Links (connections between nodes)
        links: state.connections.map(conn => ({
            source: conn.source,
            target: conn.target,
            sourceBorder: conn.sourceBorder || null,
            targetBorder: conn.targetBorder || null,
            controlPoints: conn.controlPoints || null
        }))
    };

    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    a.click();

    URL.revokeObjectURL(url);
    updateStatus('Workflow saved');
}

/**
 * Load workflow from JSON file
 * Supports both new schema (components/links) and legacy format (nodes/connections)
 */
function loadWorkflow(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const workflow = JSON.parse(e.target.result);

            // Clear current state
            clearCanvas();

            // Restore nodes/components (support both formats)
            const components = workflow.components || workflow.nodes || [];
            components.forEach(compData => {
                // Handle new schema format (uuid + canvasLocation)
                if (compData.uuid && compData.canvasLocation) {
                    const type = compData.componentType || compData._type || 'theorists';

                    // Find component data from loaded components
                    const componentData = findComponentDataByProtocolUuid(
                        compData.protocolUuid,
                        type
                    );

                    // Restore parameters from parameterSetting array
                    const parameters = {};
                    if (componentData.parameters) {
                        componentData.parameters.forEach(p => {
                            parameters[p.name] = p.default;
                        });
                    }
                    if (compData.parameterSetting) {
                        compData.parameterSetting.forEach(ps => {
                            if (ps.name) {
                                // Try to parse value back to original type
                                let value = ps.value;
                                if (value === 'true') value = true;
                                else if (value === 'false') value = false;
                                else if (!isNaN(value) && value !== '' && value !== null) value = Number(value);
                                parameters[ps.name] = value;
                            }
                        });
                    }
                    parameters._name = componentData.name || '';
                    parameters._description = componentData.description || '';

                    const node = {
                        id: compData.uuid,
                        type: type,
                        x: compData.canvasLocation.x,
                        y: compData.canvasLocation.y,
                        componentData: componentData,
                        parameters: parameters
                    };

                    state.nodes.set(node.id, node);
                    renderNode(node);
                }
                // Handle legacy format (id + x/y)
                else if (compData.id) {
                    const componentData = findComponentData(
                        compData.componentType || compData.type,
                        compData.parameters
                    );

                    const node = {
                        id: compData.id,
                        type: compData.type || compData.componentType,
                        x: compData.x,
                        y: compData.y,
                        componentData: componentData,
                        parameters: compData.parameters
                    };

                    state.nodes.set(node.id, node);
                    renderNode(node);
                }
            });

            // Restore links/connections (support both formats)
            const links = workflow.links || workflow.connections || [];
            links.forEach(linkData => {
                const connection = {
                    id: linkData.id || generateUUID(),
                    source: linkData.source,
                    target: linkData.target,
                    sourceBorder: linkData.sourceBorder || linkData._sourceBorder || null,
                    targetBorder: linkData.targetBorder || linkData._targetBorder || null,
                    controlPoints: linkData.controlPoints || linkData._controlPoints || null
                };

                state.connections.push(connection);
                renderConnectionLine(connection);
            });

            updateCounts();
            document.getElementById('canvas-hint')?.classList.add('hidden');
            updateStatus('Workflow loaded');

        } catch (error) {
            console.error('Error loading workflow:', error);
            updateStatus('Error loading workflow');
        }
    };

    reader.readAsText(file);
}

/**
 * Find component data by protocol UUID
 */
function findComponentDataByProtocolUuid(protocolUuid, type) {
    const components = state.components[type];
    if (!components) {
        return { name: 'Unknown', description: '', parameters: [] };
    }

    // Try to find by UUID
    const byUuid = components.find(c => c.uuid === protocolUuid);
    if (byUuid) return byUuid;

    // Fallback to first component
    return components[0] || { name: 'Unknown', description: '', parameters: [] };
}

/**
 * Find component data by type, parameters, and optionally file name
 */
function findComponentData(type, parameters, fileName = null) {
    const components = state.components[type];
    if (!components) {
        return {
            name: parameters._name || 'Unknown',
            description: parameters._description || '',
            parameters: []
        };
    }

    // Try to find by file name first (most accurate)
    if (fileName) {
        const byFile = components.find(c => c.file === fileName);
        if (byFile) return byFile;
    }

    // Try to find matching component by name
    const name = parameters._name;
    if (name) {
        const byName = components.find(c => c.name === name);
        if (byName) return byName;
    }

    // Fallback to first component or empty
    return components[0] || {
        name: name || 'Unknown',
        description: '',
        parameters: []
    };
}

/**
 * Clear the canvas
 */
function clearCanvas() {
    // Remove all nodes
    state.nodes.forEach((_, nodeId) => {
        const el = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (el) el.remove();
    });
    state.nodes.clear();

    // Remove all connections
    state.connections.forEach(conn => removeConnectionLine(conn.id));
    state.connections = [];

    // Clear selection
    clearSelection();
    deselectConnections();
    renderPropertiesPanel(null);

    // Show hint
    document.getElementById('canvas-hint')?.classList.remove('hidden');

    updateCounts();
    updateStatus('Canvas cleared');
}

// ===== Keyboard Shortcuts =====

/**
 * Handle keyboard shortcuts
 */
function handleKeyDown(e) {
    // Ignore if typing in input
    if (e.target.matches('input, textarea, select')) return;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

    // Delete selected
    if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedNodes();
        deleteSelectedConnections();
        e.preventDefault();
    }

    // Select all
    if (ctrlKey && e.key === 'a') {
        selectAll();
        e.preventDefault();
    }

    // Save
    if (ctrlKey && e.key === 's') {
        saveWorkflow();
        e.preventDefault();
    }

    // Escape
    if (e.key === 'Escape') {
        if (state.connecting) {
            cancelConnection();
        } else {
            clearSelection();
            deselectConnections();
            renderPropertiesPanel(null);
        }
        updateStatus('Deselected');
    }
}

// ===== Initialization =====

/**
 * Initialize the application
 */
function init() {
    // Clear any existing arrow markers (to refresh with new style)
    const svg = document.getElementById('connections-svg');
    const existingDefs = svg.querySelector('defs');
    if (existingDefs) existingDefs.remove();

    // Load components
    loadComponents();

    // Canvas events
    const canvasContainer = document.querySelector('.canvas-container');
    canvasContainer.addEventListener('dragover', handleCanvasDragOver);
    canvasContainer.addEventListener('dragleave', handleCanvasDragLeave);
    canvasContainer.addEventListener('drop', handleCanvasDrop);

    const canvas = document.getElementById('workflow-canvas');
    canvas.addEventListener('mousedown', handleCanvasMouseDown);

    // Zoom
    canvasContainer.addEventListener('wheel', handleWheel, { passive: false });

    // Toolbar buttons
    document.getElementById('btn-save').addEventListener('click', saveWorkflow);
    document.getElementById('btn-load').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    document.getElementById('file-input').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            loadWorkflow(e.target.files[0]);
            e.target.value = ''; // Reset for same file
        }
    });
    document.getElementById('btn-clear').addEventListener('click', clearCanvas);
    document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(state.zoom + 0.1));
    document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(state.zoom - 0.1));

    // Search
    document.getElementById('component-search').addEventListener('input', (e) => {
        filterComponents(e.target.value);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    // Click outside to deselect
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.workflow-node') &&
            !e.target.closest('.connection-line') &&
            !e.target.closest('.waypoint-handle') &&
            !e.target.closest('#properties-panel')) {
            // Handled by canvas mousedown
        }
    });

    updateStatus('Ready');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
