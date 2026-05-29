# AutoRA Workflow Editor

A browser-based visual workflow editor for AutoRA, built with React and FastAPI.

## Features

- **Drag-and-drop interface**: Drag components from the left palette onto the canvas
- **Visual node connections**: Connect nodes by clicking output and input ports
- **Property editing**: Edit node parameters in the right panel
- **Workflow management**: Save, load, and clear workflows
- **Zoom and pan**: Navigate large workflows with zoom (Ctrl+scroll) and pan (Alt+drag)

## Project Structure

```
react/
├── src/
│   ├── components/          # React components
│   │   ├── Canvas/          # Main workflow canvas
│   │   ├── ComponentPalette/# Left panel with draggable components
│   │   ├── Node/            # Workflow node component
│   │   ├── PropertiesPanel/ # Right panel for editing properties
│   │   └── Toolbar/         # Top toolbar with actions
│   ├── context/             # React context for state management
│   ├── hooks/               # Custom React hooks
│   └── utils/               # Utility functions
├── server.py                # FastAPI backend
├── package.json             # Node.js dependencies
├── vite.config.js           # Vite configuration
└── requirements.txt         # Python dependencies
```

## Quick Start

### 1. Install Python dependencies

```bash
cd autora_gui/react
pip install -r requirements.txt
```

### 2. Start the FastAPI backend

```bash
uvicorn server:app --reload --port 8000
```

### 3. Install Node.js dependencies

```bash
npm install
```

### 4. Start the React development server

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Usage

### Adding Nodes

1. Browse components in the left panel (organized by category)
2. Drag a component onto the canvas
3. The node will appear where you drop it

### Connecting Nodes

1. Click on a node's output port (right side)
2. Move your mouse to another node
3. Click on the target node's input port (left side)
4. A connection will be created

### Editing Parameters

1. Click on a node to select it
2. View and edit parameters in the right panel
3. Changes are applied immediately

### Managing Workflows

- **Save**: Click "Save" to download the workflow as JSON
- **Load**: Click "Load" to open a previously saved workflow
- **Clear**: Click "Clear" to remove all nodes and connections

### Navigation

- **Zoom**: Ctrl/Cmd + scroll wheel
- **Pan**: Alt + drag, or middle mouse button drag
- **Delete**: Select a node or connection, then press Delete/Backspace
- **Deselect**: Press Escape

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/components` | GET | Get all components by category |
| `/api/components/{category}` | GET | Get components for a category |
| `/api/schema/{name}` | GET | Get a JSON schema |
| `/api/workflow/validate` | POST | Validate a workflow |
| `/api/workflow/save` | POST | Save a workflow |

## Workflow JSON Format

Workflows are saved in a format compatible with the AutoRA workflow schema:

```json
{
  "name": "Workflow Name",
  "description": "Optional description",
  "components": [
    {
      "uuid": "component-instance-id",
      "protocolUuid": "protocol-definition-id",
      "parameterSetting": [
        { "uuid": "param-id", "name": "param_name", "value": 42 }
      ],
      "canvasLocation": { "x": 100, "y": 200 }
    }
  ],
  "links": [
    { "source": "source-component-uuid", "target": "target-component-uuid" }
  ]
}
```
