"""Tests for workflow data model."""

import json
import tempfile
from pathlib import Path

import pytest

from autora_gui.desktop_app.models.node import ComponentDefinition, NodeData, ParameterDef
from autora_gui.desktop_app.models.workflow import Connection, Workflow


# Module-level fixtures for reuse
@pytest.fixture
def sample_component():
    """Create a sample component definition."""
    return ComponentDefinition(
        uuid="comp-uuid",
        protocol_type="theorist",
        name="Sample",
        description="Sample component",
        github_commit="123",
        file_path="theorists/sample.json",
        parameters=[
            ParameterDef(name="alpha", description="Alpha", datatype="real", default=0.1),
        ],
    )


@pytest.fixture
def sample_nodes(sample_component):
    """Create two sample nodes for testing."""
    node1 = NodeData(uuid="node-1", component=sample_component, x=0, y=0)
    node2 = NodeData(uuid="node-2", component=sample_component, x=100, y=100)
    return node1, node2


@pytest.fixture
def workflow_with_nodes(sample_nodes):
    """Create a workflow with two nodes."""
    node1, node2 = sample_nodes
    workflow = Workflow(name="Test Workflow")
    workflow.add_node(node1)
    workflow.add_node(node2)
    return workflow


class TestConnection:
    """Tests for Connection dataclass."""

    def test_create_basic(self):
        """Test creating connection with required fields."""
        conn = Connection(
            uuid="conn-uuid",
            source_node_id="node1",
            target_node_id="node2",
        )

        assert conn.uuid == "conn-uuid"
        assert conn.source_node_id == "node1"
        assert conn.target_node_id == "node2"
        assert conn.source_port == ""
        assert conn.target_port == ""

    def test_create_with_ports(self):
        """Test creating connection with port information."""
        conn = Connection(
            uuid="conn-uuid",
            source_node_id="node1",
            target_node_id="node2",
            source_port="right",
            target_port="left",
        )

        assert conn.source_port == "right"
        assert conn.target_port == "left"


class TestConnectionCreate:
    """Tests for Connection.create factory method."""

    def test_create_factory(self):
        """Test create factory method."""
        conn = Connection.create("src", "tgt", "right", "left")

        assert conn.source_node_id == "src"
        assert conn.target_node_id == "tgt"
        assert conn.source_port == "right"
        assert conn.target_port == "left"
        assert len(conn.uuid) == 36

    def test_create_generates_unique_uuids(self):
        """Test that create generates unique UUIDs."""
        conn1 = Connection.create("a", "b")
        conn2 = Connection.create("a", "b")

        assert conn1.uuid != conn2.uuid

    def test_create_default_ports(self):
        """Test create with default empty ports."""
        conn = Connection.create("src", "tgt")

        assert conn.source_port == ""
        assert conn.target_port == ""

    def test_create_uuid_format(self):
        """Test that created UUID is valid format."""
        import uuid

        conn = Connection.create("a", "b")

        # Should not raise ValueError
        uuid.UUID(conn.uuid)


class TestWorkflow:
    """Tests for Workflow dataclass."""

    def test_create_empty(self):
        """Test creating empty workflow."""
        workflow = Workflow()

        assert workflow.name == "Untitled Workflow"
        assert workflow.description == ""
        assert workflow.nodes == []
        assert workflow.connections == []

    def test_create_with_name(self):
        """Test creating workflow with name and description."""
        workflow = Workflow(name="My Workflow", description="A test workflow")

        assert workflow.name == "My Workflow"
        assert workflow.description == "A test workflow"


class TestWorkflowNodeOperations:
    """Tests for Workflow node operations."""

    def test_add_node(self, sample_nodes):
        """Test adding a node to workflow."""
        node1, _ = sample_nodes
        workflow = Workflow()

        workflow.add_node(node1)

        assert len(workflow.nodes) == 1
        assert workflow.nodes[0] == node1

    def test_add_multiple_nodes(self, sample_nodes):
        """Test adding multiple nodes."""
        node1, node2 = sample_nodes
        workflow = Workflow()

        workflow.add_node(node1)
        workflow.add_node(node2)

        assert len(workflow.nodes) == 2

    def test_remove_node(self, sample_nodes):
        """Test removing a node from workflow."""
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)

        workflow.remove_node("node-1")

        assert len(workflow.nodes) == 1
        assert workflow.nodes[0].uuid == "node-2"

    def test_remove_node_removes_connections(self, sample_nodes):
        """Test that removing a node removes its connections."""
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        conn = Connection.create("node-1", "node-2")
        workflow.add_connection(conn)

        workflow.remove_node("node-1")

        assert len(workflow.connections) == 0

    def test_remove_node_removes_incoming_connections(self, sample_nodes):
        """Test that removing target node removes incoming connections."""
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        conn = Connection.create("node-1", "node-2")
        workflow.add_connection(conn)

        workflow.remove_node("node-2")

        assert len(workflow.connections) == 0

    def test_remove_nonexistent_node(self, sample_nodes):
        """Test removing nonexistent node doesn't error."""
        node1, _ = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)

        workflow.remove_node("nonexistent")

        assert len(workflow.nodes) == 1

    def test_get_node_by_id(self, sample_nodes):
        """Test getting node by UUID."""
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)

        found = workflow.get_node_by_id("node-2")

        assert found == node2

    def test_get_node_by_id_not_found(self, sample_nodes):
        """Test getting nonexistent node returns None."""
        node1, _ = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)

        found = workflow.get_node_by_id("nonexistent")

        assert found is None

    def test_get_node_by_id_empty_workflow(self):
        """Test getting node from empty workflow."""
        workflow = Workflow()

        found = workflow.get_node_by_id("any")

        assert found is None


class TestWorkflowConnectionOperations:
    """Tests for Workflow connection operations."""

    def test_add_connection(self, sample_nodes):
        """Test adding a connection to workflow."""
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        conn = Connection.create("node-1", "node-2", "right", "left")

        workflow.add_connection(conn)

        assert len(workflow.connections) == 1
        assert workflow.connections[0].source_node_id == "node-1"

    def test_add_multiple_connections(self, sample_component):
        """Test adding multiple connections."""
        node1 = NodeData(uuid="n1", component=sample_component)
        node2 = NodeData(uuid="n2", component=sample_component)
        node3 = NodeData(uuid="n3", component=sample_component)
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        workflow.add_node(node3)

        workflow.add_connection(Connection.create("n1", "n2"))
        workflow.add_connection(Connection.create("n2", "n3"))

        assert len(workflow.connections) == 2

    def test_remove_connection(self, sample_nodes):
        """Test removing a connection from workflow."""
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        conn = Connection.create("node-1", "node-2")
        workflow.add_connection(conn)

        workflow.remove_connection(conn.uuid)

        assert len(workflow.connections) == 0

    def test_remove_nonexistent_connection(self, workflow_with_nodes):
        """Test removing nonexistent connection doesn't error."""
        workflow_with_nodes.remove_connection("nonexistent")

        assert len(workflow_with_nodes.connections) == 0


class TestWorkflowToDict:
    """Tests for Workflow.to_dict method."""

    def test_to_dict(self, sample_nodes):
        """Test converting workflow to dictionary."""
        node1, node2 = sample_nodes
        workflow = Workflow(name="Test", description="Test workflow")
        workflow.add_node(node1)
        workflow.add_node(node2)
        conn = Connection(
            uuid="conn-1",
            source_node_id="node-1",
            target_node_id="node-2",
            source_port="right",
            target_port="left",
        )
        workflow.add_connection(conn)

        data = workflow.to_dict()

        assert data["name"] == "Test"
        assert data["description"] == "Test workflow"
        assert len(data["nodes"]) == 2
        assert len(data["connections"]) == 1
        assert data["nodes"][0]["uuid"] == "node-1"
        assert data["connections"][0]["source"] == "node-1"
        assert data["connections"][0]["target"] == "node-2"

    def test_to_dict_empty(self):
        """Test converting empty workflow to dictionary."""
        workflow = Workflow(name="Empty")

        data = workflow.to_dict()

        assert data["name"] == "Empty"
        assert data["nodes"] == []
        assert data["connections"] == []

    def test_to_dict_node_fields(self, sample_nodes):
        """Test that to_dict includes all node fields."""
        node1, _ = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)

        data = workflow.to_dict()

        node_data = data["nodes"][0]
        assert "uuid" in node_data
        assert "componentUuid" in node_data
        assert "componentFile" in node_data
        assert "protocolType" in node_data
        assert "x" in node_data
        assert "y" in node_data
        assert "parameters" in node_data

    def test_to_dict_connection_fields(self, sample_nodes):
        """Test that to_dict includes all connection fields."""
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        workflow.add_connection(Connection.create("node-1", "node-2", "right", "left"))

        data = workflow.to_dict()

        conn_data = data["connections"][0]
        assert "uuid" in conn_data
        assert "source" in conn_data
        assert "target" in conn_data
        assert "sourcePort" in conn_data
        assert "targetPort" in conn_data


class TestWorkflowSaveAndLoad:
    """Tests for Workflow save and load functionality."""

    def test_save_to_file(self, sample_nodes):
        """Test saving workflow to file."""
        node1, node2 = sample_nodes
        workflow = Workflow(name="SaveTest")
        workflow.add_node(node1)
        workflow.add_node(node2)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            temp_path = f.name

        try:
            workflow.save_to_file(temp_path)

            with open(temp_path) as f:
                saved_data = json.load(f)

            assert saved_data["name"] == "SaveTest"
            assert len(saved_data["nodes"]) == 2
        finally:
            Path(temp_path).unlink(missing_ok=True)

    def test_save_and_load(self, sample_nodes, sample_component):
        """Test round-trip save and load."""
        node1, node2 = sample_nodes
        workflow = Workflow(name="SaveLoad Test")
        workflow.add_node(node1)
        workflow.add_node(node2)
        conn = Connection.create("node-1", "node-2", "right", "left")
        workflow.add_connection(conn)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            temp_path = f.name

        try:
            workflow.save_to_file(temp_path)

            component_lookup = {"theorists/sample.json": sample_component}
            loaded = Workflow.load_from_file(temp_path, component_lookup)

            assert loaded.name == "SaveLoad Test"
            assert len(loaded.nodes) == 2
            assert len(loaded.connections) == 1
            assert loaded.nodes[0].uuid == "node-1"
            assert loaded.connections[0].source_node_id == "node-1"
        finally:
            Path(temp_path).unlink(missing_ok=True)

    def test_load_skips_unknown_components(self, sample_component):
        """Test that loading skips nodes with unknown component files."""
        data = {
            "name": "Test",
            "nodes": [
                {
                    "uuid": "known-node",
                    "componentFile": "theorists/sample.json",
                    "x": 0,
                    "y": 0,
                    "parameters": {},
                },
                {
                    "uuid": "unknown-node",
                    "componentFile": "unknown/missing.json",
                    "x": 100,
                    "y": 100,
                    "parameters": {},
                },
            ],
            "connections": [],
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            temp_path = f.name

        try:
            component_lookup = {"theorists/sample.json": sample_component}
            loaded = Workflow.load_from_file(temp_path, component_lookup)

            assert len(loaded.nodes) == 1
            assert loaded.nodes[0].uuid == "known-node"
        finally:
            Path(temp_path).unlink(missing_ok=True)

    def test_load_preserves_parameters(self, sample_component):
        """Test that loading preserves node parameters."""
        data = {
            "name": "Test",
            "nodes": [
                {
                    "uuid": "node-1",
                    "componentFile": "theorists/sample.json",
                    "x": 50,
                    "y": 75,
                    "parameters": {"alpha": 0.99},
                },
            ],
            "connections": [],
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            temp_path = f.name

        try:
            component_lookup = {"theorists/sample.json": sample_component}
            loaded = Workflow.load_from_file(temp_path, component_lookup)

            assert loaded.nodes[0].parameters["alpha"] == 0.99
            assert loaded.nodes[0].x == 50
            assert loaded.nodes[0].y == 75
        finally:
            Path(temp_path).unlink(missing_ok=True)

    def test_load_empty_workflow(self, sample_component):
        """Test loading empty workflow."""
        data = {"name": "Empty", "description": "Empty workflow", "nodes": [], "connections": []}

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            temp_path = f.name

        try:
            loaded = Workflow.load_from_file(temp_path, {})

            assert loaded.name == "Empty"
            assert loaded.description == "Empty workflow"
            assert loaded.nodes == []
            assert loaded.connections == []
        finally:
            Path(temp_path).unlink(missing_ok=True)

    def test_load_generates_uuid_if_missing(self, sample_component):
        """Test that loading generates UUID for nodes without one."""
        data = {
            "name": "Test",
            "nodes": [
                {
                    "componentFile": "theorists/sample.json",
                    "x": 0,
                    "y": 0,
                    "parameters": {},
                },
            ],
            "connections": [
                {
                    "source": "node-1",
                    "target": "node-2",
                },
            ],
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            temp_path = f.name

        try:
            component_lookup = {"theorists/sample.json": sample_component}
            loaded = Workflow.load_from_file(temp_path, component_lookup)

            # Node should have a generated UUID
            assert len(loaded.nodes[0].uuid) == 36
            # Connection should have a generated UUID
            assert len(loaded.connections[0].uuid) == 36
        finally:
            Path(temp_path).unlink(missing_ok=True)

    def test_load_uses_default_name(self):
        """Test that loading uses default name if not provided."""
        data = {"nodes": [], "connections": []}

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            temp_path = f.name

        try:
            loaded = Workflow.load_from_file(temp_path, {})

            assert loaded.name == "Untitled"
        finally:
            Path(temp_path).unlink(missing_ok=True)
