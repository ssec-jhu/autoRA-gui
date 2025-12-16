"""Main Plotly Dash application for drag-and-drop workflow builder."""

import json

import dash
from dash import Input, Output, State, callback, clientside_callback, dcc, html, no_update

from .components import get_component_definitions

# Initialize Dash app
app = dash.Dash(__name__)
app.title = "Workflow Builder"


def create_sidebar():
    """Create the component library sidebar."""
    component_defs = get_component_definitions()

    component_items = []
    for comp_def in component_defs:
        component_items.append(
            html.Div(
                [
                    html.Div(comp_def["icon"], className="component-icon"),
                    html.Div(
                        [
                            html.Div(comp_def["title"], className="component-title"),
                            html.Div(comp_def["description"], className="component-description"),
                        ],
                        className="component-details",
                    ),
                ],
                className="component-item",
                draggable="true",
                **{"data-component-type": comp_def["type"]},
            )
        )

    return html.Div(
        [html.H3("Components"), html.Div(component_items, className="component-list")], className="component-library"
    )


def create_canvas():
    """Create the main canvas area."""
    return html.Div(
        [
            # Canvas for components
            html.Div(id="canvas", className="canvas"),
            # Control panel
            html.Div(
                [
                    dcc.Upload(
                        id="load-workflow-upload",
                        children=html.Button("Load Workflow", className="run-button"),
                        accept=".json",
                        style={"display": "inline-flex", "align-items": "center", "margin-right": "10px"},
                    ),
                    html.Button("Save Workflow", id="save-button", className="run-button"),
                    html.Button("Generate Python", id="generate-python-button", className="run-button"),
                    html.Button("Run Workflow", id="run-button", className="run-button"),
                    html.Button("Clear Canvas", id="clear-button", className="clear-button"),
                    html.Button(
                        "Debug Store",
                        id="debug-button",
                        className="run-button",
                        style={"margin-left": "10px", "background-color": "#6c757d"},
                    ),
                ],
                className="control-panel",
            ),
            # Output panel
            html.Div(
                [
                    html.Div("Execution Output:", className="output-header"),
                    html.Div(id="output-content", className="output-content"),
                ],
                id="output-panel",
                className="output-panel",
            ),
        ],
        className="canvas-container",
    )


# App layout
app.layout = html.Div(
    [
        # Hidden stores for component state
        dcc.Store(id="canvas-store", data={"components": {}, "connections": []}),
        dcc.Store(id="workflow-store", data={"components": {}, "connections": []}),
        dcc.Store(id="save-trigger"),
        dcc.Download(id="download-workflow"),
        # Hidden trigger for JavaScript updates
        html.Div(id="canvas-store-trigger", style={"display": "none"}),
        # Main app container
        html.Div([create_sidebar(), create_canvas()], className="app-container"),
        # Graph container for visualizations
        html.Div(id="visualization-container", style={"display": "none"}),
    ],
    id="main-container",
)


# Clientside callback for clearing canvas
clientside_callback(
    """
    function(n_clicks) {
        if (n_clicks > 0 && window.dashDragDrop) {
            window.dashDragDrop.clearCanvas();
        }
        return '';
    }
    """,
    Output("canvas-store-trigger", "children"),
    Input("clear-button", "n_clicks"),
    prevent_initial_call=True,
)


# Clientside callback to update store on run button click
clientside_callback(
    """
    function(n_clicks) {
        if (n_clicks > 0 && window.dashDragDrop) {
            window.dashDragDrop.updateDashStore();
            return window.dashDragDrop.getCanvasState();
        }
        return window.dash_clientside.no_update;
    }
    """,
    Output("canvas-store", "data"),
    Input("run-button", "n_clicks"),
    prevent_initial_call=True,
)


# Clientside callback to capture canvas state and prepare for save
clientside_callback(
    """
    function(n_clicks) {
        if (!n_clicks) {
            return window.dash_clientside.no_update;
        }
        
        // Make sure we have the latest component data
        const components = {};
        document.querySelectorAll('.canvas-component').forEach(comp => {
            const compId = comp.id;
            if (window.componentData && window.componentData[compId]) {
                components[compId] = window.componentData[compId];
            }
        });
        
        // Clean up duplicate connections
        const connections = window.componentConnections || [];
        const uniqueConnections = [];
        const seen = new Set();
        
        connections.forEach(conn => {
            const key = `${conn.from}-${conn.to}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueConnections.push(conn);
            }
        });
        
        const state = {
            components: components,
            connections: uniqueConnections,
            savedAt: Date.now()
        };
        
        console.log('Saving state:', state); // Debug log
        
        return state;
    }
    """,
    Output("workflow-store", "data", allow_duplicate=True),
    Input("save-button", "n_clicks"),
    prevent_initial_call=True,
)


# Server-side callback to trigger download after state is captured
@callback(
    Output("download-workflow", "data"),
    Input("workflow-store", "data"),
    State("save-button", "n_clicks"),
    prevent_initial_call=True,
)
def download_workflow(workflow_data, n_clicks):
    if n_clicks and workflow_data and workflow_data.get("savedAt"):
        # Check if this is a fresh save (not from loading)
        return dict(content=json.dumps(workflow_data, indent=2), filename="workflow.json")
    return no_update


# Load workflow callback
@callback(
    Output("workflow-store", "data", allow_duplicate=True),
    Input("load-workflow-upload", "contents"),
    State("load-workflow-upload", "filename"),
    prevent_initial_call=True,
)
def load_workflow(contents, filename):
    if contents is None:
        return no_update

    # contents is "data:application/json;base64,XXXXX"
    content_string = contents.split(",")[1]

    import base64

    decoded = base64.b64decode(content_string).decode("utf-8")

    workflow_data = json.loads(decoded)

    return workflow_data


# Clientside callback to load workflow into canvas
clientside_callback(
    """
    function(workflow) {
        if (workflow && workflow.components && window.loadWorkflowIntoCanvas) {
            window.loadWorkflowIntoCanvas(workflow);
        }
        return '';
    }
    """,
    Output("canvas-store-trigger", "children", allow_duplicate=True),
    Input("workflow-store", "data"),
    prevent_initial_call=True,
)


# Run workflow callback
@callback(
    [Output("output-panel", "className"), Output("output-content", "children")],
    Input("run-button", "n_clicks"),
    State("canvas-store", "data"),
    prevent_initial_call=True,
)
def run_workflow(n_clicks, canvas_data):
    if not n_clicks or not canvas_data:
        return no_update, no_update

    try:
        components = canvas_data.get("components", {})
        connections = canvas_data.get("connections", [])

        # Execute workflow logic here
        result = f"Workflow executed successfully!\nComponents: {len(components)}\nConnections: {len(connections)}"

        return "output-panel visible", result

    except Exception as e:
        return "output-panel visible", f"Error: {e!s}"


# Debug store callback
@callback(
    Output("output-content", "children", allow_duplicate=True),
    Input("debug-button", "n_clicks"),
    State("canvas-store", "data"),
    State("workflow-store", "data"),
    prevent_initial_call=True,
)
def debug_store(n_clicks, canvas_data, workflow_data):
    if not n_clicks:
        return no_update

    debug_info = f"""
Canvas Store:
{json.dumps(canvas_data, indent=2)}

Workflow Store:
{json.dumps(workflow_data, indent=2)}
"""
    return html.Pre(debug_info)


if __name__ == "__main__":
    app.run(debug=True, port=8050)
