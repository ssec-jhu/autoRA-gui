"""Unit tests for CanvasScene class."""

import pytest
from PySide6.QtCore import QPointF
from PySide6.QtGui import QColor
from PySide6.QtWidgets import QApplication

from autora_gui.desktop_app.canvas.canvas_scene import CanvasScene
from autora_gui.desktop_app.canvas.connection_item import ConnectionItem, TempConnectionItem
from autora_gui.desktop_app.canvas.node_item import NodeItem
from autora_gui.desktop_app.models.node import ComponentDefinition, NodeData, PortDef
from autora_gui.desktop_app.models.workflow import Connection, Workflow


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
def another_component():
    """Create another component definition."""
    return ComponentDefinition(
        uuid="another-component-uuid",
        protocol_type="theorist",
        name="Another Component",
        description="Another test component",
        github_commit="def456",
        parameters=[],
        input_ports=[],
        output_ports=[],
        file_path="/test/another.json",
    )


@pytest.fixture
def scene(app):
    """Create a CanvasScene for testing."""
    return CanvasScene()


@pytest.fixture
def workflow():
    """Create an empty workflow."""
    return Workflow(name="Test Workflow")


class TestCanvasSceneInit:
    """Tests for CanvasScene initialization."""

    def test_init(self, app):
        """Test CanvasScene initialization."""
        scene = CanvasScene()

        assert scene.sceneRect().width() == 10000
        assert scene.sceneRect().height() == 10000
        assert scene.backgroundBrush().color() == QColor("#f8f8f8")

    def test_init_empty_collections(self, scene):
        """Test that collections are initialized empty."""
        assert scene._node_items == {}
        assert scene._connection_items == {}
        assert scene._temp_connection is None
        assert scene._connection_start_port is None
        assert scene._connection_start_node is None
        assert scene._workflow is None

    def test_signals_exist(self, scene):
        """Test that signals are defined."""
        assert hasattr(scene, "node_selected")
        assert hasattr(scene, "workflow_modified")


class TestCanvasSceneWorkflow:
    """Tests for workflow management."""

    def test_set_workflow_empty(self, scene, workflow):
        """Test setting an empty workflow."""
        scene.set_workflow(workflow)

        assert scene._workflow == workflow
        assert len(scene._node_items) == 0
        assert len(scene._connection_items) == 0

    def test_set_workflow_with_nodes(self, scene, sample_component):
        """Test setting a workflow with nodes."""
        workflow = Workflow(name="Test")
        node1 = NodeData.create(sample_component, 0, 0)
        node2 = NodeData.create(sample_component, 200, 100)
        workflow.add_node(node1)
        workflow.add_node(node2)

        scene.set_workflow(workflow)

        assert len(scene._node_items) == 2
        assert node1.uuid in scene._node_items
        assert node2.uuid in scene._node_items

    def test_set_workflow_with_connections(self, scene, sample_component):
        """Test setting a workflow with nodes and connections."""
        workflow = Workflow(name="Test")
        node1 = NodeData.create(sample_component, 0, 0)
        node2 = NodeData.create(sample_component, 200, 100)
        workflow.add_node(node1)
        workflow.add_node(node2)
        connection = Connection.create(node1.uuid, node2.uuid, "right", "left")
        workflow.add_connection(connection)

        scene.set_workflow(workflow)

        assert len(scene._node_items) == 2
        assert len(scene._connection_items) == 1
        assert connection.uuid in scene._connection_items

    def test_get_workflow(self, scene, workflow):
        """Test getting the current workflow."""
        scene.set_workflow(workflow)

        result = scene.get_workflow()

        assert result == workflow

    def test_get_workflow_none(self, scene):
        """Test getting workflow when none is set."""
        result = scene.get_workflow()

        assert result is None

    def test_clear_all(self, scene, sample_component):
        """Test clearing all items."""
        workflow = Workflow(name="Test")
        node1 = NodeData.create(sample_component, 0, 0)
        node2 = NodeData.create(sample_component, 200, 100)
        workflow.add_node(node1)
        workflow.add_node(node2)
        connection = Connection.create(node1.uuid, node2.uuid)
        workflow.add_connection(connection)
        scene.set_workflow(workflow)

        scene.clear_all()

        assert len(scene._node_items) == 0
        assert len(scene._connection_items) == 0
        assert scene._temp_connection is None
        assert scene._connection_start_port is None
        assert scene._connection_start_node is None


class TestCanvasSceneNodeOperations:
    """Tests for node operations."""

    def test_add_node(self, scene, sample_component, workflow):
        """Test adding a node to the scene."""
        scene.set_workflow(workflow)

        node_item = scene.add_node(sample_component, 100.0, 200.0)

        assert isinstance(node_item, NodeItem)
        assert node_item.node_data.component == sample_component
        assert node_item.node_data.x == 100.0
        assert node_item.node_data.y == 200.0
        assert len(scene._node_items) == 1
        assert len(workflow.nodes) == 1

    def test_add_node_emits_workflow_modified(self, scene, sample_component, workflow):
        """Test that adding a node emits workflow_modified signal."""
        scene.set_workflow(workflow)
        received = []
        scene.workflow_modified.connect(lambda: received.append(True))

        scene.add_node(sample_component, 100.0, 200.0)

        assert len(received) == 1

    def test_add_multiple_nodes(self, scene, sample_component, another_component, workflow):
        """Test adding multiple nodes."""
        scene.set_workflow(workflow)

        node1 = scene.add_node(sample_component, 0, 0)
        node2 = scene.add_node(another_component, 200, 100)

        assert len(scene._node_items) == 2
        assert node1.node_data.uuid in scene._node_items
        assert node2.node_data.uuid in scene._node_items

    def test_create_node_item(self, scene, sample_component):
        """Test _create_node_item method."""
        node_data = NodeData.create(sample_component, 50, 60)

        node_item = scene._create_node_item(node_data)

        assert isinstance(node_item, NodeItem)
        assert node_item.node_data == node_data
        assert node_data.uuid in scene._node_items
        assert node_item in scene.items()

    def test_remove_node(self, scene, sample_component, workflow):
        """Test removing a node."""
        scene.set_workflow(workflow)
        node_item = scene.add_node(sample_component, 100, 200)
        node_id = node_item.node_data.uuid

        scene._remove_node(node_item)

        assert node_id not in scene._node_items
        assert len(workflow.nodes) == 0

    def test_remove_node_removes_connections(self, scene, sample_component, workflow):
        """Test that removing a node removes its connections."""
        scene.set_workflow(workflow)
        node1 = scene.add_node(sample_component, 0, 0)
        node2 = scene.add_node(sample_component, 200, 100)

        # Create connection manually
        connection = Connection.create(node1.node_data.uuid, node2.node_data.uuid)
        workflow.add_connection(connection)
        scene._create_connection_item(connection)

        scene._remove_node(node1)

        assert len(scene._connection_items) == 0
        assert len(workflow.connections) == 0


class TestCanvasSceneConnectionOperations:
    """Tests for connection operations."""

    def test_create_connection_item(self, scene, sample_component, workflow):
        """Test _create_connection_item method."""
        scene.set_workflow(workflow)
        node1 = scene.add_node(sample_component, 0, 0)
        node2 = scene.add_node(sample_component, 200, 100)
        connection = Connection.create(node1.node_data.uuid, node2.node_data.uuid, "right", "left")

        conn_item = scene._create_connection_item(connection)

        assert isinstance(conn_item, ConnectionItem)
        assert connection.uuid in scene._connection_items

    def test_create_connection_item_missing_source(self, scene, sample_component, workflow):
        """Test _create_connection_item with missing source node."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 0, 0)
        connection = Connection.create("nonexistent", node.node_data.uuid)

        result = scene._create_connection_item(connection)

        assert result is None

    def test_create_connection_item_missing_target(self, scene, sample_component, workflow):
        """Test _create_connection_item with missing target node."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 0, 0)
        connection = Connection.create(node.node_data.uuid, "nonexistent")

        result = scene._create_connection_item(connection)

        assert result is None

    def test_remove_connection(self, scene, sample_component, workflow):
        """Test removing a connection."""
        scene.set_workflow(workflow)
        node1 = scene.add_node(sample_component, 0, 0)
        node2 = scene.add_node(sample_component, 200, 100)
        connection = Connection.create(node1.node_data.uuid, node2.node_data.uuid)
        workflow.add_connection(connection)
        conn_item = scene._create_connection_item(connection)

        scene._remove_connection(conn_item)

        assert connection.uuid not in scene._connection_items
        assert len(workflow.connections) == 0

    def test_update_connections(self, scene, sample_component, workflow):
        """Test update_connections method."""
        scene.set_workflow(workflow)
        node1 = scene.add_node(sample_component, 0, 0)
        node2 = scene.add_node(sample_component, 200, 100)
        connection = Connection.create(node1.node_data.uuid, node2.node_data.uuid)
        workflow.add_connection(connection)
        conn_item = scene._create_connection_item(connection)

        old_path = conn_item.path()
        node1.setPos(500, 500)
        scene.update_connections(node1)
        new_path = conn_item.path()

        # Path should have been updated (different length)
        assert old_path.length() != new_path.length()


class TestCanvasSceneConnectionCreation:
    """Tests for interactive connection creation."""

    def test_start_connection(self, scene, sample_component, workflow):
        """Test starting a connection from an output port."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 0, 0)
        output_port = node.get_first_output_port()

        scene.start_connection(node, output_port)

        assert scene._connection_start_node == node
        assert scene._connection_start_port == output_port
        assert scene._temp_connection is not None
        assert isinstance(scene._temp_connection, TempConnectionItem)

    def test_start_connection_from_input_port_ignored(self, scene, sample_component, workflow):
        """Test that starting connection from input port is ignored."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 0, 0)
        input_port = node.get_first_input_port()

        scene.start_connection(node, input_port)

        assert scene._connection_start_node is None
        assert scene._temp_connection is None

    def test_update_temp_connection(self, scene, sample_component, workflow):
        """Test updating temporary connection endpoint."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 0, 0)
        output_port = node.get_first_output_port()
        scene.start_connection(node, output_port)

        scene.update_temp_connection(QPointF(300, 200))

        assert scene._temp_connection.end_pos == QPointF(300, 200)

    def test_update_temp_connection_no_temp(self, scene):
        """Test update_temp_connection when no temp connection exists."""
        # Should not raise an error
        scene.update_temp_connection(QPointF(100, 100))

    def test_finish_connection_with_sides(self, scene, sample_component, workflow):
        """Test finishing a connection with specified sides."""
        scene.set_workflow(workflow)
        node1 = scene.add_node(sample_component, 0, 0)
        node2 = scene.add_node(sample_component, 200, 100)
        output_port = node1.get_first_output_port()
        scene.start_connection(node1, output_port)

        result = scene.finish_connection_with_sides(node2, "left")

        assert result is True
        assert len(scene._connection_items) == 1
        assert len(workflow.connections) == 1
        assert scene._temp_connection is None

    def test_finish_connection_to_self_fails(self, scene, sample_component, workflow):
        """Test that connecting a node to itself fails."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 0, 0)
        output_port = node.get_first_output_port()
        scene.start_connection(node, output_port)

        result = scene.finish_connection_with_sides(node, "left")

        assert result is False
        assert len(scene._connection_items) == 0

    def test_finish_connection_without_start_fails(self, scene, sample_component, workflow):
        """Test finishing connection without starting fails."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 0, 0)

        result = scene.finish_connection_with_sides(node, "left")

        assert result is False

    def test_finish_connection_emits_workflow_modified(self, scene, sample_component, workflow):
        """Test that finishing connection emits workflow_modified."""
        scene.set_workflow(workflow)
        node1 = scene.add_node(sample_component, 0, 0)
        node2 = scene.add_node(sample_component, 200, 100)
        output_port = node1.get_first_output_port()
        scene.start_connection(node1, output_port)

        received = []
        scene.workflow_modified.connect(lambda: received.append(True))

        scene.finish_connection_with_sides(node2, "left")

        assert len(received) == 1

    def test_cancel_connection(self, scene, sample_component, workflow):
        """Test canceling a connection."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 0, 0)
        output_port = node.get_first_output_port()
        scene.start_connection(node, output_port)

        scene._cancel_connection()

        assert scene._temp_connection is None
        assert scene._connection_start_node is None
        assert scene._connection_start_port is None


class TestCanvasSceneSelection:
    """Tests for selection operations."""

    def test_remove_selected_nodes(self, scene, sample_component, workflow):
        """Test removing selected nodes."""
        scene.set_workflow(workflow)
        node1 = scene.add_node(sample_component, 0, 0)
        node2 = scene.add_node(sample_component, 200, 100)
        node1.setSelected(True)

        scene.remove_selected()

        assert len(scene._node_items) == 1
        assert node1.node_data.uuid not in scene._node_items
        assert node2.node_data.uuid in scene._node_items

    def test_remove_selected_connections(self, scene, sample_component, workflow):
        """Test removing selected connections."""
        scene.set_workflow(workflow)
        node1 = scene.add_node(sample_component, 0, 0)
        node2 = scene.add_node(sample_component, 200, 100)
        connection = Connection.create(node1.node_data.uuid, node2.node_data.uuid)
        workflow.add_connection(connection)
        conn_item = scene._create_connection_item(connection)
        conn_item.setSelected(True)

        scene.remove_selected()

        assert len(scene._connection_items) == 0
        assert len(scene._node_items) == 2

    def test_remove_selected_emits_workflow_modified(self, scene, sample_component, workflow):
        """Test that remove_selected emits workflow_modified."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 0, 0)
        node.setSelected(True)

        received = []
        scene.workflow_modified.connect(lambda: received.append(True))

        scene.remove_selected()

        assert len(received) == 1


class TestCanvasSceneHelperMethods:
    """Tests for helper methods."""

    def test_find_node_at(self, scene, sample_component, workflow):
        """Test _find_node_at method."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 100, 100)

        # Point inside the node
        found = scene._find_node_at(QPointF(150, 130))

        assert found == node

    def test_find_node_at_empty(self, scene, workflow):
        """Test _find_node_at when no node at position."""
        scene.set_workflow(workflow)

        found = scene._find_node_at(QPointF(100, 100))

        assert found is None

    def test_get_closest_side_left(self, scene, sample_component, workflow):
        """Test _get_closest_side returns left for left edge."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 100, 100)

        # Point near left edge
        side = scene._get_closest_side(node, QPointF(105, 130))

        assert side == "left"

    def test_get_closest_side_right(self, scene, sample_component, workflow):
        """Test _get_closest_side returns right for right edge."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 100, 100)

        # Point near right edge
        side = scene._get_closest_side(node, QPointF(295, 130))

        assert side == "right"

    def test_get_closest_side_top(self, scene, sample_component, workflow):
        """Test _get_closest_side returns top for top edge."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 100, 100)

        # Point near top edge
        side = scene._get_closest_side(node, QPointF(200, 105))

        assert side == "top"

    def test_get_closest_side_bottom(self, scene, sample_component, workflow):
        """Test _get_closest_side returns bottom for bottom edge."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 100, 100)

        # Point near bottom edge (node height is 70)
        side = scene._get_closest_side(node, QPointF(200, 165))

        assert side == "bottom"

    def test_get_closest_side_and_distance(self, scene, sample_component, workflow):
        """Test _get_closest_side_and_distance returns side and distance."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 100, 100)

        # Point 5 pixels from left edge
        side, distance = scene._get_closest_side_and_distance(node, QPointF(105, 135))

        assert side == "left"
        assert distance == pytest.approx(5, abs=1)

    def test_get_connection_start_pos(self, scene, sample_component, workflow):
        """Test _get_connection_start_pos method."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 100, 100)

        pos = scene._get_connection_start_pos(node, "right")
        expected = node.get_edge_point("right")

        assert pos.x() == pytest.approx(expected.x())
        assert pos.y() == pytest.approx(expected.y())


class TestCanvasSceneSignals:
    """Tests for signal emissions."""

    def test_node_selected_signal(self, scene, sample_component, workflow):
        """Test node_selected signal emission."""
        scene.set_workflow(workflow)
        node = scene.add_node(sample_component, 100, 100)

        received = []
        scene.node_selected.connect(lambda data: received.append(data))

        # Trigger selection
        scene._on_node_selected(node.node_data)

        assert len(received) == 1
        assert received[0] == node.node_data

    def test_node_selected_emits_none_on_empty_click(self, scene, workflow):
        """Test that clicking empty area emits None for node_selected."""
        scene.set_workflow(workflow)

        received = []
        scene.node_selected.connect(lambda data: received.append(data))

        # Simulate clicking empty area via _on_node_selected(None)
        scene._on_node_selected(None)

        # The handler just emits whatever is passed
        assert len(received) == 1
        assert received[0] is None
