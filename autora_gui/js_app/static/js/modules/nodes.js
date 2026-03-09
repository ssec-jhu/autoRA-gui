/**
 * Node Management Module
 */

import { state } from './state.js';
import { generateUUID, updateStatus, updateCounts, getTypeIcon, getControlNodeIcon, formatTypeName, canBeSource, canBeTarget } from './utils.js';
import { renderPropertiesPanel } from './properties.js';
import { handleBorderMouseDown, removeConnectionLine, updateConnectionLines } from './connections.js';
import { clearSelection, deselectConnections } from './selection.js';

// Node dragging state
let isDraggingNode = false;
let dragStartPos = { x: 0, y: 0 };
let dragStartNodePos = { x: 0, y: 0 };
let dragStartPositions = new Map();

/**
 * Extract editable parameters from component data
 */
export function extractParameters(componentData) {
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
export function createNode(type, componentData, x, y) {
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
export function renderNode(nodeData) {
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
    const protocolType = nodeData.componentData.protocolType;

    // Use special icon for control nodes
    if (nodeData.type === 'control' && protocolType) {
        node.querySelector('.node-icon').textContent = getControlNodeIcon(protocolType);
        node.classList.add(protocolType.replace(/_/g, '-'));
    } else {
        node.querySelector('.node-icon').textContent = getTypeIcon(nodeData.type);
    }

    node.querySelector('.node-title').textContent = name;
    node.querySelector('.node-type').textContent = formatTypeName(protocolType || nodeData.type);

    // Configure connection borders based on input/output capabilities
    const hasInput = canBeTarget(nodeData);
    const hasOutput = canBeSource(nodeData);

    node.querySelectorAll('.connection-border').forEach(border => {
        const isLeftBorder = border.classList.contains('border-left');
        const isRightBorder = border.classList.contains('border-right');

        if (isLeftBorder && !hasInput) {
            border.classList.add('hidden');
        } else if (isRightBorder && !hasOutput) {
            border.classList.add('hidden');
        }

        if (!border.classList.contains('hidden')) {
            border.addEventListener('mousedown', (e) => handleBorderMouseDown(e, nodeData.id, border));
        }
    });

    // For filter nodes, add special styling class for dual output
    if (protocolType === 'filter_point') {
        node.classList.add('filter-node');
    }

    // Event listeners
    node.addEventListener('mousedown', handleNodeMouseDown);
    node.querySelector('.node-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNode(nodeData.id);
    });

    document.getElementById('workflow-canvas').appendChild(node);
}

/**
 * Delete a node and its connections
 */
export function deleteNode(nodeId) {
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
export function deleteSelectedNodes() {
    if (state.selectedNodes.size === 0) return;

    const nodesToDelete = [...state.selectedNodes];
    nodesToDelete.forEach(nodeId => deleteNode(nodeId));

    state.selectedNodes.clear();
}

/**
 * Handle mouse down on a node
 */
export function handleNodeMouseDown(e) {
    if (e.target.closest('.connection-border') || e.target.closest('.node-delete')) return;

    const node = e.target.closest('.workflow-node');
    const nodeId = node.dataset.nodeId;
    const nodeData = state.nodes.get(nodeId);

    // Handle selection
    if (e.shiftKey) {
        if (state.selectedNodes.has(nodeId)) {
            state.selectedNodes.delete(nodeId);
            node.classList.remove('selected');
        } else {
            state.selectedNodes.add(nodeId);
            node.classList.add('selected');
        }
    } else if (!state.selectedNodes.has(nodeId)) {
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
