"""Visual node item for the canvas."""

from PySide6.QtCore import QObject, QPointF, QRectF, Qt, Signal
from PySide6.QtGui import (
    QBrush,
    QColor,
    QFont,
    QLinearGradient,
    QPainter,
    QPen,
)
from PySide6.QtWidgets import (
    QGraphicsEllipseItem,
    QGraphicsItem,
    QStyleOptionGraphicsItem,
    QWidget,
)

from ..models.node import NodeData, PortDef

# Color scheme for different node types
NODE_COLORS = {
    "experimentalist": QColor("#4CAF50"),  # Green
    "theorist": QColor("#2196F3"),  # Blue
    "experiment_runner": QColor("#FF9800"),  # Orange
}

NODE_WIDTH = 200
NODE_HEIGHT = 70
HEADER_HEIGHT = 35


class PortItem(QGraphicsEllipseItem):
    """Invisible connection point for linking nodes."""

    def __init__(
        self,
        port_def: PortDef | None,
        port_type: str,  # "input" or "output"
        parent: "NodeItem",
    ):
        # Invisible - no visual representation
        super().__init__(-1, -1, 2, 2, parent)
        self.port_def = port_def
        self.port_type = port_type
        self.node_item = parent
        self.setVisible(False)  # Hidden

    def get_center_scene_pos(self) -> QPointF:
        """Get the center position of this port in scene coordinates."""
        return self.scenePos()


class NodeItemSignals(QObject):
    """Signals for NodeItem (QGraphicsItem can't have signals directly)."""

    selected = Signal(object)  # Emits NodeData
    position_changed = Signal(str, float, float)  # uuid, x, y


class NodeItem(QGraphicsItem):
    """Visual representation of a workflow node on the canvas."""

    def __init__(self, node_data: NodeData, parent=None):
        super().__init__(parent)
        self.node_data = node_data
        self.signals = NodeItemSignals()

        # Visual settings
        self._width = NODE_WIDTH
        self._height = NODE_HEIGHT
        self._header_height = HEADER_HEIGHT

        # Interaction flags
        self.setFlag(QGraphicsItem.ItemIsMovable, True)
        self.setFlag(QGraphicsItem.ItemIsSelectable, True)
        self.setFlag(QGraphicsItem.ItemSendsGeometryChanges, True)
        self.setAcceptHoverEvents(True)

        # Set initial position
        self.setPos(node_data.x, node_data.y)

        # Create invisible connection points (for connection logic)
        self.input_ports: list[PortItem] = []
        self.output_ports: list[PortItem] = []
        self._create_connection_points()

        # Color based on type
        self._color = NODE_COLORS.get(node_data.component.protocol_type, QColor("#9E9E9E"))

    def _create_connection_points(self):
        """Create invisible connection points at node edges."""
        # Single input point (left center)
        input_port = PortItem(None, "input", self)
        input_port.setPos(0, self._height / 2)
        self.input_ports.append(input_port)

        # Single output point (right center)
        output_port = PortItem(None, "output", self)
        output_port.setPos(self._width, self._height / 2)
        self.output_ports.append(output_port)

    def boundingRect(self) -> QRectF:
        """Return the bounding rectangle of the node."""
        return QRectF(-5, -5, self._width + 10, self._height + 10)

    def paint(
        self,
        painter: QPainter,
        option: QStyleOptionGraphicsItem,
        widget: QWidget = None,
    ):
        """Paint the node."""
        # Shadow
        painter.setBrush(QBrush(QColor(0, 0, 0, 40)))
        painter.setPen(Qt.NoPen)
        painter.drawRoundedRect(3, 3, self._width, self._height, 8, 8)

        # Body gradient
        gradient = QLinearGradient(0, 0, 0, self._height)
        gradient.setColorAt(0, QColor("#ffffff"))
        gradient.setColorAt(1, QColor("#f5f5f5"))
        painter.setBrush(QBrush(gradient))

        # Border
        if self.isSelected():
            painter.setPen(QPen(QColor("#1976D2"), 3))
        else:
            painter.setPen(QPen(QColor("#cccccc"), 1))

        painter.drawRoundedRect(0, 0, self._width, self._height, 8, 8)

        # Header
        painter.setBrush(QBrush(self._color))
        painter.setPen(Qt.NoPen)
        painter.drawRoundedRect(0, 0, self._width, self._header_height, 8, 8)
        painter.drawRect(0, self._header_height - 8, self._width, 8)

        # Title text (centered, larger font)
        painter.setPen(QPen(QColor("#ffffff")))
        font = QFont("Arial", 12, QFont.Bold)
        painter.setFont(font)
        title = self.node_data.component.name
        if len(title) > 20:
            title = title[:18] + "..."
        title_rect = QRectF(0, 0, self._width, self._header_height)
        painter.drawText(title_rect, Qt.AlignCenter, title)

        # Type indicator (centered at bottom, larger font)
        painter.setPen(QPen(QColor("#666666")))
        font = QFont("Arial", 10)
        painter.setFont(font)
        type_text = self.node_data.component.protocol_type.replace("_", " ").title()
        type_rect = QRectF(0, self._header_height, self._width, self._height - self._header_height)
        painter.drawText(type_rect, Qt.AlignCenter, type_text)

    def itemChange(self, change, value):
        """Handle item changes like position."""
        if change == QGraphicsItem.ItemPositionHasChanged:
            # Update node data
            pos = self.pos()
            self.node_data.x = pos.x()
            self.node_data.y = pos.y()
            self.signals.position_changed.emit(self.node_data.uuid, pos.x(), pos.y())

            # Notify scene to update connections
            scene = self.scene()
            if scene and hasattr(scene, "update_connections"):
                scene.update_connections(self)

        elif change == QGraphicsItem.ItemSelectedHasChanged:
            if value:
                self.signals.selected.emit(self.node_data)

        return super().itemChange(change, value)

    def get_input_port(self, name: str = "") -> PortItem | None:
        """Get the input connection point."""
        return self.input_ports[0] if self.input_ports else None

    def get_output_port(self, name: str = "") -> PortItem | None:
        """Get the output connection point."""
        return self.output_ports[0] if self.output_ports else None

    def get_first_input_port(self) -> PortItem | None:
        """Get the input connection point."""
        return self.input_ports[0] if self.input_ports else None

    def get_first_output_port(self) -> PortItem | None:
        """Get the output connection point."""
        return self.output_ports[0] if self.output_ports else None

    def get_left_center(self) -> QPointF:
        """Get the left center point in scene coordinates."""
        return self.mapToScene(QPointF(0, self._height / 2))

    def get_right_center(self) -> QPointF:
        """Get the right center point in scene coordinates."""
        return self.mapToScene(QPointF(self._width, self._height / 2))

    def get_top_center(self) -> QPointF:
        """Get the top center point in scene coordinates."""
        return self.mapToScene(QPointF(self._width / 2, 0))

    def get_bottom_center(self) -> QPointF:
        """Get the bottom center point in scene coordinates."""
        return self.mapToScene(QPointF(self._width / 2, self._height))

    def get_edge_point(self, side: str) -> QPointF:
        """Get the connection point for the specified side."""
        if side == "left":
            return self.get_left_center()
        if side == "right":
            return self.get_right_center()
        if side == "top":
            return self.get_top_center()
        if side == "bottom":
            return self.get_bottom_center()
        return self.get_right_center()  # Default
