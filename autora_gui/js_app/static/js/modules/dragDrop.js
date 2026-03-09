/**
 * Drag and Drop Module - Palette to Canvas
 */

import { state } from './state.js';
import { updateStatus } from './utils.js';
import { createNode } from './nodes.js';

/**
 * Handle drag start from component palette
 */
export function handleDragStart(e) {
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
export function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    state.draggedComponent = null;
}

/**
 * Handle drag over canvas
 */
export function handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
}

/**
 * Handle drag leave canvas
 */
export function handleCanvasDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

/**
 * Handle drop on canvas
 */
export function handleCanvasDrop(e) {
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
