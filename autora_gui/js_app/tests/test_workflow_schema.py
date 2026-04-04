"""Tests for workflow schema validation."""

import json
from pathlib import Path

import pytest


class TestWorkflowSchemaStructure:
    """Tests for the workflow model schema structure."""

    @pytest.fixture
    def schema_path(self) -> Path:
        """Get the path to the workflow schema."""
        return Path(__file__).parent.parent.parent / "JSON" / "schemas" / "workflow_model.json"

    @pytest.fixture
    def schema(self, schema_path: Path) -> dict:
        """Load the workflow schema."""
        return json.loads(schema_path.read_text())

    def test_schema_file_exists(self, schema_path: Path) -> None:
        """Test that the schema file exists."""
        assert schema_path.exists()

    def test_schema_is_valid_json(self, schema_path: Path) -> None:
        """Test that the schema is valid JSON."""
        content = schema_path.read_text()
        schema = json.loads(content)
        assert isinstance(schema, dict)

    def test_schema_has_defs(self, schema: dict) -> None:
        """Test that schema has $defs section."""
        assert "$defs" in schema

    def test_schema_has_required_definitions(self, schema: dict) -> None:
        """Test that schema has all required definitions."""
        defs = schema["$defs"]
        required_defs = [
            "CanvasLocation",
            "ProtocolComponent",
            "Datatype",
            "Link",
            "ParameterSetting",
            "PrimitiveVariableType",
        ]
        for def_name in required_defs:
            assert def_name in defs, f"Missing definition: {def_name}"

    def test_schema_has_required_properties(self, schema: dict) -> None:
        """Test that schema has required root properties."""
        assert "properties" in schema
        props = schema["properties"]

        required_props = [
            "name",
            "description",
            "independentVariables",
            "dependentVariables",
            "components",
            "links",
        ]
        for prop in required_props:
            assert prop in props, f"Missing property: {prop}"

    def test_schema_required_fields(self, schema: dict) -> None:
        """Test that schema specifies required fields correctly."""
        assert "required" in schema
        required = schema["required"]

        assert "name" in required
        assert "independentVariables" in required
        assert "dependentVariables" in required
        assert "components" in required
        assert "links" in required


class TestCanvasLocationDefinition:
    """Tests for the CanvasLocation definition."""

    @pytest.fixture
    def canvas_location_def(self) -> dict:
        """Load the CanvasLocation definition."""
        schema_path = Path(__file__).parent.parent.parent / "JSON" / "schemas" / "workflow_model.json"
        schema = json.loads(schema_path.read_text())
        return schema["$defs"]["CanvasLocation"]

    def test_has_x_property(self, canvas_location_def: dict) -> None:
        """Test that CanvasLocation has x property."""
        assert "x" in canvas_location_def["properties"]
        assert canvas_location_def["properties"]["x"]["type"] == "integer"

    def test_has_y_property(self, canvas_location_def: dict) -> None:
        """Test that CanvasLocation has y property."""
        assert "y" in canvas_location_def["properties"]
        assert canvas_location_def["properties"]["y"]["type"] == "integer"

    def test_x_and_y_are_required(self, canvas_location_def: dict) -> None:
        """Test that x and y are required."""
        assert "x" in canvas_location_def["required"]
        assert "y" in canvas_location_def["required"]


class TestProtocolComponentDefinition:
    """Tests for the ProtocolComponent definition."""

    @pytest.fixture
    def component_def(self) -> dict:
        """Load the ProtocolComponent definition."""
        schema_path = Path(__file__).parent.parent.parent / "JSON" / "schemas" / "workflow_model.json"
        schema = json.loads(schema_path.read_text())
        return schema["$defs"]["ProtocolComponent"]

    def test_has_uuid_property(self, component_def: dict) -> None:
        """Test that ProtocolComponent has uuid property."""
        assert "uuid" in component_def["properties"]
        assert component_def["properties"]["uuid"]["format"] == "uuid"

    def test_has_protocol_uuid_property(self, component_def: dict) -> None:
        """Test that ProtocolComponent has protocolUuid property."""
        assert "protocolUuid" in component_def["properties"]
        assert component_def["properties"]["protocolUuid"]["format"] == "uuid"

    def test_has_parameter_setting_property(self, component_def: dict) -> None:
        """Test that ProtocolComponent has parameterSetting property."""
        assert "parameterSetting" in component_def["properties"]

    def test_has_canvas_location_property(self, component_def: dict) -> None:
        """Test that ProtocolComponent has canvasLocation property."""
        assert "canvasLocation" in component_def["properties"]

    def test_required_fields(self, component_def: dict) -> None:
        """Test that ProtocolComponent has correct required fields."""
        required = component_def["required"]
        assert "uuid" in required
        assert "protocolUuid" in required
        assert "parameterSetting" in required
        assert "canvasLocation" in required


class TestLinkDefinition:
    """Tests for the Link definition."""

    @pytest.fixture
    def link_def(self) -> dict:
        """Load the Link definition."""
        schema_path = Path(__file__).parent.parent.parent / "JSON" / "schemas" / "workflow_model.json"
        schema = json.loads(schema_path.read_text())
        return schema["$defs"]["Link"]

    def test_has_source_property(self, link_def: dict) -> None:
        """Test that Link has source property."""
        assert "source" in link_def["properties"]
        assert link_def["properties"]["source"]["format"] == "uuid"

    def test_has_target_property(self, link_def: dict) -> None:
        """Test that Link has target property."""
        assert "target" in link_def["properties"]
        assert link_def["properties"]["target"]["format"] == "uuid"

    def test_source_and_target_are_required(self, link_def: dict) -> None:
        """Test that source and target are required."""
        assert "source" in link_def["required"]
        assert "target" in link_def["required"]


class TestDatatypeDefinition:
    """Tests for the Datatype enum definition."""

    @pytest.fixture
    def datatype_def(self) -> dict:
        """Load the Datatype definition."""
        schema_path = Path(__file__).parent.parent.parent / "JSON" / "schemas" / "workflow_model.json"
        schema = json.loads(schema_path.read_text())
        return schema["$defs"]["Datatype"]

    def test_is_enum(self, datatype_def: dict) -> None:
        """Test that Datatype is an enum."""
        assert "enum" in datatype_def

    def test_has_expected_values(self, datatype_def: dict) -> None:
        """Test that Datatype has expected enum values."""
        expected = ["real", "integer", "boolean", "string", "categorical"]
        for value in expected:
            assert value in datatype_def["enum"]


class TestParameterSettingDefinition:
    """Tests for the ParameterSetting definition."""

    @pytest.fixture
    def param_setting_def(self) -> dict:
        """Load the ParameterSetting definition."""
        schema_path = Path(__file__).parent.parent.parent / "JSON" / "schemas" / "workflow_model.json"
        schema = json.loads(schema_path.read_text())
        return schema["$defs"]["ParameterSetting"]

    def test_has_value_property(self, param_setting_def: dict) -> None:
        """Test that ParameterSetting has value property."""
        assert "value" in param_setting_def["properties"]
        assert param_setting_def["properties"]["value"]["type"] == "string"
