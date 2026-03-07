"""Main Dash application for AutoRA GUI with drag-drop workflow builder."""

import base64
import json
import logging
import uuid
from pathlib import Path

# Suppress Flask/Werkzeug development server warning
logging.getLogger("werkzeug").setLevel(logging.ERROR)

import dash
import dash_cytoscape as cyto
from dash import Dash, Input, Output, State, ctx, dcc, html

# Load extra cytoscape layouts
cyto.load_extra_layouts()

# Path to JSON components
JSON_PATH = Path(__file__).parent.parent / "JSON"
COMPONENTS_PATH = JSON_PATH / "components"
WORKFLOWS_PATH = JSON_PATH / "workflows"

# Node type colors
NODE_COLORS = {
    "experiment_runners": "#4CAF50",
    "experimentalists": "#2196F3",
    "theorists": "#FF9800",
}


def load_components() -> dict:
    """Load all component JSON files organized by type."""
    components = {}
    for type_dir in COMPONENTS_PATH.iterdir():
        if type_dir.is_dir():
            type_name = type_dir.name
            components[type_name] = []
            for json_file in type_dir.glob("*.json"):
                with open(json_file) as f:
                    data = json.load(f)
                    data["_file"] = json_file.name
                    components[type_name].append(data)
    return components


COMPONENTS = load_components()


def create_node_palette_item(component: dict, component_type: str) -> html.Div:
    """Create a draggable node palette item."""
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


def create_layout():
    """Create the app layout."""
    palette_sections = []
    for type_name, components in COMPONENTS.items():
        display_name = type_name.replace("_", " ").title()
        section = html.Div(
            [
                html.Div(
                    [
                        html.Span("▶", className="collapse-icon", id={"type": "section-icon", "section": type_name}),
                        html.Span(display_name),
                    ],
                    className="palette-section-header",
                    id={"type": "section-header", "section": type_name},
                    n_clicks=0,
                ),
                html.Div(
                    [create_node_palette_item(comp, type_name) for comp in components],
                    className="palette-section-items collapsed",
                    id={"type": "section-items", "section": type_name},
                ),
            ],
            className="palette-section",
        )
        palette_sections.append(section)

    return html.Div(
        [
            html.Div(
                [
                    html.H1("AutoRA Workflow Builder"),
                    html.P("Drag components from the left panel to build your workflow"),
                ],
                className="app-header",
            ),
            html.Div(
                [
                    # Left panel
                    html.Div(
                        [
                            html.H3("Components", className="panel-header"),
                            html.Div(palette_sections, className="palette-container"),
                        ],
                        className="left-panel",
                        id="left-panel",
                    ),
                    # Canvas panel
                    html.Div(
                        [
                            html.Div(
                                [
                                    html.H3("Workflow Canvas", className="panel-header"),
                                    html.Div(
                                        [
                                            html.Button("Clear", id="clear-canvas-btn", className="toolbar-btn"),
                                            html.Button("Save", id="save-workflow-btn", className="toolbar-btn"),
                                            dcc.Upload(
                                                id="upload-workflow",
                                                children=html.Button("Load", className="toolbar-btn"),
                                                accept=".json",
                                            ),
                                        ],
                                        className="canvas-toolbar",
                                    ),
                                ],
                                className="canvas-header",
                            ),
                            cyto.Cytoscape(
                                id="workflow-canvas",
                                elements=[],
                                layout={"name": "preset", "fit": False},
                                style={"width": "100%", "height": "calc(100% - 80px)"},
                                zoom=1,
                                minZoom=0.5,
                                maxZoom=2,
                                autoRefreshLayout=False,
                                stylesheet=[
                                    # Main node style - two-part design with name on top, divider, type on bottom
                                    {
                                        "selector": "node",
                                        "style": {
                                            "label": "data(label)",
                                            "text-valign": "center",
                                            "text-halign": "center",
                                            "font-size": 12,
                                            "text-wrap": "wrap",
                                            "text-max-width": 180,
                                            "color": "#fff",
                                            "line-height": 1.3,
                                            # Node appearance
                                            "background-color": "data(color)",
                                            "width": 200,
                                            "height": 80,
                                            "shape": "round-rectangle",
                                            "border-width": 2,
                                            "border-color": "#333",
                                        },
                                    },
                                    # Node hover effect
                                    {
                                        "selector": "node:hover",
                                        "style": {
                                            "border-color": "#888",
                                        },
                                    },
                                    # Selected node
                                    {
                                        "selector": "node:selected",
                                        "style": {
                                            "border-width": 3,
                                            "border-color": "#e91e63",
                                        },
                                    },
                                    # Connection source highlight
                                    {
                                        "selector": ".connection-source",
                                        "style": {
                                            "border-width": 3,
                                            "border-color": "#FF9800",
                                        },
                                    },
                                    # Edge style - quadratic bezier curve (concave)
                                    {
                                        "selector": "edge",
                                        "style": {
                                            "curve-style": "unbundled-bezier",
                                            "control-point-distances": [-40],
                                            "control-point-weights": [0.5],
                                            "target-arrow-shape": "triangle",
                                            "target-arrow-color": "#888",
                                            "line-color": "#888",
                                            "width": 2,
                                            "source-endpoint": "outside-to-node",
                                            "target-endpoint": "outside-to-node",
                                        },
                                    },
                                    # Edge hover
                                    {
                                        "selector": "edge:hover",
                                        "style": {
                                            "line-color": "#aaa",
                                            "target-arrow-color": "#aaa",
                                        },
                                    },
                                    # Selected edge
                                    {
                                        "selector": "edge:selected",
                                        "style": {
                                            "line-color": "#e91e63",
                                            "target-arrow-color": "#e91e63",
                                            "width": 3,
                                        },
                                    },
                                ],
                                boxSelectionEnabled=True,
                                userZoomingEnabled=True,
                                userPanningEnabled=True,
                            ),
                            dcc.Store(id="node-data-store", data={}),
                            dcc.Store(id="drop-event-store", data=None),
                            dcc.Store(id="edge-event-store", data=None),
                            dcc.Interval(id="js-poll-interval", interval=200, n_intervals=0),
                            dcc.Download(id="download-workflow"),
                        ],
                        className="canvas-panel",
                        id="canvas-panel",
                    ),
                    # Right panel
                    html.Div(
                        [
                            html.H3("Node Properties", className="panel-header"),
                            html.Div(
                                [
                                    html.Div(
                                        [
                                            html.P(
                                                "Select a node to view and edit its parameters.",
                                                className="no-selection-message",
                                            ),
                                        ],
                                        id="parameter-editor",
                                        className="parameter-editor",
                                    ),
                                    html.Div(
                                        [
                                            html.Button(
                                                "Delete Node",
                                                id="delete-node-btn",
                                                className="delete-node-btn",
                                                disabled=True,
                                            ),
                                        ],
                                        className="delete-button-container",
                                    ),
                                ],
                                className="parameter-editor-container",
                            ),
                            html.Div(
                                [
                                    html.H4("Instructions", className="instructions-header"),
                                    html.Ul(
                                        [
                                            html.Li("Drag components from left to canvas"),
                                            html.Li("Click a node to start connection"),
                                            html.Li("Click another node to connect"),
                                            html.Li("Press Escape to cancel connection"),
                                            html.Li("Press Delete to remove selected"),
                                        ],
                                        className="instructions-list",
                                    ),
                                ],
                                className="instructions-panel",
                            ),
                        ],
                        className="right-panel",
                        id="right-panel",
                    ),
                ],
                className="main-content",
            ),
        ],
        className="app-container",
    )


def create_app():
    """Create and configure the Dash app."""
    app = Dash(__name__, suppress_callback_exceptions=True, title="AutoRA Workflow Builder")
    app.layout = create_layout()

    # Clientside callback for section collapse/expand
    app.clientside_callback(
        """
        function(n_clicks, currentClass) {
            if (!n_clicks) return [dash_clientside.no_update, dash_clientside.no_update];
            if (currentClass && currentClass.includes('collapsed')) {
                return ['palette-section-items', 'collapse-icon expanded'];
            }
            return ['palette-section-items collapsed', 'collapse-icon'];
        }
        """,
        Output({"type": "section-items", "section": dash.MATCH}, "className"),
        Output({"type": "section-icon", "section": dash.MATCH}, "className"),
        Input({"type": "section-header", "section": dash.MATCH}, "n_clicks"),
        State({"type": "section-items", "section": dash.MATCH}, "className"),
    )

    # Clientside callback for drop events
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

    # Clientside callback for edge events
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

    def create_node_element(node_id, label, color, x, y, node_type=""):
        """Create a main node element."""
        # Format the node type for display (e.g., "experiment_runners" -> "Experiment Runner")
        display_type = node_type.replace("_", " ").title().rstrip("s") if node_type else ""
        # Combine label and type with a separator line represented by dashes
        combined_label = f"{label}\n{'─' * 14}\n{display_type}"
        return {
            "data": {
                "id": node_id,
                "label": combined_label,
                "color": color,
                "type": "main",
                "nodeType": display_type,
                "nodeName": label,
            },
            "position": {"x": x, "y": y},
        }

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
            x = drop_event.get("x", 100)
            y = drop_event.get("y", 100)
            label = drop_event.get("componentName", "Node")
            comp_type = drop_event.get("componentType", "")
            color = NODE_COLORS.get(comp_type, "#999")

            new_node = create_node_element(node_id, label, color, x, y, comp_type)
            new_elements = elements + [new_node]
            new_node_data = {
                **node_data,
                node_id: {
                    "componentType": drop_event.get("componentType", ""),
                    "componentFile": drop_event.get("componentFile", ""),
                    "name": label,
                    "parameters": {"name": label},
                },
            }
            return new_elements, new_node_data

        if triggered == "edge-event-store" and edge_event:
            src, tgt = edge_event.get("source"), edge_event.get("target")
            if src and tgt:
                # Check if edge already exists
                edge_exists = any(
                    e.get("data", {}).get("source") == src and e.get("data", {}).get("target") == tgt for e in elements
                )
                if not edge_exists:
                    new_edge = {"data": {"id": str(uuid.uuid4()), "source": src, "target": tgt}}
                    return elements + [new_edge], node_data
            return dash.no_update, dash.no_update

        if triggered == "clear-canvas-btn":
            return [], {}

        if triggered == "upload-workflow" and upload_contents:
            # Parse the uploaded file content
            content_type, content_string = upload_contents.split(",")
            decoded = base64.b64decode(content_string)
            try:
                wf = json.loads(decoded.decode("utf-8"))
                new_elements, new_node_data = [], {}
                for n in wf.get("nodes", []):
                    ct = n.get("type", n.get("componentType", ""))
                    label = n.get("parameters", {}).get("name", "Node")
                    color = NODE_COLORS.get(ct, "#999")
                    new_elements.append(create_node_element(n["id"], label, color, n["x"], n["y"], ct))
                    new_node_data[n["id"]] = {
                        "componentType": ct,
                        "componentFile": n.get("componentFile", ""),
                        "name": label,
                        "parameters": n.get("parameters", {}),
                    }
                for c in wf.get("connections", []):
                    new_elements.append({"data": {"id": c["id"], "source": c["source"], "target": c["target"]}})
                return new_elements, new_node_data
            except (json.JSONDecodeError, UnicodeDecodeError):
                return dash.no_update, dash.no_update

        return dash.no_update, dash.no_update

    @app.callback(
        Output("parameter-editor", "children"),
        Input("workflow-canvas", "selectedNodeData"),
        State("node-data-store", "data"),
    )
    def update_params(selected, node_data):
        if not selected:
            return html.P("Select a node to view parameters.", className="no-selection-message")

        # Get the first selected node
        node_id = selected[0].get("id") if selected else None

        if not node_id:
            return html.P("Select a node to view parameters.", className="no-selection-message")

        if not node_data or node_id not in node_data:
            return html.P("Node data not found.", className="error-message")
        data = node_data[node_id]
        comp_type, comp_file = data.get("componentType", ""), data.get("componentFile", "")
        params = data.get("parameters", {})

        comp_def = None
        fp = COMPONENTS_PATH / comp_type / comp_file
        if fp.exists():
            with open(fp) as f:
                comp_def = json.load(f)

        children = [
            html.H4(data.get("name", "Unknown"), className="node-title"),
            html.P(f"Type: {comp_type.replace('_', ' ').title()}", className="node-type"),
            # Store selected node ID for delete button
            dcc.Store(id="selected-node-id", data=node_id),
        ]
        if comp_def and "description" in comp_def:
            children.append(html.P(comp_def["description"], className="node-description"))
        if comp_def and "parameters" in comp_def:
            for p in comp_def["parameters"]:
                pn, pt = p["name"], p.get("datatype", "string")
                children.append(
                    html.Div(
                        [
                            html.Label(pn, className="param-label"),
                            dcc.Input(
                                id={"type": "param-input", "param": pn, "node": node_id},
                                type="number" if pt in ("integer", "real") else "text",
                                value=params.get(pn, p.get("default", "")),
                                className="param-input",
                                debounce=True,
                            ),
                        ],
                        className="param-group",
                    )
                )
        return html.Div(children, className="node-editor")

    @app.callback(
        Output("delete-node-btn", "disabled"),
        Input("workflow-canvas", "selectedNodeData"),
    )
    def toggle_delete_button(selected):
        return not selected or len(selected) == 0

    @app.callback(
        Output("workflow-canvas", "elements", allow_duplicate=True),
        Output("node-data-store", "data", allow_duplicate=True),
        Input("delete-node-btn", "n_clicks"),
        State("workflow-canvas", "selectedNodeData"),
        State("workflow-canvas", "elements"),
        State("node-data-store", "data"),
        prevent_initial_call=True,
    )
    def delete_node(clicks, selected, elements, node_data):
        if not clicks or not selected:
            return dash.no_update, dash.no_update
        nid = selected[0].get("id")
        if not nid:
            return dash.no_update, dash.no_update
        # Remove node and any connected edges
        new_el = [
            e
            for e in elements
            if e.get("data", {}).get("id") != nid
            and e.get("data", {}).get("source") != nid
            and e.get("data", {}).get("target") != nid
        ]
        new_nd = {k: v for k, v in node_data.items() if k != nid}
        return new_el, new_nd

    @app.callback(
        Output("node-data-store", "data", allow_duplicate=True),
        Input({"type": "param-input", "param": dash.ALL, "node": dash.ALL}, "value"),
        State("node-data-store", "data"),
        prevent_initial_call=True,
    )
    def update_param_values(values, node_data):
        if not ctx.triggered_id or not node_data:
            return dash.no_update
        pn, nid = ctx.triggered_id["param"], ctx.triggered_id["node"]
        if nid not in node_data:
            return dash.no_update
        new_nd = {**node_data}
        new_nd[nid] = {
            **new_nd[nid],
            "parameters": {**new_nd[nid].get("parameters", {}), pn: ctx.triggered[0]["value"]},
        }
        return new_nd

    @app.callback(
        Output("download-workflow", "data"),
        Input("save-workflow-btn", "n_clicks"),
        State("workflow-canvas", "elements"),
        State("node-data-store", "data"),
        prevent_initial_call=True,
    )
    def handle_save(save_click, elements, node_data):
        if not save_click or not ctx.triggered_id:
            return dash.no_update

        nodes, conns = [], []
        for e in elements or []:
            d = e.get("data", {})
            if "source" in d:
                conns.append({"id": d.get("id"), "source": d["source"], "target": d["target"], "controlPoints": None})
            else:
                ni = (node_data or {}).get(d.get("id"), {})
                nodes.append(
                    {
                        "id": d.get("id"),
                        "type": ni.get("componentType", ""),
                        "x": e.get("position", {}).get("x", 0),
                        "y": e.get("position", {}).get("y", 0),
                        "componentFile": ni.get("componentFile", ""),
                        "parameters": ni.get("parameters", {}),
                    }
                )

        workflow_data = {"name": "workflow", "nodes": nodes, "connections": conns}

        return {
            "content": json.dumps(workflow_data, indent=2),
            "filename": "workflow.json",
            "type": "application/json",
        }

    return app


app = create_app()
server = app.server

if __name__ == "__main__":
    app.run(debug=False, host="localhost", port=8050)
