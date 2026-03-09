/**
 * Selection Module
 */

import { state } from './state.js';
import { updateStatus } from './utils.js';
import { renderPropertiesPanel } from './properties.js';

// Rectangle selection state
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionRect = null;

/**
 * Clear all node selections
 */
export function clearSelection() {
    state.selectedNodes.forEach(nodeId => {
        document.querySelector(`[data-node-id="${nodeId}"]`)?.classList.remove('selected');
    });
    state.selectedNodes.clear();
    state.selectedNode = null;
}

/**
 * Deselect all connections
 */
export function deselectConnections() {
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
export function selectAll() {
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

/**
 * Handle canvas mouse down for rectangle selection
 */
export function handleCanvasMouseDown(e) {
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
