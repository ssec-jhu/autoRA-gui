---
name: pyside
description: Reference guide for building cross-platform desktop applications with PySide6 (Qt for Python)
disable-model-invocation: true
allowed-tools: WebFetch, WebSearch, Read, Grep, Write, Edit
---

# PySide6 Framework Skill

Reference guide for building cross-platform desktop applications using PySide6 (Qt for Python).

## Overview

**Official Docs**: https://doc.qt.io/qtforpython-6/
**PyPI**: https://pypi.org/project/PySide6/
**Tutorial**: https://www.pythonguis.com/pyside6-tutorial/
**Version**: 6.10.1 (Production/Stable)
**License**: LGPL-3.0 / GPL-2.0 / GPL-3.0 / Commercial

PySide6 is the official Python binding for Qt 6, developed by The Qt Company. Enables cross-platform GUI development on Windows, macOS, and Linux.

## Installation

```bash
pip install PySide6
```

Requires Python 3.9 to 3.14.

## Core Components

| Module | Purpose |
|--------|---------|
| `PySide6.QtWidgets` | GUI widgets (buttons, labels, inputs, etc.) |
| `PySide6.QtCore` | Core non-GUI classes (signals, slots, events) |
| `PySide6.QtGui` | GUI utilities (fonts, colors, images) |
| `PySide6.QtQml` | QML/QtQuick declarative UI |
| `PySide6.QtMultimedia` | Audio/video playback |
| `PySide6.QtNetwork` | Network programming |
| `PySide6.QtSql` | Database integration |

## Basic App Structure

```python
import sys
from PySide6.QtWidgets import QApplication, QMainWindow, QPushButton

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("My App")

        button = QPushButton("Click me!")
        button.clicked.connect(self.on_click)
        self.setCentralWidget(button)

    def on_click(self):
        print("Button clicked!")

app = QApplication(sys.argv)
window = MainWindow()
window.show()
sys.exit(app.exec())
```

## Signals and Slots

Qt's central communication mechanism for event handling.

### Connecting Signals to Slots

```python
from PySide6.QtCore import Slot

button.clicked.connect(self.on_button_clicked)

@Slot()
def on_button_clicked(self):
    print("Button was clicked")
```

### Custom Signals

```python
from PySide6.QtCore import Signal, QObject

class MyWidget(QObject):
    # Declare signal with parameter types
    value_changed = Signal(int)
    data_ready = Signal(str, int)

    def update_value(self, value):
        self.value_changed.emit(value)
```

### Signal/Slot Rules

- Use `@Slot()` decorator for performance (avoids runtime overhead)
- Signals can connect to multiple slots
- Slots can receive signals from multiple sources
- Use `.disconnect()` to remove connections

## Layouts

### Layout Types

| Layout | Purpose |
|--------|---------|
| `QVBoxLayout` | Vertical stack |
| `QHBoxLayout` | Horizontal row |
| `QGridLayout` | Row/column grid |
| `QStackedLayout` | Overlapping widgets (tab-like) |
| `QFormLayout` | Label-field pairs |

### Layout Example

```python
from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QPushButton

class MyWidget(QWidget):
    def __init__(self):
        super().__init__()

        # Create layout
        layout = QVBoxLayout()

        # Add widgets
        layout.addWidget(QPushButton("Button 1"))
        layout.addWidget(QPushButton("Button 2"))

        # Nested layout
        h_layout = QHBoxLayout()
        h_layout.addWidget(QPushButton("Left"))
        h_layout.addWidget(QPushButton("Right"))
        layout.addLayout(h_layout)

        # Set layout on widget
        self.setLayout(layout)
```

### Layout Methods

- `.addWidget(widget)` - Add widget to layout
- `.addLayout(layout)` - Nest another layout
- `.setContentsMargins(left, top, right, bottom)` - Set margins
- `.setSpacing(pixels)` - Set spacing between items

## Common Widgets

### Display Widgets

| Widget | Purpose | Key Signals |
|--------|---------|-------------|
| `QLabel` | Text/image display | - |
| `QProgressBar` | Progress indicator | `valueChanged` |

### Input Widgets

| Widget | Purpose | Key Signals |
|--------|---------|-------------|
| `QPushButton` | Clickable button | `clicked`, `pressed`, `released` |
| `QLineEdit` | Single-line text | `textChanged`, `returnPressed` |
| `QTextEdit` | Multi-line text | `textChanged` |
| `QCheckBox` | Checkbox | `stateChanged` |
| `QRadioButton` | Radio button | `toggled` |
| `QComboBox` | Dropdown list | `currentIndexChanged`, `currentTextChanged` |
| `QSlider` | Slider control | `valueChanged`, `sliderMoved` |
| `QSpinBox` | Numeric spinner | `valueChanged` |
| `QDoubleSpinBox` | Decimal spinner | `valueChanged` |
| `QDateEdit` | Date picker | `dateChanged` |

### Container Widgets

| Widget | Purpose |
|--------|---------|
| `QMainWindow` | Main application window with menubar, toolbar, statusbar |
| `QWidget` | Base container widget |
| `QGroupBox` | Grouped widgets with title |
| `QTabWidget` | Tabbed interface |
| `QScrollArea` | Scrollable container |
| `QSplitter` | Resizable split panels |

## QMainWindow Structure

```python
from PySide6.QtWidgets import QMainWindow, QToolBar, QStatusBar
from PySide6.QtGui import QAction

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        # Menu bar
        menu = self.menuBar()
        file_menu = menu.addMenu("&File")

        # Actions
        open_action = QAction("&Open", self)
        open_action.setShortcut("Ctrl+O")
        open_action.triggered.connect(self.open_file)
        file_menu.addAction(open_action)

        # Toolbar
        toolbar = QToolBar("Main Toolbar")
        self.addToolBar(toolbar)
        toolbar.addAction(open_action)

        # Status bar
        self.setStatusBar(QStatusBar())
        self.statusBar().showMessage("Ready")

        # Central widget
        self.setCentralWidget(QWidget())
```

## Dialogs

```python
from PySide6.QtWidgets import QMessageBox, QFileDialog, QInputDialog

# Message box
QMessageBox.information(self, "Title", "Message")
QMessageBox.warning(self, "Title", "Warning message")
result = QMessageBox.question(self, "Title", "Are you sure?")

# File dialog
filename, _ = QFileDialog.getOpenFileName(self, "Open File", "", "All Files (*)")
filename, _ = QFileDialog.getSaveFileName(self, "Save File", "", "All Files (*)")

# Input dialog
text, ok = QInputDialog.getText(self, "Input", "Enter value:")
number, ok = QInputDialog.getInt(self, "Input", "Enter number:")
```

## Qt Designer

Visual UI editor for building interfaces without code:
- Create `.ui` files with drag-and-drop
- Load at runtime: `QUiLoader().load("design.ui")`
- Or compile to Python: `pyside6-uic design.ui -o ui_design.py`

## Key Documentation Links

- Getting Started: https://doc.qt.io/qtforpython-6/quickstart.html
- Tutorials: https://doc.qt.io/qtforpython-6/tutorials/index.html
- API Reference: https://doc.qt.io/qtforpython-6/api.html
- Signals/Slots: https://doc.qt.io/qtforpython-6/tutorials/basictutorial/signals_and_slots.html
- PythonGUIs Tutorial: https://www.pythonguis.com/pyside6-tutorial/

## Research Focus

When invoked, help with:

1. **Window/Widget Design**: Create and structure application windows
2. **Signals/Slots**: Connect events to handlers
3. **Layouts**: Position and arrange widgets
4. **Dialogs**: Implement user interaction dialogs
5. **Menus/Toolbars**: Build application chrome
6. **Threading**: Handle background tasks with QThread
7. **Styling**: Apply stylesheets and themes

---

## AutoRA Desktop App Reference (gui_poc_python branch)

This project has an existing PySide6 implementation in the `gui_poc_python` branch. Reference it when building or extending the desktop GUI.

### Architecture Overview

The desktop app is a 3-panel workflow editor located in `autora_gui/desktop_app/`:

```
autora_gui/desktop_app/
├── main.py                    # Entry point
├── main_window.py             # Main window with 3-panel splitter layout
├── canvas/
│   ├── canvas_scene.py        # QGraphicsScene for nodes and connections
│   ├── canvas_view.py         # QGraphicsView with pan/zoom support
│   ├── node_item.py           # Visual node representation
│   └── connection_item.py     # Bezier curve connections with arrows
├── components/
│   ├── component_browser.py   # Left panel tree widget with drag support
│   └── component_loader.py    # JSON component file loader
├── properties/
│   └── property_editor.py     # Right panel for editing node parameters
└── models/
    ├── node.py                # ComponentDefinition, NodeData dataclasses
    └── workflow.py            # Workflow, Connection dataclasses
```

### MainWindow Structure

```python
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("AutoRA Workflow Editor")
        self.setMinimumSize(1200, 700)

        # Three-panel splitter layout
        self.splitter = QSplitter(Qt.Horizontal)
        self.setCentralWidget(self.splitter)

        # Left: Component browser (tree with drag support)
        self.component_browser = ComponentBrowser(self.component_loader)
        self.splitter.addWidget(self.component_browser)

        # Center: Canvas (nodes and connections)
        self.canvas_scene = CanvasScene()
        self.canvas_view = CanvasView(self.canvas_scene)
        self.splitter.addWidget(self.canvas_view)

        # Right: Property editor
        self.property_editor = PropertyEditor()
        self.splitter.addWidget(self.property_editor)

        self.splitter.setSizes([200, 700, 280])

        # Connect signals
        self.canvas_scene.node_selected.connect(self._on_node_selected)
        self.canvas_scene.workflow_modified.connect(self._on_workflow_modified)
        self.canvas_view.component_dropped.connect(self._on_component_dropped)
        self.property_editor.parameter_changed.connect(self._on_parameter_changed)
```

### Canvas Scene with QGraphicsScene

```python
class CanvasScene(QGraphicsScene):
    node_selected = Signal(object)     # Emits NodeData or None
    workflow_modified = Signal()       # Emitted when workflow changes

    def __init__(self):
        super().__init__()
        self.setSceneRect(-5000, -5000, 10000, 10000)
        self.setBackgroundBrush(QColor("#f8f8f8"))

        self._node_items: dict[str, NodeItem] = {}
        self._connection_items: dict[str, ConnectionItem] = {}
        self._workflow: Workflow | None = None

    def add_node(self, component: ComponentDefinition, x: float, y: float) -> NodeItem:
        node_data = NodeData.create(component, x, y)
        if self._workflow:
            self._workflow.add_node(node_data)
        node_item = self._create_node_item(node_data)
        self.workflow_modified.emit()
        return node_item
```

### Node Item with Custom Painting

```python
NODE_COLORS = {
    "experimentalist": QColor("#4CAF50"),    # Green
    "theorist": QColor("#2196F3"),            # Blue
    "experiment_runner": QColor("#FF9800"),   # Orange
}
NODE_WIDTH, NODE_HEIGHT, HEADER_HEIGHT = 200, 70, 35

class NodeItem(QGraphicsItem):
    def __init__(self, node_data: NodeData):
        super().__init__()
        self.node_data = node_data
        self.signals = NodeItemSignals()
        self._color = NODE_COLORS.get(node_data.component.protocol_type, QColor("#9E9E9E"))

        self.setFlag(QGraphicsItem.ItemIsMovable, True)
        self.setFlag(QGraphicsItem.ItemIsSelectable, True)
        self.setFlag(QGraphicsItem.ItemSendsGeometryChanges, True)
        self.setPos(node_data.x, node_data.y)

    def paint(self, painter: QPainter, option, widget=None):
        # Shadow
        painter.setBrush(QBrush(QColor(0, 0, 0, 40)))
        painter.drawRoundedRect(3, 3, self._width, self._height, 8, 8)

        # Body with gradient
        gradient = QLinearGradient(0, 0, 0, self._height)
        gradient.setColorAt(0, QColor("#ffffff"))
        gradient.setColorAt(1, QColor("#f5f5f5"))
        painter.setBrush(QBrush(gradient))

        # Selection highlight
        if self.isSelected():
            painter.setPen(QPen(QColor("#1976D2"), 3))
        else:
            painter.setPen(QPen(QColor("#cccccc"), 1))
        painter.drawRoundedRect(0, 0, self._width, self._height, 8, 8)

        # Colored header
        painter.setBrush(QBrush(self._color))
        painter.drawRoundedRect(0, 0, self._width, self._header_height, 8, 8)
```

### Drag and Drop from Tree to Canvas

```python
# component_browser.py - Draggable tree widget
class DraggableTreeWidget(QTreeWidget):
    def mimeTypes(self):
        return ["application/x-component"]

    def mimeData(self, items):
        mime_data = QMimeData()
        for item in items:
            component = item.data(0, Qt.UserRole)
            if isinstance(component, ComponentDefinition):
                data = pickle.dumps(component)
                mime_data.setData("application/x-component", QByteArray(data))
                break
        return mime_data

    def startDrag(self, supportedActions):
        drag = QDrag(self)
        drag.setMimeData(self.mimeData([self.currentItem()]))
        drag.exec(Qt.CopyAction)

# canvas_view.py - Accept drops
class CanvasView(QGraphicsView):
    component_dropped = Signal(object, float, float)

    def dropEvent(self, event: QDropEvent):
        if event.mimeData().hasFormat("application/x-component"):
            scene_pos = self.mapToScene(event.position().toPoint())
            component = pickle.loads(bytes(event.mimeData().data("application/x-component")))
            self.component_dropped.emit(component, scene_pos.x(), scene_pos.y())
            event.acceptProposedAction()
```

### Pan and Zoom in Canvas View

```python
class CanvasView(QGraphicsView):
    def __init__(self, scene: CanvasScene):
        super().__init__(scene)
        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)
        self.setAcceptDrops(True)
        self._zoom_factor = 1.0
        self._zoom_min, self._zoom_max = 0.1, 3.0

    def wheelEvent(self, event: QWheelEvent):
        factor = 1.15 if event.angleDelta().y() > 0 else 1/1.15
        new_zoom = self._zoom_factor * factor
        if self._zoom_min <= new_zoom <= self._zoom_max:
            self._zoom_factor = new_zoom
            self.scale(factor, factor)

    def mousePressEvent(self, event: QMouseEvent):
        if event.button() == Qt.MiddleButton:
            self._panning = True
            self._pan_start = event.position()
            self.setCursor(Qt.ClosedHandCursor)
```

### Bezier Curve Connections

```python
class ConnectionItem(QGraphicsPathItem):
    def update_path(self):
        start = self._get_node_edge_point(self.source_node, self.source_side)
        end = self._get_node_edge_point(self.target_node, self.target_side)

        path = QPainterPath()
        path.moveTo(start)

        dx, dy = abs(end.x() - start.x()), abs(end.y() - start.y())
        ctrl_offset = max(max(dx, dy) * 0.4, 50)

        ctrl1 = self._get_control_point(start, self.source_side, ctrl_offset)
        ctrl2 = self._get_control_point(end, self.target_side, ctrl_offset)
        path.cubicTo(ctrl1, ctrl2, end)
        self.setPath(path)
```

### Property Editor with Dynamic Widgets

```python
class PropertyEditor(QWidget):
    parameter_changed = Signal(str, str, object)  # node_uuid, param_name, value

    def _create_param_widget(self, param_def: ParameterDef, node_data: NodeData):
        current_value = node_data.parameters.get(param_def.name, param_def.default)

        if param_def.datatype == "integer":
            widget = QSpinBox()
            widget.setRange(-999999, 999999)
            widget.setValue(int(current_value) if current_value else 0)
            widget.valueChanged.connect(lambda v: self._on_param_changed(param_def.name, v))
        elif param_def.datatype == "real":
            widget = QDoubleSpinBox()
            widget.setDecimals(6)
            widget.valueChanged.connect(lambda v: self._on_param_changed(param_def.name, v))
        elif param_def.datatype == "boolean":
            widget = QCheckBox()
            widget.setChecked(bool(current_value))
            widget.stateChanged.connect(lambda s: self._on_param_changed(param_def.name, s == Qt.Checked))
        elif param_def.datatype == "categorical":
            widget = QComboBox()
            widget.addItems(param_def.valid_values)
            widget.currentTextChanged.connect(lambda t: self._on_param_changed(param_def.name, t))
        else:
            widget = QLineEdit()
            widget.textChanged.connect(lambda t: self._on_param_changed(param_def.name, t))
        return widget
```

### Data Models

```python
# node.py
@dataclass
class ComponentDefinition:
    uuid: str
    protocol_type: str  # experimentalist, theorist, experiment_runner
    name: str
    description: str
    github_commit: str
    parameters: list[ParameterDef]
    input_ports: list[PortDef]
    output_ports: list[PortDef]
    file_path: str

@dataclass
class NodeData:
    uuid: str
    component: ComponentDefinition
    x: float = 0
    y: float = 0
    parameters: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(cls, component: ComponentDefinition, x: float = 0, y: float = 0):
        return cls(uuid=str(uuid_module.uuid4()), component=component, x=x, y=y)

# workflow.py
@dataclass
class Connection:
    uuid: str
    source_node_id: str
    target_node_id: str
    source_port: str = ""
    target_port: str = ""

@dataclass
class Workflow:
    name: str = "Untitled Workflow"
    nodes: list[NodeData] = field(default_factory=list)
    connections: list[Connection] = field(default_factory=list)

    def save_to_file(self, file_path: str):
        with open(file_path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)
```

### Component Loader

```python
class ComponentLoader:
    CATEGORY_MAP = {
        "experimentalists": "experimentalist",
        "theorists": "theorist",
        "experiment_runners": "experiment_runner",
    }

    def __init__(self, components_dir: Path):
        self.components_dir = components_dir
        self._components: dict[str, list[ComponentDefinition]] = {}

    def load_all(self) -> dict[str, list[ComponentDefinition]]:
        for category in self.CATEGORY_MAP.keys():
            category_path = self.components_dir / category
            if category_path.is_dir():
                self._components[category] = list(self._load_category(category_path))
        return self._components

def get_default_components_dir() -> Path:
    return Path(__file__).parent.parent.parent / "JSON" / "components"
```

### Running the App

```bash
# Checkout the gui_poc_python branch
git checkout gui_poc_python

# Install dependencies
pip install PySide6

# Run the application
python -m autora_gui.desktop_app.main
```

$ARGUMENTS
