"""Connection/arrow item for linking nodes."""
from PySide6.QtWidgets import QGraphicsPathItem, QGraphicsItem
from PySide6.QtCore import Qt, QPointF
from PySide6.QtGui import QPainter, QPen, QColor, QPainterPath, QPolygonF

from ..models.workflow import Connection
from .node_item import NodeItem, PortItem


class ConnectionItem(QGraphicsPathItem):
    """Visual representation of a connection between two nodes."""

    def __init__(
        self,
        connection: Connection,
        source_node: NodeItem,
        target_node: NodeItem,
        source_port: PortItem | None = None,
        target_port: PortItem | None = None,
        source_side: str = "right",
        target_side: str = "left",
        parent=None,
    ):
        super().__init__(parent)
        self.connection = connection
        self.source_node = source_node
        self.target_node = target_node
        self.source_port = source_port
        self.target_port = target_port
        self.source_side = source_side
        self.target_side = target_side

        # Visual settings
        self.setPen(QPen(QColor("#666666"), 2, Qt.SolidLine, Qt.RoundCap))
        self.setFlag(QGraphicsItem.ItemIsSelectable, True)
        self.setZValue(-1)  # Draw behind nodes

        # Initial path
        self.update_path()

    def _get_node_edge_point(self, node: NodeItem, side: str) -> QPointF:
        """Get the connection point on the specified side of a node."""
        return node.get_edge_point(side)

    def _get_control_point(self, point: QPointF, side: str, offset: float) -> QPointF:
        """Get control point for bezier curve based on side."""
        if side == "right":
            return QPointF(point.x() + offset, point.y())
        elif side == "left":
            return QPointF(point.x() - offset, point.y())
        elif side == "bottom":
            return QPointF(point.x(), point.y() + offset)
        elif side == "top":
            return QPointF(point.x(), point.y() - offset)
        return QPointF(point.x() + offset, point.y())  # Default

    def update_path(self):
        """Update the bezier path based on connected node positions."""
        start = self._get_node_edge_point(self.source_node, self.source_side)
        end = self._get_node_edge_point(self.target_node, self.target_side)

        # Create bezier curve with control points based on sides
        path = QPainterPath()
        path.moveTo(start)

        # Calculate control point offset based on distance
        dx = abs(end.x() - start.x())
        dy = abs(end.y() - start.y())
        ctrl_offset = max(max(dx, dy) * 0.4, 50)

        # Get control points based on sides
        ctrl1 = self._get_control_point(start, self.source_side, ctrl_offset)
        ctrl2 = self._get_control_point(end, self.target_side, ctrl_offset)

        path.cubicTo(ctrl1, ctrl2, end)
        self.setPath(path)

    def paint(self, painter: QPainter, option, widget=None):
        """Paint the connection with an arrow head."""
        # Draw the path
        if self.isSelected():
            painter.setPen(QPen(QColor("#1976D2"), 3, Qt.SolidLine, Qt.RoundCap))
        else:
            painter.setPen(QPen(QColor("#666666"), 2, Qt.SolidLine, Qt.RoundCap))

        painter.drawPath(self.path())

        # Draw arrow head at the end
        end = self._get_node_edge_point(self.target_node, self.target_side)

        # Calculate arrow direction from path
        path = self.path()
        if path.length() > 0:
            # Get point near the end to determine direction
            t = 0.95
            point_near_end = path.pointAtPercent(t)
            dx = end.x() - point_near_end.x()
            dy = end.y() - point_near_end.y()

            # Normalize
            length = (dx * dx + dy * dy) ** 0.5
            if length > 0:
                dx /= length
                dy /= length

                # Arrow head points
                arrow_size = 10
                arrow_angle = 0.5  # ~30 degrees

                p1 = QPointF(
                    end.x() - arrow_size * (dx + arrow_angle * dy),
                    end.y() - arrow_size * (dy - arrow_angle * dx),
                )
                p2 = QPointF(
                    end.x() - arrow_size * (dx - arrow_angle * dy),
                    end.y() - arrow_size * (dy + arrow_angle * dx),
                )

                # Draw arrow head
                arrow = QPolygonF([end, p1, p2])
                painter.setBrush(QColor("#666666") if not self.isSelected() else QColor("#1976D2"))
                painter.drawPolygon(arrow)


class TempConnectionItem(QGraphicsPathItem):
    """Temporary connection while dragging to create a new connection."""

    def __init__(self, start_pos: QPointF, parent=None):
        super().__init__(parent)
        self.start_pos = start_pos
        self.end_pos = start_pos
        self.start_side = "right"  # Default

        # Dashed line for temp connection
        pen = QPen(QColor("#999999"), 2, Qt.DashLine, Qt.RoundCap)
        self.setPen(pen)
        self.setZValue(-1)

    def set_start_side(self, side: str):
        """Set which side the connection starts from."""
        self.start_side = side

    def update_end(self, end_pos: QPointF):
        """Update the end position of the temporary connection."""
        self.end_pos = end_pos
        self._update_path()

    def _get_control_point(self, point: QPointF, side: str, offset: float) -> QPointF:
        """Get control point for bezier curve based on side."""
        if side == "right":
            return QPointF(point.x() + offset, point.y())
        elif side == "left":
            return QPointF(point.x() - offset, point.y())
        elif side == "bottom":
            return QPointF(point.x(), point.y() + offset)
        elif side == "top":
            return QPointF(point.x(), point.y() - offset)
        return QPointF(point.x() + offset, point.y())  # Default

    def _guess_end_side(self) -> str:
        """Guess the end side based on relative positions."""
        dx = self.end_pos.x() - self.start_pos.x()
        dy = self.end_pos.y() - self.start_pos.y()

        # Determine primary direction
        if abs(dx) > abs(dy):
            # Horizontal movement dominant
            return "left" if dx > 0 else "right"
        else:
            # Vertical movement dominant
            return "top" if dy > 0 else "bottom"

    def _update_path(self):
        """Update the bezier path."""
        path = QPainterPath()
        path.moveTo(self.start_pos)

        dx = abs(self.end_pos.x() - self.start_pos.x())
        dy = abs(self.end_pos.y() - self.start_pos.y())
        ctrl_offset = max(max(dx, dy) * 0.4, 50)

        # Control point for start side
        ctrl1 = self._get_control_point(self.start_pos, self.start_side, ctrl_offset)

        # Guess end side and get control point
        end_side = self._guess_end_side()
        ctrl2 = self._get_control_point(self.end_pos, end_side, ctrl_offset)

        path.cubicTo(ctrl1, ctrl2, self.end_pos)
        self.setPath(path)
