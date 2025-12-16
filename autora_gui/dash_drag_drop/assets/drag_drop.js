// Global state management
window.componentData = window.componentData || {};
window.componentConnections = window.componentConnections || [];
window.isConnecting = false;
window.connectionStart = null;

let draggedComponent = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {
    setupDragAndDrop();
    // Delay SVG creation to ensure canvas is ready
    setTimeout(createConnectionSVG, 100);
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
            
            const canvas = e.target.closest('.canvas-container').querySelector('.canvas');
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            createCanvasComponent(draggedComponent, x, y);
            draggedComponent = null;
        }
    });

    // Global click handler for connection points
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('input-point') || e.target.classList.contains('output-point')) {
            e.stopPropagation();
            const componentId = e.target.getAttribute('data-component-id');
            const pointType = e.target.getAttribute('data-point-type');
            handleConnectionPoint(componentId, pointType);
        }
    });
}

function createCanvasComponent(componentInfo, x, y, existingId = null) {
    const componentId = existingId || 'component_' + Date.now();
    
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
                <button class="control-btn delete-btn">❌</button>
            </div>
        </div>
        <div class="component-content">${componentInfo.description}</div>
        <div class="connection-points">
            <div class="input-point" data-component-id="${componentId}" data-point-type="input">📥 Input</div>
            <div class="output-point" data-component-id="${componentId}" data-point-type="output">📤 Output</div>
        </div>
    `;

    // Add to canvas
    const canvas = document.querySelector('.canvas');
    canvas.appendChild(component);

    // Store component data
    window.componentData[componentId] = {
        type: componentInfo.type,
        title: componentInfo.title,
        x: x,
        y: y,
        config: {}
    };

    console.log('Component created:', componentId, window.componentData[componentId]);

    // Setup event handlers
    setupComponentEventHandlers(component);
    
    return component;
}

function setupComponentEventHandlers(component) {
    // Delete button handler
    const deleteBtn = component.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteComponent(component.id);
    });

    // Setup drag functionality
    setupComponentDrag(component);
}

function handleConnectionPoint(componentId, pointType) {
    console.log('Connection point clicked:', componentId, pointType, 'isConnecting:', window.isConnecting);
    
    if (!window.isConnecting) {
        // Start connection
        window.isConnecting = true;
        window.connectionStart = {
            componentId: componentId,
            pointType: pointType
        };
        document.body.style.cursor = 'crosshair';
        showConnectionMode();
        showInstruction(`Click on an ${pointType === 'output' ? 'input' : 'output'} point to complete the connection`);
    } else {
        // Complete connection
        const start = window.connectionStart;
        
        if (start.componentId !== componentId) {
            if ((start.pointType === 'output' && pointType === 'input') ||
                (start.pointType === 'input' && pointType === 'output')) {
                
                // Create the connection
                let fromId, toId;
                if (start.pointType === 'output') {
                    fromId = start.componentId;
                    toId = componentId;
                } else {
                    fromId = componentId;
                    toId = start.componentId;
                }
                
                createConnection(fromId, toId);
                showInstruction('Connection created!');
                setTimeout(hideInstruction, 1000);
            } else {
                showInstruction('Cannot connect same type of points!');
                setTimeout(hideInstruction, 2000);
            }
        }
        
        // Reset connection state
        window.isConnecting = false;
        window.connectionStart = null;
        document.body.style.cursor = 'default';
        hideConnectionMode();
    }
}

function setupComponentDrag(component) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    component.addEventListener('mousedown', function (e) {
        if (
            e.target.classList.contains('control-btn') ||
            e.target.classList.contains('input-point') ||
            e.target.classList.contains('output-point')
        ) {
            return;
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = parseInt(component.style.left);
        initialY = parseInt(component.style.top);

        component.style.cursor = 'grabbing';
        component.style.zIndex = '1000';
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
            component.style.zIndex = '';
        }
    });
}

function deleteComponent(componentId) {
    const component = document.getElementById(componentId);
    if (component) {
        component.remove();
    }

    // Remove from stored data
    delete window.componentData[componentId];

    // Remove related connections
    window.componentConnections = window.componentConnections.filter(
        conn => conn.from !== componentId && conn.to !== componentId
    );

    redrawConnections();
}

function createConnection(fromId, toId) {
    // Check if connection already exists
    const exists = window.componentConnections.some(conn => 
        conn.from === fromId && conn.to === toId
    );
    
    if (exists) {
        console.log('Connection already exists');
        showInstruction('Connection already exists!');
        setTimeout(hideInstruction, 2000);
        return;
    }
    
    const connectionId = 'conn_' + Date.now();
    const connection = {
        from: fromId,
        to: toId,
        id: connectionId
    };
    
    window.componentConnections.push(connection);
    
    console.log('Connection created:', connection);
    console.log('All connections:', window.componentConnections);
    
    // Ensure SVG exists before drawing
    if (!document.querySelector('.connection-svg')) {
        createConnectionSVG();
    }
    
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => drawConnection(connection), 50);
}

function createConnectionSVG() {
    const canvas = document.querySelector('.canvas');
    if (!canvas) {
        console.error('Canvas not found');
        return;
    }
    
    // Remove existing SVG if any
    const existingSvg = canvas.querySelector('.connection-svg');
    if (existingSvg) {
        existingSvg.remove();
    }
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('connection-svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '1';
    
    // Add arrow marker definition
    svg.innerHTML = `
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                    refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#007bff" />
            </marker>
        </defs>
    `;
    
    canvas.appendChild(svg);
    console.log('SVG created');
}

function drawConnection(connection) {
    const fromElement = document.getElementById(connection.from);
    const toElement = document.getElementById(connection.to);
    
    if (!fromElement || !toElement) {
        console.error('Cannot find elements for connection:', connection);
        return;
    }
    
    const svg = document.querySelector('.connection-svg');
    if (!svg) {
        console.error('SVG container not found');
        createConnectionSVG();
        setTimeout(() => drawConnection(connection), 50);
        return;
    }
    
    const canvas = document.querySelector('.canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const canvasScrollLeft = canvas.scrollLeft;
    const canvasScrollTop = canvas.scrollTop;
    
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();
    
    // Calculate positions relative to canvas, accounting for scroll
    const fromX = fromRect.right - canvasRect.left + canvasScrollLeft;
    const fromY = fromRect.top + fromRect.height / 2 - canvasRect.top + canvasScrollTop;
    const toX = toRect.left - canvasRect.left + canvasScrollLeft;
    const toY = toRect.top + toRect.height / 2 - canvasRect.top + canvasScrollTop;
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    // Create a curved path
    const midX = (fromX + toX) / 2;
    const d = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
    
    path.setAttribute('d', d);
    path.setAttribute('class', 'connection-line');
    path.setAttribute('id', connection.id);
    path.setAttribute('stroke', '#007bff');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    path.style.pointerEvents = 'stroke';
    path.style.cursor = 'pointer';
    
    path.onclick = function(e) {
        e.stopPropagation();
        if (confirm('Delete this connection?')) {
            deleteConnection(connection.id);
        }
    };
    
    svg.appendChild(path);
    console.log('Path drawn:', d);
}

function deleteConnection(connectionId) {
    window.componentConnections = window.componentConnections.filter(
        conn => conn.id !== connectionId
    );
    redrawConnections();
}

function redrawConnections() {
    const svg = document.querySelector('.connection-svg');
    if (!svg) {
        createConnectionSVG();
        setTimeout(redrawConnections, 50);
        return;
    }
    
    // Remove existing paths
    svg.querySelectorAll('.connection-line').forEach(path => path.remove());

    // Redraw all connections
    window.componentConnections.forEach(connection => {
        drawConnection(connection);
    });
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

function showInstruction(text) {
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
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(instructionDiv);
    }
    instructionDiv.textContent = text;
    instructionDiv.style.display = 'block';
}

function hideInstruction() {
    const instructionDiv = document.getElementById('connection-instruction');
    if (instructionDiv) {
        instructionDiv.style.display = 'none';
    }
}

function clearCanvas() {
    const canvas = document.querySelector('.canvas');
    if (!canvas) return;
    
    // Remove all components
    canvas.querySelectorAll('.canvas-component').forEach(comp => comp.remove());
    
    // Clear global state
    window.componentData = {};
    window.componentConnections = [];
    
    // Clear connection lines
    redrawConnections();
}

// Load workflow into canvas
window.loadWorkflowIntoCanvas = function(workflow) {
    console.log('Loading workflow:', workflow);
    
    // Clear existing components
    clearCanvas();

    const components = workflow.components || {};

    // Restore components
    for (const compId in components) {
        const comp = components[compId];
        createCanvasComponent(
            { 
                title: comp.title, 
                description: comp.description || "", 
                type: comp.type 
            },
            comp.x,
            comp.y,
            compId
        );
    }

    // Restore connections
    if (workflow.connections) {
        window.componentConnections = workflow.connections.slice();
        setTimeout(redrawConnections, 100);
    }
};

