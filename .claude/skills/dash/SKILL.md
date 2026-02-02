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

$ARGUMENTS
