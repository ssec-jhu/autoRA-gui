"""Property editor panel for editing node parameters."""
from typing import Any, Callable
from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QFormLayout,
    QLabel,
    QLineEdit,
    QSpinBox,
    QDoubleSpinBox,
    QCheckBox,
    QComboBox,
    QScrollArea,
    QFrame,
    QTextEdit,
    QGroupBox,
)
from PySide6.QtCore import Qt, Signal

from ..models.node import NodeData, ParameterDef


class PropertyEditor(QWidget):
    """Panel for editing properties of a selected node."""

    parameter_changed = Signal(str, str, object)  # node_uuid, param_name, value

    def __init__(self, parent=None):
        super().__init__(parent)
        self._current_node: NodeData | None = None
        self._param_widgets: dict[str, QWidget] = {}

        # Main layout
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Header
        self.header_label = QLabel("Properties")
        self.header_label.setStyleSheet(
            "font-weight: bold; padding: 10px; background: #f0f0f0;"
        )
        main_layout.addWidget(self.header_label)

        # Scroll area for properties
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.NoFrame)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        main_layout.addWidget(scroll_area)

        # Content widget
        self.content_widget = QWidget()
        self.content_layout = QVBoxLayout(self.content_widget)
        self.content_layout.setContentsMargins(10, 10, 10, 10)
        self.content_layout.setSpacing(10)
        scroll_area.setWidget(self.content_widget)

        # Placeholder
        self.placeholder = QLabel("Select a node to edit its properties")
        self.placeholder.setStyleSheet("color: #888; padding: 20px;")
        self.placeholder.setAlignment(Qt.AlignCenter)
        self.content_layout.addWidget(self.placeholder)

        # Add stretch at the bottom
        self.content_layout.addStretch()

        self.setMinimumWidth(250)

    def set_node(self, node_data: NodeData | None):
        """Set the node to edit, or None to clear."""
        self._current_node = node_data
        self._param_widgets.clear()

        # Clear existing widgets
        while self.content_layout.count() > 0:
            item = self.content_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        if node_data is None:
            self.placeholder = QLabel("Select a node to edit its properties")
            self.placeholder.setStyleSheet("color: #888; padding: 20px;")
            self.placeholder.setAlignment(Qt.AlignCenter)
            self.content_layout.addWidget(self.placeholder)
            self.content_layout.addStretch()
            self.header_label.setText("Properties")
            return

        # Update header
        self.header_label.setText(f"Properties: {node_data.component.name}")

        # Component info group
        info_group = QGroupBox("Component Info")
        info_layout = QFormLayout(info_group)
        info_layout.addRow("Type:", QLabel(node_data.component.protocol_type.replace("_", " ").title()))

        # Description
        desc_label = QLabel(node_data.component.description)
        desc_label.setWordWrap(True)
        desc_label.setStyleSheet("color: #666;")
        info_layout.addRow("Description:", desc_label)

        self.content_layout.addWidget(info_group)

        # Parameters group
        if node_data.component.parameters:
            param_group = QGroupBox("Parameters")
            param_layout = QFormLayout(param_group)

            for param_def in node_data.component.parameters:
                widget = self._create_param_widget(param_def, node_data)
                if widget:
                    label = QLabel(param_def.name)
                    label.setToolTip(param_def.description)
                    param_layout.addRow(label, widget)
                    self._param_widgets[param_def.name] = widget

            self.content_layout.addWidget(param_group)

        # Inputs group
        if node_data.component.input_ports:
            input_group = QGroupBox("Inputs")
            input_layout = QFormLayout(input_group)
            for port in node_data.component.input_ports:
                port_label = QLabel(f"{port.datatype}")
                port_label.setStyleSheet("color: #666;")
                input_layout.addRow(port.name + ":", port_label)
            self.content_layout.addWidget(input_group)

        # Outputs group
        if node_data.component.output_ports:
            output_group = QGroupBox("Outputs")
            output_layout = QFormLayout(output_group)
            for port in node_data.component.output_ports:
                port_label = QLabel(f"{port.datatype}")
                port_label.setStyleSheet("color: #666;")
                output_layout.addRow(port.name + ":", port_label)
            self.content_layout.addWidget(output_group)

        # Add stretch
        self.content_layout.addStretch()

    def _create_param_widget(
        self, param_def: ParameterDef, node_data: NodeData
    ) -> QWidget | None:
        """Create appropriate widget for a parameter."""
        current_value = node_data.parameters.get(param_def.name, param_def.default)

        if param_def.datatype == "integer":
            widget = QSpinBox()
            widget.setRange(-999999, 999999)
            widget.setSpecialValueText("null")
            if current_value is not None:
                widget.setValue(int(current_value))
            widget.valueChanged.connect(
                lambda v: self._on_param_changed(param_def.name, v)
            )
            return widget

        elif param_def.datatype == "real":
            widget = QDoubleSpinBox()
            widget.setRange(-999999.0, 999999.0)
            widget.setDecimals(6)
            if current_value is not None:
                widget.setValue(float(current_value))
            widget.valueChanged.connect(
                lambda v: self._on_param_changed(param_def.name, v)
            )
            return widget

        elif param_def.datatype == "boolean":
            widget = QCheckBox()
            if current_value is not None:
                widget.setChecked(bool(current_value))
            widget.stateChanged.connect(
                lambda s: self._on_param_changed(param_def.name, s == Qt.Checked)
            )
            return widget

        elif param_def.datatype == "categorical" and param_def.valid_values:
            widget = QComboBox()
            widget.addItems(param_def.valid_values)
            if current_value in param_def.valid_values:
                widget.setCurrentText(str(current_value))
            widget.currentTextChanged.connect(
                lambda t: self._on_param_changed(param_def.name, t)
            )
            return widget

        else:  # string or other
            widget = QLineEdit()
            if current_value is not None:
                widget.setText(str(current_value))
            else:
                widget.setPlaceholderText("null")
            widget.textChanged.connect(
                lambda t: self._on_param_changed(param_def.name, t if t else None)
            )
            return widget

    def _on_param_changed(self, param_name: str, value: Any):
        """Handle parameter value change."""
        if self._current_node:
            self._current_node.parameters[param_name] = value
            self.parameter_changed.emit(
                self._current_node.uuid, param_name, value
            )
