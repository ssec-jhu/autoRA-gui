"""Tests for the data_model module."""

import json
import uuid
from pathlib import Path

import pytest
from pydantic import ValidationError

from autora_gui.data_model import (
    AutoraBaseModel,
    CanvasLocation,
    Cardinality,
    Component,
    Datatype,
    DictVariableType,
    EndComponent,
    Filter,
    Link,
    ParameterSetting,
    PrimitiveVariableType,
    Protocol,
    ProtocolComponent,
    ProtocolType,
    StartComponent,
    VariableType,
    Workflow,
    generate_schemas,
)


class TestDatatype:
    """Tests for the Datatype enum."""

    def test_datatype_values(self):
        assert Datatype.REAL == "real"
        assert Datatype.INTEGER == "integer"
        assert Datatype.BOOLEAN == "boolean"
        assert Datatype.STRING == "string"
        assert Datatype.CATEGORICAL == "categorical"

    def test_datatype_is_string_enum(self):
        assert isinstance(Datatype.REAL, str)
        assert Datatype.REAL.upper() == "REAL"


class TestProtocolType:
    """Tests for the ProtocolType enum."""

    def test_protocol_type_values(self):
        assert ProtocolType.THEORIST == "theorist"
        assert ProtocolType.EXPERIMENTALIST == "experimentalist"
        assert ProtocolType.EXPERIMENT_RUNNER == "experiment_runner"

    def test_protocol_type_is_string_enum(self):
        assert isinstance(ProtocolType.THEORIST, str)


class TestAutoraBaseModel:
    """Tests for the AutoraBaseModel class."""

    def test_create_with_uuid(self):
        test_uuid = uuid.uuid4()
        model = AutoraBaseModel(uuid=test_uuid)
        assert model.uuid == test_uuid

    def test_create_with_uuid_string(self):
        test_uuid = uuid.uuid4()
        model = AutoraBaseModel(uuid=str(test_uuid))
        assert model.uuid == test_uuid

    def test_invalid_uuid_raises_error(self):
        with pytest.raises(ValidationError):
            AutoraBaseModel(uuid="not-a-valid-uuid")


class TestVariableType:
    """Tests for the VariableType class."""

    def test_create_with_name_and_description(self):
        var = VariableType(name="test_var", description="A test variable")
        assert var.name == "test_var"
        assert var.description == "A test variable"

    def test_create_with_none_description(self):
        var = VariableType(name="test_var", description=None)
        assert var.name == "test_var"
        assert var.description is None

    def test_name_defaults_to_none(self):
        var = VariableType(description="Has description only")
        assert var.name is None
        assert var.description == "Has description only"

    def test_all_fields_default_to_none(self):
        var = VariableType()
        assert var.name is None
        assert var.description is None


class TestCardinality:
    """Tests for the Cardinality class."""

    def test_default_values(self):
        card = Cardinality()
        assert card.minOccurs == 0
        assert card.maxOccurs == 1
        assert card.unique is True

    def test_custom_values(self):
        card = Cardinality(minOccurs=1, maxOccurs=5, unique=False)
        assert card.minOccurs == 1
        assert card.maxOccurs == 5
        assert card.unique is False


class TestPrimitiveVariableType:
    """Tests for the PrimitiveVariableType class."""

    def test_create_with_required_fields(self):
        var = PrimitiveVariableType(
            name="age",
            description="User age",
            datatype=Datatype.INTEGER,
        )
        assert var.name == "age"
        assert var.description == "User age"
        assert var.datatype == Datatype.INTEGER
        assert var.cardinality is None
        assert var.validValues is None
        assert var.default is None

    def test_create_with_all_fields(self):
        card = Cardinality(minOccurs=1, maxOccurs=1)
        var = PrimitiveVariableType(
            name="status",
            description="Status flag",
            datatype=Datatype.CATEGORICAL,
            cardinality=card,
            validValues=["active", "inactive"],
            default="active",
        )
        assert var.datatype == Datatype.CATEGORICAL
        assert var.cardinality == card
        assert var.validValues == ["active", "inactive"]
        assert var.default == "active"

    def test_invalid_datatype_raises_error(self):
        with pytest.raises(ValidationError):
            PrimitiveVariableType(
                name="test",
                description="test",
                datatype="invalid_type",
            )


class TestDictVariableType:
    """Tests for the DictVariableType class."""

    def test_create_with_nested_variables(self):
        inner_var = PrimitiveVariableType(
            name="inner",
            description="Inner variable",
            datatype=Datatype.STRING,
        )
        dict_var = DictVariableType(
            name="outer",
            description="Outer dict",
            variables=[inner_var],
        )
        assert dict_var.name == "outer"
        assert len(dict_var.variables) == 1
        assert dict_var.variables[0].name == "inner"

    def test_create_with_nested_dict_variable(self):
        inner_primitive = PrimitiveVariableType(
            name="inner_primitive",
            description="Inner primitive variable",
            datatype=Datatype.INTEGER,
        )
        inner_dict = DictVariableType(
            name="inner_dict",
            description="Inner dict",
            variables=[inner_primitive],
        )
        outer_dict = DictVariableType(
            name="outer_dict",
            description="Outer dict",
            variables=[inner_dict],
        )
        assert outer_dict.name == "outer_dict"
        assert len(outer_dict.variables) == 1
        assert outer_dict.variables[0].name == "inner_dict"
        assert len(outer_dict.variables[0].variables) == 1

    def test_create_with_empty_variables(self):
        dict_var = DictVariableType(
            name="empty_dict",
            description="Empty dict",
            variables=[],
        )
        assert dict_var.variables == []


class TestLink:
    """Tests for the Link class."""

    def test_create_link(self):
        source_uuid = uuid.uuid4()
        target_uuid = uuid.uuid4()
        link = Link(source=source_uuid, target=target_uuid)
        assert link.source == source_uuid
        assert link.target == target_uuid

    def test_missing_source_raises_error(self):
        with pytest.raises(ValidationError):
            Link(target=uuid.uuid4())

    def test_missing_target_raises_error(self):
        with pytest.raises(ValidationError):
            Link(source=uuid.uuid4())


class TestFilter:
    """Tests for the Filter class."""

    def test_create_filter_with_defaults(self):
        source_uuid = uuid.uuid4()
        target_uuid = uuid.uuid4()
        filter_obj = Filter(source=source_uuid, target=target_uuid, altTarget=None)
        assert filter_obj.maxCounter == 1
        assert filter_obj.altTarget is None

    def test_create_filter_with_all_fields(self):
        source_uuid = uuid.uuid4()
        target_uuid = uuid.uuid4()
        alt_target_uuid = uuid.uuid4()
        filter_obj = Filter(
            source=source_uuid,
            target=target_uuid,
            maxCounter=5,
            altTarget=alt_target_uuid,
        )
        assert filter_obj.maxCounter == 5
        assert filter_obj.altTarget == alt_target_uuid


class TestParameterSetting:
    """Tests for the ParameterSetting class."""

    def test_create_parameter_setting(self):
        test_uuid = uuid.uuid4()
        param = ParameterSetting(uuid=test_uuid, value="test_value")
        assert param.uuid == test_uuid
        assert param.value == "test_value"

    def test_missing_value_raises_error(self):
        with pytest.raises(ValidationError):
            ParameterSetting(uuid=uuid.uuid4())


class TestCanvasLocation:
    """Tests for the CanvasLocation class."""

    def test_create_canvas_location(self):
        loc = CanvasLocation(x=100, y=200)
        assert loc.x == 100
        assert loc.y == 200

    def test_negative_coordinates(self):
        loc = CanvasLocation(x=-50, y=-100)
        assert loc.x == -50
        assert loc.y == -100

    def test_missing_coordinate_raises_error(self):
        with pytest.raises(ValidationError):
            CanvasLocation(x=100)


class TestComponent:
    """Tests for the Component class."""

    def test_create_component_minimal(self):
        comp_uuid = uuid.uuid4()
        comp = Component(
            uuid=comp_uuid,
            canvasLocation=None,
        )
        assert comp.uuid == comp_uuid
        assert comp.canvasLocation is None

    def test_create_component_with_location(self):
        comp_uuid = uuid.uuid4()
        loc = CanvasLocation(x=50, y=75)
        comp = Component(
            uuid=comp_uuid,
            canvasLocation=loc,
        )
        assert comp.canvasLocation.x == 50
        assert comp.canvasLocation.y == 75


class TestProtocolComponent:
    """Tests for the ProtocolComponent class."""

    def test_create_protocol_component_minimal(self):
        comp_uuid = uuid.uuid4()
        protocol_uuid = uuid.uuid4()
        comp = ProtocolComponent(
            uuid=comp_uuid,
            protocolUuid=protocol_uuid,
            parameterSetting=None,
            canvasLocation=None,
        )
        assert comp.uuid == comp_uuid
        assert comp.protocolUuid == protocol_uuid
        assert comp.parameterSetting is None
        assert comp.canvasLocation is None

    def test_create_protocol_component_with_all_fields(self):
        comp_uuid = uuid.uuid4()
        protocol_uuid = uuid.uuid4()
        param_uuid = uuid.uuid4()
        param = ParameterSetting(uuid=param_uuid, value="param_value")
        loc = CanvasLocation(x=50, y=75)
        comp = ProtocolComponent(
            uuid=comp_uuid,
            protocolUuid=protocol_uuid,
            parameterSetting=[param],
            canvasLocation=loc,
        )
        assert len(comp.parameterSetting) == 1
        assert comp.canvasLocation.x == 50


class TestStartComponent:
    """Tests for the StartComponent class."""

    def test_create_start_component(self):
        comp_uuid = uuid.uuid4()
        comp = StartComponent(
            uuid=comp_uuid,
            canvasLocation=None,
        )
        assert comp.uuid == comp_uuid

    def test_create_start_component_with_location(self):
        comp_uuid = uuid.uuid4()
        loc = CanvasLocation(x=0, y=0)
        comp = StartComponent(
            uuid=comp_uuid,
            canvasLocation=loc,
        )
        assert comp.canvasLocation.x == 0


class TestEndComponent:
    """Tests for the EndComponent class."""

    def test_create_end_component(self):
        comp_uuid = uuid.uuid4()
        comp = EndComponent(
            uuid=comp_uuid,
            canvasLocation=None,
        )
        assert comp.uuid == comp_uuid

    def test_create_end_component_with_location(self):
        comp_uuid = uuid.uuid4()
        loc = CanvasLocation(x=100, y=100)
        comp = EndComponent(
            uuid=comp_uuid,
            canvasLocation=loc,
        )
        assert comp.canvasLocation.x == 100


class TestProtocol:
    """Tests for the Protocol class."""

    def test_create_protocol_minimal(self):
        test_uuid = uuid.uuid4()
        protocol = Protocol(
            uuid=test_uuid,
            protocolType=ProtocolType.THEORIST,
            name="Test Protocol",
            description="A test protocol",
            githubCommit="commit123",
            pythonName="TestClass",
            importPath="test.module",
            pipInstall="test-package",
            parameters=None,
            inputDataType=None,
            outputDataType=None,
        )
        assert protocol.uuid == test_uuid
        assert protocol.protocolType == ProtocolType.THEORIST
        assert protocol.name == "Test Protocol"
        assert protocol.description == "A test protocol"
        assert protocol.pythonName == "TestClass"
        assert protocol.githubCommit == "commit123"
        assert protocol.importPath == "test.module"
        assert protocol.pipInstall == "test-package"

    def test_create_protocol_with_all_fields(self):
        test_uuid = uuid.uuid4()
        param = PrimitiveVariableType(
            name="param1",
            description="Parameter 1",
            datatype=Datatype.STRING,
        )
        protocol = Protocol(
            uuid=test_uuid,
            protocolType=ProtocolType.EXPERIMENTALIST,
            name="Full Protocol",
            description="A full protocol",
            githubCommit="abc123",
            pythonName="FullClass",
            importPath="some.module.path",
            pipInstall="some-package",
            parameters={"__init__": [param]},
            inputDataType=[param],
            outputDataType=[param],
        )
        assert protocol.pythonName == "FullClass"
        assert protocol.githubCommit == "abc123"
        assert protocol.importPath == "some.module.path"
        assert protocol.pipInstall == "some-package"
        assert len(protocol.parameters) == 1


class TestWorkflow:
    """Tests for the Workflow class."""

    def test_create_workflow(self):
        comp_uuid = uuid.uuid4()
        protocol_uuid = uuid.uuid4()
        component = ProtocolComponent(
            uuid=comp_uuid,
            protocolUuid=protocol_uuid,
            parameterSetting=None,
            canvasLocation=None,
        )
        source_uuid = uuid.uuid4()
        target_uuid = uuid.uuid4()
        link = Link(source=source_uuid, target=target_uuid)

        ind_var = PrimitiveVariableType(
            name="x",
            description="Independent variable",
            datatype=Datatype.REAL,
        )
        dep_var = PrimitiveVariableType(
            name="y",
            description="Dependent variable",
            datatype=Datatype.REAL,
        )

        workflow = Workflow(
            name="Test Workflow",
            description="A test workflow",
            independentVariables=ind_var,
            dependentVariables=dep_var,
            components=[component],
            links=[link],
        )
        assert workflow.name == "Test Workflow"
        assert workflow.description == "A test workflow"
        assert len(workflow.components) == 1
        assert len(workflow.links) == 1

    def test_create_workflow_without_description(self):
        comp_uuid = uuid.uuid4()
        protocol_uuid = uuid.uuid4()
        component = ProtocolComponent(
            uuid=comp_uuid,
            protocolUuid=protocol_uuid,
            parameterSetting=None,
            canvasLocation=None,
        )

        ind_var = PrimitiveVariableType(
            name="x",
            description="Independent variable",
            datatype=Datatype.REAL,
        )
        dep_var = PrimitiveVariableType(
            name="y",
            description="Dependent variable",
            datatype=Datatype.REAL,
        )

        workflow = Workflow(
            name="Minimal Workflow",
            independentVariables=ind_var,
            dependentVariables=dep_var,
            components=[component],
            links=[],
        )
        assert workflow.description is None
        assert workflow.links == []

    def test_create_workflow_with_start_and_end(self):
        start_uuid = uuid.uuid4()
        end_uuid = uuid.uuid4()
        start = StartComponent(uuid=start_uuid, canvasLocation=CanvasLocation(x=0, y=50))
        end = EndComponent(uuid=end_uuid, canvasLocation=CanvasLocation(x=500, y=50))

        ind_var = PrimitiveVariableType(
            name="x",
            description="Independent variable",
            datatype=Datatype.REAL,
        )
        dep_var = PrimitiveVariableType(
            name="y",
            description="Dependent variable",
            datatype=Datatype.REAL,
        )

        workflow = Workflow(
            name="Workflow with Start/End",
            independentVariables=ind_var,
            dependentVariables=dep_var,
            start=start,
            end=end,
            components=[],
            links=[],
        )
        assert workflow.start is not None
        assert workflow.start.uuid == start_uuid
        assert workflow.end is not None
        assert workflow.end.uuid == end_uuid

    def test_workflow_missing_required_field_raises_error(self):
        with pytest.raises(ValidationError):
            Workflow(
                name="Incomplete Workflow",
                components=[],
                links=[],
            )


class TestModelSerialization:
    """Tests for model serialization and deserialization."""

    def test_protocol_json_roundtrip(self):
        test_uuid = uuid.uuid4()
        protocol = Protocol(
            uuid=test_uuid,
            protocolType=ProtocolType.THEORIST,
            name="Test Protocol",
            description="A test protocol",
            githubCommit="abc123",
            pythonName="TestClass",
            importPath="some.module",
            pipInstall="some-package",
            parameters=None,
            inputDataType=None,
            outputDataType=None,
        )
        json_str = protocol.model_dump_json()
        restored = Protocol.model_validate_json(json_str)
        assert restored.uuid == protocol.uuid
        assert restored.name == protocol.name
        assert restored.pythonName == protocol.pythonName

    def test_workflow_dict_roundtrip(self):
        comp_uuid = uuid.uuid4()
        protocol_uuid = uuid.uuid4()
        component = ProtocolComponent(
            uuid=comp_uuid,
            protocolUuid=protocol_uuid,
            parameterSetting=None,
            canvasLocation=None,
        )
        ind_var = PrimitiveVariableType(
            name="x",
            description="Independent variable",
            datatype=Datatype.REAL,
        )
        dep_var = PrimitiveVariableType(
            name="y",
            description="Dependent variable",
            datatype=Datatype.REAL,
        )
        workflow = Workflow(
            name="Test Workflow",
            independentVariables=ind_var,
            dependentVariables=dep_var,
            components=[component],
            links=[],
        )
        workflow_dict = workflow.model_dump()
        restored = Workflow.model_validate(workflow_dict)
        assert restored.name == workflow.name
        assert len(restored.components) == 1


class TestComponentJsonFiles:
    """Tests for component JSON file consistency."""

    @pytest.fixture
    def component_files(self):
        """Get all component JSON files."""
        from pathlib import Path

        components_dir = Path(__file__).parent.parent / "JSON" / "components"
        return list(components_dir.rglob("*.json"))

    def test_all_components_validate_against_protocol_model(self, component_files):
        """All component JSON files should be valid Protocol instances."""
        import json

        for file_path in component_files:
            with open(file_path) as f:
                data = json.load(f)
            # This will raise ValidationError if invalid
            Protocol.model_validate(data)

    def test_all_uuids_are_unique(self, component_files):
        """All component UUIDs should be unique across files."""
        import json

        uuids = []
        for file_path in component_files:
            with open(file_path) as f:
                data = json.load(f)
            uuids.append((data["uuid"], file_path.name))

        uuid_values = [u[0] for u in uuids]
        duplicates = [u for u in uuids if uuid_values.count(u[0]) > 1]
        assert len(duplicates) == 0, f"Duplicate UUIDs found: {duplicates}"

    def test_all_uuids_are_valid_format(self, component_files):
        """All UUIDs should be valid UUID format."""
        import json

        for file_path in component_files:
            with open(file_path) as f:
                data = json.load(f)
            uuid.UUID(data["uuid"])  # Raises ValueError if invalid


class TestSchemaGeneration:
    """Tests for JSON schema generation."""

    def test_workflow_schema_is_valid_json_schema(self):
        """Workflow.model_json_schema() produces valid JSON schema."""
        schema = Workflow.model_json_schema()
        assert isinstance(schema, dict)
        assert "$defs" in schema or "properties" in schema
        assert schema.get("type") == "object"

    def test_protocol_schema_is_valid_json_schema(self):
        """Protocol.model_json_schema() produces valid JSON schema."""
        schema = Protocol.model_json_schema()
        assert isinstance(schema, dict)
        assert schema.get("type") == "object"
        assert "properties" in schema

    def test_protocol_schema_contains_required_fields(self):
        """Protocol schema includes all required fields."""
        schema = Protocol.model_json_schema()
        required = schema.get("required", [])
        expected_fields = [
            "uuid",
            "protocolType",
            "name",
            "description",
            "githubCommit",
            "pythonName",
            "importPath",
            "pipInstall",
        ]
        for field in expected_fields:
            assert field in required, f"Missing required field: {field}"

    def test_workflow_schema_file_is_up_to_date(self):
        """Saved workflow schema file matches current model definition."""

        schema_dir = Path(__file__).parent.parent / "JSON" / "schemas"
        workflow_schema = Workflow.model_json_schema()
        workflow_file = schema_dir / "workflow_model.json"

        assert workflow_file.exists(), "workflow_model.json does not exist"
        with workflow_file.open() as f:
            saved_schema = json.load(f)
        assert workflow_schema == saved_schema, (
            "workflow_model.json is out of date. Run 'python -m autora_gui.data_model' to regenerate."
        )

    def test_protocol_schema_file_is_up_to_date(self):
        """Saved protocol schema file matches current model definition."""

        schema_dir = Path(__file__).parent.parent / "JSON" / "schemas"
        protocol_schema = Protocol.model_json_schema()
        protocol_file = schema_dir / "protocol_model.json"

        assert protocol_file.exists(), "protocol_model.json does not exist"
        with protocol_file.open() as f:
            saved_schema = json.load(f)
        assert protocol_schema == saved_schema, (
            "protocol_model.json is out of date. Run 'python -m autora_gui.data_model' to regenerate."
        )

    def test_generate_schemas_creates_files(self, tmp_path):
        """generate_schemas() creates expected files."""

        generate_schemas(output_dir=tmp_path)

        assert (tmp_path / "workflow_model.json").exists()
        assert (tmp_path / "protocol_model.json").exists()

    def test_generate_schemas_creates_valid_json(self, tmp_path):
        """generate_schemas() creates valid JSON files."""

        generate_schemas(output_dir=tmp_path)

        with (tmp_path / "workflow_model.json").open() as f:
            workflow_data = json.load(f)
        assert isinstance(workflow_data, dict)

        with (tmp_path / "protocol_model.json").open() as f:
            protocol_data = json.load(f)
        assert isinstance(protocol_data, dict)

    def test_generate_schemas_creates_directory_if_missing(self, tmp_path):
        """generate_schemas() creates output directory if it doesn't exist."""

        nested_dir = tmp_path / "nested" / "schema" / "dir"
        assert not nested_dir.exists()

        generate_schemas(output_dir=nested_dir)

        assert nested_dir.exists()
        assert (nested_dir / "workflow_model.json").exists()
        assert (nested_dir / "protocol_model.json").exists()
