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

$ARGUMENTS
