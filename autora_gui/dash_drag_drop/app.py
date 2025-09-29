"""
Main Plotly Dash application for drag-and-drop workflow builder.
"""

import dash
from dash import dcc, html, Input, Output, State, clientside_callback, no_update
import json
from typing import Dict, List, Any

from components import get_component_definitions, create_component

# Initialize Dash app
app = dash.Dash(__name__)
app.title = "Workflow Builder"


def create_sidebar():
    """Create the component library sidebar."""
    component_defs = get_component_definitions()

    component_items = []
    for comp_def in component_defs:
        component_items.append(
            html.Div([
                html.Div(comp_def['icon'], className='component-icon'),
                html.Div([
                    html.Div(comp_def['title'], className='component-title'),
                    html.Div(comp_def['description'], className='component-description')
                ], className='component-details')
            ],
                className='component-item',
                draggable='true',
                **{'data-component-type': comp_def['type']})
        )

    return html.Div([
        html.Div([
            html.H3("Component Library"),
            html.P("Drag arithmetic components to the canvas, connect them with lines to create calculations",
                   style={'font-size': '12px', 'color': '#6c757d', 'margin-bottom': '15px'}),
            html.Div(component_items, className='component-list')
        ], className='component-library')
    ], className='sidebar')


def create_canvas():
    """Create the main canvas area."""
    return html.Div([
        # Canvas for dropping components
        html.Div(id='canvas', className='canvas'),

        # Control panel
        html.Div([
            html.Button('Run Workflow', id='run-button', className='run-button'),
            html.Button('Clear Canvas', id='clear-button', className='clear-button'),
            html.Button('Debug Store', id='debug-button', className='run-button', 
                       style={'margin-left': '10px', 'background-color': '#6c757d'}),
        ], className='control-panel'),

        # Output panel
        html.Div([
            html.Div('Execution Output:', className='output-header'),
            html.Div(id='output-content', className='output-content')
        ], id='output-panel', className='output-panel'),

    ], className='canvas-container')


# App layout
app.layout = html.Div([
    # Hidden stores for component state
    dcc.Store(id='canvas-store', data={'components': {}, 'connections': []}),

    # Hidden trigger for JavaScript updates
    html.Div(id='canvas-store-trigger', style={'display': 'none'}),

    # Main app container
    html.Div([
        create_sidebar(),
        create_canvas()
    ], className='app-container'),

    # Graph container for visualizations
    html.Div(id='visualization-container', style={'display': 'none'})

], id='main-container')

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
    Output('canvas-store-trigger', 'children'),
    Input('clear-button', 'n_clicks'),
    prevent_initial_call=True
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
    Output('canvas-store', 'data'),
    Input('run-button', 'n_clicks'),
    prevent_initial_call=True
)


@app.callback(
    Output('canvas-store', 'data', allow_duplicate=True),
    Input('canvas-store-trigger', 'children'),
    prevent_initial_call=True
)
def update_canvas_store(trigger_data):
    """Update the canvas store when triggered by JavaScript."""
    if trigger_data:
        try:
            return json.loads(trigger_data)
        except (json.JSONDecodeError, TypeError):
            pass
    return dash.no_update


@app.callback(
    [Output('output-panel', 'className'),
     Output('output-content', 'children'),
     Output('visualization-container', 'children'),
     Output('visualization-container', 'style')],
    Input('run-button', 'n_clicks'),
    State('canvas-store', 'data'),
    prevent_initial_call=True
)
def execute_workflow(n_clicks, canvas_data):
    """Execute the workflow when Run button is clicked."""
    print(f"Execute workflow called: n_clicks={n_clicks}, canvas_data={canvas_data}")  # Debug
    
    if not n_clicks or not canvas_data:
        return 'output-panel', '', [], {'display': 'none'}

    components_data = canvas_data.get('components', {})
    connections = canvas_data.get('connections', [])
    
    print(f"Components: {components_data}")  # Debug
    print(f"Connections: {connections}")  # Debug

    if not components_data:
        return 'output-panel visible', 'No components on canvas.', [], {'display': 'none'}

    try:
        # Build execution order based on connections (if any)
        if connections:
            execution_order = get_execution_order(components_data, connections)
        else:
            # Simple sequential execution if no connections
            execution_order = list(components_data.keys())

        # Execute components
        output_lines = []
        visualizations = []
        results = {}

        for comp_id in execution_order:
            comp_data = components_data[comp_id]
            comp_type = comp_data['type']
            comp_config = comp_data.get('config', {})

            try:
                # Create and execute component
                component = create_component(comp_type, comp_id, comp_config)

                # Get input data based on connections
                input_data = None
                if connections:
                    # Find connected input
                    for conn in connections:
                        if conn['to'] == comp_id and conn['from'] in results:
                            input_data = results[conn['from']]
                            break
                elif comp_type != 'data_source' and results:
                    # Fallback: use the last result as input
                    input_data = list(results.values())[-1]

                result = component.execute(input_data)
                results[comp_id] = result

                # Show the expression and result for arithmetic components
                if hasattr(component, 'expression') and hasattr(component, 'result'):
                    output_lines.append(f"✅ {comp_data['title']}: {component.expression}")
                else:
                    output_lines.append(f"✅ {comp_data['title']}: Result = {result}")

            except Exception as e:
                output_lines.append(f"❌ {comp_data['title']}: Error - {str(e)}")

        # Show final result
        if results:
            final_result = list(results.values())[-1]
            output_lines.append("")
            output_lines.append(f"🎯 FINAL RESULT: {final_result}")

        output_content = [html.Div(line, style={'margin': '2px 0', 'font-family': 'monospace'}) for line in
                          output_lines]

        return 'output-panel visible', output_content, [], {'display': 'none'}

    except Exception as e:
        error_msg = f"Execution error: {str(e)}"
        return 'output-panel visible', error_msg, [], {'display': 'none'}


def get_execution_order(components_data: Dict, connections: List) -> List[str]:
    """Determine the order of component execution based on connections."""
    component_ids = list(components_data.keys())

    if not connections:
        return component_ids

    # Build dependency graph
    dependencies = {comp_id: [] for comp_id in component_ids}

    for conn in connections:
        from_comp = conn['from']
        to_comp = conn['to']
        if to_comp in dependencies and from_comp in component_ids:
            dependencies[to_comp].append(from_comp)

    # Simple topological sort
    visited = set()
    temp_visited = set()
    order = []

    def visit(comp_id):
        if comp_id in temp_visited:
            # Circular dependency - just add to end
            return
        if comp_id in visited:
            return

        temp_visited.add(comp_id)
        for dep in dependencies.get(comp_id, []):
            visit(dep)
        temp_visited.remove(comp_id)
        visited.add(comp_id)
        order.append(comp_id)

    for comp_id in component_ids:
        if comp_id not in visited:
            visit(comp_id)

    return order


@app.callback(
    Output('output-content', 'children', allow_duplicate=True),
    Input('debug-button', 'n_clicks'),
    State('canvas-store', 'data'),
    prevent_initial_call=True
)
def debug_store(n_clicks, canvas_data):
    """Debug callback to show store contents."""
    if n_clicks:
        debug_info = [
            html.Div(f"Store data: {json.dumps(canvas_data, indent=2)}", 
                    style={'font-family': 'monospace', 'white-space': 'pre-wrap'})
        ]
        return debug_info
    return no_update


if __name__ == '__main__':
    app.run(debug=True, port=8050)
