"""Tests for property editor (without Qt dependencies)."""

import pytest

from autora_gui.desktop_app.models.node import (
    ComponentDefinition,
    NodeData,
    ParameterDef,
    PortDef,
)


class TestPropertyEditorDataFlow:
    """Test data flow aspects of PropertyEditor without Qt widgets."""

    @pytest.fixture
    def component_with_params(self):
        return ComponentDefinition(
            uuid="comp-uuid",
            protocol_type="experimentalist",
            name="Test Component",
            description="A test component",
            github_commit="123",
            parameters=[
                ParameterDef(name="int_param", description="Integer", datatype="integer", default=10),
                ParameterDef(name="real_param", description="Real", datatype="real", default=0.5),
                ParameterDef(name="bool_param", description="Boolean", datatype="boolean", default=True),
                ParameterDef(
                    name="cat_param",
                    description="Categorical",
                    datatype="categorical",
                    valid_values=["a", "b", "c"],
                    default="b",
                ),
                ParameterDef(name="str_param", description="String", datatype="string", default="hello"),
            ],
            input_ports=[PortDef(name="input", description="Input", datatype="array")],
            output_ports=[PortDef(name="output", description="Output", datatype="object")],
        )

    def test_node_parameters_initialized(self, component_with_params):
        """Test that node parameters are initialized from component defaults."""
        node = NodeData.create(component_with_params)

        assert node.parameters["int_param"] == 10
        assert node.parameters["real_param"] == 0.5
        assert node.parameters["bool_param"] is True
        assert node.parameters["cat_param"] == "b"
        assert node.parameters["str_param"] == "hello"

    def test_node_parameters_can_be_modified(self, component_with_params):
        """Test that node parameters can be modified."""
        node = NodeData.create(component_with_params)

        node.parameters["int_param"] = 20
        node.parameters["real_param"] = 0.9
        node.parameters["bool_param"] = False
        node.parameters["cat_param"] = "c"
        node.parameters["str_param"] = "world"

        assert node.parameters["int_param"] == 20
        assert node.parameters["real_param"] == 0.9
        assert node.parameters["bool_param"] is False
        assert node.parameters["cat_param"] == "c"
        assert node.parameters["str_param"] == "world"

    def test_parameter_types(self, component_with_params):
        """Test parameter type definitions."""
        params = component_with_params.parameters

        int_param = next(p for p in params if p.name == "int_param")
        assert int_param.datatype == "integer"

        real_param = next(p for p in params if p.name == "real_param")
        assert real_param.datatype == "real"

        bool_param = next(p for p in params if p.name == "bool_param")
        assert bool_param.datatype == "boolean"

        cat_param = next(p for p in params if p.name == "cat_param")
        assert cat_param.datatype == "categorical"
        assert cat_param.valid_values == ["a", "b", "c"]

        str_param = next(p for p in params if p.name == "str_param")
        assert str_param.datatype == "string"

    def test_port_info(self, component_with_params):
        """Test port information."""
        assert len(component_with_params.input_ports) == 1
        assert component_with_params.input_ports[0].name == "input"
        assert component_with_params.input_ports[0].datatype == "array"

        assert len(component_with_params.output_ports) == 1
        assert component_with_params.output_ports[0].name == "output"
        assert component_with_params.output_ports[0].datatype == "object"
