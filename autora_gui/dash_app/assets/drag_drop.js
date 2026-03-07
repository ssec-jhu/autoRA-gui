/**
 * Drag and Drop functionality for AutoRA Workflow Builder
 * Handles dragging nodes from the palette to the canvas and creating connections
 */

(function() {
    'use strict';

    // Global state for communication with Dash via polling
    window.pendingDropEvent = null;
    window.pendingEdgeEvent = null;

    // Connection mode state
    let connectionMode = {
        active: false,
        sourceNode: null
    };

    // Cache for Cytoscape instance
    let cyInstance = null;

    // Get Cytoscape instance (cached)
    function getCytoscape() {
        if (cyInstance) return cyInstance;

        const cyContainer = document.getElementById('workflow-canvas');
        if (cyContainer && cyContainer._cyreg && cyContainer._cyreg.cy) {
            cyInstance = cyContainer._cyreg.cy;
            return cyInstance;
        }
        return null;
    }

    // Wait for Cytoscape to be ready
    function waitForCytoscape(callback, maxAttempts = 100) {
        let attempts = 0;
        const checkCy = setInterval(() => {
            attempts++;
            const cy = getCytoscape();
            if (cy) {
                clearInterval(checkCy);
                callback(cy);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkCy);
                console.warn('Cytoscape not found after max attempts');
            }
        }, 50);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // Small delay to ensure Dash has rendered
        setTimeout(initialize, 100);
    }

    function initialize() {
        console.log('Initializing drag-drop handlers...');
        setupPaletteDragHandlers();
        setupCanvasDropZone();

        waitForCytoscape(function(cy) {
            console.log('Cytoscape ready, setting up interactions');
            setupCytoscapeInteractions(cy);
        });
    }

    // Setup drag handlers for palette items
    function setupPaletteDragHandlers() {
        document.addEventListener('dragstart', function(e) {
            const paletteItem = e.target.closest('.palette-item');
            if (!paletteItem) return;

            console.log('Drag started:', paletteItem.dataset.componentName);

            const dragData = {
                componentType: paletteItem.dataset.componentType,
                componentFile: paletteItem.dataset.componentFile,
                componentName: paletteItem.dataset.componentName
            };

            // Set drag data - use text/plain for broader compatibility
            e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
            e.dataTransfer.effectAllowed = 'copy';

            // Add visual feedback
            paletteItem.style.opacity = '0.5';
        });

        document.addEventListener('dragend', function(e) {
            const paletteItem = e.target.closest('.palette-item');
            if (paletteItem) {
                paletteItem.style.opacity = '1';
            }
        });

    }

    // Setup drop zone on canvas
    function setupCanvasDropZone() {
        const setupDropZone = () => {
            const canvasPanel = document.querySelector('.canvas-panel');
            if (!canvasPanel) {
                console.log('Canvas panel not found, retrying...');
                setTimeout(setupDropZone, 100);
                return;
            }

            console.log('Setting up drop zone on canvas panel');

            // Prevent default to allow drop
            canvasPanel.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                this.classList.add('drag-over');
            });

            canvasPanel.addEventListener('dragenter', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.add('drag-over');
            });

            canvasPanel.addEventListener('dragleave', function(e) {
                e.preventDefault();
                e.stopPropagation();
                // Only remove if actually leaving the panel
                const rect = this.getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX >= rect.right ||
                    e.clientY < rect.top || e.clientY >= rect.bottom) {
                    this.classList.remove('drag-over');
                }
            });

            canvasPanel.addEventListener('drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.remove('drag-over');

                console.log('Drop event received');

                try {
                    const jsonData = e.dataTransfer.getData('text/plain');
                    console.log('Drop data:', jsonData);

                    if (jsonData) {
                        const data = JSON.parse(jsonData);
                        if (data && data.componentType) {
                            handleNodeDrop(data, e.clientX, e.clientY);
                        }
                    }
                } catch (err) {
                    console.error('Error parsing drop data:', err);
                }
            });
        };

        setupDropZone();
    }

    // Handle node drop - calculate position and send to Dash
    function handleNodeDrop(data, clientX, clientY) {
        console.log('Handling node drop:', data.componentName, 'at', clientX, clientY);

        // Generate unique ID
        const nodeId = generateUUID();

        // Try to get position relative to cytoscape canvas
        let x = 200;
        let y = 200;

        const cy = getCytoscape();
        if (cy) {
            const container = cy.container();
            const rect = container.getBoundingClientRect();
            const pan = cy.pan();
            const zoom = cy.zoom();

            x = (clientX - rect.left - pan.x) / zoom;
            y = (clientY - rect.top - pan.y) / zoom;

            console.log('Calculated position:', x, y);
        } else {
            // Fallback: use position relative to canvas panel
            const canvasPanel = document.querySelector('.canvas-panel');
            if (canvasPanel) {
                const rect = canvasPanel.getBoundingClientRect();
                x = clientX - rect.left;
                y = clientY - rect.top - 80; // Account for header
            }
            console.log('Fallback position:', x, y);
        }

        // Set pending event for Dash to pick up via polling
        window.pendingDropEvent = {
            nodeId: nodeId,
            componentType: data.componentType,
            componentFile: data.componentFile,
            componentName: data.componentName,
            x: Math.max(50, x),
            y: Math.max(50, y),
            timestamp: Date.now()
        };

        console.log('Set pendingDropEvent:', window.pendingDropEvent);
    }

    // Setup Cytoscape interactions
    function setupCytoscapeInteractions(cy) {
        // Click on node - start connection if not active, complete if active
        cy.on('tap', 'node', function(evt) {
            evt.stopPropagation();
            const node = evt.target;

            if (!connectionMode.active) {
                // Start connection mode from this node
                enterConnectionMode(cy, node);
            } else if (connectionMode.sourceNode) {
                // Complete connection to this node (if not the same node)
                const sourceId = connectionMode.sourceNode.id();
                const targetId = node.id();
                if (sourceId !== targetId) {
                    createEdge(sourceId, targetId);
                }
                exitConnectionMode(cy);
            }
        });

        // Right-click on node to start/complete connection
        cy.on('cxttap', 'node', function(evt) {
            evt.preventDefault();
            const node = evt.target;

            if (!connectionMode.active) {
                enterConnectionMode(cy, node);
            } else if (connectionMode.sourceNode) {
                const sourceId = connectionMode.sourceNode.id();
                const targetId = node.id();
                if (sourceId !== targetId) {
                    createEdge(sourceId, targetId);
                }
                exitConnectionMode(cy);
            }
        });

        // Click on background to exit connection mode
        cy.on('tap', function(evt) {
            if (evt.target === cy) {
                if (connectionMode.active) {
                    exitConnectionMode(cy);
                }
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && connectionMode.active) {
                const cy = getCytoscape();
                if (cy) exitConnectionMode(cy);
            }

            // Delete selected nodes and edges
            if ((e.key === 'Delete' || e.key === 'Backspace') &&
                !e.target.matches('input, textarea')) {
                e.preventDefault();
                const cy = getCytoscape();
                if (cy) {
                    const selected = cy.$(':selected');
                    if (selected.length > 0) {
                        selected.remove();
                    }
                }
            }
        });

        // Prevent context menu on canvas
        cy.container().addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });
    }

    // Enter connection mode
    function enterConnectionMode(cy, sourceNode) {
        connectionMode.active = true;
        connectionMode.sourceNode = sourceNode;

        sourceNode.addClass('connection-source');
        cy.container().style.cursor = 'crosshair';

        showStatus('Click on a target node to create connection, or press Escape to cancel');
    }

    // Exit connection mode
    function exitConnectionMode(cy) {
        if (connectionMode.sourceNode) {
            connectionMode.sourceNode.removeClass('connection-source');
        }
        connectionMode.active = false;
        connectionMode.sourceNode = null;

        if (cy && cy.container()) {
            cy.container().style.cursor = '';
        }
        hideStatus();
    }

    // Create an edge between two nodes - send to Dash
    function createEdge(sourceId, targetId) {
        console.log('Creating edge:', sourceId, '->', targetId);
        window.pendingEdgeEvent = {
            source: sourceId,
            target: targetId,
            timestamp: Date.now()
        };
    }

    // Generate a UUID
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Status message helpers
    function showStatus(message) {
        let statusEl = document.getElementById('connection-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'connection-status';
            statusEl.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(76, 175, 80, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                font-size: 14px;
                z-index: 1000;
                pointer-events: none;
            `;
            document.body.appendChild(statusEl);
        }
        statusEl.textContent = message;
        statusEl.style.display = 'block';
    }

    function hideStatus() {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }

    // Expose for debugging
    window.autoraWorkflow = {
        getConnectionMode: () => connectionMode,
        getCytoscape: getCytoscape,
        testDrop: function(name) {
            window.pendingDropEvent = {
                nodeId: generateUUID(),
                componentType: 'experiment_runners',
                componentFile: 'test.json',
                componentName: name || 'Test Node',
                x: 200,
                y: 200,
                timestamp: Date.now()
            };
            console.log('Test drop event set');
        }
    };

})();
