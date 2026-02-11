---
name: dash
description: Reference guide for building interactive web applications with Plotly Dash framework
disable-model-invocation: true
allowed-tools: WebFetch, WebSearch, Read, Grep, Write, Edit
---

# Dash Framework Skill

Reference guide for building interactive web applications using Plotly's Dash framework.

## Overview

**Documentation**: https://dash.plotly.com/
**PyPI**: https://pypi.org/project/dash/
**GitHub**: https://github.com/plotly/dash
**Version**: 3.4.0 (Production/Stable)
**License**: MIT

Dash is Plotly's Python framework for building ML & data science web apps. Built on Plotly.js, React, and Flask. Enables interactive UI tied to analytical Python code without writing JavaScript.

## Installation

```bash
pip install dash
```

Optional extras: `async`, `celery`, `diskcache`, `compress`, `cloud`, `ag-grid`

## Core Architecture

### Component Libraries

| Library | Import | Purpose |
|---------|--------|---------|
| HTML Components | `dash.html` | Standard HTML elements (Div, H1, Table, etc.) |
| Core Components | `dash.dcc` | Interactive elements (Dropdown, Graph, Slider, Input) |
| DataTable | `dash.dash_table` | Data presentation and manipulation |
| Bootstrap | `dash_bootstrap_components` | Pre-styled responsive UI |
| Mantine | `dash_mantine_components` | Modern customizable UI |
| DAQ | `dash_daq` | Industrial controls and monitoring |

### Basic App Structure

```python
from dash import Dash, html, dcc, callback, Input, Output

app = Dash(__name__)

app.layout = html.Div([
    html.H1('My Dashboard'),
    dcc.Input(id='my-input', value='initial', type='text'),
    html.Div(id='my-output')
])

@callback(
    Output('my-output', 'children'),
    Input('my-input', 'value')
)
def update_output(value):
    return f'You entered: {value}'

if __name__ == '__main__':
    app.run(debug=True)
```

## Layout

The `layout` property defines the app's UI as a hierarchical tree of components.

### HTML Components (`dash.html`)

Python equivalents of HTML tags:
- `html.Div`, `html.H1`, `html.P`, `html.Table`, etc.
- `className` instead of `class`
- Styles as dictionaries with camelCase: `{'textAlign': 'center', 'color': 'blue'}`
- `children` as first positional argument

### Core Components (`dash.dcc`)

Interactive elements generated with React.js:
- `dcc.Dropdown` - Selection menus
- `dcc.Graph` - Plotly charts (~50 chart types)
- `dcc.Slider`, `dcc.RangeSlider` - Numeric selection
- `dcc.Input` - Text input
- `dcc.Checklist`, `dcc.RadioItems` - Multiple choice
- `dcc.DatePickerSingle`, `dcc.DatePickerRange` - Date selection
- `dcc.Markdown` - Markdown rendering
- `dcc.Store` - Client-side data storage
- `dcc.Loading` - Loading spinners

## Callbacks

Reactive functions that update outputs when inputs change.

### Decorator Syntax

```python
@callback(
    Output(component_id='output-div', component_property='children'),
    Input(component_id='input-field', component_property='value'),
    State(component_id='state-field', component_property='value')
)
def update_output(input_value, state_value):
    return f'Input: {input_value}, State: {state_value}'
```

### Input, Output, State

| Decorator | Purpose |
|-----------|---------|
| `Input` | Triggers callback when property changes; value passed to function |
| `Output` | Receives callback return value; updates component property |
| `State` | Passes value without triggering callback (form patterns) |

### Multiple Inputs/Outputs

```python
@callback(
    Output('graph', 'figure'),
    Output('table', 'data'),
    Input('dropdown', 'value'),
    Input('slider', 'value')
)
def update_both(dropdown_val, slider_val):
    fig = create_figure(dropdown_val, slider_val)
    data = create_data(dropdown_val, slider_val)
    return fig, data
```

### Callback Rules

- Decorator must sit directly above function (no blank lines)
- Component IDs must match those in layout
- Don't modify variables outside callback scope (session conflicts)
- Load data in global scope, not within callbacks

## Key Documentation Links

- Quickstart: https://dash.plotly.com/tutorial
- Layout: https://dash.plotly.com/layout
- Basic Callbacks: https://dash.plotly.com/basic-callbacks
- Interactive Graphing: https://dash.plotly.com/interactive-graphing
- Sharing Data: https://dash.plotly.com/sharing-data-between-callbacks
- Component Gallery: https://dash.plotly.com/dash-core-components

## Research Focus

When invoked, help with:

1. **Layout Design**: Structure apps with HTML and Core components
2. **Callbacks**: Implement reactive behavior with Input/Output/State
3. **Graphs**: Create interactive Plotly visualizations
4. **Data Tables**: Display and manipulate tabular data
5. **Styling**: Apply CSS and Bootstrap for responsive design
6. **Performance**: Optimize callbacks and data loading

---

## AutoRA Dash App Reference (gui_poc_dash branch)

This project has an existing Dash implementation in the `gui_poc_dash` branch. Reference it when building or extending the web-based workflow builder.

### Architecture Overview

The Dash app is a 3-panel workflow builder located in `autora_gui/dash_drag_drop/`:

```
autora_gui/dash_drag_drop/
├── __init__.py
├── app.py                     # Main Dash application
└── assets/
    ├── drag_drop.js           # JavaScript for drag-drop and connections
    └── styles.css             # Dark theme styling
```

### Key Dependencies

```python
import dash_cytoscape as cyto  # Graph visualization for nodes/edges
from dash import Dash, Input, Output, State, dcc, html, ctx
```

### App Structure

```python
# Node type colors
NODE_COLORS = {
    "experiment_runners": "#4CAF50",  # Green
    "experimentalists": "#2196F3",     # Blue
    "theorists": "#FF9800",            # Orange
}

def create_layout():
    return html.Div([
        # Header
        html.Div([
            html.H1("AutoRA Workflow Builder"),
            html.P("Drag components from the left panel to build your workflow"),
        ], className="app-header"),

        html.Div([
            # Left panel: Component palette
            html.Div([
                html.H3("Components", className="panel-header"),
                html.Div(palette_sections, className="palette-container"),
            ], className="left-panel"),

            # Center panel: Cytoscape canvas
            html.Div([
                cyto.Cytoscape(
                    id="workflow-canvas",
                    elements=[],
                    layout={"name": "preset", "fit": False},
                    style={"width": "100%", "height": "calc(100% - 80px)"},
                    zoom=1, minZoom=0.5, maxZoom=2,
                    stylesheet=[...],  # Node and edge styles
                ),
                dcc.Store(id="node-data-store", data={}),
                dcc.Store(id="drop-event-store", data=None),
                dcc.Store(id="edge-event-store", data=None),
                dcc.Interval(id="js-poll-interval", interval=200, n_intervals=0),
            ], className="canvas-panel"),

            # Right panel: Property editor
            html.Div([
                html.H3("Node Properties", className="panel-header"),
                html.Div(id="parameter-editor"),
                html.Button("Delete Node", id="delete-node-btn"),
            ], className="right-panel"),
        ], className="main-content"),
    ], className="app-container")
```

### Cytoscape Stylesheet

```python
stylesheet=[
    # Node style - two-part with name and type
    {"selector": "node", "style": {
        "label": "data(label)",
        "text-valign": "center",
        "text-halign": "center",
        "font-size": 12,
        "text-wrap": "wrap",
        "color": "#fff",
        "background-color": "data(color)",
        "width": 200,
        "height": 80,
        "shape": "round-rectangle",
        "border-width": 2,
        "border-color": "#333",
    }},
    # Selected node
    {"selector": "node:selected", "style": {
        "border-width": 3,
        "border-color": "#e91e63",
    }},
    # Connection source highlight
    {"selector": ".connection-source", "style": {
        "border-width": 3,
        "border-color": "#FF9800",
    }},
    # Edge style - bezier curve with arrow
    {"selector": "edge", "style": {
        "curve-style": "unbundled-bezier",
        "control-point-distances": [-40],
        "target-arrow-shape": "triangle",
        "target-arrow-color": "#888",
        "line-color": "#888",
        "width": 2,
    }},
]
```

### Draggable Palette Items

```python
def create_node_palette_item(component: dict, component_type: str) -> html.Div:
    return html.Div(
        [html.Span(component["name"], className="node-name")],
        className=f"palette-item palette-{component_type}",
        draggable="true",
        id={"type": "palette-item", "index": f"{component_type}:{component['_file']}"},
        **{
            "data-component-type": component_type,
            "data-component-file": component["_file"],
            "data-component-name": component["name"],
        },
    )
```

### JavaScript Drag-Drop Bridge (assets/drag_drop.js)

Communication between JavaScript drag-drop events and Dash callbacks via polling:

```javascript
// Global state for Dash communication
window.pendingDropEvent = null;
window.pendingEdgeEvent = null;

// Handle node drop - calculate position and queue for Dash
function handleNodeDrop(data, clientX, clientY) {
    const cy = getCytoscape();
    const container = cy.container();
    const rect = container.getBoundingClientRect();
    const pan = cy.pan();
    const zoom = cy.zoom();

    // Convert screen coords to canvas coords
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;

    window.pendingDropEvent = {
        nodeId: generateUUID(),
        componentType: data.componentType,
        componentFile: data.componentFile,
        componentName: data.componentName,
        x: x,
        y: y,
        timestamp: Date.now()
    };
}

// Connection mode state
let connectionMode = { active: false, sourceNode: null };

// Click on node to start/complete connection
cy.on('tap', 'node', function(evt) {
    const node = evt.target;
    if (!connectionMode.active) {
        enterConnectionMode(cy, node);
    } else if (connectionMode.sourceNode) {
        const sourceId = connectionMode.sourceNode.id();
        const targetId = node.id();
        if (sourceId !== targetId) {
            window.pendingEdgeEvent = { source: sourceId, target: targetId };
        }
        exitConnectionMode(cy);
    }
});
```

### Clientside Callbacks for JS Events

```python
# Poll for drop events from JavaScript
app.clientside_callback(
    """
    function(n) {
        if (window.pendingDropEvent) {
            var e = window.pendingDropEvent;
            window.pendingDropEvent = null;
            return e;
        }
        return dash_clientside.no_update;
    }
    """,
    Output("drop-event-store", "data"),
    Input("js-poll-interval", "n_intervals"),
)

# Poll for edge events from JavaScript
app.clientside_callback(
    """
    function(n) {
        if (window.pendingEdgeEvent) {
            var e = window.pendingEdgeEvent;
            window.pendingEdgeEvent = null;
            return e;
        }
        return dash_clientside.no_update;
    }
    """,
    Output("edge-event-store", "data"),
    Input("js-poll-interval", "n_intervals"),
)
```

### Canvas Update Callback

```python
@app.callback(
    Output("workflow-canvas", "elements"),
    Output("node-data-store", "data"),
    Input("drop-event-store", "data"),
    Input("edge-event-store", "data"),
    Input("clear-canvas-btn", "n_clicks"),
    Input("upload-workflow", "contents"),
    State("workflow-canvas", "elements"),
    State("node-data-store", "data"),
    prevent_initial_call=True,
)
def update_canvas(drop_event, edge_event, clear_clicks, upload_contents, elements, node_data):
    triggered = ctx.triggered_id
    elements = elements or []
    node_data = node_data or {}

    if triggered == "drop-event-store" and drop_event:
        node_id = drop_event.get("nodeId", str(uuid.uuid4()))
        label = drop_event.get("componentName", "Node")
        comp_type = drop_event.get("componentType", "")
        color = NODE_COLORS.get(comp_type, "#999")

        new_node = {
            "data": {
                "id": node_id,
                "label": f"{label}\n{'─' * 14}\n{comp_type.replace('_', ' ').title()}",
                "color": color,
            },
            "position": {"x": drop_event["x"], "y": drop_event["y"]},
        }
        return elements + [new_node], {**node_data, node_id: {...}}

    if triggered == "edge-event-store" and edge_event:
        new_edge = {
            "data": {
                "id": str(uuid.uuid4()),
                "source": edge_event["source"],
                "target": edge_event["target"]
            }
        }
        return elements + [new_edge], node_data

    if triggered == "clear-canvas-btn":
        return [], {}

    return dash.no_update, dash.no_update
```

### Parameter Editor Callback

```python
@app.callback(
    Output("parameter-editor", "children"),
    Input("workflow-canvas", "selectedNodeData"),
    State("node-data-store", "data"),
)
def update_params(selected, node_data):
    if not selected:
        return html.P("Select a node to view parameters.")

    node_id = selected[0].get("id")
    data = node_data.get(node_id, {})

    # Load component definition for parameter schema
    comp_def = load_component_definition(data["componentType"], data["componentFile"])

    children = [
        html.H4(data.get("name", "Unknown")),
        html.P(f"Type: {data['componentType'].replace('_', ' ').title()}"),
    ]

    # Generate input widgets for each parameter
    for p in comp_def.get("parameters", []):
        pn, pt = p["name"], p.get("datatype", "string")
        children.append(html.Div([
            html.Label(pn),
            dcc.Input(
                id={"type": "param-input", "param": pn, "node": node_id},
                type="number" if pt in ("integer", "real") else "text",
                value=data["parameters"].get(pn, p.get("default", "")),
                debounce=True
            ),
        ]))

    return html.Div(children)
```

### Save/Load Workflow

```python
@app.callback(
    Output("download-workflow", "data"),
    Input("save-workflow-btn", "n_clicks"),
    State("workflow-canvas", "elements"),
    State("node-data-store", "data"),
    prevent_initial_call=True,
)
def handle_save(save_click, elements, node_data):
    nodes, conns = [], []
    for e in elements:
        d = e.get("data", {})
        if "source" in d:  # Edge
            conns.append({"id": d["id"], "source": d["source"], "target": d["target"]})
        else:  # Node
            ni = node_data.get(d["id"], {})
            nodes.append({
                "id": d["id"],
                "type": ni.get("componentType", ""),
                "x": e.get("position", {}).get("x", 0),
                "y": e.get("position", {}).get("y", 0),
                "parameters": ni.get("parameters", {})
            })

    return {
        "content": json.dumps({"nodes": nodes, "connections": conns}, indent=2),
        "filename": "workflow.json",
        "type": "application/json",
    }
```

### CSS Dark Theme Highlights (assets/styles.css)

```css
/* 3-panel layout */
.main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.left-panel { width: 280px; background-color: #16213e; }
.canvas-panel { flex: 1; background-color: #0f0f23; }
.right-panel { width: 320px; background-color: #16213e; }

/* Palette items with color-coded borders */
.palette-item {
    padding: 10px 12px;
    border-radius: 6px;
    cursor: grab;
    border-left: 4px solid;
    background-color: #1a1a2e;
}

.palette-experiment_runners { border-left-color: #4CAF50; }
.palette-experimentalists { border-left-color: #2196F3; }
.palette-theorists { border-left-color: #FF9800; }

/* Canvas with grid background */
#workflow-canvas {
    background-color: #0f0f23;
    background-image:
        linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 20px 20px;
}

/* Drop zone indicator */
.canvas-panel.drag-over::after {
    content: 'Drop here to add node';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #4CAF50;
}
```

### Running the App

```bash
# Checkout the gui_poc_dash branch
git checkout gui_poc_dash

# Install dependencies
pip install dash dash-cytoscape

# Run the application
python -m autora_gui.dash_drag_drop.app

# Open browser to http://localhost:8050
```

### Key Patterns

1. **JS-to-Python Bridge**: Use `dcc.Store` + `dcc.Interval` + clientside callbacks to poll for JS events
2. **Pattern-Matching Callbacks**: Use `{"type": "param-input", "param": dash.ALL}` for dynamic inputs
3. **Cytoscape Integration**: `dash_cytoscape` for node-based graph editing
4. **Assets Folder**: Place `.js` and `.css` files in `assets/` for auto-loading

$ARGUMENTS
