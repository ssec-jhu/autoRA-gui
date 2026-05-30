"""Tests for node data models."""

import pytest

from autora_gui.desktop_app.models.node import (
    ComponentDefinition,
    NodeData,
    ParameterDef,
    PortData,
    PortDef,
)


# Module-level fixtures for reuse
@pytest.fixture
def sample_parameter():
    """Create a sample parameter definition."""
    return ParameterDef(
        name="alpha",
        description="Alpha value",
        datatype="real",
        default=0.1,
    )


@pytest.fixture
def sample_component():
    """Create a sample component definition."""
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


@pytest.fixture
def component_with_ports():
    """Create a component with input and output ports."""
    return ComponentDefinition(
        uuid="port-comp-uuid",
        protocol_type="experimentalist",
        name="Port Component",
        description="Has ports",
        github_commit="456",
        input_ports=[PortDef(name="data_in", description="Input", datatype="array")],
        output_ports=[PortDef(name="result", description="Output", datatype="object")],
    )


class TestParameterDef:
    """Tests for ParameterDef dataclass."""

    def test_create_basic(self):
        """Test creating parameter with required fields only."""
        param = ParameterDef(name="test", description="A test param", datatype="string")

        assert param.name == "test"
        assert param.description == "A test param"
        assert param.datatype == "string"
        assert param.min_occurs == 1
        assert param.max_occurs == 1
        assert param.valid_values is None
        assert param.default is None

    def test_create_with_defaults(self):
        """Test creating parameter with all optional fields."""
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
        """Test creating categorical parameter with valid values."""
        param = ParameterDef(
            name="method",
            description="Method to use",
            datatype="categorical",
            valid_values=["linear", "polynomial", "rbf"],
            default="linear",
        )

        assert param.valid_values == ["linear", "polynomial", "rbf"]
        assert param.default == "linear"

    def test_create_boolean(self):
        """Test creating boolean parameter."""
        param = ParameterDef(
            name="enabled",
            description="Enable feature",
            datatype="boolean",
            default=True,
        )

        assert param.datatype == "boolean"
        assert param.default is True

    def test_valid_values_none_for_non_categorical(self):
        """Test that valid_values is None for non-categorical types."""
        param = ParameterDef(name="count", description="Count", datatype="integer")

        assert param.valid_values is None


class TestPortDef:
    """Tests for PortDef dataclass."""

    def test_create_basic(self):
        """Test creating port with required fields only."""
        port = PortDef(name="input", description="Input data", datatype="object")

        assert port.name == "input"
        assert port.description == "Input data"
        assert port.datatype == "object"
        assert port.min_occurs == 1
        assert port.max_occurs == -1

    def test_create_with_occurs(self):
        """Test creating port with custom occurs values."""
        port = PortDef(
            name="output",
            description="Output",
            datatype="array",
            min_occurs=0,
            max_occurs=3,
        )

        assert port.min_occurs == 0
        assert port.max_occurs == 3

    def test_unlimited_max_occurs(self):
        """Test that -1 represents unlimited max_occurs."""
        port = PortDef(name="data", description="Data", datatype="any")

        assert port.max_occurs == -1

    def test_optional_port(self):
        """Test creating optional port (min_occurs=0)."""
        port = PortDef(name="optional", description="Optional", datatype="object", min_occurs=0)

        assert port.min_occurs == 0


class TestPortData:
    """Tests for PortData dataclass."""

    def test_create_input_port(self):
        """Test creating input port data."""
        port = PortData(name="data_in", port_type="input", datatype="array")

        assert port.name == "data_in"
        assert port.port_type == "input"
        assert port.datatype == "array"

    def test_create_output_port(self):
        """Test creating output port data."""
        port = PortData(name="result", port_type="output", datatype="object")

        assert port.name == "result"
        assert port.port_type == "output"
        assert port.datatype == "object"

    def test_port_type_values(self):
        """Test that port_type accepts expected values."""
        input_port = PortData(name="in", port_type="input", datatype="any")
        output_port = PortData(name="out", port_type="output", datatype="any")

        assert input_port.port_type == "input"
        assert output_port.port_type == "output"


class TestComponentDefinition:
    """Tests for ComponentDefinition dataclass."""

    def test_create_basic(self):
        """Test creating component with required fields only."""
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
        assert comp.description == "A test component"
        assert comp.github_commit == "abc123"
        assert comp.parameters == []
        assert comp.input_ports == []
        assert comp.output_ports == []
        assert comp.file_path == ""

    def test_create_with_file_path(self):
        """Test creating component with file path."""
        comp = ComponentDefinition(
            uuid="uuid",
            protocol_type="theorist",
            name="Comp",
            description="",
            github_commit="",
            file_path="theorists/comp.json",
        )

        assert comp.file_path == "theorists/comp.json"

    def test_create_with_parameters(self, sample_parameter):
        """Test creating component with parameters."""
        comp = ComponentDefinition(
            uuid="uuid",
            protocol_type="theorist",
            name="Comp",
            description="",
            github_commit="",
            parameters=[sample_parameter],
        )

        assert len(comp.parameters) == 1
        assert comp.parameters[0].name == "alpha"

    def test_create_with_ports(self):
        """Test creating component with input and output ports."""
        input_port = PortDef(name="in", description="Input", datatype="object")
        output_port = PortDef(name="out", description="Output", datatype="object")

        comp = ComponentDefinition(
            uuid="uuid",
            protocol_type="experimentalist",
            name="Comp",
            description="",
            github_commit="",
            input_ports=[input_port],
            output_ports=[output_port],
        )

        assert len(comp.input_ports) == 1
        assert len(comp.output_ports) == 1


class TestComponentDefinitionFromJson:
    """Tests for ComponentDefinition.from_json method."""

    def test_from_json_minimal(self):
        """Test parsing minimal JSON data."""
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
        """Test parsing JSON with parameters."""
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
        """Test parsing JSON with input and output ports."""
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
        """Test parsing JSON with file path argument."""
        data = {"uuid": "fp-uuid", "protocolType": "theorist", "name": "FP"}

        comp = ComponentDefinition.from_json(data, file_path="theorists/test.json")

        assert comp.file_path == "theorists/test.json"

    def test_from_json_missing_optional_fields(self):
        """Test parsing JSON with missing optional fields uses defaults."""
        data = {"uuid": "min-uuid"}

        comp = ComponentDefinition.from_json(data)

        assert comp.uuid == "min-uuid"
        assert comp.protocol_type == ""
        assert comp.name == "Unknown"
        assert comp.description == ""
        assert comp.github_commit == ""

    def test_from_json_parameter_min_max_occurs(self):
        """Test parsing parameter minOccurs and maxOccurs."""
        data = {
            "uuid": "uuid",
            "parameters": [
                {"name": "opt", "minOccurs": 0, "maxOccurs": 5},
            ],
        }

        comp = ComponentDefinition.from_json(data)

        assert comp.parameters[0].min_occurs == 0
        assert comp.parameters[0].max_occurs == 5

    def test_from_json_parameter_valid_values(self):
        """Test parsing parameter validValues."""
        data = {
            "uuid": "uuid",
            "parameters": [
                {"name": "method", "datatype": "categorical", "validValues": ["a", "b", "c"]},
            ],
        }

        comp = ComponentDefinition.from_json(data)

        assert comp.parameters[0].valid_values == ["a", "b", "c"]


class TestNodeData:
    """Tests for NodeData dataclass."""

    def test_create_basic(self, sample_component):
        """Test creating node with required fields."""
        node = NodeData(uuid="node-uuid", component=sample_component)

        assert node.uuid == "node-uuid"
        assert node.component == sample_component
        assert node.x == 0
        assert node.y == 0

    def test_create_with_position(self, sample_component):
        """Test creating node with position."""
        node = NodeData(uuid="node-uuid", component=sample_component, x=100.5, y=200.5)

        assert node.x == 100.5
        assert node.y == 200.5

    def test_parameters_initialized_from_defaults(self, sample_component):
        """Test that parameters are initialized from component defaults."""
        node = NodeData(uuid="node-uuid", component=sample_component)

        assert node.parameters["alpha"] == 0.1
        assert node.parameters["beta"] == 5

    def test_parameters_can_be_overridden(self, sample_component):
        """Test that parameters can be overridden at creation."""
        node = NodeData(
            uuid="node-uuid",
            component=sample_component,
            parameters={"alpha": 0.9, "beta": 10},
        )

        assert node.parameters["alpha"] == 0.9
        assert node.parameters["beta"] == 10

    def test_parameters_can_be_modified(self, sample_component):
        """Test that parameters can be modified after creation."""
        node = NodeData(uuid="node-uuid", component=sample_component)

        node.parameters["alpha"] = 0.5

        assert node.parameters["alpha"] == 0.5

    def test_node_parameters_initialized(self, sample_component):
        """Test node parameters are initialized from component defaults."""
        node = NodeData(uuid="test", component=sample_component)

        assert "alpha" in node.parameters
        assert "beta" in node.parameters

    def test_node_parameters_can_be_modified(self, sample_component):
        """Test node parameters can be modified."""
        node = NodeData(uuid="test", component=sample_component)

        node.parameters["alpha"] = 99

        assert node.parameters["alpha"] == 99

    def test_component_without_defaults(self):
        """Test node creation when component has no default parameter values."""
        comp = ComponentDefinition(
            uuid="no-default",
            protocol_type="theorist",
            name="No Defaults",
            description="",
            github_commit="",
            parameters=[ParameterDef(name="required", description="Required", datatype="string")],
        )

        node = NodeData(uuid="node", component=comp)

        # Parameter with no default should not be in parameters dict
        assert "required" not in node.parameters

    def test_position_can_be_modified(self, sample_component):
        """Test that node position can be modified."""
        node = NodeData(uuid="node", component=sample_component, x=0, y=0)

        node.x = 100
        node.y = 200

        assert node.x == 100
        assert node.y == 200


class TestNodeDataCreate:
    """Tests for NodeData.create factory method."""

    def test_create_factory(self, sample_component):
        """Test create factory method."""
        node = NodeData.create(sample_component, x=50, y=75)

        assert node.component == sample_component
        assert node.x == 50
        assert node.y == 75
        assert len(node.uuid) == 36  # UUID format

    def test_create_generates_unique_uuids(self, sample_component):
        """Test that create generates unique UUIDs."""
        node1 = NodeData.create(sample_component)
        node2 = NodeData.create(sample_component)

        assert node1.uuid != node2.uuid

    def test_create_default_position(self, sample_component):
        """Test create with default position."""
        node = NodeData.create(sample_component)

        assert node.x == 0
        assert node.y == 0

    def test_create_initializes_parameters(self, sample_component):
        """Test that create initializes parameters from defaults."""
        node = NodeData.create(sample_component)

        assert node.parameters["alpha"] == 0.1
        assert node.parameters["beta"] == 5

    def test_create_with_float_position(self, sample_component):
        """Test create with floating point position."""
        node = NodeData.create(sample_component, x=123.456, y=789.012)

        assert node.x == 123.456
        assert node.y == 789.012

    def test_create_uuid_format(self, sample_component):
        """Test that created UUID is valid format."""
        import uuid

        node = NodeData.create(sample_component)

        # Should not raise ValueError
        uuid.UUID(node.uuid)
