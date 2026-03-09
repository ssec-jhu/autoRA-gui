/**
 * Component Palette Module
 */

import { state } from './state.js';
import { updateStatus, getTypeIcon, formatTypeName } from './utils.js';
import { handleDragStart, handleDragEnd } from './dragDrop.js';

/**
 * Load components from API and render palette
 */
export async function loadComponents() {
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
export function renderComponentPalette() {
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
export function filterComponents(query) {
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
