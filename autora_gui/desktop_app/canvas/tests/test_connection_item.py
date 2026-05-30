"""Unit tests for ConnectionItem and TempConnectionItem classes."""

import pytest
from PySide6.QtCore import QPointF, Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import QApplication, QGraphicsScene

from autora_gui.desktop_app.canvas.connection_item import ConnectionItem, TempConnectionItem
from autora_gui.desktop_app.canvas.node_item import NodeItem
from autora_gui.desktop_app.models.node import ComponentDefinition, NodeData
from autora_gui.desktop_app.models.workflow import Connection


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
        input_ports=[],
        output_ports=[],
        file_path="/test/path.json",
    )


@pytest.fixture
def scene(app):
    """Create a QGraphicsScene for testing."""
    return QGraphicsScene()


@pytest.fixture
def source_node(sample_component, scene):
    """Create a source node for connections."""
    node_data = NodeData.create(sample_component, x=0.0, y=0.0)
    item = NodeItem(node_data)
    scene.addItem(item)
    return item


@pytest.fixture
def target_node(sample_component, scene):
    """Create a target node for connections."""
    node_data = NodeData.create(sample_component, x=300.0, y=100.0)
    item = NodeItem(node_data)
    scene.addItem(item)
    return item


@pytest.fixture
def connection(source_node, target_node):
    """Create a connection between source and target."""
    return Connection.create(
        source_node.node_data.uuid,
        target_node.node_data.uuid,
        "right",
        "left",
    )


@pytest.fixture
def connection_item(connection, source_node, target_node, scene):
    """Create a ConnectionItem instance."""
    item = ConnectionItem(connection, source_node, target_node, source_side="right", target_side="left")
    scene.addItem(item)
    return item


class TestConnectionItem:
    """Tests for ConnectionItem class."""

    def test_init(self, connection, source_node, target_node, scene):
        """Test ConnectionItem initialization."""
        item = ConnectionItem(connection, source_node, target_node, source_side="right", target_side="left")
        scene.addItem(item)

        assert item.connection == connection
        assert item.source_node == source_node
        assert item.target_node == target_node
        assert item.source_side == "right"
        assert item.target_side == "left"

    def test_init_default_sides(self, connection, source_node, target_node, scene):
        """Test ConnectionItem initialization with default sides."""
        item = ConnectionItem(connection, source_node, target_node)
        scene.addItem(item)

        assert item.source_side == "right"
        assert item.target_side == "left"

    def test_init_custom_sides(self, connection, source_node, target_node, scene):
        """Test ConnectionItem initialization with custom sides."""
        item = ConnectionItem(connection, source_node, target_node, source_side="bottom", target_side="top")
        scene.addItem(item)

        assert item.source_side == "bottom"
        assert item.target_side == "top"

    def test_is_selectable(self, connection_item):
        """Test that connection is selectable."""
        from PySide6.QtWidgets import QGraphicsItem

        assert connection_item.flags() & QGraphicsItem.ItemIsSelectable

    def test_z_value(self, connection_item):
        """Test that connection is drawn behind nodes."""
        assert connection_item.zValue() == -1

    def test_pen_style(self, connection_item):
        """Test initial pen style."""
        pen = connection_item.pen()

        assert pen.color() == QColor("#666666")
        assert pen.width() == 2
        assert pen.style() == Qt.SolidLine

    def test_get_node_edge_point(self, connection_item, source_node):
        """Test _get_node_edge_point method."""
        point = connection_item._get_node_edge_point(source_node, "right")

        expected = source_node.get_edge_point("right")
        assert point.x() == pytest.approx(expected.x())
        assert point.y() == pytest.approx(expected.y())

    def test_get_control_point_right(self, connection_item):
        """Test _get_control_point for right side."""
        start = QPointF(100, 100)
        offset = 50

        ctrl = connection_item._get_control_point(start, "right", offset)

        assert ctrl.x() == start.x() + offset
        assert ctrl.y() == start.y()

    def test_get_control_point_left(self, connection_item):
        """Test _get_control_point for left side."""
        start = QPointF(100, 100)
        offset = 50

        ctrl = connection_item._get_control_point(start, "left", offset)

        assert ctrl.x() == start.x() - offset
        assert ctrl.y() == start.y()

    def test_get_control_point_bottom(self, connection_item):
        """Test _get_control_point for bottom side."""
        start = QPointF(100, 100)
        offset = 50

        ctrl = connection_item._get_control_point(start, "bottom", offset)

        assert ctrl.x() == start.x()
        assert ctrl.y() == start.y() + offset

    def test_get_control_point_top(self, connection_item):
        """Test _get_control_point for top side."""
        start = QPointF(100, 100)
        offset = 50

        ctrl = connection_item._get_control_point(start, "top", offset)

        assert ctrl.x() == start.x()
        assert ctrl.y() == start.y() - offset

    def test_get_control_point_default(self, connection_item):
        """Test _get_control_point for unknown side defaults to right."""
        start = QPointF(100, 100)
        offset = 50

        ctrl = connection_item._get_control_point(start, "unknown", offset)

        assert ctrl.x() == start.x() + offset
        assert ctrl.y() == start.y()

    def test_update_path(self, connection_item):
        """Test update_path creates a valid path."""
        connection_item.update_path()

        path = connection_item.path()
        assert not path.isEmpty()
        assert path.length() > 0

    def test_update_path_after_node_move(self, connection_item, source_node):
        """Test that path updates correctly after moving a node."""
        old_path_length = connection_item.path().length()

        source_node.setPos(500, 500)
        connection_item.update_path()

        new_path_length = connection_item.path().length()
        assert new_path_length != old_path_length

    def test_path_starts_at_source(self, connection_item, source_node):
        """Test that path starts at source node edge."""
        connection_item.update_path()

        path = connection_item.path()
        start = path.pointAtPercent(0)
        expected = source_node.get_edge_point("right")

        assert start.x() == pytest.approx(expected.x(), abs=1)
        assert start.y() == pytest.approx(expected.y(), abs=1)

    def test_path_ends_at_target(self, connection_item, target_node):
        """Test that path ends at target node edge."""
        connection_item.update_path()

        path = connection_item.path()
        end = path.pointAtPercent(1)
        expected = target_node.get_edge_point("left")

        assert end.x() == pytest.approx(expected.x(), abs=1)
        assert end.y() == pytest.approx(expected.y(), abs=1)


class TestConnectionItemPaint:
    """Tests for ConnectionItem paint method."""

    def test_paint_not_selected(self, connection_item):
        """Test paint method when not selected."""
        from PySide6.QtGui import QImage, QPainter

        connection_item.setSelected(False)

        # Create a QImage to paint on
        image = QImage(500, 500, QImage.Format.Format_ARGB32)
        image.fill(Qt.white)
        painter = QPainter(image)

        # Call paint - should not raise
        connection_item.paint(painter, None, None)

        painter.end()

    def test_paint_selected(self, connection_item):
        """Test paint method when selected."""
        from PySide6.QtGui import QImage, QPainter

        connection_item.setSelected(True)

        image = QImage(500, 500, QImage.Format.Format_ARGB32)
        image.fill(Qt.white)
        painter = QPainter(image)

        # Call paint - should use different pen color when selected
        connection_item.paint(painter, None, None)

        painter.end()

    def test_paint_draws_arrow(self, connection_item):
        """Test that paint draws an arrow head."""
        from PySide6.QtGui import QImage, QPainter

        # Ensure path has length for arrow to be drawn
        connection_item.update_path()
        assert connection_item.path().length() > 0

        image = QImage(500, 500, QImage.Format.Format_ARGB32)
        image.fill(Qt.white)
        painter = QPainter(image)

        # Should draw arrow head without errors
        connection_item.paint(painter, None, None)

        painter.end()

    def test_paint_with_zero_length_path(self, connection, source_node, target_node, scene):
        """Test paint handles zero-length path gracefully."""
        from PySide6.QtGui import QImage, QPainter

        # Create item with nodes at same position
        target_node.setPos(0, 0)
        source_node.setPos(0, 0)

        item = ConnectionItem(connection, source_node, target_node)
        scene.addItem(item)
        item.update_path()

        image = QImage(500, 500, QImage.Format.Format_ARGB32)
        image.fill(Qt.white)
        painter = QPainter(image)

        # Should handle gracefully without division by zero
        item.paint(painter, None, None)

        painter.end()

    def test_paint_with_different_sides(self, connection, source_node, target_node, scene):
        """Test paint with various connection sides."""
        from PySide6.QtGui import QImage, QPainter

        sides = [("right", "left"), ("bottom", "top"), ("left", "right"), ("top", "bottom")]

        for source_side, target_side in sides:
            item = ConnectionItem(
                connection, source_node, target_node, source_side=source_side, target_side=target_side
            )
            scene.addItem(item)
            item.update_path()

            image = QImage(500, 500, QImage.Format.Format_ARGB32)
            image.fill(Qt.white)
            painter = QPainter(image)

            item.paint(painter, None, None)

            painter.end()
            scene.removeItem(item)


class TestTempConnectionItem:
    """Tests for TempConnectionItem class."""

    def test_init(self, scene):
        """Test TempConnectionItem initialization."""
        start_pos = QPointF(100, 100)
        item = TempConnectionItem(start_pos)
        scene.addItem(item)

        assert item.start_pos == start_pos
        assert item.end_pos == start_pos
        assert item.start_side == "right"

    def test_init_pen_style(self, scene):
        """Test initial pen is dashed."""
        start_pos = QPointF(100, 100)
        item = TempConnectionItem(start_pos)
        scene.addItem(item)

        pen = item.pen()
        assert pen.style() == Qt.DashLine
        assert pen.color() == QColor("#999999")
        assert pen.width() == 2

    def test_z_value(self, scene):
        """Test that temp connection is drawn behind nodes."""
        item = TempConnectionItem(QPointF(100, 100))
        scene.addItem(item)

        assert item.zValue() == -1

    def test_set_start_side(self, scene):
        """Test setting start side."""
        item = TempConnectionItem(QPointF(100, 100))
        scene.addItem(item)

        item.set_start_side("left")
        assert item.start_side == "left"

        item.set_start_side("top")
        assert item.start_side == "top"

        item.set_start_side("bottom")
        assert item.start_side == "bottom"

    def test_update_end(self, scene):
        """Test updating end position."""
        start_pos = QPointF(100, 100)
        end_pos = QPointF(300, 200)
        item = TempConnectionItem(start_pos)
        scene.addItem(item)

        item.update_end(end_pos)

        assert item.end_pos == end_pos

    def test_update_end_creates_path(self, scene):
        """Test that update_end creates a path."""
        item = TempConnectionItem(QPointF(100, 100))
        scene.addItem(item)

        item.update_end(QPointF(300, 200))

        path = item.path()
        assert not path.isEmpty()
        assert path.length() > 0

    def test_get_control_point_right(self, scene):
        """Test _get_control_point for right side."""
        item = TempConnectionItem(QPointF(0, 0))
        scene.addItem(item)
        start = QPointF(100, 100)
        offset = 50

        ctrl = item._get_control_point(start, "right", offset)

        assert ctrl.x() == start.x() + offset
        assert ctrl.y() == start.y()

    def test_get_control_point_left(self, scene):
        """Test _get_control_point for left side."""
        item = TempConnectionItem(QPointF(0, 0))
        scene.addItem(item)
        start = QPointF(100, 100)
        offset = 50

        ctrl = item._get_control_point(start, "left", offset)

        assert ctrl.x() == start.x() - offset
        assert ctrl.y() == start.y()

    def test_get_control_point_bottom(self, scene):
        """Test _get_control_point for bottom side."""
        item = TempConnectionItem(QPointF(0, 0))
        scene.addItem(item)
        start = QPointF(100, 100)
        offset = 50

        ctrl = item._get_control_point(start, "bottom", offset)

        assert ctrl.x() == start.x()
        assert ctrl.y() == start.y() + offset

    def test_get_control_point_top(self, scene):
        """Test _get_control_point for top side."""
        item = TempConnectionItem(QPointF(0, 0))
        scene.addItem(item)
        start = QPointF(100, 100)
        offset = 50

        ctrl = item._get_control_point(start, "top", offset)

        assert ctrl.x() == start.x()
        assert ctrl.y() == start.y() - offset

    def test_get_control_point_default(self, scene):
        """Test _get_control_point for unknown side."""
        item = TempConnectionItem(QPointF(0, 0))
        scene.addItem(item)
        start = QPointF(100, 100)
        offset = 50

        ctrl = item._get_control_point(start, "unknown", offset)

        assert ctrl.x() == start.x() + offset
        assert ctrl.y() == start.y()

    def test_guess_end_side_horizontal_right(self, scene):
        """Test _guess_end_side for horizontal movement to right."""
        item = TempConnectionItem(QPointF(0, 0))
        scene.addItem(item)
        item.end_pos = QPointF(100, 10)

        side = item._guess_end_side()

        assert side == "left"

    def test_guess_end_side_horizontal_left(self, scene):
        """Test _guess_end_side for horizontal movement to left."""
        item = TempConnectionItem(QPointF(100, 0))
        scene.addItem(item)
        item.end_pos = QPointF(0, 10)

        side = item._guess_end_side()

        assert side == "right"

    def test_guess_end_side_vertical_down(self, scene):
        """Test _guess_end_side for vertical movement down."""
        item = TempConnectionItem(QPointF(0, 0))
        scene.addItem(item)
        item.end_pos = QPointF(10, 100)

        side = item._guess_end_side()

        assert side == "top"

    def test_guess_end_side_vertical_up(self, scene):
        """Test _guess_end_side for vertical movement up."""
        item = TempConnectionItem(QPointF(0, 100))
        scene.addItem(item)
        item.end_pos = QPointF(10, 0)

        side = item._guess_end_side()

        assert side == "bottom"

    def test_path_starts_at_start_pos(self, scene):
        """Test that path starts at start_pos."""
        start_pos = QPointF(100, 100)
        end_pos = QPointF(300, 200)
        item = TempConnectionItem(start_pos)
        scene.addItem(item)
        item.update_end(end_pos)

        path = item.path()
        path_start = path.pointAtPercent(0)

        assert path_start.x() == pytest.approx(start_pos.x(), abs=1)
        assert path_start.y() == pytest.approx(start_pos.y(), abs=1)

    def test_path_ends_at_end_pos(self, scene):
        """Test that path ends at end_pos."""
        start_pos = QPointF(100, 100)
        end_pos = QPointF(300, 200)
        item = TempConnectionItem(start_pos)
        scene.addItem(item)
        item.update_end(end_pos)

        path = item.path()
        path_end = path.pointAtPercent(1)

        assert path_end.x() == pytest.approx(end_pos.x(), abs=1)
        assert path_end.y() == pytest.approx(end_pos.y(), abs=1)
