// Simple drag and drop functionality for Dash workflow builder
let draggedComponent = null;
let componentData = {};
let componentConnections = [];
let isConnecting = false;
let connectionStart = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {
    setupDragAndDrop();
});

function setupDragAndDrop() {
    // Handle drag start for component library items
    document.addEventListener('dragstart', function (e) {
        if (e.target.classList.contains('component-item')) {
            draggedComponent = {
                type: e.target.dataset.componentType,
                title: e.target.querySelector('.component-title').textContent,
                description: e.target.querySelector('.component-description').textContent
            };
            e.dataTransfer.effectAllowed = 'copy';
        }
    });

    // Handle drag over canvas
    document.addEventListener('dragover', function (e) {
        if (e.target.closest('.canvas-container')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    });

    // Handle drop on canvas
    document.addEventListener('drop', function (e) {
        if (e.target.closest('.canvas-container') && draggedComponent) {
            e.preventDefault();

            const canvasRect = e.target.closest('.canvas-container').getBoundingClientRect();
            const x = e.clientX - canvasRect.left;
            const y = e.clientY - canvasRect.top;

            createCanvasComponent(draggedComponent, x, y);
            draggedComponent = null;
        }
    });
}

function createCanvasComponent(componentInfo, x, y) {
    const componentId = 'component_' + Date.now();

    // Create component element
    const component = document.createElement('div');
    component.className = 'canvas-component';
    component.id = componentId;
    component.style.left = x + 'px';
    component.style.top = y + 'px';

    component.innerHTML = `
        <div class="component-header">
            <span>${componentInfo.title}</span>
            <div class="component-controls">
                <button class="control-btn delete-btn" onclick="deleteComponent('${componentId}')">❌</button>
            </div>
        </div>
        <div class="component-content">${componentInfo.description}</div>
        <div class="connection-points">
            <div class="input-point" onclick="startConnection('${componentId}', 'input')" title="Click to connect input">📥 Input</div>
            <div class="output-point" onclick="startConnection('${componentId}', 'output')" title="Click to connect output">📤 Output</div>
        </div>
    `;

    // Add to canvas
    const canvas = document.querySelector('.canvas');
    canvas.appendChild(component);

    // Store component data
    window.componentData = window.componentData || {};
    window.componentData[componentId] = {
        type: componentInfo.type,
        title: componentInfo.title,
        x: x,
        y: y,
        config: {}
    };

    // Make component draggable within canvas
    setupComponentDrag(component);

    // Update Dash store
    updateDashStore();
}

function setupComponentDrag(component) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    component.addEventListener('mousedown', function (e) {
        if (e.target.classList.contains('control-btn')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = parseInt(component.style.left);
        initialY = parseInt(component.style.top);

        component.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        component.style.left = (initialX + dx) + 'px';
        component.style.top = (initialY + dy) + 'px';

        // Update stored position
        const componentId = component.id;
        if (window.componentData && window.componentData[componentId]) {
            window.componentData[componentId].x = initialX + dx;
            window.componentData[componentId].y = initialY + dy;
        }

        // Redraw connections
        redrawConnections();
    });

    document.addEventListener('mouseup', function () {
        if (isDragging) {
            isDragging = false;
            component.style.cursor = 'move';
            updateDashStore();
        }
    });
}

function deleteComponent(componentId) {
    const component = document.getElementById(componentId);
    if (component) {
        component.remove();

        // Remove from data
        if (window.componentData) {
            delete window.componentData[componentId];
        }

        updateDashStore();
    }
}

function clearCanvas() {
    document.querySelectorAll('.canvas-component').forEach(comp => comp.remove());
    const svg = document.querySelector('.connection-svg');
    if (svg) svg.remove();

    window.componentData = {};
    window.componentConnections = [];
    updateDashStore();
}

// Connection Functions
function startConnection(componentId, pointType) {
    if (!isConnecting) {
        isConnecting = true;
        connectionStart = { componentId, pointType };

        // Visual feedback
        document.body.style.cursor = 'crosshair';
        showConnectionMode();

        // Show instruction
        showInstruction(`Now click on an ${pointType === 'output' ? 'input' : 'output'} point to complete the connection`);
    } else {
        // Complete connection
        completeConnection(componentId, pointType);
    }
}

function completeConnection(endComponentId, endPointType) {
    if (connectionStart && connectionStart.componentId !== endComponentId) {
        // Only allow output -> input connections
        if (connectionStart.pointType === 'output' && endPointType === 'input') {
            const connection = {
                from: connectionStart.componentId,
                to: endComponentId,
                id: 'conn_' + Date.now()
            };

            window.componentConnections = window.componentConnections || [];
            window.componentConnections.push(connection);

            drawConnection(connection);
            updateDashStore();
            showInstruction('Connection created! Click output → input to create more connections.');
        } else if (connectionStart.pointType === 'input' && endPointType === 'output') {
            showInstruction('Please connect from output to input (📤 → 📥)');
        } else {
            showInstruction('Cannot connect to the same type of point');
        }
    }

    // Reset connection state
    isConnecting = false;
    connectionStart = null;
    document.body.style.cursor = 'default';
    hideConnectionMode();
}

function drawConnection(connection) {
    const fromComponent = document.getElementById(connection.from);
    const toComponent = document.getElementById(connection.to);

    if (!fromComponent || !toComponent) return;

    const canvas = document.querySelector('.canvas');
    let svg = canvas.querySelector('.connection-svg');

    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('connection-svg');
        svg.innerHTML = `
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                        refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#007bff" />
                </marker>
            </defs>
        `;
        canvas.appendChild(svg);
    }

    const fromRect = fromComponent.getBoundingClientRect();
    const toRect = toComponent.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const x1 = fromRect.right - canvasRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
    const x2 = toRect.left - canvasRect.left;
    const y2 = toRect.top + toRect.height / 2 - canvasRect.top;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const curve = `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
    path.setAttribute('d', curve);
    path.classList.add('connection-line');
    path.dataset.connectionId = connection.id;

    // Add click handler for connection deletion
    path.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteConnection(connection.id);
    });

    svg.appendChild(path);
}

function deleteConnection(connectionId) {
    if (window.componentConnections) {
        window.componentConnections = window.componentConnections.filter(
            conn => conn.id !== connectionId
        );
        redrawConnections();
        updateDashStore();
    }
}

function redrawConnections() {
    const svg = document.querySelector('.connection-svg');
    if (svg) {
        // Remove existing paths
        svg.querySelectorAll('.connection-line').forEach(path => path.remove());

        // Redraw all connections
        if (window.componentConnections) {
            window.componentConnections.forEach(connection => {
                drawConnection(connection);
            });
        }
    }
}

function showConnectionMode() {
    document.querySelectorAll('.canvas-component').forEach(comp => {
        comp.classList.add('connection-mode');
    });
}

function hideConnectionMode() {
    document.querySelectorAll('.canvas-component').forEach(comp => {
        comp.classList.remove('connection-mode');
    });
}

function showInstruction(message) {
    let instructionDiv = document.getElementById('connection-instruction');
    if (!instructionDiv) {
        instructionDiv = document.createElement('div');
        instructionDiv.id = 'connection-instruction';
        instructionDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #007bff;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-weight: 500;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(instructionDiv);
    }
    instructionDiv.textContent = message;
    instructionDiv.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (instructionDiv && instructionDiv.style.display === 'block') {
            instructionDiv.style.display = 'none';
        }
    }, 3000);
}

function updateDashStore() {
    // Update Dash Store components with current state
    const storeData = {
        components: window.componentData || {},
        connections: window.componentConnections || [],
        timestamp: Date.now()
    };

    console.log('Updating store with:', storeData); // Debug log

    // Trigger Dash callback by updating hidden div
    const storeDiv = document.getElementById('canvas-store-trigger');
    if (storeDiv) {
        storeDiv.textContent = JSON.stringify(storeData);
        // Try multiple event types to ensure callback triggers
        storeDiv.dispatchEvent(new Event('change', { bubbles: true }));
        storeDiv.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        console.error('canvas-store-trigger element not found');
    }
}

// Export functions for Dash callbacks
window.dashDragDrop = {
    clearCanvas: clearCanvas,
    updateDashStore: updateDashStore,
    getCanvasState: () => ({
        components: window.componentData || {},
        connections: window.componentConnections || []
    })
};
