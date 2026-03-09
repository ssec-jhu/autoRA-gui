/**
 * Utility Functions
 */

import { state } from './state.js';

/**
 * Generate a UUID v4
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Update status bar message
 */
export function updateStatus(message) {
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.textContent = message;
    }
}

/**
 * Update node and connection counts in toolbar
 */
export function updateCounts() {
    document.getElementById('node-count').textContent = `Nodes: ${state.nodes.size}`;
    document.getElementById('connection-count').textContent = `Connections: ${state.connections.length}`;
}

/**
 * Get icon for component type
 */
export function getTypeIcon(type) {
    const icons = {
        theorists: '\u{1F9E0}',           // Brain
        experimentalists: '\u{1F52C}',     // Microscope
        experiment_runners: '\u{1F3C3}',   // Runner
        control: '\u{2699}'                // Gear
    };
    return icons[type] || '\u{1F4E6}';     // Package
}

/**
 * Get specific icon for control node types
 */
export function getControlNodeIcon(protocolType) {
    const icons = {
        start_point: '\u{25B6}',    // Play arrow
        end_point: '\u{23F9}',      // Stop
        filter_point: '\u{1F500}'   // Shuffle/branch
    };
    return icons[protocolType] || '\u{2699}';
}

/**
 * Check if a node can be a connection source (has outputs)
 */
export function canBeSource(nodeData) {
    const comp = nodeData.componentData;
    if (!comp.inputDataType && !comp.outputDataType) return true;
    return !!comp.outputDataType;
}

/**
 * Check if a node can be a connection target (has inputs)
 */
export function canBeTarget(nodeData) {
    const comp = nodeData.componentData;
    if (!comp.inputDataType && !comp.outputDataType) return true;
    return !!comp.inputDataType;
}

/**
 * Format type name for display
 */
export function formatTypeName(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
