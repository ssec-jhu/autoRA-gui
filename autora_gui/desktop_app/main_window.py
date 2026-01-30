"""Main application window with 3-panel layout."""
from pathlib import Path
from PySide6.QtWidgets import (
    QMainWindow,
    QSplitter,
    QWidget,
    QVBoxLayout,
    QToolBar,
    QFileDialog,
    QMessageBox,
    QStatusBar,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QAction, QKeySequence

from .components.component_loader import ComponentLoader, get_default_components_dir
from .components.component_browser import ComponentBrowser
from .canvas.canvas_scene import CanvasScene
from .canvas.canvas_view import CanvasView
from .properties.property_editor import PropertyEditor
from .models.workflow import Workflow
from .models.node import ComponentDefinition


class MainWindow(QMainWindow):
    """Main application window for the workflow editor."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("AutoRA Workflow Editor")
        self.setMinimumSize(1200, 700)

        # Initialize components
        self._current_file: str | None = None
        self._modified = False

        # Load components
        self.component_loader = ComponentLoader(get_default_components_dir())
        self.component_loader.load_all()

        # Create UI
        self._setup_ui()
        self._setup_toolbar()
        self._setup_menu()
        self._setup_statusbar()

        # Create new workflow
        self._new_workflow()

    def _setup_ui(self):
        """Set up the main UI with 3-panel splitter."""
        # Main splitter
        self.splitter = QSplitter(Qt.Horizontal)
        self.setCentralWidget(self.splitter)

        # Left panel: Component browser
        self.component_browser = ComponentBrowser(self.component_loader)
        self.splitter.addWidget(self.component_browser)

        # Middle panel: Canvas
        self.canvas_scene = CanvasScene()
        self.canvas_view = CanvasView(self.canvas_scene)
        self.splitter.addWidget(self.canvas_view)

        # Right panel: Property editor
        self.property_editor = PropertyEditor()
        self.splitter.addWidget(self.property_editor)

        # Set splitter sizes (left: 200, middle: stretch, right: 280)
        self.splitter.setSizes([200, 700, 280])

        # Connect signals
        self.canvas_scene.node_selected.connect(self._on_node_selected)
        self.canvas_scene.workflow_modified.connect(self._on_workflow_modified)
        self.canvas_view.component_dropped.connect(self._on_component_dropped)
        self.property_editor.parameter_changed.connect(self._on_parameter_changed)

    def _setup_toolbar(self):
        """Set up the toolbar."""
        toolbar = QToolBar("Main Toolbar")
        toolbar.setMovable(False)
        self.addToolBar(toolbar)

        # New
        new_action = QAction("New", self)
        new_action.setShortcut(QKeySequence.New)
        new_action.triggered.connect(self._new_workflow)
        toolbar.addAction(new_action)

        # Open
        open_action = QAction("Open", self)
        open_action.setShortcut(QKeySequence.Open)
        open_action.triggered.connect(self._open_workflow)
        toolbar.addAction(open_action)

        # Save
        save_action = QAction("Save", self)
        save_action.setShortcut(QKeySequence.Save)
        save_action.triggered.connect(self._save_workflow)
        toolbar.addAction(save_action)

        toolbar.addSeparator()

        # Fit view
        fit_action = QAction("Fit View", self)
        fit_action.setShortcut("F")
        fit_action.triggered.connect(self.canvas_view.fit_in_view)
        toolbar.addAction(fit_action)

        # Reset zoom
        reset_action = QAction("Reset Zoom", self)
        reset_action.setShortcut("R")
        reset_action.triggered.connect(self.canvas_view.reset_zoom)
        toolbar.addAction(reset_action)

        toolbar.addSeparator()

        # Delete selected
        delete_action = QAction("Delete", self)
        delete_action.setShortcut(QKeySequence.Delete)
        delete_action.triggered.connect(self.canvas_scene.remove_selected)
        toolbar.addAction(delete_action)

    def _setup_menu(self):
        """Set up the menu bar."""
        menubar = self.menuBar()

        # File menu
        file_menu = menubar.addMenu("File")

        new_action = QAction("New", self)
        new_action.setShortcut(QKeySequence.New)
        new_action.triggered.connect(self._new_workflow)
        file_menu.addAction(new_action)

        open_action = QAction("Open...", self)
        open_action.setShortcut(QKeySequence.Open)
        open_action.triggered.connect(self._open_workflow)
        file_menu.addAction(open_action)

        file_menu.addSeparator()

        save_action = QAction("Save", self)
        save_action.setShortcut(QKeySequence.Save)
        save_action.triggered.connect(self._save_workflow)
        file_menu.addAction(save_action)

        save_as_action = QAction("Save As...", self)
        save_as_action.setShortcut(QKeySequence.SaveAs)
        save_as_action.triggered.connect(self._save_workflow_as)
        file_menu.addAction(save_as_action)

        file_menu.addSeparator()

        exit_action = QAction("Exit", self)
        exit_action.setShortcut(QKeySequence.Quit)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        # Edit menu
        edit_menu = menubar.addMenu("Edit")

        delete_action = QAction("Delete Selected", self)
        delete_action.setShortcut(QKeySequence.Delete)
        delete_action.triggered.connect(self.canvas_scene.remove_selected)
        edit_menu.addAction(delete_action)

        # View menu
        view_menu = menubar.addMenu("View")

        fit_action = QAction("Fit All in View", self)
        fit_action.setShortcut("F")
        fit_action.triggered.connect(self.canvas_view.fit_in_view)
        view_menu.addAction(fit_action)

        reset_zoom_action = QAction("Reset Zoom", self)
        reset_zoom_action.setShortcut("R")
        reset_zoom_action.triggered.connect(self.canvas_view.reset_zoom)
        view_menu.addAction(reset_zoom_action)

        center_action = QAction("Center on Origin", self)
        center_action.setShortcut("C")
        center_action.triggered.connect(self.canvas_view.center_on_origin)
        view_menu.addAction(center_action)

    def _setup_statusbar(self):
        """Set up the status bar."""
        self.statusbar = QStatusBar()
        self.setStatusBar(self.statusbar)
        self.statusbar.showMessage("Ready")

    def _new_workflow(self):
        """Create a new workflow."""
        if self._modified:
            result = QMessageBox.question(
                self,
                "Unsaved Changes",
                "Do you want to save changes before creating a new workflow?",
                QMessageBox.Save | QMessageBox.Discard | QMessageBox.Cancel,
            )
            if result == QMessageBox.Save:
                if not self._save_workflow():
                    return
            elif result == QMessageBox.Cancel:
                return

        workflow = Workflow(name="New Workflow")
        self.canvas_scene.set_workflow(workflow)
        self._current_file = None
        self._modified = False
        self._update_title()
        self.statusbar.showMessage("New workflow created")

    def _open_workflow(self):
        """Open a workflow from file."""
        if self._modified:
            result = QMessageBox.question(
                self,
                "Unsaved Changes",
                "Do you want to save changes before opening another workflow?",
                QMessageBox.Save | QMessageBox.Discard | QMessageBox.Cancel,
            )
            if result == QMessageBox.Save:
                if not self._save_workflow():
                    return
            elif result == QMessageBox.Cancel:
                return

        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Open Workflow",
            str(get_default_components_dir().parent / "workflows"),
            "JSON Files (*.json);;All Files (*)",
        )

        if file_path:
            try:
                workflow = Workflow.load_from_file(
                    file_path, self.component_loader.component_lookup
                )
                self.canvas_scene.set_workflow(workflow)
                self._current_file = file_path
                self._modified = False
                self._update_title()
                self.statusbar.showMessage(f"Opened: {file_path}")
            except Exception as e:
                QMessageBox.critical(
                    self, "Error", f"Failed to open workflow:\n{str(e)}"
                )

    def _save_workflow(self) -> bool:
        """Save the current workflow - always shows file dialog."""
        # Always show file dialog
        default_dir = str(get_default_components_dir().parent / "workflows")
        if self._current_file:
            default_dir = self._current_file

        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Save Workflow",
            default_dir,
            "JSON Files (*.json);;All Files (*)",
        )

        if not file_path:
            return False

        if not file_path.endswith(".json"):
            file_path += ".json"

        workflow = self.canvas_scene.get_workflow()
        if workflow:
            try:
                workflow.save_to_file(file_path)
                self._current_file = file_path
                self._modified = False
                self._update_title()
                self.statusbar.showMessage(f"Saved: {file_path}")
                return True
            except Exception as e:
                QMessageBox.critical(
                    self, "Error", f"Failed to save workflow:\n{str(e)}"
                )
        return False

    def _save_workflow_as(self) -> bool:
        """Save the workflow with a new filename."""
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Save Workflow",
            str(get_default_components_dir().parent / "workflows"),
            "JSON Files (*.json);;All Files (*)",
        )

        if file_path:
            if not file_path.endswith(".json"):
                file_path += ".json"
            self._current_file = file_path
            return self._save_workflow()

        return False

    def _on_node_selected(self, node_data):
        """Handle node selection."""
        self.property_editor.set_node(node_data)

    def _on_workflow_modified(self):
        """Handle workflow modification."""
        self._modified = True
        self._update_title()

    def _on_component_dropped(
        self, component: ComponentDefinition, x: float, y: float
    ):
        """Handle component dropped on canvas."""
        self.canvas_scene.add_node(component, x, y)
        self.statusbar.showMessage(f"Added node: {component.name}")

    def _on_parameter_changed(self, node_uuid: str, param_name: str, value):
        """Handle parameter change."""
        self._modified = True
        self._update_title()
        self.statusbar.showMessage(f"Changed {param_name}")

    def _update_title(self):
        """Update window title with file name and modified indicator."""
        title = "AutoRA Workflow Editor"
        if self._current_file:
            title += f" - {Path(self._current_file).name}"
        else:
            title += " - Untitled"
        if self._modified:
            title += " *"
        self.setWindowTitle(title)

    def closeEvent(self, event):
        """Handle window close."""
        if self._modified:
            result = QMessageBox.question(
                self,
                "Unsaved Changes",
                "Do you want to save changes before closing?",
                QMessageBox.Save | QMessageBox.Discard | QMessageBox.Cancel,
            )
            if result == QMessageBox.Save:
                if not self._save_workflow():
                    event.ignore()
                    return
            elif result == QMessageBox.Cancel:
                event.ignore()
                return

        event.accept()
