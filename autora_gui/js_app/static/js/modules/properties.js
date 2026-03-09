/**
 * Properties Panel Module
 */

import { updateStatus, formatTypeName } from './utils.js';

/**
 * Render the properties panel for a selected node
 */
export function renderPropertiesPanel(nodeData) {
    const panel = document.getElementById('properties-panel');

    if (!nodeData) {
        panel.innerHTML = '<div class="no-selection">Select a node to edit properties</div>';
        return;
    }

    const componentData = nodeData.componentData;
    const params = nodeData.parameters;

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

    // Input/Output types
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
 * Render a parameter input based on datatype
 */
function renderParameterInput(param, value, nodeId) {
    const name = param.name;
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
 */
function formatDataTypes(types) {
    if (!types) return '';

    if (Array.isArray(types)) {
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
