/**
 * Main Entry Point - Initialization and Event Wiring
 */

import { state } from './state.js';
import { updateStatus } from './utils.js';
import { loadComponents, filterComponents } from './palette.js';
import { handleCanvasDragOver, handleCanvasDragLeave, handleCanvasDrop } from './dragDrop.js';
import { deleteSelectedNodes } from './nodes.js';
import { clearSelection, deselectConnections, selectAll, handleCanvasMouseDown } from './selection.js';
import { cancelConnection, deleteSelectedConnections } from './connections.js';
import { renderPropertiesPanel } from './properties.js';
import { saveWorkflow, loadWorkflow, clearCanvas } from './workflow.js';
import { setZoom, handleWheel } from './canvas.js';

/**
 * Handle keyboard shortcuts
 */
function handleKeyDown(e) {
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

/**
 * Initialize the application
 */
function init() {
    // Clear any existing arrow markers
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
            e.target.value = '';
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

    updateStatus('Ready');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
