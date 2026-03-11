---
name: js
description: Generate a complete drag-drop workflow editor with Vanilla JavaScript - 3-panel layout with component palette, canvas, and properties panel
---

# Workflow Editor Generator

Generate a complete drag-drop workflow editor using Vanilla JavaScript with a 3-panel layout.

## Layout Structure

Create a 3-panel layout:
- **Left Panel (Component Palette)**: Displays available components from JSON/components directory organized by type (theorists, experimentalists, experiment_runners)
- **Center Panel (Canvas)**: Drag-drop workspace for placing and connecting nodes with SVG bezier curve connections
- **Right Panel (Properties)**: Displays and allows editing of the selected node's parameters

## File Structure to Generate

```
js_app/
├── templates/
│   └── index.html          # Main HTML with 3-panel layout and node template
├── static/
│   ├── css/
│   │   └── styles.css      # All styling with dark theme
│   └── js/
│       └── app.js          # Main application logic
```

## Required Features

### 1. State Management
```javascript
const state = {
    components: {},           // Available components from API/JSON
    nodes: new Map(),         // Nodes on canvas: Map<nodeId, nodeData>
    connections: [],          // Connections between nodes
    selectedNode: null,       // Currently selected node
    selectedNodes: new Set(), // Multi-selected nodes
    selectedConnection: null, // Selected connection
    draggedComponent: null,   // Component being dragged from palette
    connecting: null,         // Connection in progress {source: nodeId}
    zoom: 1,                  // Canvas zoom level
    pan: { x: 0, y: 0 }       // Canvas pan offset
};
```

### 2. Component Palette (Left Panel)
- Load components from `/api/components` endpoint
- Organize by type with collapsible sections
- Each component item is draggable (`draggable="true"`)
- Show component name and icon based on type
- Include search/filter functionality

### 3. Canvas (Center Panel)
- Accept drops from component palette
- Render nodes as positioned HTML elements
- Render connections as SVG bezier curves with arrow markers
- Support node dragging with multi-select (Shift+click)
- Support rectangle selection (marquee)
- Handle zoom (Ctrl+scroll) and pan
- Coordinate conversion: `canvasX = (screenX - rect.left) / zoom - pan.x`

### 4. Node System
```javascript
// Node data structure
{
    id: "uuid",
    type: "theorists|experimentalists|experiment_runners",
    x: number,
    y: number,
    componentData: {...},  // Original component definition
    parameters: {...}      // Editable parameter values
}
```

Node features:
- Draggable positioning on canvas
- Input port (left side) and output port (right side)
- Visual styling based on type (different header colors)
- Delete button (× in header)
- Selection state with visual feedback (red border + glow)

### 5. Connection System
```javascript
// Connection data structure
{
    id: "uuid",
    source: "sourceNodeId",
    target: "targetNodeId",
    controlPoints: {
        cp1: { x, y },
        cp2: { x, y }
    }
}
```

Connection features:
- Click output port to start, click input port to complete
- Temporary line follows mouse during connection
- SVG cubic bezier curves: `M x1 y1 C cp1x cp1y cp2x cp2y x2 y2`
- Arrow markers at connection end
- Selectable (click to select)
- Deletable (Delete key or double-click)
- Draggable control points to reshape curves (visible when selected)
- Auto-routing when target is left of source

### 6. Properties Panel (Right Panel)
- Display selected node's information (name, type, description)
- Editable parameter inputs based on parameter type:
  - `integer`: `<input type="number" step="1">`
  - `real`: `<input type="number" step="any">`
  - `boolean`: `<select>` dropdown (True/False)
  - `categorical`: `<select>` dropdown with validValues
  - `string`: `<input type="text">`
- Real-time updates to node state on change
- Show "Select a node to edit properties" when nothing selected

### 7. Toolbar
- Save workflow button (downloads JSON)
- Load workflow button (file picker)
- Clear canvas button
- Zoom controls (+/- buttons)
- Node/connection count display

### 8. Keyboard Shortcuts
- `Delete/Backspace`: Delete selected nodes/connections
- `Ctrl/Cmd+A`: Select all nodes and connections
- `Escape`: Deselect all / Cancel connection in progress
- `Ctrl/Cmd+S`: Save workflow
- `Ctrl/Cmd+scroll`: Zoom in/out

### 9. Workflow Serialization
```javascript
// Save format
{
    name: "workflow_name",
    nodes: [{ id, type, x, y, componentFile, componentType, parameters }],
    connections: [{ id, source, target, controlPoints }]
}
```

## CSS Styling Guidelines

Use a dark theme with CSS variables:
```css
:root {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-tertiary: #0f3460;
    --text-primary: #e8e8e8;
    --text-muted: #a0a0a0;
    --accent-primary: #4a90d9;
    --accent-danger: #ef4444;
    --accent-warning: #f59e0b;
    --border-color: #2a2a4a;
}
```

Node type header colors:
- theorists: indigo (#6366f1)
- experimentalists: green (#22c55e)
- experiment_runners: amber (#f59e0b)

Visual states:
- Selected elements: red border with box-shadow glow
- Ports: circular dots that scale on hover
- Connections: smooth curves, thicker on hover/select
- Drag-over: visual feedback on canvas

## HTML Template for Nodes

```html
<template id="node-template">
    <div class="workflow-node" data-node-id="">
        <div class="node-header">
            <span class="node-icon"></span>
            <span class="node-title"></span>
            <button class="node-delete" title="Delete node">×</button>
        </div>
        <div class="node-body">
            <div class="node-port port-input" data-port="input" title="Input">
                <span class="port-dot"></span>
            </div>
            <div class="node-content">
                <span class="node-type"></span>
            </div>
            <div class="node-port port-output" data-port="output" title="Output">
                <span class="port-dot"></span>
            </div>
        </div>
    </div>
</template>
```

## Implementation Approach

1. Generate `index.html` with complete layout and node template
2. Generate `styles.css` with all styling (dark theme, nodes, connections, panels)
3. Generate `app.js` with all application logic:
   - Initialization and API loading
   - Drag-drop handlers
   - Node CRUD operations
   - Connection system with SVG rendering
   - Properties panel rendering
   - Save/load functionality
   - Keyboard shortcuts

## When Invoked

Generate all three files (HTML, CSS, JS) for a complete working workflow editor. The generated code should:
- Be production-ready with proper error handling
- Use ES6+ features (arrow functions, template literals, destructuring)
- Be well-commented for maintainability
- Work with a FastAPI backend serving `/api/components`

$ARGUMENTS
