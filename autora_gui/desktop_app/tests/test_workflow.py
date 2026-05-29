"""Tests for workflow data model."""

import json
import tempfile
from pathlib import Path

import pytest

from autora_gui.desktop_app.models.node import ComponentDefinition, NodeData, ParameterDef
from autora_gui.desktop_app.models.workflow import Connection, Workflow


class TestConnection:
    """Tests for Connection dataclass."""

    def test_create_basic(self):
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
        conn = Connection(
            uuid="conn-uuid",
            source_node_id="node1",
            target_node_id="node2",
            source_port="right",
            target_port="left",
        )
        assert conn.source_port == "right"
        assert conn.target_port == "left"

    def test_create_factory(self):
        conn = Connection.create("src", "tgt", "right", "left")
        assert conn.source_node_id == "src"
        assert conn.target_node_id == "tgt"
        assert conn.source_port == "right"
        assert conn.target_port == "left"
        assert len(conn.uuid) == 36

    def test_create_generates_unique_uuids(self):
        conn1 = Connection.create("a", "b")
        conn2 = Connection.create("a", "b")
        assert conn1.uuid != conn2.uuid


class TestWorkflow:
    """Tests for Workflow dataclass."""

    @pytest.fixture
    def sample_component(self):
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
    def sample_nodes(self, sample_component):
        node1 = NodeData(uuid="node-1", component=sample_component, x=0, y=0)
        node2 = NodeData(uuid="node-2", component=sample_component, x=100, y=100)
        return node1, node2

    def test_create_empty(self):
        workflow = Workflow()
        assert workflow.name == "Untitled Workflow"
        assert workflow.description == ""
        assert workflow.nodes == []
        assert workflow.connections == []

    def test_create_with_name(self):
        workflow = Workflow(name="My Workflow", description="A test workflow")
        assert workflow.name == "My Workflow"
        assert workflow.description == "A test workflow"

    def test_add_node(self, sample_nodes):
        node1, _ = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        assert len(workflow.nodes) == 1
        assert workflow.nodes[0] == node1

    def test_remove_node(self, sample_nodes):
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        workflow.remove_node("node-1")
        assert len(workflow.nodes) == 1
        assert workflow.nodes[0].uuid == "node-2"

    def test_remove_node_removes_connections(self, sample_nodes):
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        conn = Connection.create("node-1", "node-2")
        workflow.add_connection(conn)
        workflow.remove_node("node-1")
        assert len(workflow.connections) == 0

    def test_add_connection(self, sample_nodes):
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        conn = Connection.create("node-1", "node-2", "right", "left")
        workflow.add_connection(conn)
        assert len(workflow.connections) == 1
        assert workflow.connections[0].source_node_id == "node-1"

    def test_remove_connection(self, sample_nodes):
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        conn = Connection.create("node-1", "node-2")
        workflow.add_connection(conn)
        workflow.remove_connection(conn.uuid)
        assert len(workflow.connections) == 0

    def test_get_node_by_id(self, sample_nodes):
        node1, node2 = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        workflow.add_node(node2)
        found = workflow.get_node_by_id("node-2")
        assert found == node2

    def test_get_node_by_id_not_found(self, sample_nodes):
        node1, _ = sample_nodes
        workflow = Workflow()
        workflow.add_node(node1)
        found = workflow.get_node_by_id("nonexistent")
        assert found is None

    def test_to_dict(self, sample_nodes):
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

    def test_save_and_load(self, sample_nodes, sample_component):
        node1, node2 = sample_nodes
        workflow = Workflow(name="SaveLoad Test")
        workflow.add_node(node1)
        workflow.add_node(node2)
        conn = Connection.create("node-1", "node-2", "right", "left")
        workflow.add_connection(conn)

        # Save to temp file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            temp_path = f.name

        try:
            workflow.save_to_file(temp_path)

            # Verify file contents
            with open(temp_path) as f:
                saved_data = json.load(f)
            assert saved_data["name"] == "SaveLoad Test"
            assert len(saved_data["nodes"]) == 2

            # Load workflow back
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
            # Only the known node should be loaded
            assert len(loaded.nodes) == 1
            assert loaded.nodes[0].uuid == "known-node"
        finally:
            Path(temp_path).unlink(missing_ok=True)
