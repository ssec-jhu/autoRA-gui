"""Tests for PropertyEditor widget."""

import pytest
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QDoubleSpinBox,
    QGroupBox,
    QLineEdit,
    QSpinBox,
)

from autora_gui.desktop_app.models.node import (
    ComponentDefinition,
    NodeData,
    ParameterDef,
    PortDef,
)
from autora_gui.desktop_app.properties.property_editor import PropertyEditor


@pytest.fixture(scope="module")
def app():
    """Create QApplication instance for tests."""
    app = QApplication.instance()
    if app is None:
        app = QApplication([])
    return app


@pytest.fixture
def component_with_params():
    """Create a component with various parameter types."""
    return ComponentDefinition(
        uuid="comp-uuid",
        protocol_type="experimentalist",
        name="Test Component",
        description="A test component for testing",
        github_commit="123",
        parameters=[
            ParameterDef(name="int_param", description="Integer param", datatype="integer", default=10),
            ParameterDef(name="real_param", description="Real param", datatype="real", default=0.5),
            ParameterDef(name="bool_param", description="Boolean param", datatype="boolean", default=True),
            ParameterDef(
                name="cat_param",
                description="Categorical param",
                datatype="categorical",
                valid_values=["option_a", "option_b", "option_c"],
                default="option_b",
            ),
            ParameterDef(name="str_param", description="String param", datatype="string", default="hello"),
        ],
        input_ports=[PortDef(name="data_in", description="Input data", datatype="array")],
        output_ports=[PortDef(name="result", description="Output result", datatype="object")],
    )


@pytest.fixture
def component_no_params():
    """Create a component without parameters."""
    return ComponentDefinition(
        uuid="no-params-uuid",
        protocol_type="theorist",
        name="Simple Component",
        description="A simple component without parameters",
        github_commit="456",
    )


@pytest.fixture
def component_no_ports():
    """Create a component without ports."""
    return ComponentDefinition(
        uuid="no-ports-uuid",
        protocol_type="experiment_runner",
        name="No Ports Component",
        description="A component without ports",
        github_commit="789",
        parameters=[ParameterDef(name="value", description="Value", datatype="integer", default=1)],
    )


@pytest.fixture
def node_data(component_with_params):
    """Create a node data instance."""
    return NodeData.create(component_with_params, x=100, y=200)


@pytest.fixture
def editor(app):
    """Create a PropertyEditor instance."""
    return PropertyEditor()


class TestPropertyEditorInit:
    """Tests for PropertyEditor initialization."""

    def test_init(self, editor):
        """Test PropertyEditor initialization."""
        assert editor._current_node is None
        assert editor._param_widgets == {}
        assert editor.minimumWidth() == 250

    def test_has_header_label(self, editor):
        """Test that editor has header label."""
        assert editor.header_label is not None
        assert editor.header_label.text() == "Properties"

    def test_has_content_widget(self, editor):
        """Test that editor has content widget."""
        assert editor.content_widget is not None

    def test_has_placeholder(self, editor):
        """Test that editor shows placeholder when no node selected."""
        assert editor.placeholder is not None
        assert "Select a node" in editor.placeholder.text()

    def test_signal_exists(self, editor):
        """Test that parameter_changed signal exists."""
        assert hasattr(editor, "parameter_changed")


class TestPropertyEditorSetNode:
    """Tests for set_node method."""

    def test_set_node_updates_current_node(self, editor, node_data):
        """Test that set_node updates _current_node."""
        editor.set_node(node_data)

        assert editor._current_node == node_data

    def test_set_node_updates_header(self, editor, node_data):
        """Test that set_node updates header label."""
        editor.set_node(node_data)

        assert node_data.component.name in editor.header_label.text()

    def test_set_node_none_clears(self, editor, node_data):
        """Test that set_node(None) clears the editor."""
        editor.set_node(node_data)
        editor.set_node(None)

        assert editor._current_node is None
        assert editor.header_label.text() == "Properties"

    def test_set_node_creates_param_widgets(self, editor, node_data):
        """Test that set_node creates parameter widgets."""
        editor.set_node(node_data)

        assert len(editor._param_widgets) == 5
        assert "int_param" in editor._param_widgets
        assert "real_param" in editor._param_widgets
        assert "bool_param" in editor._param_widgets
        assert "cat_param" in editor._param_widgets
        assert "str_param" in editor._param_widgets

    def test_set_node_clears_previous_widgets(self, editor, component_with_params, component_no_params):
        """Test that set_node clears previous widgets."""
        node1 = NodeData.create(component_with_params)
        node2 = NodeData.create(component_no_params)

        editor.set_node(node1)
        assert len(editor._param_widgets) == 5

        editor.set_node(node2)
        assert len(editor._param_widgets) == 0


class TestPropertyEditorParameterWidgets:
    """Tests for parameter widget creation."""

    def test_integer_param_creates_spinbox(self, editor, node_data):
        """Test that integer parameter creates QSpinBox."""
        editor.set_node(node_data)

        widget = editor._param_widgets["int_param"]
        assert isinstance(widget, QSpinBox)

    def test_integer_param_has_correct_value(self, editor, node_data):
        """Test that integer spinbox has correct initial value."""
        editor.set_node(node_data)

        widget = editor._param_widgets["int_param"]
        assert widget.value() == 10

    def test_real_param_creates_double_spinbox(self, editor, node_data):
        """Test that real parameter creates QDoubleSpinBox."""
        editor.set_node(node_data)

        widget = editor._param_widgets["real_param"]
        assert isinstance(widget, QDoubleSpinBox)

    def test_real_param_has_correct_value(self, editor, node_data):
        """Test that real spinbox has correct initial value."""
        editor.set_node(node_data)

        widget = editor._param_widgets["real_param"]
        assert widget.value() == pytest.approx(0.5)

    def test_boolean_param_creates_checkbox(self, editor, node_data):
        """Test that boolean parameter creates QCheckBox."""
        editor.set_node(node_data)

        widget = editor._param_widgets["bool_param"]
        assert isinstance(widget, QCheckBox)

    def test_boolean_param_has_correct_value(self, editor, node_data):
        """Test that checkbox has correct initial value."""
        editor.set_node(node_data)

        widget = editor._param_widgets["bool_param"]
        assert widget.isChecked() is True

    def test_categorical_param_creates_combobox(self, editor, node_data):
        """Test that categorical parameter creates QComboBox."""
        editor.set_node(node_data)

        widget = editor._param_widgets["cat_param"]
        assert isinstance(widget, QComboBox)

    def test_categorical_param_has_correct_options(self, editor, node_data):
        """Test that combobox has all valid values."""
        editor.set_node(node_data)

        widget = editor._param_widgets["cat_param"]
        options = [widget.itemText(i) for i in range(widget.count())]

        assert "option_a" in options
        assert "option_b" in options
        assert "option_c" in options

    def test_categorical_param_has_correct_selection(self, editor, node_data):
        """Test that combobox has correct initial selection."""
        editor.set_node(node_data)

        widget = editor._param_widgets["cat_param"]
        assert widget.currentText() == "option_b"

    def test_string_param_creates_lineedit(self, editor, node_data):
        """Test that string parameter creates QLineEdit."""
        editor.set_node(node_data)

        widget = editor._param_widgets["str_param"]
        assert isinstance(widget, QLineEdit)

    def test_string_param_has_correct_value(self, editor, node_data):
        """Test that lineedit has correct initial value."""
        editor.set_node(node_data)

        widget = editor._param_widgets["str_param"]
        assert widget.text() == "hello"


class TestPropertyEditorGroups:
    """Tests for group boxes in property editor."""

    def test_has_component_info_group(self, editor, node_data):
        """Test that editor has Component Info group."""
        editor.set_node(node_data)

        groups = editor.content_widget.findChildren(QGroupBox)
        group_titles = [g.title() for g in groups]

        assert "Component Info" in group_titles

    def test_has_parameters_group(self, editor, node_data):
        """Test that editor has Parameters group when component has params."""
        editor.set_node(node_data)

        groups = editor.content_widget.findChildren(QGroupBox)
        group_titles = [g.title() for g in groups]

        assert "Parameters" in group_titles

    def test_has_inputs_group(self, editor, node_data):
        """Test that editor has Inputs group when component has input ports."""
        editor.set_node(node_data)

        groups = editor.content_widget.findChildren(QGroupBox)
        group_titles = [g.title() for g in groups]

        assert "Inputs" in group_titles

    def test_has_outputs_group(self, editor, node_data):
        """Test that editor has Outputs group when component has output ports."""
        editor.set_node(node_data)

        groups = editor.content_widget.findChildren(QGroupBox)
        group_titles = [g.title() for g in groups]

        assert "Outputs" in group_titles

    def test_no_params_group_when_no_params(self, editor, component_no_params):
        """Test that Parameters group is not shown when no parameters."""
        node = NodeData.create(component_no_params)
        editor.set_node(node)

        groups = editor.content_widget.findChildren(QGroupBox)
        group_titles = [g.title() for g in groups]

        assert "Parameters" not in group_titles

    def test_no_ports_groups_when_no_ports(self, editor, component_no_ports):
        """Test that Inputs/Outputs groups are not shown when no ports."""
        node = NodeData.create(component_no_ports)
        editor.set_node(node)

        groups = editor.content_widget.findChildren(QGroupBox)
        group_titles = [g.title() for g in groups]

        assert "Inputs" not in group_titles
        assert "Outputs" not in group_titles


class TestPropertyEditorSignals:
    """Tests for parameter_changed signal."""

    def test_integer_change_emits_signal(self, editor, node_data):
        """Test that changing integer parameter emits signal."""
        editor.set_node(node_data)
        received = []
        editor.parameter_changed.connect(lambda uuid, name, val: received.append((uuid, name, val)))

        widget = editor._param_widgets["int_param"]
        widget.setValue(42)

        assert len(received) == 1
        assert received[0][0] == node_data.uuid
        assert received[0][1] == "int_param"
        assert received[0][2] == 42

    def test_real_change_emits_signal(self, editor, node_data):
        """Test that changing real parameter emits signal."""
        editor.set_node(node_data)
        received = []
        editor.parameter_changed.connect(lambda uuid, name, val: received.append((uuid, name, val)))

        widget = editor._param_widgets["real_param"]
        widget.setValue(3.14)

        assert len(received) >= 1
        # Get the last emission (may emit multiple times during setValue)
        assert received[-1][1] == "real_param"
        assert received[-1][2] == pytest.approx(3.14)

    def test_boolean_change_emits_signal(self, editor, node_data):
        """Test that changing boolean parameter emits signal."""
        editor.set_node(node_data)
        received = []
        editor.parameter_changed.connect(lambda uuid, name, val: received.append((uuid, name, val)))

        widget = editor._param_widgets["bool_param"]
        widget.setChecked(False)

        assert len(received) == 1
        assert received[0][1] == "bool_param"
        assert received[0][2] is False

    def test_categorical_change_emits_signal(self, editor, node_data):
        """Test that changing categorical parameter emits signal."""
        editor.set_node(node_data)
        received = []
        editor.parameter_changed.connect(lambda uuid, name, val: received.append((uuid, name, val)))

        widget = editor._param_widgets["cat_param"]
        widget.setCurrentText("option_c")

        assert len(received) == 1
        assert received[0][1] == "cat_param"
        assert received[0][2] == "option_c"

    def test_string_change_emits_signal(self, editor, node_data):
        """Test that changing string parameter emits signal."""
        editor.set_node(node_data)
        received = []
        editor.parameter_changed.connect(lambda uuid, name, val: received.append((uuid, name, val)))

        widget = editor._param_widgets["str_param"]
        widget.setText("new value")

        # Text changes emit for each character, get the last one
        assert len(received) >= 1
        final_values = [r for r in received if r[1] == "str_param"]
        assert final_values[-1][2] == "new value"


class TestPropertyEditorParameterUpdates:
    """Tests for parameter value updates in node data."""

    def test_integer_change_updates_node(self, editor, node_data):
        """Test that changing integer parameter updates node data."""
        editor.set_node(node_data)

        widget = editor._param_widgets["int_param"]
        widget.setValue(99)

        assert node_data.parameters["int_param"] == 99

    def test_real_change_updates_node(self, editor, node_data):
        """Test that changing real parameter updates node data."""
        editor.set_node(node_data)

        widget = editor._param_widgets["real_param"]
        widget.setValue(2.718)

        assert node_data.parameters["real_param"] == pytest.approx(2.718)

    def test_boolean_change_updates_node(self, editor, node_data):
        """Test that changing boolean parameter updates node data."""
        editor.set_node(node_data)

        widget = editor._param_widgets["bool_param"]
        widget.setChecked(False)

        assert node_data.parameters["bool_param"] is False

    def test_categorical_change_updates_node(self, editor, node_data):
        """Test that changing categorical parameter updates node data."""
        editor.set_node(node_data)

        widget = editor._param_widgets["cat_param"]
        widget.setCurrentText("option_a")

        assert node_data.parameters["cat_param"] == "option_a"

    def test_string_change_updates_node(self, editor, node_data):
        """Test that changing string parameter updates node data."""
        editor.set_node(node_data)

        widget = editor._param_widgets["str_param"]
        widget.setText("updated")

        assert node_data.parameters["str_param"] == "updated"


class TestPropertyEditorCreateParamWidget:
    """Tests for _create_param_widget method."""

    def test_create_integer_widget(self, editor, component_with_params):
        """Test creating integer widget."""
        node = NodeData.create(component_with_params)
        param = next(p for p in component_with_params.parameters if p.name == "int_param")

        widget = editor._create_param_widget(param, node)

        assert isinstance(widget, QSpinBox)
        assert widget.value() == 10

    def test_create_real_widget(self, editor, component_with_params):
        """Test creating real widget."""
        node = NodeData.create(component_with_params)
        param = next(p for p in component_with_params.parameters if p.name == "real_param")

        widget = editor._create_param_widget(param, node)

        assert isinstance(widget, QDoubleSpinBox)
        assert widget.decimals() == 6

    def test_create_boolean_widget(self, editor, component_with_params):
        """Test creating boolean widget."""
        node = NodeData.create(component_with_params)
        param = next(p for p in component_with_params.parameters if p.name == "bool_param")

        widget = editor._create_param_widget(param, node)

        assert isinstance(widget, QCheckBox)

    def test_create_categorical_widget(self, editor, component_with_params):
        """Test creating categorical widget."""
        node = NodeData.create(component_with_params)
        param = next(p for p in component_with_params.parameters if p.name == "cat_param")

        widget = editor._create_param_widget(param, node)

        assert isinstance(widget, QComboBox)
        assert widget.count() == 3

    def test_create_string_widget(self, editor, component_with_params):
        """Test creating string widget."""
        node = NodeData.create(component_with_params)
        param = next(p for p in component_with_params.parameters if p.name == "str_param")

        widget = editor._create_param_widget(param, node)

        assert isinstance(widget, QLineEdit)

    def test_create_unknown_type_creates_lineedit(self, editor):
        """Test that unknown datatype creates QLineEdit."""
        component = ComponentDefinition(
            uuid="test",
            protocol_type="theorist",
            name="Test",
            description="",
            github_commit="",
            parameters=[ParameterDef(name="unknown", description="Unknown", datatype="custom_type", default="value")],
        )
        node = NodeData.create(component)
        param = component.parameters[0]

        widget = editor._create_param_widget(param, node)

        assert isinstance(widget, QLineEdit)

    def test_create_widget_with_none_default(self, editor):
        """Test creating widget when default is None."""
        component = ComponentDefinition(
            uuid="test",
            protocol_type="theorist",
            name="Test",
            description="",
            github_commit="",
            parameters=[ParameterDef(name="nullable", description="Nullable", datatype="string")],
        )
        node = NodeData.create(component)
        param = component.parameters[0]

        widget = editor._create_param_widget(param, node)

        assert isinstance(widget, QLineEdit)
        assert widget.text() == ""
        assert widget.placeholderText() == "null"


class TestPropertyEditorEdgeCases:
    """Tests for edge cases."""

    def test_set_node_multiple_times(self, editor, component_with_params):
        """Test setting node multiple times."""
        node1 = NodeData.create(component_with_params)
        node2 = NodeData.create(component_with_params)

        editor.set_node(node1)
        editor.set_node(node2)
        editor.set_node(None)
        editor.set_node(node1)

        assert editor._current_node == node1

    def test_param_change_without_node(self, editor):
        """Test that _on_param_changed doesn't error without node."""
        # Should not raise an error
        editor._on_param_changed("test_param", 123)

    def test_empty_string_becomes_none(self, editor, component_with_params):
        """Test that empty string parameter becomes None."""
        node = NodeData.create(component_with_params)
        editor.set_node(node)

        widget = editor._param_widgets["str_param"]
        widget.setText("")

        assert node.parameters["str_param"] is None

    def test_categorical_without_valid_values(self, editor):
        """Test categorical parameter without valid_values creates LineEdit."""
        component = ComponentDefinition(
            uuid="test",
            protocol_type="theorist",
            name="Test",
            description="",
            github_commit="",
            parameters=[ParameterDef(name="cat", description="Cat", datatype="categorical")],
        )
        node = NodeData.create(component)
        param = component.parameters[0]

        widget = editor._create_param_widget(param, node)

        # Without valid_values, should fall through to string/LineEdit
        assert isinstance(widget, QLineEdit)
