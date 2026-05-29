"""Tests for node data models."""

import pytest

from autora_gui.desktop_app.models.node import (
    ComponentDefinition,
    NodeData,
    ParameterDef,
    PortDef,
)


class TestParameterDef:
    """Tests for ParameterDef dataclass."""

    def test_create_basic(self):
        param = ParameterDef(name="test", description="A test param", datatype="string")
        assert param.name == "test"
        assert param.description == "A test param"
        assert param.datatype == "string"
        assert param.min_occurs == 1
        assert param.max_occurs == 1
        assert param.valid_values is None
        assert param.default is None

    def test_create_with_defaults(self):
        param = ParameterDef(
            name="num_samples",
            description="Number of samples",
            datatype="integer",
            min_occurs=0,
            max_occurs=5,
            default=10,
        )
        assert param.name == "num_samples"
        assert param.default == 10
        assert param.min_occurs == 0
        assert param.max_occurs == 5

    def test_create_categorical(self):
        param = ParameterDef(
            name="method",
            description="Method to use",
            datatype="categorical",
            valid_values=["linear", "polynomial", "rbf"],
            default="linear",
        )
        assert param.valid_values == ["linear", "polynomial", "rbf"]
        assert param.default == "linear"


class TestPortDef:
    """Tests for PortDef dataclass."""

    def test_create_basic(self):
        port = PortDef(name="input", description="Input data", datatype="object")
        assert port.name == "input"
        assert port.description == "Input data"
        assert port.datatype == "object"
        assert port.min_occurs == 1
        assert port.max_occurs == -1

    def test_create_with_occurs(self):
        port = PortDef(
            name="output",
            description="Output",
            datatype="array",
            min_occurs=0,
            max_occurs=3,
        )
        assert port.min_occurs == 0
        assert port.max_occurs == 3


class TestComponentDefinition:
    """Tests for ComponentDefinition dataclass."""

    def test_create_basic(self):
        comp = ComponentDefinition(
            uuid="test-uuid-123",
            protocol_type="experimentalist",
            name="Test Component",
            description="A test component",
            github_commit="abc123",
        )
        assert comp.uuid == "test-uuid-123"
        assert comp.protocol_type == "experimentalist"
        assert comp.name == "Test Component"
        assert comp.parameters == []
        assert comp.input_ports == []
        assert comp.output_ports == []

    def test_from_json_minimal(self):
        data = {
            "uuid": "json-uuid",
            "protocolType": "theorist",
            "name": "JSON Component",
            "description": "From JSON",
            "githubCommit": "commit123",
        }
        comp = ComponentDefinition.from_json(data)
        assert comp.uuid == "json-uuid"
        assert comp.protocol_type == "theorist"
        assert comp.name == "JSON Component"
        assert comp.description == "From JSON"
        assert comp.github_commit == "commit123"

    def test_from_json_with_parameters(self):
        data = {
            "uuid": "param-uuid",
            "protocolType": "experimentalist",
            "name": "Param Component",
            "description": "Has params",
            "githubCommit": "xyz",
            "parameters": [
                {"name": "alpha", "description": "Alpha value", "datatype": "real", "default": 0.5},
                {"name": "iterations", "description": "Num iterations", "datatype": "integer"},
            ],
        }
        comp = ComponentDefinition.from_json(data)
        assert len(comp.parameters) == 2
        assert comp.parameters[0].name == "alpha"
        assert comp.parameters[0].default == 0.5
        assert comp.parameters[1].name == "iterations"

    def test_from_json_with_ports(self):
        data = {
            "uuid": "port-uuid",
            "protocolType": "experiment_runner",
            "name": "Port Component",
            "description": "Has ports",
            "githubCommit": "def",
            "inputDataType": [
                {"name": "data_in", "description": "Input data", "datatype": "array"},
            ],
            "outputDataType": [
                {"name": "result", "description": "Output result", "datatype": "object"},
            ],
        }
        comp = ComponentDefinition.from_json(data)
        assert len(comp.input_ports) == 1
        assert comp.input_ports[0].name == "data_in"
        assert len(comp.output_ports) == 1
        assert comp.output_ports[0].name == "result"

    def test_from_json_with_file_path(self):
        data = {"uuid": "fp-uuid", "protocolType": "theorist", "name": "FP"}
        comp = ComponentDefinition.from_json(data, file_path="theorists/test.json")
        assert comp.file_path == "theorists/test.json"


class TestNodeData:
    """Tests for NodeData dataclass."""

    @pytest.fixture
    def sample_component(self):
        return ComponentDefinition(
            uuid="comp-uuid",
            protocol_type="theorist",
            name="Sample",
            description="Sample component",
            github_commit="123",
            parameters=[
                ParameterDef(name="alpha", description="Alpha", datatype="real", default=0.1),
                ParameterDef(name="beta", description="Beta", datatype="integer", default=5),
            ],
        )

    def test_create_basic(self, sample_component):
        node = NodeData(uuid="node-uuid", component=sample_component)
        assert node.uuid == "node-uuid"
        assert node.component == sample_component
        assert node.x == 0
        assert node.y == 0

    def test_create_with_position(self, sample_component):
        node = NodeData(uuid="node-uuid", component=sample_component, x=100.5, y=200.5)
        assert node.x == 100.5
        assert node.y == 200.5

    def test_parameters_initialized_from_defaults(self, sample_component):
        node = NodeData(uuid="node-uuid", component=sample_component)
        assert node.parameters["alpha"] == 0.1
        assert node.parameters["beta"] == 5

    def test_parameters_can_be_overridden(self, sample_component):
        node = NodeData(
            uuid="node-uuid",
            component=sample_component,
            parameters={"alpha": 0.9, "beta": 10},
        )
        assert node.parameters["alpha"] == 0.9
        assert node.parameters["beta"] == 10

    def test_create_factory(self, sample_component):
        node = NodeData.create(sample_component, x=50, y=75)
        assert node.component == sample_component
        assert node.x == 50
        assert node.y == 75
        assert len(node.uuid) == 36  # UUID format

    def test_create_generates_unique_uuids(self, sample_component):
        node1 = NodeData.create(sample_component)
        node2 = NodeData.create(sample_component)
        assert node1.uuid != node2.uuid
