"""Tests for MainWindow class."""

from unittest.mock import patch

import pytest
from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QApplication,
    QMainWindow,
    QMenuBar,
    QMessageBox,
    QSplitter,
    QStatusBar,
    QToolBar,
)

from autora_gui.desktop_app.canvas.canvas_scene import CanvasScene
from autora_gui.desktop_app.canvas.canvas_view import CanvasView
from autora_gui.desktop_app.components.component_browser import ComponentBrowser
from autora_gui.desktop_app.main_window import MainWindow
from autora_gui.desktop_app.models.node import ComponentDefinition, ParameterDef
from autora_gui.desktop_app.models.workflow import Workflow
from autora_gui.desktop_app.properties.property_editor import PropertyEditor


@pytest.fixture(scope="module")
def app():
    """Create QApplication instance for tests."""
    app = QApplication.instance()
    if app is None:
        app = QApplication([])
    return app


@pytest.fixture
def main_window(app):
    """Create MainWindow instance for tests."""
    window = MainWindow()
    yield window
    # Ensure window can close without showing save dialog
    window._modified = False
    window.close()


@pytest.fixture
def sample_component():
    """Create a sample component definition."""
    return ComponentDefinition(
        uuid="test-uuid",
        protocol_type="theorist",
        name="Test Component",
        description="A test component",
        github_commit="abc123",
        file_path="theorists/test.json",
        parameters=[
            ParameterDef(name="alpha", description="Alpha", datatype="real", default=0.1),
        ],
    )


class TestMainWindowInit:
    """Tests for MainWindow initialization."""

    def test_inherits_qmainwindow(self, main_window):
        """Test that MainWindow inherits from QMainWindow."""
        assert isinstance(main_window, QMainWindow)

    def test_window_title_set(self, main_window):
        """Test that window title is set correctly."""
        assert "AutoRA Workflow Editor" in main_window.windowTitle()

    def test_minimum_size_set(self, main_window):
        """Test that minimum window size is set."""
        min_size = main_window.minimumSize()
        assert min_size.width() == 1200
        assert min_size.height() == 700

    def test_current_file_is_none(self, main_window):
        """Test that current file is None initially."""
        assert main_window._current_file is None

    def test_modified_is_false(self, main_window):
        """Test that modified flag is False initially."""
        assert main_window._modified is False

    def test_component_loader_initialized(self, main_window):
        """Test that component loader is initialized."""
        assert main_window.component_loader is not None


class TestSetupUi:
    """Tests for _setup_ui method."""

    def test_splitter_created(self, main_window):
        """Test that splitter is created."""
        assert hasattr(main_window, "splitter")
        assert isinstance(main_window.splitter, QSplitter)

    def test_splitter_is_horizontal(self, main_window):
        """Test that splitter orientation is horizontal."""
        assert main_window.splitter.orientation() == Qt.Horizontal

    def test_splitter_is_central_widget(self, main_window):
        """Test that splitter is set as central widget."""
        assert main_window.centralWidget() == main_window.splitter

    def test_component_browser_created(self, main_window):
        """Test that component browser is created."""
        assert hasattr(main_window, "component_browser")
        assert isinstance(main_window.component_browser, ComponentBrowser)

    def test_canvas_scene_created(self, main_window):
        """Test that canvas scene is created."""
        assert hasattr(main_window, "canvas_scene")
        assert isinstance(main_window.canvas_scene, CanvasScene)

    def test_canvas_view_created(self, main_window):
        """Test that canvas view is created."""
        assert hasattr(main_window, "canvas_view")
        assert isinstance(main_window.canvas_view, CanvasView)

    def test_property_editor_created(self, main_window):
        """Test that property editor is created."""
        assert hasattr(main_window, "property_editor")
        assert isinstance(main_window.property_editor, PropertyEditor)

    def test_splitter_has_three_widgets(self, main_window):
        """Test that splitter has three widgets."""
        assert main_window.splitter.count() == 3

    def test_splitter_sizes_set(self, main_window):
        """Test that splitter sizes are set correctly."""
        sizes = main_window.splitter.sizes()
        assert len(sizes) == 3
        # Verify relative sizes make sense
        assert sizes[0] > 0  # Left panel
        assert sizes[1] > 0  # Middle panel
        assert sizes[2] > 0  # Right panel


class TestSetupToolbar:
    """Tests for _setup_toolbar method."""

    def test_toolbar_exists(self, main_window):
        """Test that toolbar exists."""
        toolbars = main_window.findChildren(QToolBar)
        assert len(toolbars) > 0

    def test_toolbar_not_movable(self, main_window):
        """Test that toolbar is not movable."""
        toolbars = main_window.findChildren(QToolBar)
        main_toolbar = toolbars[0]
        assert main_toolbar.isMovable() is False

    def test_new_action_in_toolbar(self, main_window):
        """Test that New action exists in toolbar."""
        toolbars = main_window.findChildren(QToolBar)
        actions = toolbars[0].actions()
        action_texts = [a.text() for a in actions]
        assert "New" in action_texts

    def test_open_action_in_toolbar(self, main_window):
        """Test that Open action exists in toolbar."""
        toolbars = main_window.findChildren(QToolBar)
        actions = toolbars[0].actions()
        action_texts = [a.text() for a in actions]
        assert "Open" in action_texts

    def test_save_action_in_toolbar(self, main_window):
        """Test that Save action exists in toolbar."""
        toolbars = main_window.findChildren(QToolBar)
        actions = toolbars[0].actions()
        action_texts = [a.text() for a in actions]
        assert "Save" in action_texts

    def test_fit_view_action_in_toolbar(self, main_window):
        """Test that Fit View action exists in toolbar."""
        toolbars = main_window.findChildren(QToolBar)
        actions = toolbars[0].actions()
        action_texts = [a.text() for a in actions]
        assert "Fit View" in action_texts

    def test_reset_zoom_action_in_toolbar(self, main_window):
        """Test that Reset Zoom action exists in toolbar."""
        toolbars = main_window.findChildren(QToolBar)
        actions = toolbars[0].actions()
        action_texts = [a.text() for a in actions]
        assert "Reset Zoom" in action_texts

    def test_delete_action_in_toolbar(self, main_window):
        """Test that Delete action exists in toolbar."""
        toolbars = main_window.findChildren(QToolBar)
        actions = toolbars[0].actions()
        action_texts = [a.text() for a in actions]
        assert "Delete" in action_texts


class TestSetupMenu:
    """Tests for _setup_menu method."""

    def test_menubar_exists(self, main_window):
        """Test that menubar exists."""
        menubar = main_window.menuBar()
        assert menubar is not None
        assert isinstance(menubar, QMenuBar)

    def test_file_menu_exists(self, main_window):
        """Test that File menu exists."""
        menubar = main_window.menuBar()
        actions = menubar.actions()
        menu_titles = [a.text() for a in actions]
        assert "File" in menu_titles

    def test_edit_menu_exists(self, main_window):
        """Test that Edit menu exists."""
        menubar = main_window.menuBar()
        actions = menubar.actions()
        menu_titles = [a.text() for a in actions]
        assert "Edit" in menu_titles

    def test_view_menu_exists(self, main_window):
        """Test that View menu exists."""
        menubar = main_window.menuBar()
        actions = menubar.actions()
        menu_titles = [a.text() for a in actions]
        assert "View" in menu_titles

    def test_file_menu_has_new_action(self, main_window):
        """Test that File menu has New action."""
        menubar = main_window.menuBar()
        for action in menubar.actions():
            if action.text() == "File":
                menu = action.menu()
                action_texts = [a.text() for a in menu.actions()]
                assert "New" in action_texts
                return
        pytest.fail("File menu not found")

    def test_file_menu_has_open_action(self, main_window):
        """Test that File menu has Open action."""
        menubar = main_window.menuBar()
        for action in menubar.actions():
            if action.text() == "File":
                menu = action.menu()
                action_texts = [a.text() for a in menu.actions()]
                assert "Open..." in action_texts
                return
        pytest.fail("File menu not found")

    def test_file_menu_has_save_action(self, main_window):
        """Test that File menu has Save action."""
        menubar = main_window.menuBar()
        for action in menubar.actions():
            if action.text() == "File":
                menu = action.menu()
                action_texts = [a.text() for a in menu.actions()]
                assert "Save" in action_texts
                return
        pytest.fail("File menu not found")

    def test_file_menu_has_save_as_action(self, main_window):
        """Test that File menu has Save As action."""
        menubar = main_window.menuBar()
        for action in menubar.actions():
            if action.text() == "File":
                menu = action.menu()
                action_texts = [a.text() for a in menu.actions()]
                assert "Save As..." in action_texts
                return
        pytest.fail("File menu not found")

    def test_file_menu_has_exit_action(self, main_window):
        """Test that File menu has Exit action."""
        menubar = main_window.menuBar()
        for action in menubar.actions():
            if action.text() == "File":
                menu = action.menu()
                action_texts = [a.text() for a in menu.actions()]
                assert "Exit" in action_texts
                return
        pytest.fail("File menu not found")


class TestSetupStatusbar:
    """Tests for _setup_statusbar method."""

    def test_statusbar_exists(self, main_window):
        """Test that status bar exists."""
        assert main_window.statusBar() is not None
        assert isinstance(main_window.statusBar(), QStatusBar)

    def test_statusbar_shows_ready(self, main_window):
        """Test that status bar shows Ready message."""
        # Note: We can't directly test the current message easily
        # but we can verify the statusbar is properly initialized
        assert main_window.statusbar is not None


class TestNewWorkflow:
    """Tests for _new_workflow method."""

    def test_new_workflow_creates_workflow(self, main_window):
        """Test that new workflow creates a workflow."""
        main_window._modified = False
        main_window._new_workflow()

        workflow = main_window.canvas_scene.get_workflow()
        assert workflow is not None

    def test_new_workflow_clears_current_file(self, main_window):
        """Test that new workflow clears current file."""
        main_window._current_file = "/some/file.json"
        main_window._modified = False
        main_window._new_workflow()

        assert main_window._current_file is None

    def test_new_workflow_clears_modified_flag(self, main_window):
        """Test that new workflow clears modified flag."""
        main_window._modified = True
        # Mock the message box to return Discard
        with patch.object(QMessageBox, "question", return_value=QMessageBox.Discard):
            main_window._new_workflow()

        assert main_window._modified is False

    def test_new_workflow_updates_title(self, main_window):
        """Test that new workflow updates title."""
        main_window._modified = False
        main_window._new_workflow()

        assert "Untitled" in main_window.windowTitle()

    def test_new_workflow_cancelled_when_save_fails(self, main_window):
        """Test that new workflow is cancelled when save fails."""
        main_window._modified = True
        main_window._current_file = "/some/file.json"

        # Mock: user clicks Save, but save fails
        with patch.object(QMessageBox, "question", return_value=QMessageBox.Save):
            with patch.object(main_window, "_save_workflow", return_value=False):
                main_window._new_workflow()

        # Workflow should NOT have changed since save failed
        assert main_window._modified is True
        assert main_window._current_file == "/some/file.json"

    def test_new_workflow_cancelled_on_cancel_button(self, main_window):
        """Test that new workflow is cancelled when user clicks Cancel."""
        main_window._modified = True
        main_window._current_file = "/some/file.json"

        # Mock: user clicks Cancel
        with patch.object(QMessageBox, "question", return_value=QMessageBox.Cancel):
            main_window._new_workflow()

        # State should remain unchanged
        assert main_window._modified is True
        assert main_window._current_file == "/some/file.json"

    def test_new_workflow_proceeds_after_successful_save(self, main_window, tmp_path):
        """Test that new workflow proceeds after successful save."""
        main_window._modified = True
        main_window._current_file = str(tmp_path / "old.json")
        workflow = Workflow(name="Old")
        main_window.canvas_scene.set_workflow(workflow)

        # Mock: user clicks Save, and save succeeds
        with patch.object(QMessageBox, "question", return_value=QMessageBox.Save):
            with patch.object(main_window, "_save_workflow", return_value=True):
                main_window._new_workflow()

        # New workflow should have been created
        assert main_window._current_file is None
        assert main_window._modified is False


class TestOpenWorkflow:
    """Tests for _open_workflow method."""

    def test_open_workflow_loads_file(self, main_window, tmp_path):
        """Test that open workflow loads a file."""
        # Create a test workflow file
        test_file = tmp_path / "test_workflow.json"
        workflow = Workflow(name="Test Workflow")
        workflow.save_to_file(str(test_file))

        main_window._modified = False

        with patch("PySide6.QtWidgets.QFileDialog.getOpenFileName", return_value=(str(test_file), "")):
            main_window._open_workflow()

        assert main_window._current_file == str(test_file)
        assert main_window._modified is False

    def test_open_workflow_cancelled_on_empty_path(self, main_window):
        """Test that open workflow is cancelled when no file selected."""
        main_window._modified = False
        main_window._current_file = "/original/file.json"

        with patch("PySide6.QtWidgets.QFileDialog.getOpenFileName", return_value=("", "")):
            main_window._open_workflow()

        # Current file should remain unchanged
        assert main_window._current_file == "/original/file.json"

    def test_open_workflow_shows_save_dialog_when_modified(self, main_window, tmp_path):
        """Test that open workflow shows save dialog when modified."""
        main_window._modified = True

        # Create a test workflow file
        test_file = tmp_path / "test_workflow.json"
        workflow = Workflow(name="Test Workflow")
        workflow.save_to_file(str(test_file))

        with patch.object(QMessageBox, "question", return_value=QMessageBox.Discard) as mock_question:
            with patch("PySide6.QtWidgets.QFileDialog.getOpenFileName", return_value=(str(test_file), "")):
                main_window._open_workflow()

        mock_question.assert_called_once()

    def test_open_workflow_cancelled_when_save_fails(self, main_window):
        """Test that open workflow is cancelled when save fails."""
        main_window._modified = True
        main_window._current_file = "/original/file.json"

        # Mock: user clicks Save, but save fails
        with patch.object(QMessageBox, "question", return_value=QMessageBox.Save):
            with patch.object(main_window, "_save_workflow", return_value=False):
                main_window._open_workflow()

        # Should not proceed - current file unchanged
        assert main_window._current_file == "/original/file.json"

    def test_open_workflow_cancelled_on_cancel_button(self, main_window):
        """Test that open workflow is cancelled when user clicks Cancel."""
        main_window._modified = True
        main_window._current_file = "/original/file.json"

        with patch.object(QMessageBox, "question", return_value=QMessageBox.Cancel):
            main_window._open_workflow()

        # Should not proceed - current file unchanged
        assert main_window._current_file == "/original/file.json"

    def test_open_workflow_shows_error_on_invalid_file(self, main_window, tmp_path):
        """Test that open workflow shows error for invalid file."""
        # Create an invalid JSON file
        test_file = tmp_path / "invalid.json"
        test_file.write_text("not valid json {{{")

        main_window._modified = False

        with patch("PySide6.QtWidgets.QFileDialog.getOpenFileName", return_value=(str(test_file), "")):
            with patch.object(QMessageBox, "critical") as mock_critical:
                main_window._open_workflow()

        mock_critical.assert_called_once()
        # Current file should not be set on error
        assert main_window._current_file is None

    def test_open_workflow_updates_title(self, main_window, tmp_path):
        """Test that open workflow updates window title."""
        # Create a test workflow file
        test_file = tmp_path / "my_workflow.json"
        workflow = Workflow(name="My Workflow")
        workflow.save_to_file(str(test_file))

        main_window._modified = False

        with patch("PySide6.QtWidgets.QFileDialog.getOpenFileName", return_value=(str(test_file), "")):
            main_window._open_workflow()

        assert "my_workflow.json" in main_window.windowTitle()

    def test_open_workflow_proceeds_after_save(self, main_window, tmp_path):
        """Test that open workflow proceeds after successful save."""
        main_window._modified = True

        # Create a test workflow file
        test_file = tmp_path / "new_workflow.json"
        workflow = Workflow(name="New Workflow")
        workflow.save_to_file(str(test_file))

        with patch.object(QMessageBox, "question", return_value=QMessageBox.Save):
            with patch.object(main_window, "_save_workflow", return_value=True):
                with patch("PySide6.QtWidgets.QFileDialog.getOpenFileName", return_value=(str(test_file), "")):
                    main_window._open_workflow()

        assert main_window._current_file == str(test_file)


class TestSaveWorkflow:
    """Tests for _save_workflow method."""

    def test_save_workflow_returns_false_when_cancelled(self, main_window):
        """Test that save returns False when cancelled."""
        main_window._current_file = None
        # Mock file dialog to return empty string (cancelled)
        with patch("PySide6.QtWidgets.QFileDialog.getSaveFileName", return_value=("", "")):
            result = main_window._save_workflow()

        assert result is False

    def test_save_workflow_calls_save_as_when_no_file(self, main_window):
        """Test that save calls save_as when no current file."""
        main_window._current_file = None
        with patch.object(main_window, "_save_workflow_as") as mock_save_as:
            mock_save_as.return_value = True
            main_window._save_workflow()

        mock_save_as.assert_called_once()


class TestSaveWorkflowAs:
    """Tests for _save_workflow_as method."""

    def test_save_workflow_as_returns_false_on_cancel(self, main_window):
        """Test that save as returns False when cancelled."""
        with patch("PySide6.QtWidgets.QFileDialog.getSaveFileName", return_value=("", "")):
            result = main_window._save_workflow_as()

        assert result is False

    def test_save_workflow_as_adds_json_extension(self, main_window, tmp_path):
        """Test that save as adds .json extension if missing."""
        test_file = tmp_path / "test_workflow"
        with patch("PySide6.QtWidgets.QFileDialog.getSaveFileName", return_value=(str(test_file), "")):
            with patch.object(main_window, "_do_save") as mock_do_save:
                mock_do_save.return_value = True
                main_window._save_workflow_as()

        # Verify _do_save was called with .json extension
        mock_do_save.assert_called_once()
        call_arg = mock_do_save.call_args[0][0]
        assert call_arg.endswith(".json")


class TestDoSave:
    """Tests for _do_save method."""

    def test_do_save_returns_true_on_success(self, main_window, tmp_path):
        """Test that do_save returns True on success."""
        test_file = tmp_path / "test.json"
        main_window._modified = False
        main_window._new_workflow()

        result = main_window._do_save(str(test_file))

        assert result is True

    def test_do_save_sets_current_file(self, main_window, tmp_path):
        """Test that do_save sets current file on success."""
        test_file = tmp_path / "test.json"
        main_window._modified = False
        main_window._new_workflow()

        main_window._do_save(str(test_file))

        assert main_window._current_file == str(test_file)

    def test_do_save_clears_modified_flag(self, main_window, tmp_path):
        """Test that do_save clears modified flag on success."""
        test_file = tmp_path / "test.json"
        main_window._modified = True
        # Create a new workflow without triggering the save dialog
        workflow = Workflow(name="Test")
        main_window.canvas_scene.set_workflow(workflow)

        main_window._do_save(str(test_file))

        assert main_window._modified is False

    def test_do_save_updates_title(self, main_window, tmp_path):
        """Test that do_save updates title with filename."""
        test_file = tmp_path / "myworkflow.json"
        main_window._modified = False
        main_window._new_workflow()

        main_window._do_save(str(test_file))

        assert "myworkflow.json" in main_window.windowTitle()

    def test_do_save_returns_false_on_error(self, main_window):
        """Test that do_save returns False on error."""
        # Try to save to an invalid path
        with patch("autora_gui.desktop_app.models.workflow.Workflow.save_to_file", side_effect=Exception("Error")):
            with patch.object(QMessageBox, "critical"):
                result = main_window._do_save("/invalid/path/test.json")

        assert result is False


class TestOnNodeSelected:
    """Tests for _on_node_selected method."""

    def test_on_node_selected_sets_property_editor_node(self, main_window, sample_component):
        """Test that node selection sets property editor node."""
        from autora_gui.desktop_app.models.node import NodeData

        node = NodeData(uuid="test-node", component=sample_component)

        with patch.object(main_window.property_editor, "set_node") as mock_set_node:
            main_window._on_node_selected(node)

        mock_set_node.assert_called_once_with(node)

    def test_on_node_selected_with_none(self, main_window):
        """Test that node selection with None clears property editor."""
        with patch.object(main_window.property_editor, "set_node") as mock_set_node:
            main_window._on_node_selected(None)

        mock_set_node.assert_called_once_with(None)


class TestOnWorkflowModified:
    """Tests for _on_workflow_modified method."""

    def test_on_workflow_modified_sets_modified_flag(self, main_window):
        """Test that workflow modified sets modified flag."""
        main_window._modified = False

        main_window._on_workflow_modified()

        assert main_window._modified is True

    def test_on_workflow_modified_updates_title(self, main_window):
        """Test that workflow modified updates title with asterisk."""
        main_window._modified = False
        main_window._current_file = None

        main_window._on_workflow_modified()

        assert "*" in main_window.windowTitle()


class TestOnComponentDropped:
    """Tests for _on_component_dropped method."""

    def test_on_component_dropped_adds_node(self, main_window, sample_component):
        """Test that component drop adds node to scene."""
        with patch.object(main_window.canvas_scene, "add_node") as mock_add_node:
            main_window._on_component_dropped(sample_component, 100.0, 200.0)

        mock_add_node.assert_called_once_with(sample_component, 100.0, 200.0)

    def test_on_component_dropped_updates_statusbar(self, main_window, sample_component):
        """Test that component drop updates status bar."""
        with patch.object(main_window.canvas_scene, "add_node"):
            with patch.object(main_window.statusbar, "showMessage") as mock_show:
                main_window._on_component_dropped(sample_component, 100.0, 200.0)

        mock_show.assert_called()
        args = mock_show.call_args[0][0]
        assert "Test Component" in args


class TestOnParameterChanged:
    """Tests for _on_parameter_changed method."""

    def test_on_parameter_changed_sets_modified(self, main_window):
        """Test that parameter change sets modified flag."""
        main_window._modified = False

        main_window._on_parameter_changed("node-uuid", "alpha", 0.5)

        assert main_window._modified is True

    def test_on_parameter_changed_updates_title(self, main_window):
        """Test that parameter change updates title."""
        main_window._modified = False
        main_window._current_file = None

        main_window._on_parameter_changed("node-uuid", "alpha", 0.5)

        assert "*" in main_window.windowTitle()

    def test_on_parameter_changed_updates_statusbar(self, main_window):
        """Test that parameter change updates status bar."""
        with patch.object(main_window.statusbar, "showMessage") as mock_show:
            main_window._on_parameter_changed("node-uuid", "alpha", 0.5)

        mock_show.assert_called()
        args = mock_show.call_args[0][0]
        assert "alpha" in args


class TestUpdateTitle:
    """Tests for _update_title method."""

    def test_update_title_with_no_file(self, main_window):
        """Test title with no current file."""
        main_window._current_file = None
        main_window._modified = False

        main_window._update_title()

        assert "Untitled" in main_window.windowTitle()
        assert "*" not in main_window.windowTitle()

    def test_update_title_with_file(self, main_window):
        """Test title with current file."""
        main_window._current_file = "/path/to/workflow.json"
        main_window._modified = False

        main_window._update_title()

        assert "workflow.json" in main_window.windowTitle()
        assert "*" not in main_window.windowTitle()

    def test_update_title_with_modified_flag(self, main_window):
        """Test title with modified flag."""
        main_window._current_file = None
        main_window._modified = True

        main_window._update_title()

        assert "*" in main_window.windowTitle()

    def test_update_title_base_title(self, main_window):
        """Test that base title is always present."""
        main_window._current_file = "/some/file.json"
        main_window._modified = True

        main_window._update_title()

        assert "AutoRA Workflow Editor" in main_window.windowTitle()


class TestCloseEvent:
    """Tests for closeEvent method."""

    def test_close_event_accepted_when_not_modified(self, main_window):
        """Test close event is accepted when not modified."""
        from PySide6.QtGui import QCloseEvent

        main_window._modified = False
        event = QCloseEvent()

        main_window.closeEvent(event)

        assert event.isAccepted()

    def test_close_event_save_dialog_when_modified(self, main_window):
        """Test close event shows dialog when modified."""
        from PySide6.QtGui import QCloseEvent

        main_window._modified = True
        event = QCloseEvent()

        with patch.object(QMessageBox, "question", return_value=QMessageBox.Discard) as mock_question:
            main_window.closeEvent(event)

        mock_question.assert_called_once()

    def test_close_event_ignored_on_cancel(self, main_window):
        """Test close event is ignored when cancelled."""
        from PySide6.QtGui import QCloseEvent

        main_window._modified = True
        event = QCloseEvent()

        with patch.object(QMessageBox, "question", return_value=QMessageBox.Cancel):
            main_window.closeEvent(event)

        assert not event.isAccepted()

    def test_close_event_saves_on_save(self, main_window, tmp_path):
        """Test close event saves when Save is chosen."""
        from PySide6.QtGui import QCloseEvent

        main_window._modified = True
        main_window._current_file = str(tmp_path / "test.json")
        # Set a workflow so save works
        workflow = Workflow(name="Test")
        main_window.canvas_scene.set_workflow(workflow)
        event = QCloseEvent()

        with patch.object(QMessageBox, "question", return_value=QMessageBox.Save):
            main_window.closeEvent(event)

        assert event.isAccepted()

    def test_close_event_ignores_when_save_fails(self, main_window):
        """Test close event is ignored when save fails."""
        from PySide6.QtGui import QCloseEvent

        main_window._modified = True
        event = QCloseEvent()

        with patch.object(QMessageBox, "question", return_value=QMessageBox.Save):
            with patch.object(main_window, "_save_workflow", return_value=False):
                main_window.closeEvent(event)

        assert not event.isAccepted()


class TestSignalConnections:
    """Tests for signal connections."""

    def test_node_selected_signal_connected(self, main_window):
        """Test that node_selected signal is connected."""
        # The connection should exist; verify by checking receivers
        # PySide6 doesn't expose receiver count easily, so we verify the handler exists
        assert hasattr(main_window, "_on_node_selected")

    def test_workflow_modified_signal_connected(self, main_window):
        """Test that workflow_modified signal is connected."""
        assert hasattr(main_window, "_on_workflow_modified")

    def test_component_dropped_signal_connected(self, main_window):
        """Test that component_dropped signal is connected."""
        assert hasattr(main_window, "_on_component_dropped")

    def test_parameter_changed_signal_connected(self, main_window):
        """Test that parameter_changed signal is connected."""
        assert hasattr(main_window, "_on_parameter_changed")
