"""Unit tests for NodeItem and PortItem classes."""

import pytest
from PySide6.QtCore import QPointF
from PySide6.QtWidgets import QApplication, QGraphicsScene

from autora_gui.desktop_app.canvas.node_item import (
    HEADER_HEIGHT,
    NODE_COLORS,
    NODE_HEIGHT,
    NODE_WIDTH,
    NodeItem,
    NodeItemSignals,
    PortItem,
)
from autora_gui.desktop_app.models.node import ComponentDefinition, NodeData, PortDef


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
def sample_node_data(sample_component):
    """Create a sample node data instance."""
    return NodeData.create(sample_component, x=100.0, y=200.0)


@pytest.fixture
def scene(app):
    """Create a QGraphicsScene for testing."""
    return QGraphicsScene()


@pytest.fixture
def node_item(sample_node_data, scene):
    """Create a NodeItem instance."""
    item = NodeItem(sample_node_data)
    scene.addItem(item)
    return item


class TestPortItem:
    """Tests for PortItem class."""

    def test_init_input_port(self, node_item):
        """Test creating an input port."""
        port_def = PortDef(name="test_input", description="Test", datatype="object")
        port = PortItem(port_def, "input", node_item)

        assert port.port_def == port_def
        assert port.port_type == "input"
        assert port.node_item == node_item
        assert not port.isVisible()

    def test_init_output_port(self, node_item):
        """Test creating an output port."""
        port_def = PortDef(name="test_output", description="Test", datatype="object")
        port = PortItem(port_def, "output", node_item)

        assert port.port_def == port_def
        assert port.port_type == "output"
        assert port.node_item == node_item

    def test_init_none_port_def(self, node_item):
        """Test creating a port with None port_def."""
        port = PortItem(None, "input", node_item)

        assert port.port_def is None
        assert port.port_type == "input"

    def test_get_center_scene_pos(self, node_item):
        """Test getting center position in scene coordinates."""
        port = PortItem(None, "input", node_item)
        port.setPos(10, 20)

        pos = port.get_center_scene_pos()

        assert isinstance(pos, QPointF)


class TestNodeItemSignals:
    """Tests for NodeItemSignals class."""

    def test_signals_exist(self):
        """Test that signals are properly defined."""
        signals = NodeItemSignals()

        assert hasattr(signals, "selected")
        assert hasattr(signals, "position_changed")

    def test_selected_signal_emission(self, sample_node_data):
        """Test that selected signal can be emitted."""
        signals = NodeItemSignals()
        received = []

        signals.selected.connect(lambda data: received.append(data))
        signals.selected.emit(sample_node_data)

        assert len(received) == 1
        assert received[0] == sample_node_data

    def test_position_changed_signal_emission(self):
        """Test that position_changed signal can be emitted."""
        signals = NodeItemSignals()
        received = []

        signals.position_changed.connect(lambda uuid, x, y: received.append((uuid, x, y)))
        signals.position_changed.emit("test-uuid", 10.0, 20.0)

        assert len(received) == 1
        assert received[0] == ("test-uuid", 10.0, 20.0)


class TestNodeItem:
    """Tests for NodeItem class."""

    def test_init(self, sample_node_data, scene):
        """Test NodeItem initialization."""
        item = NodeItem(sample_node_data)
        scene.addItem(item)

        assert item.node_data == sample_node_data
        assert item._width == NODE_WIDTH
        assert item._height == NODE_HEIGHT
        assert item._header_height == HEADER_HEIGHT

    def test_init_position(self, sample_node_data, scene):
        """Test that node is positioned correctly on init."""
        item = NodeItem(sample_node_data)
        scene.addItem(item)

        pos = item.pos()
        assert pos.x() == sample_node_data.x
        assert pos.y() == sample_node_data.y

    def test_init_flags(self, node_item):
        """Test that correct flags are set."""
        from PySide6.QtWidgets import QGraphicsItem

        assert node_item.flags() & QGraphicsItem.ItemIsMovable
        assert node_item.flags() & QGraphicsItem.ItemIsSelectable
        assert node_item.flags() & QGraphicsItem.ItemSendsGeometryChanges

    def test_init_creates_ports(self, node_item):
        """Test that input and output ports are created."""
        assert len(node_item.input_ports) >= 1
        assert len(node_item.output_ports) >= 1
        assert all(isinstance(p, PortItem) for p in node_item.input_ports)
        assert all(isinstance(p, PortItem) for p in node_item.output_ports)

    def test_color_experimentalist(self, scene):
        """Test color for experimentalist type."""
        component = ComponentDefinition(
            uuid="test", protocol_type="experimentalist", name="Test", description="", github_commit=""
        )
        node_data = NodeData.create(component)
        item = NodeItem(node_data)
        scene.addItem(item)

        assert item._color == NODE_COLORS["experimentalist"]

    def test_color_theorist(self, scene):
        """Test color for theorist type."""
        component = ComponentDefinition(
            uuid="test", protocol_type="theorist", name="Test", description="", github_commit=""
        )
        node_data = NodeData.create(component)
        item = NodeItem(node_data)
        scene.addItem(item)

        assert item._color == NODE_COLORS["theorist"]

    def test_color_experiment_runner(self, scene):
        """Test color for experiment_runner type."""
        component = ComponentDefinition(
            uuid="test", protocol_type="experiment_runner", name="Test", description="", github_commit=""
        )
        node_data = NodeData.create(component)
        item = NodeItem(node_data)
        scene.addItem(item)

        assert item._color == NODE_COLORS["experiment_runner"]

    def test_color_unknown_type(self, scene):
        """Test default color for unknown type."""
        from PySide6.QtGui import QColor

        component = ComponentDefinition(
            uuid="test", protocol_type="unknown_type", name="Test", description="", github_commit=""
        )
        node_data = NodeData.create(component)
        item = NodeItem(node_data)
        scene.addItem(item)

        assert item._color == QColor("#9E9E9E")

    def test_bounding_rect(self, node_item):
        """Test bounding rectangle calculation."""
        rect = node_item.boundingRect()

        assert rect.x() == -5
        assert rect.y() == -5
        assert rect.width() == NODE_WIDTH + 10
        assert rect.height() == NODE_HEIGHT + 10

    def test_get_input_port(self, node_item):
        """Test getting input port."""
        port = node_item.get_input_port()

        assert port is not None
        assert isinstance(port, PortItem)
        assert port.port_type == "input"

    def test_get_output_port(self, node_item):
        """Test getting output port."""
        port = node_item.get_output_port()

        assert port is not None
        assert isinstance(port, PortItem)
        assert port.port_type == "output"

    def test_get_first_input_port(self, node_item):
        """Test getting first input port."""
        port = node_item.get_first_input_port()

        assert port is not None
        assert port == node_item.input_ports[0]

    def test_get_first_output_port(self, node_item):
        """Test getting first output port."""
        port = node_item.get_first_output_port()

        assert port is not None
        assert port == node_item.output_ports[0]

    def test_get_left_center(self, node_item):
        """Test getting left center point."""
        pos = node_item.get_left_center()

        assert isinstance(pos, QPointF)
        # Left edge is at x=0 in local coords, transformed to scene
        expected_x = node_item.pos().x()
        expected_y = node_item.pos().y() + NODE_HEIGHT / 2
        assert pos.x() == pytest.approx(expected_x)
        assert pos.y() == pytest.approx(expected_y)

    def test_get_right_center(self, node_item):
        """Test getting right center point."""
        pos = node_item.get_right_center()

        assert isinstance(pos, QPointF)
        expected_x = node_item.pos().x() + NODE_WIDTH
        expected_y = node_item.pos().y() + NODE_HEIGHT / 2
        assert pos.x() == pytest.approx(expected_x)
        assert pos.y() == pytest.approx(expected_y)

    def test_get_top_center(self, node_item):
        """Test getting top center point."""
        pos = node_item.get_top_center()

        assert isinstance(pos, QPointF)
        expected_x = node_item.pos().x() + NODE_WIDTH / 2
        expected_y = node_item.pos().y()
        assert pos.x() == pytest.approx(expected_x)
        assert pos.y() == pytest.approx(expected_y)

    def test_get_bottom_center(self, node_item):
        """Test getting bottom center point."""
        pos = node_item.get_bottom_center()

        assert isinstance(pos, QPointF)
        expected_x = node_item.pos().x() + NODE_WIDTH / 2
        expected_y = node_item.pos().y() + NODE_HEIGHT
        assert pos.x() == pytest.approx(expected_x)
        assert pos.y() == pytest.approx(expected_y)

    def test_get_edge_point_left(self, node_item):
        """Test get_edge_point for left side."""
        pos = node_item.get_edge_point("left")
        expected = node_item.get_left_center()

        assert pos.x() == pytest.approx(expected.x())
        assert pos.y() == pytest.approx(expected.y())

    def test_get_edge_point_right(self, node_item):
        """Test get_edge_point for right side."""
        pos = node_item.get_edge_point("right")
        expected = node_item.get_right_center()

        assert pos.x() == pytest.approx(expected.x())
        assert pos.y() == pytest.approx(expected.y())

    def test_get_edge_point_top(self, node_item):
        """Test get_edge_point for top side."""
        pos = node_item.get_edge_point("top")
        expected = node_item.get_top_center()

        assert pos.x() == pytest.approx(expected.x())
        assert pos.y() == pytest.approx(expected.y())

    def test_get_edge_point_bottom(self, node_item):
        """Test get_edge_point for bottom side."""
        pos = node_item.get_edge_point("bottom")
        expected = node_item.get_bottom_center()

        assert pos.x() == pytest.approx(expected.x())
        assert pos.y() == pytest.approx(expected.y())

    def test_get_edge_point_default(self, node_item):
        """Test get_edge_point for unknown side defaults to right."""
        pos = node_item.get_edge_point("unknown")
        expected = node_item.get_right_center()

        assert pos.x() == pytest.approx(expected.x())
        assert pos.y() == pytest.approx(expected.y())

    def test_position_change_updates_node_data(self, node_item):
        """Test that moving the node updates node_data coordinates."""
        new_x, new_y = 500.0, 600.0
        node_item.setPos(new_x, new_y)

        assert node_item.node_data.x == new_x
        assert node_item.node_data.y == new_y

    def test_position_change_emits_signal(self, node_item):
        """Test that moving the node emits position_changed signal."""
        received = []
        node_item.signals.position_changed.connect(lambda uuid, x, y: received.append((uuid, x, y)))

        node_item.setPos(300.0, 400.0)

        assert len(received) == 1
        assert received[0][0] == node_item.node_data.uuid
        assert received[0][1] == 300.0
        assert received[0][2] == 400.0

    def test_selection_emits_signal(self, node_item):
        """Test that selecting the node emits selected signal."""
        received = []
        node_item.signals.selected.connect(lambda data: received.append(data))

        node_item.setSelected(True)

        assert len(received) == 1
        assert received[0] == node_item.node_data
