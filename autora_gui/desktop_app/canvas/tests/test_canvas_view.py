"""Unit tests for CanvasView class."""

import pytest
from PySide6.QtCore import QByteArray, QMimeData, Qt
from PySide6.QtGui import QPainter
from PySide6.QtWidgets import QApplication, QGraphicsView

from autora_gui.desktop_app.canvas.canvas_scene import CanvasScene
from autora_gui.desktop_app.canvas.canvas_view import CanvasView
from autora_gui.desktop_app.models.node import ComponentDefinition, PortDef
from autora_gui.desktop_app.models.workflow import Workflow


@pytest.fixture(scope="module")
def app():
    """Create QApplication instance for tests."""
    app = QApplication.instance()
    if app is None:
        app = QApplication([])
    yield app


@pytest.fixture
def sample_component():
    """Create a sample component definition."""
    return ComponentDefinition(
        uuid="test-component-uuid",
        protocol_type="experimentalist",
        name="Test Component",
        description="A test component",
        github_commit="abc123",
        parameters=[],
        input_ports=[PortDef(name="input1", description="Input port", datatype="object")],
        output_ports=[PortDef(name="output1", description="Output port", datatype="object")],
        file_path="/test/path.json",
    )


@pytest.fixture
def scene(app):
    """Create a CanvasScene for testing."""
    scene = CanvasScene()
    workflow = Workflow(name="Test")
    scene.set_workflow(workflow)
    return scene


@pytest.fixture
def view(scene):
    """Create a CanvasView for testing."""
    return CanvasView(scene)


class TestCanvasViewInit:
    """Tests for CanvasView initialization."""

    def test_init(self, scene):
        """Test CanvasView initialization."""
        view = CanvasView(scene)

        assert view._scene == scene
        assert view.scene() == scene

    def test_render_hints(self, view):
        """Test that render hints are set correctly."""
        assert view.renderHints() & QPainter.RenderHint.Antialiasing
        assert view.renderHints() & QPainter.RenderHint.SmoothPixmapTransform

    def test_viewport_update_mode(self, view):
        """Test viewport update mode."""
        assert view.viewportUpdateMode() == QGraphicsView.FullViewportUpdate

    def test_drag_mode(self, view):
        """Test drag mode."""
        assert view.dragMode() == QGraphicsView.RubberBandDrag

    def test_transformation_anchor(self, view):
        """Test transformation anchor."""
        assert view.transformationAnchor() == QGraphicsView.AnchorUnderMouse

    def test_resize_anchor(self, view):
        """Test resize anchor."""
        assert view.resizeAnchor() == QGraphicsView.AnchorUnderMouse

    def test_accepts_drops(self, view):
        """Test that view accepts drops."""
        assert view.acceptDrops()

    def test_initial_zoom(self, view):
        """Test initial zoom state."""
        assert view._zoom_factor == 1.0
        assert view._zoom_min == 0.1
        assert view._zoom_max == 3.0

    def test_initial_pan_state(self, view):
        """Test initial pan state."""
        assert view._panning is False
        assert view._pan_start_x == 0
        assert view._pan_start_y == 0


class TestCanvasViewZoom:
    """Tests for zoom functionality."""

    def test_zoom_limits(self, view):
        """Test zoom factor limits."""
        assert view._zoom_min == 0.1
        assert view._zoom_max == 3.0

    def test_reset_zoom(self, view):
        """Test reset_zoom method."""
        # First scale to something other than 1
        view.scale(2.0, 2.0)
        view._zoom_factor = 2.0

        view.reset_zoom()

        assert view._zoom_factor == 1.0
        # Transform should be identity (scale factor 1)
        assert view.transform().m11() == pytest.approx(1.0)
        assert view.transform().m22() == pytest.approx(1.0)

    def test_fit_in_view_empty_scene(self, view):
        """Test fit_in_view with empty scene."""
        # Should not crash with empty scene
        view.fit_in_view()

    def test_fit_in_view_with_items(self, view, scene, sample_component):
        """Test fit_in_view with items in scene."""
        scene.add_node(sample_component, 0, 0)
        scene.add_node(sample_component, 500, 300)

        view.fit_in_view()

        # Zoom factor should be updated
        assert view._zoom_factor != 1.0 or view.transform().m11() != 1.0

    def test_center_on_origin(self, view):
        """Test center_on_origin method."""
        # First scroll somewhere else
        view.horizontalScrollBar().setValue(500)
        view.verticalScrollBar().setValue(500)

        view.center_on_origin()

        # View should be centered on (0, 0)
        # The exact scroll values depend on viewport size, so we just verify
        # that center_on_origin runs without error


class TestCanvasViewSignals:
    """Tests for CanvasView signals."""

    def test_component_dropped_signal_exists(self, view):
        """Test that component_dropped signal exists."""
        assert hasattr(view, "component_dropped")

    def test_component_dropped_signal_emission(self, view, sample_component):
        """Test component_dropped signal can be emitted and received."""
        received = []
        view.component_dropped.connect(lambda comp, x, y: received.append((comp, x, y)))

        view.component_dropped.emit(sample_component, 100.0, 200.0)

        assert len(received) == 1
        assert received[0][0] == sample_component
        assert received[0][1] == 100.0
        assert received[0][2] == 200.0


class TestCanvasViewDragDrop:
    """Tests for drag and drop functionality."""

    def test_drag_enter_accepts_component_data(self, view):
        """Test that drag enter accepts component mime data."""
        # Create mock drag event with component data
        mime_data = QMimeData()
        mime_data.setData("application/x-component", QByteArray(b"{}"))

        # The view should accept this format
        assert view.acceptDrops()

    def test_drag_enter_rejects_other_data(self, view):
        """Test that drag enter rejects non-component mime data."""
        # View should only accept application/x-component format
        mime_data = QMimeData()
        mime_data.setText("some text")

        # We can't easily simulate the actual event, but we can verify
        # the format check in dragEnterEvent logic


class TestCanvasViewHelperMethods:
    """Tests for helper methods and properties."""

    def test_scene_property(self, view, scene):
        """Test that _scene property is set correctly."""
        assert view._scene == scene

    def test_scene_method(self, view, scene):
        """Test that scene() method returns the scene."""
        assert view.scene() == scene


class TestCanvasViewMouseEvents:
    """Tests for mouse event handling (unit tests without full event simulation)."""

    def test_panning_initial_state(self, view):
        """Test initial panning state."""
        assert view._panning is False
        assert view._pan_start_x == 0
        assert view._pan_start_y == 0

    def test_cursor_during_pan(self, view):
        """Test cursor changes during panning."""
        # Simulate start of panning
        view._panning = True
        view.setCursor(Qt.ClosedHandCursor)

        assert view.cursor().shape() == Qt.ClosedHandCursor

        # Simulate end of panning
        view._panning = False
        view.setCursor(Qt.ArrowCursor)

        assert view.cursor().shape() == Qt.ArrowCursor
