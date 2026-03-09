/**
 * Canvas Module - Zoom and Pan
 */

import { state } from './state.js';
import { updateConnectionLines } from './connections.js';

/**
 * Update zoom level
 */
export function setZoom(newZoom) {
    state.zoom = Math.max(0.25, Math.min(2, newZoom));

    const canvas = document.getElementById('workflow-canvas');
    canvas.style.transform = `scale(${state.zoom}) translate(${state.pan.x}px, ${state.pan.y}px)`;

    document.getElementById('zoom-level').textContent = `${Math.round(state.zoom * 100)}%`;

    updateConnectionLines();
}

/**
 * Handle mouse wheel for zooming
 */
export function handleWheel(e) {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(state.zoom + delta);
    }
}
