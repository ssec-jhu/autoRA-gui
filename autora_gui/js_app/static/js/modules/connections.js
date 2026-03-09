/**
 * Connection System Module
 */

import { state } from './state.js';
import { generateUUID, updateStatus, updateCounts, canBeSource, canBeTarget } from './utils.js';
import { clearSelection } from './selection.js';
import { renderPropertiesPanel } from './properties.js';

// Connection state
let tempLine = null;
let tempLineStart = null;
let mousePathPoints = [];
let draggingControlPoint = null;

/**
 * Handle mouse down on node border for creating connections
 */
export function handleBorderMouseDown(e, nodeId, border) {
    e.stopPropagation();
    e.preventDefault();

    if (state.connecting) {
        cancelConnection();
    }

    const nodeData = state.nodes.get(nodeId);

    if (!canBeSource(nodeData)) {
        updateStatus('This node has no outputs');
        return;
    }

    const node = document.querySelector(`[data-node-id="${nodeId}"]`);
    const nodeRect = node.getBoundingClientRect();
    const svg = document.getElementById('connections-svg');
    const svgRect = svg.getBoundingClientRect();

    const borderRect = border.getBoundingClientRect();
    let startX, startY, relativePos;
    const borderClass = border.classList.contains('border-top') ? 'border-top' :
                        border.classList.contains('border-bottom') ? 'border-bottom' :
                        border.classList.contains('border-left') ? 'border-left' : 'border-right';

    if (borderClass === 'border-top') {
        startX = e.clientX - svgRect.left;
        startY = nodeRect.top - svgRect.top;
        relativePos = (e.clientX - nodeRect.left) / nodeRect.width;
    } else if (borderClass === 'border-bottom') {
        startX = e.clientX - svgRect.left;
        startY = nodeRect.bottom - svgRect.top;
        relativePos = (e.clientX - nodeRect.left) / nodeRect.width;
    } else if (borderClass === 'border-left') {
        startX = nodeRect.left - svgRect.left;
        startY = e.clientY - svgRect.top;
        relativePos = (e.clientY - nodeRect.top) / nodeRect.height;
    } else {
        startX = nodeRect.right - svgRect.left;
        startY = e.clientY - svgRect.top;
        relativePos = (e.clientY - nodeRect.top) / nodeRect.height;
    }

    relativePos = Math.max(0, Math.min(1, relativePos));

    tempLineStart = {
        nodeId: nodeId,
        x: startX,
        y: startY,
        border: borderClass,
        relativePos: relativePos
    };

    state.connecting = {
        source: nodeId,
        sourcePoint: { x: startX, y: startY },
        sourceBorder: borderClass,
        sourceRelativePos: relativePos
    };

    node.classList.add('connecting-source');

    document.querySelectorAll('.workflow-node').forEach(n => {
        if (n.dataset.nodeId !== nodeId) {
            const targetData = state.nodes.get(n.dataset.nodeId);
            if (canBeTarget(targetData)) {
                n.classList.add('valid-target');
            } else {
                n.classList.add('invalid-target');
            }
        }
    });

    document.addEventListener('mousemove', handleConnectionMouseMove);
    document.addEventListener('mouseup', handleConnectionMouseUp);
    document.addEventListener('keydown', handleConnectionEscape);

    updateStatus('Drag to another node to create connection');
}

/**
 * Handle mouse move during connection creation
 */
function handleConnectionMouseMove(e) {
    if (!tempLineStart) return;

    const svg = document.getElementById('connections-svg');
    const svgRect = svg.getBoundingClientRect();

    const endX = e.clientX - svgRect.left;
    const endY = e.clientY - svgRect.top;

    mousePathPoints.push({ x: endX, y: endY, time: Date.now() });
    if (mousePathPoints.length > 20) {
        mousePathPoints.shift();
    }

    if (!tempLine) {
        tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempLine.classList.add('connection-line', 'temp');
        ensureArrowMarker(svg, 'temp');
        tempLine.setAttribute('marker-end', 'url(#arrowhead-temp)');
        svg.appendChild(tempLine);
    }

    const sourceData = state.nodes.get(tempLineStart.nodeId);
    const sourceProtocol = sourceData?.componentData?.protocolType;
    const useStraightLine = sourceProtocol === 'start_point';

    let path;
    if (useStraightLine) {
        path = createStraightPath(tempLineStart.x, tempLineStart.y, endX, endY);
    } else {
        path = createConnectionPath(tempLineStart.x, tempLineStart.y, endX, endY, mousePathPoints);
    }
    tempLine.setAttribute('d', path);
}

/**
 * Handle mouse up to complete connection
 */
function handleConnectionMouseUp(e) {
    if (!state.connecting) return;

    const targetNode = e.target.closest('.workflow-node');

    if (targetNode) {
        const targetNodeId = targetNode.dataset.nodeId;

        if (targetNodeId !== state.connecting.source) {
            const svg = document.getElementById('connections-svg');
            const svgRect = svg.getBoundingClientRect();
            const nodeRect = targetNode.getBoundingClientRect();

            const mouseX = e.clientX;
            const mouseY = e.clientY;

            const distTop = Math.abs(mouseY - nodeRect.top);
            const distBottom = Math.abs(mouseY - nodeRect.bottom);
            const distLeft = Math.abs(mouseX - nodeRect.left);
            const distRight = Math.abs(mouseX - nodeRect.right);

            const minDist = Math.min(distTop, distBottom, distLeft, distRight);

            let targetBorder, endX, endY, targetRelativePos;

            if (minDist === distTop) {
                targetBorder = 'border-top';
                endX = mouseX - svgRect.left;
                endY = nodeRect.top - svgRect.top;
                targetRelativePos = (mouseX - nodeRect.left) / nodeRect.width;
            } else if (minDist === distBottom) {
                targetBorder = 'border-bottom';
                endX = mouseX - svgRect.left;
                endY = nodeRect.bottom - svgRect.top;
                targetRelativePos = (mouseX - nodeRect.left) / nodeRect.width;
            } else if (minDist === distLeft) {
                targetBorder = 'border-left';
                endX = nodeRect.left - svgRect.left;
                endY = mouseY - svgRect.top;
                targetRelativePos = (mouseY - nodeRect.top) / nodeRect.height;
            } else {
                targetBorder = 'border-right';
                endX = nodeRect.right - svgRect.left;
                endY = mouseY - svgRect.top;
                targetRelativePos = (mouseY - nodeRect.top) / nodeRect.height;
            }

            targetRelativePos = Math.max(0, Math.min(1, targetRelativePos));

            completeConnection(targetNodeId, endX, endY, targetBorder, targetRelativePos);
            return;
        }
    }

    cancelConnection();
    updateStatus('Connection cancelled');
}

/**
 * Complete a connection to target node
 */
function completeConnection(targetNodeId, endX, endY, targetBorder, targetRelativePos = 0.5) {
    if (targetNodeId === state.connecting.source) {
        updateStatus('Cannot connect a node to itself');
        cancelConnection();
        return;
    }

    const targetData = state.nodes.get(targetNodeId);
    if (!canBeTarget(targetData)) {
        updateStatus('This node cannot accept inputs');
        cancelConnection();
        return;
    }

    const exists = state.connections.some(c =>
        c.source === state.connecting.source && c.target === targetNodeId
    );

    if (exists) {
        updateStatus('Connection already exists');
        cancelConnection();
        return;
    }

    const curveOffset = calculateCurveOffset(
        state.connecting.sourcePoint.x,
        state.connecting.sourcePoint.y,
        endX, endY,
        mousePathPoints
    );

    createConnection(
        state.connecting.source,
        targetNodeId,
        state.connecting.sourcePoint,
        { x: endX, y: endY },
        state.connecting.sourceBorder,
        targetBorder,
        state.connecting.sourceRelativePos,
        targetRelativePos,
        curveOffset
    );
    cancelConnection();
    updateStatus('Connection created');
}

/**
 * Cancel connection in progress
 */
export function cancelConnection() {
    state.connecting = null;
    tempLineStart = null;
    mousePathPoints = [];

    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }

    document.querySelectorAll('.connecting-source, .valid-target, .invalid-target').forEach(el => {
        el.classList.remove('connecting-source', 'valid-target', 'invalid-target');
    });

    document.removeEventListener('mousemove', handleConnectionMouseMove);
    document.removeEventListener('mouseup', handleConnectionMouseUp);
    document.removeEventListener('keydown', handleConnectionEscape);
}

/**
 * Handle escape key to cancel connection
 */
function handleConnectionEscape(e) {
    if (e.key === 'Escape') {
        cancelConnection();
        updateStatus('Connection cancelled');
    }
}

/**
 * Create a connection between two nodes
 */
export function createConnection(sourceId, targetId, sourcePoint = null, targetPoint = null, sourceBorder = null, targetBorder = null, sourceRelativePos = 0.5, targetRelativePos = 0.5, curveOffset = 0) {
    const connection = {
        id: generateUUID(),
        source: sourceId,
        target: targetId,
        sourceAnchor: sourcePoint,
        targetAnchor: targetPoint,
        sourceBorder: sourceBorder,
        targetBorder: targetBorder,
        sourceRelativePos: sourceRelativePos,
        targetRelativePos: targetRelativePos,
        controlPoints: null,
        curveOffset: curveOffset
    };

    state.connections.push(connection);
    renderConnectionLine(connection);
    updateCounts();

    return connection.id;
}

/**
 * Delete a connection
 */
export function deleteConnection(connectionId) {
    const index = state.connections.findIndex(c => c.id === connectionId);
    if (index === -1) return;

    state.connections.splice(index, 1);
    removeConnectionLine(connectionId);

    state.selectedConnections.delete(connectionId);
    if (state.selectedConnection === connectionId) {
        state.selectedConnection = null;
    }

    updateCounts();
    updateStatus('Connection deleted');
}

/**
 * Delete all selected connections
 */
export function deleteSelectedConnections() {
    const toDelete = [...state.selectedConnections];
    toDelete.forEach(connId => deleteConnection(connId));
}

/**
 * Remove connection line from SVG
 */
export function removeConnectionLine(connectionId) {
    const svg = document.getElementById('connections-svg');
    svg.querySelectorAll(`[data-connection-id="${connectionId}"], [data-cp-connection="${connectionId}"]`).forEach(el => el.remove());
}

/**
 * Select a connection
 */
export function selectConnection(connectionId) {
    clearSelection();
    renderPropertiesPanel(null);

    if (state.selectedConnection === connectionId) {
        deselectConnectionsInternal();
        return;
    }

    deselectConnectionsInternal();

    state.selectedConnection = connectionId;
    state.selectedConnections.add(connectionId);

    const line = document.querySelector(`[data-connection-id="${connectionId}"]`);
    if (line) line.classList.add('selected');

    const connection = state.connections.find(c => c.id === connectionId);
    if (connection) {
        renderConnectionLine(connection);
    }

    updateStatus('Connection selected - drag control points to reshape');
}

function deselectConnectionsInternal() {
    state.selectedConnections.forEach(connId => {
        const line = document.querySelector(`[data-connection-id="${connId}"]`);
        if (line) line.classList.remove('selected');
    });
    state.selectedConnections.clear();
    state.selectedConnection = null;
    document.querySelectorAll('.waypoint-handle, .control-line').forEach(el => el.remove());
}

/**
 * Create connection path based on mouse movement
 */
function createConnectionPath(x1, y1, x2, y2, pathPoints = null) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let curveOffset = calculateCurveOffset(x1, y1, x2, y2, pathPoints);

    if (Math.abs(curveOffset) < 5) {
        curveOffset = distance * -0.3;
    }

    return createParabolicPath(x1, y1, x2, y2, curveOffset);
}

/**
 * Create a straight line path
 */
export function createStraightPath(x1, y1, x2, y2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/**
 * Create a parabolic (quadratic bezier) curve
 */
export function createParabolicPath(x1, y1, x2, y2, curveOffset) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    const perpX = -dy / distance;
    const perpY = dx / distance;

    const cpX = midX + perpX * curveOffset;
    const cpY = midY + perpY * curveOffset;

    return `M ${x1} ${y1} Q ${cpX} ${cpY}, ${x2} ${y2}`;
}

/**
 * Calculate curve offset based on mouse path deviation
 */
function calculateCurveOffset(x1, y1, x2, y2, pathPoints) {
    if (!pathPoints || pathPoints.length < 3) {
        return 0;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return 0;

    let totalDeviation = 0;
    let count = 0;

    for (const point of pathPoints) {
        const apX = point.x - x1;
        const apY = point.y - y1;
        const crossProduct = dx * apY - dy * apX;
        const deviation = crossProduct / distance;
        totalDeviation += deviation;
        count++;
    }

    const avgDeviation = totalDeviation / count;
    const scaledOffset = Math.max(-150, Math.min(150, avgDeviation * 1.5));

    return scaledOffset;
}

/**
 * Create bezier path string (legacy)
 */
function createBezierPath(x1, y1, x2, y2, controlPoints = null) {
    if (controlPoints) {
        return `M ${x1} ${y1} C ${controlPoints.cp1.x} ${controlPoints.cp1.y}, ${controlPoints.cp2.x} ${controlPoints.cp2.y}, ${x2} ${y2}`;
    }
    return createParabolicPath(x1, y1, x2, y2, 0);
}

/**
 * Calculate default control points for bezier curve
 */
function getDefaultControlPoints(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
        return {
            cp1: { x: x1, y: y1 },
            cp2: { x: x2, y: y2 }
        };
    }

    const curvature = Math.max(30, distance * 0.3);
    const perpX = dy / distance;
    const perpY = -dx / distance;

    const cp1 = {
        x: x1 + dx * 0.25 + perpX * curvature,
        y: y1 + dy * 0.25 + perpY * curvature
    };

    const cp2 = {
        x: x1 + dx * 0.75 + perpX * curvature,
        y: y1 + dy * 0.75 + perpY * curvature
    };

    return { cp1, cp2 };
}

/**
 * Ensure arrow marker exists in SVG
 */
export function ensureArrowMarker(svg, suffix = '') {
    const id = suffix ? `arrowhead-${suffix}` : 'arrowhead';
    if (svg.querySelector(`#${id}`)) return;

    const defs = svg.querySelector('defs') || svg.insertBefore(
        document.createElementNS('http://www.w3.org/2000/svg', 'defs'),
        svg.firstChild
    );

    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '12');
    marker.setAttribute('markerHeight', '12');
    marker.setAttribute('refX', '12');
    marker.setAttribute('refY', '6');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L12,6 L0,12 L3,6 Z');
    path.setAttribute('fill', suffix === 'temp' ? '#22c55e' : '#4a90d9');

    marker.appendChild(path);
    defs.appendChild(marker);
}

/**
 * Calculate connection anchor point on a node
 */
function getConnectionAnchor(nodeElement, svgRect, border, relativePos = 0.5) {
    const nodeRect = nodeElement.getBoundingClientRect();
    let x, y;

    switch (border) {
        case 'border-top':
            x = nodeRect.left + nodeRect.width * relativePos - svgRect.left;
            y = nodeRect.top - svgRect.top;
            break;
        case 'border-bottom':
            x = nodeRect.left + nodeRect.width * relativePos - svgRect.left;
            y = nodeRect.bottom - svgRect.top;
            break;
        case 'border-left':
            x = nodeRect.left - svgRect.left;
            y = nodeRect.top + nodeRect.height * relativePos - svgRect.top;
            break;
        case 'border-right':
        default:
            x = nodeRect.right - svgRect.left;
            y = nodeRect.top + nodeRect.height * relativePos - svgRect.top;
            break;
    }

    return { x, y };
}

/**
 * Determine best border for connecting two nodes
 */
function determineBestBorder(sourceNode, targetNode, svgRect) {
    const sourceRect = sourceNode.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();

    const sourceCenterX = sourceRect.left + sourceRect.width / 2;
    const sourceCenterY = sourceRect.top + sourceRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;

    let sourceBorder, targetBorder;

    if (Math.abs(dx) > Math.abs(dy)) {
        sourceBorder = dx > 0 ? 'border-right' : 'border-left';
        targetBorder = dx > 0 ? 'border-left' : 'border-right';
    } else {
        sourceBorder = dy > 0 ? 'border-bottom' : 'border-top';
        targetBorder = dy > 0 ? 'border-top' : 'border-bottom';
    }

    return { sourceBorder, targetBorder };
}

/**
 * Render a connection line
 */
export function renderConnectionLine(connection) {
    const svg = document.getElementById('connections-svg');
    const sourceNode = document.querySelector(`[data-node-id="${connection.source}"]`);
    const targetNode = document.querySelector(`[data-node-id="${connection.target}"]`);

    if (!sourceNode || !targetNode) return;

    const svgRect = svg.getBoundingClientRect();

    let startX, startY, endX, endY;

    const sourceRelPos = connection.sourceRelativePos !== undefined ? connection.sourceRelativePos : 0.5;
    const targetRelPos = connection.targetRelativePos !== undefined ? connection.targetRelativePos : 0.5;

    if (connection.sourceBorder && connection.targetBorder) {
        const sourceAnchor = getConnectionAnchor(sourceNode, svgRect, connection.sourceBorder, sourceRelPos);
        const targetAnchor = getConnectionAnchor(targetNode, svgRect, connection.targetBorder, targetRelPos);
        startX = sourceAnchor.x;
        startY = sourceAnchor.y;
        endX = targetAnchor.x;
        endY = targetAnchor.y;
    } else {
        const { sourceBorder, targetBorder } = determineBestBorder(sourceNode, targetNode, svgRect);
        const sourceAnchor = getConnectionAnchor(sourceNode, svgRect, sourceBorder, sourceRelPos);
        const targetAnchor = getConnectionAnchor(targetNode, svgRect, targetBorder, targetRelPos);
        startX = sourceAnchor.x;
        startY = sourceAnchor.y;
        endX = targetAnchor.x;
        endY = targetAnchor.y;

        connection.sourceBorder = sourceBorder;
        connection.targetBorder = targetBorder;
    }

    let path = svg.querySelector(`[data-connection-id="${connection.id}"]`);
    if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('connection-line');
        path.dataset.connectionId = connection.id;

        path.addEventListener('click', (e) => {
            e.stopPropagation();
            selectConnection(connection.id);
        });

        path.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            deleteConnection(connection.id);
        });

        ensureArrowMarker(svg);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        svg.appendChild(path);
    }

    let pathD;
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const sourceData = state.nodes.get(connection.source);
    const targetData = state.nodes.get(connection.target);
    const sourceProtocol = sourceData?.componentData?.protocolType;
    const targetProtocol = targetData?.componentData?.protocolType;
    const useStraightLine = sourceProtocol === 'start_point' || targetProtocol === 'end_point';

    if (useStraightLine) {
        pathD = createStraightPath(startX, startY, endX, endY);
    } else if (connection.curveOffset !== undefined && connection.curveOffset !== null && Math.abs(connection.curveOffset) > 5) {
        pathD = createParabolicPath(startX, startY, endX, endY, connection.curveOffset);
    } else if (connection.controlPoints) {
        pathD = createBezierPath(startX, startY, endX, endY, connection.controlPoints);
    } else {
        const defaultCurveOffset = distance * -0.3;
        pathD = createParabolicPath(startX, startY, endX, endY, defaultCurveOffset);
    }
    path.setAttribute('d', pathD);

    if (state.selectedConnection === connection.id && connection.controlPoints) {
        const controlPoints = connection.controlPoints || getDefaultControlPoints(startX, startY, endX, endY);
        renderControlPointHandles(connection, startX, startY, endX, endY, controlPoints, svg);
    }
}

/**
 * Render control point handles for a selected connection
 */
function renderControlPointHandles(connection, startX, startY, endX, endY, controlPoints, svg) {
    svg.querySelectorAll(`[data-cp-connection="${connection.id}"]`).forEach(el => el.remove());

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', startX);
    line1.setAttribute('y1', startY);
    line1.setAttribute('x2', controlPoints.cp1.x);
    line1.setAttribute('y2', controlPoints.cp1.y);
    line1.classList.add('control-line');
    line1.dataset.cpConnection = connection.id;
    svg.appendChild(line1);

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', endX);
    line2.setAttribute('y1', endY);
    line2.setAttribute('x2', controlPoints.cp2.x);
    line2.setAttribute('y2', controlPoints.cp2.y);
    line2.classList.add('control-line');
    line2.dataset.cpConnection = connection.id;
    svg.appendChild(line2);

    createControlPointHandle(connection, controlPoints.cp1, 'cp1', svg, startX, startY, endX, endY);
    createControlPointHandle(connection, controlPoints.cp2, 'cp2', svg, startX, startY, endX, endY);
}

/**
 * Create a draggable control point handle
 */
function createControlPointHandle(connection, point, cpName, svg, startX, startY, endX, endY) {
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.setAttribute('cx', point.x);
    handle.setAttribute('cy', point.y);
    handle.setAttribute('r', '8');
    handle.classList.add('waypoint-handle');
    handle.dataset.cpConnection = connection.id;
    handle.dataset.cpName = cpName;

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startDraggingControlPoint(e, connection, cpName, svg, startX, startY, endX, endY);
    });

    svg.appendChild(handle);
}

/**
 * Start dragging a control point
 */
function startDraggingControlPoint(e, connection, cpName, svg, startX, startY, endX, endY) {
    const svgRect = svg.getBoundingClientRect();

    draggingControlPoint = {
        connection,
        cpName,
        svg,
        svgRect,
        startX,
        startY,
        endX,
        endY
    };

    document.addEventListener('mousemove', handleControlPointDrag);
    document.addEventListener('mouseup', handleControlPointDragEnd);
}

/**
 * Handle control point dragging
 */
function handleControlPointDrag(e) {
    if (!draggingControlPoint) return;

    const { connection, cpName, svg, svgRect, startX, startY, endX, endY } = draggingControlPoint;

    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;

    if (!connection.controlPoints) {
        connection.controlPoints = getDefaultControlPoints(startX, startY, endX, endY);
    }

    connection.controlPoints[cpName] = { x, y };

    renderConnectionLine(connection);
}

/**
 * Handle control point drag end
 */
function handleControlPointDragEnd(e) {
    draggingControlPoint = null;
    document.removeEventListener('mousemove', handleControlPointDrag);
    document.removeEventListener('mouseup', handleControlPointDragEnd);
}

/**
 * Update all connection lines
 */
export function updateConnectionLines() {
    state.connections.forEach(conn => renderConnectionLine(conn));
}
