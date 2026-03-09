/**
 * Workflow Save/Load Module
 */

import { state } from './state.js';
import { generateUUID, updateStatus, updateCounts } from './utils.js';
import { renderNode } from './nodes.js';
import { renderConnectionLine, removeConnectionLine } from './connections.js';
import { clearSelection, deselectConnections } from './selection.js';
import { renderPropertiesPanel } from './properties.js';

/**
 * Save workflow to JSON file
 */
export function saveWorkflow() {
    const workflow = {
        name: 'workflow',
        description: null,
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
        components: Array.from(state.nodes.values()).map(node => ({
            uuid: node.id,
            protocolUuid: node.componentData.uuid || node.id,
            componentType: node.type,
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
 */
export function loadWorkflow(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const workflow = JSON.parse(e.target.result);

            clearCanvas();

            const components = workflow.components || workflow.nodes || [];
            components.forEach(compData => {
                if (compData.uuid && compData.canvasLocation) {
                    const type = compData.componentType || compData._type || 'theorists';

                    const componentData = findComponentDataByProtocolUuid(
                        compData.protocolUuid,
                        type
                    );

                    const parameters = {};
                    if (componentData.parameters) {
                        componentData.parameters.forEach(p => {
                            parameters[p.name] = p.default;
                        });
                    }
                    if (compData.parameterSetting) {
                        compData.parameterSetting.forEach(ps => {
                            if (ps.name) {
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

    const byUuid = components.find(c => c.uuid === protocolUuid);
    if (byUuid) return byUuid;

    return components[0] || { name: 'Unknown', description: '', parameters: [] };
}

/**
 * Find component data by type and parameters
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

    if (fileName) {
        const byFile = components.find(c => c.file === fileName);
        if (byFile) return byFile;
    }

    const name = parameters._name;
    if (name) {
        const byName = components.find(c => c.name === name);
        if (byName) return byName;
    }

    return components[0] || {
        name: name || 'Unknown',
        description: '',
        parameters: []
    };
}

/**
 * Clear the canvas
 */
export function clearCanvas() {
    state.nodes.forEach((_, nodeId) => {
        const el = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (el) el.remove();
    });
    state.nodes.clear();

    state.connections.forEach(conn => removeConnectionLine(conn.id));
    state.connections = [];

    clearSelection();
    deselectConnections();
    renderPropertiesPanel(null);

    document.getElementById('canvas-hint')?.classList.remove('hidden');

    updateCounts();
    updateStatus('Canvas cleared');
}
