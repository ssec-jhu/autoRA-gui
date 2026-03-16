#!/usr/bin/env python3
"""Build a standalone version of the workflow editor that works without a server.
Creates a single self-contained HTML file with all CSS and JS inlined.
"""

import json
from pathlib import Path


def load_components():
    """Load all component JSON files from the components directory."""
    base_path = Path(__file__).parent.parent / "JSON" / "components"
    components = {}

    for type_dir in base_path.iterdir():
        if type_dir.is_dir():
            type_name = type_dir.name
            components[type_name] = []

            for json_file in sorted(type_dir.glob("*.json")):
                try:
                    with open(json_file) as f:
                        data = json.load(f)
                        data["file"] = json_file.name
                        components[type_name].append(data)
                except (OSError, json.JSONDecodeError) as e:
                    print(f"Warning: Could not load {json_file}: {e}")

    return components


def load_css():
    """Load CSS file."""
    css_path = Path(__file__).parent / "static" / "css" / "styles.css"
    return css_path.read_text()


def load_js_modules():
    """Load and concatenate all JS modules."""
    modules_dir = Path(__file__).parent / "static" / "js" / "modules"

    # Order matters due to dependencies
    module_order = [
        "state.js",
        "utils.js",
        "properties.js",
        "selection.js",
        "connections.js",
        "nodes.js",
        "canvas.js",
        "dragDrop.js",
        "palette.js",
        "workflow.js",
        "main.js",
    ]

    js_content = []
    for module_name in module_order:
        module_path = modules_dir / module_name
        if module_path.exists():
            content = module_path.read_text()
            # Remove import/export statements for bundling
            lines = []
            for line in content.split("\n"):
                stripped = line.strip()
                if stripped.startswith("import ") or stripped.startswith("export "):
                    # Keep function/const declarations but remove export keyword
                    if stripped.startswith("export "):
                        lines.append(line.replace("export ", "", 1))
                else:
                    lines.append(line)
            js_content.append(f"// ===== {module_name} =====\n" + "\n".join(lines))

    return "\n\n".join(js_content)


def generate_standalone_html(components, css, js):
    """Generate fully self-contained HTML."""
    components_json = json.dumps(components, indent=2)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workflow Editor (Standalone)</title>
    <style>
{css}
    </style>
</head>
<body>
    <div class="app-container">
        <!-- Left Panel: Component Palette -->
        <aside class="panel panel-left">
            <div class="panel-header">
                <h2>Components</h2>
                <input type="text" id="component-search" placeholder="Search components..." class="search-input">
            </div>
            <div class="panel-content" id="component-palette">
                <!-- Components loaded dynamically -->
            </div>
        </aside>

        <!-- Center Panel: Canvas -->
        <main class="panel panel-center">
            <div class="toolbar">
                <div class="toolbar-group">
                    <button id="btn-save" title="Save workflow (Ctrl+S)">Save</button>
                    <button id="btn-load" title="Load workflow">Load</button>
                    <input type="file" id="file-input" accept=".json" hidden>
                    <button id="btn-clear" title="Clear canvas">Clear</button>
                </div>
                <div class="toolbar-group">
                    <button id="btn-zoom-out" title="Zoom out">-</button>
                    <span id="zoom-level">100%</span>
                    <button id="btn-zoom-in" title="Zoom in">+</button>
                </div>
                <div class="toolbar-group">
                    <span id="node-count">Nodes: 0</span>
                    <span id="connection-count">Connections: 0</span>
                </div>
            </div>
            <div class="canvas-container">
                <svg id="connections-svg"></svg>
                <div id="workflow-canvas">
                    <div id="canvas-hint" class="canvas-hint">
                        Drag components here to build your workflow
                    </div>
                </div>
            </div>
        </main>

        <!-- Right Panel: Properties -->
        <aside class="panel panel-right">
            <div class="panel-header">
                <h2>Properties</h2>
            </div>
            <div class="panel-content" id="properties-panel">
                <div class="no-selection">Select a node to edit properties</div>
            </div>
        </aside>
    </div>

    <!-- Node Template -->
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
            <!-- Invisible border zones for connection dragging -->
            <div class="connection-border border-top"></div>
            <div class="connection-border border-right"></div>
            <div class="connection-border border-bottom"></div>
            <div class="connection-border border-left"></div>
        </div>
    </template>

    <!-- Status Bar -->
    <div id="status-bar" class="status-bar">Ready</div>

    <script>
// ===== Embedded Component Data =====
const EMBEDDED_COMPONENTS = {components_json};

{js}

// ===== Override loadComponents to use embedded data =====
function loadComponents() {{
    state.components = EMBEDDED_COMPONENTS;
    renderComponentPalette();
    updateStatus('Components loaded (Standalone Mode)');
}}
    </script>
</body>
</html>
"""


def main():
    script_dir = Path(__file__).parent
    # Output to repo root for GitHub Pages
    root_dir = script_dir.parent.parent

    print("Building standalone version...")

    # Load components
    components = load_components()
    total_components = sum(len(v) for v in components.values())
    print(f"Loaded {total_components} components from {len(components)} categories")

    # Load CSS
    css = load_css()
    print(f"Loaded CSS ({len(css)} bytes)")

    # Load and bundle JS
    js = load_js_modules()
    print(f"Bundled JS ({len(js)} bytes)")

    # Generate and write standalone HTML
    html = generate_standalone_html(components, css, js)
    html_file = root_dir / "index.html"
    html_file.write_text(html)
    print(f"Generated: {html_file}")

    print("\nStandalone build complete!")
    print(f"Total size: {len(html) / 1024:.1f} KB")
    print("\nOpen this file in your browser:")
    print(f"  {html_file.absolute()}")


if __name__ == "__main__":
    main()
