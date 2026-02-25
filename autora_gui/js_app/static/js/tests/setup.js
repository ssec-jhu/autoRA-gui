/**
 * Jest setup file for workflow editor tests.
 * Sets up the DOM environment and loads app.js functions.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock fetch globally
global.fetch = jest.fn();

// Create a minimal DOM structure needed by app.js
document.body.innerHTML = `
  <div id="component-palette"></div>
  <div class="canvas-container">
    <div id="workflow-canvas">
      <div id="canvas-hint"></div>
    </div>
    <svg id="connections-svg"></svg>
  </div>
  <div id="properties-panel"></div>
  <div id="status-bar"></div>
  <span id="node-count">Nodes: 0</span>
  <span id="connection-count">Connections: 0</span>
  <span id="zoom-level">100%</span>
  <button id="btn-save"></button>
  <button id="btn-load"></button>
  <button id="btn-clear"></button>
  <button id="btn-zoom-in"></button>
  <button id="btn-zoom-out"></button>
  <input id="file-input" type="file" />
  <input id="component-search" type="text" />
  <template id="node-template">
    <div class="workflow-node" data-node-id="">
      <div class="node-header">
        <span class="node-icon"></span>
        <span class="node-title"></span>
        <button class="node-delete" title="Delete node">&times;</button>
      </div>
      <div class="node-body">
        <div class="node-content">
          <span class="node-type"></span>
        </div>
      </div>
      <div class="connection-border border-top"></div>
      <div class="connection-border border-right"></div>
      <div class="connection-border border-bottom"></div>
      <div class="connection-border border-left"></div>
    </div>
  </template>
`;

// Read the app.js file
const appJsPath = path.join(__dirname, '..', 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Remove the DOMContentLoaded listener to prevent auto-init during tests
appJsContent = appJsContent.replace(
  "document.addEventListener('DOMContentLoaded', init);",
  "// Auto-init disabled for testing"
);

// Create context with all browser globals
const context = {
  // DOM globals
  document,
  window,
  navigator,
  console,

  // URL API
  URL,
  Blob,
  FileReader: global.FileReader || class FileReader {
    readAsText(blob) {
      this.onload && this.onload({ target: { result: '' } });
    }
  },

  // Fetch
  fetch: global.fetch,

  // SVG namespace
  SVGElement: global.SVGElement || class SVGElement {},

  // Timer functions
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,

  // Math
  Math,

  // JSON
  JSON,

  // Array, Map, Set
  Array,
  Map,
  Set,
  Object,
  String,
  Number,
  Boolean,

  // Error types
  Error,

  // Functions that will be exported to global
  __exports__: {}
};

// Use vm.createContext and vm.runInContext to execute app.js
vm.createContext(context);

// Wrap the code to capture exports
const wrappedCode = `
${appJsContent}

// Export all functions and state to __exports__
__exports__.state = state;
__exports__.generateUUID = generateUUID;
__exports__.updateStatus = updateStatus;
__exports__.updateCounts = updateCounts;
__exports__.getTypeIcon = getTypeIcon;
__exports__.formatTypeName = formatTypeName;
__exports__.loadComponents = loadComponents;
__exports__.renderComponentPalette = renderComponentPalette;
__exports__.filterComponents = filterComponents;
__exports__.handleDragStart = handleDragStart;
__exports__.handleDragEnd = handleDragEnd;
__exports__.handleCanvasDragOver = handleCanvasDragOver;
__exports__.handleCanvasDragLeave = handleCanvasDragLeave;
__exports__.handleCanvasDrop = handleCanvasDrop;
__exports__.extractParameters = extractParameters;
__exports__.createNode = createNode;
__exports__.renderNode = renderNode;
__exports__.deleteNode = deleteNode;
__exports__.deleteSelectedNodes = deleteSelectedNodes;
__exports__.handleNodeMouseDown = handleNodeMouseDown;
__exports__.handleNodeDrag = handleNodeDrag;
__exports__.handleNodeDragEnd = handleNodeDragEnd;
__exports__.clearSelection = clearSelection;
__exports__.deselectConnections = deselectConnections;
__exports__.selectAll = selectAll;
__exports__.handleCanvasMouseDown = handleCanvasMouseDown;
__exports__.handleSelectionDrag = handleSelectionDrag;
__exports__.handleSelectionEnd = handleSelectionEnd;
__exports__.handleBorderMouseDown = handleBorderMouseDown;
__exports__.handleConnectionMouseUp = handleConnectionMouseUp;
__exports__.completeConnection = completeConnection;
__exports__.handleConnectionMouseMove = handleConnectionMouseMove;
__exports__.cancelConnection = cancelConnection;
__exports__.handleConnectionEscape = handleConnectionEscape;
__exports__.createConnection = createConnection;
__exports__.deleteConnection = deleteConnection;
__exports__.deleteSelectedConnections = deleteSelectedConnections;
__exports__.removeConnectionLine = removeConnectionLine;
__exports__.selectConnection = selectConnection;
__exports__.createBezierPath = createBezierPath;
__exports__.getDefaultControlPoints = getDefaultControlPoints;
__exports__.ensureArrowMarker = ensureArrowMarker;
__exports__.getConnectionAnchor = getConnectionAnchor;
__exports__.determineBestBorder = determineBestBorder;
__exports__.renderConnectionLine = renderConnectionLine;
__exports__.renderControlPointHandles = renderControlPointHandles;
__exports__.createControlPointHandle = createControlPointHandle;
__exports__.startDraggingControlPoint = startDraggingControlPoint;
__exports__.handleControlPointDrag = handleControlPointDrag;
__exports__.handleControlPointDragEnd = handleControlPointDragEnd;
__exports__.updateConnectionLines = updateConnectionLines;
__exports__.renderPropertiesPanel = renderPropertiesPanel;
__exports__.renderParameterInput = renderParameterInput;
__exports__.formatDataTypes = formatDataTypes;
__exports__.setZoom = setZoom;
__exports__.handleWheel = handleWheel;
__exports__.saveWorkflow = saveWorkflow;
__exports__.loadWorkflow = loadWorkflow;
__exports__.findComponentDataByProtocolUuid = findComponentDataByProtocolUuid;
__exports__.findComponentData = findComponentData;
__exports__.clearCanvas = clearCanvas;
__exports__.handleKeyDown = handleKeyDown;
__exports__.init = init;
`;

try {
  vm.runInContext(wrappedCode, context);

  // Copy exports to global scope
  Object.assign(global, context.__exports__);
} catch (error) {
  console.error('Error loading app.js:', error);
  throw error;
}
