"""Canvas view with pan and zoom support."""

import json

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QDragEnterEvent, QDropEvent, QMouseEvent, QPainter, QWheelEvent
from PySide6.QtWidgets import QGraphicsView, QWidget

from ..models.node import ComponentDefinition, ParameterDef, PortDef
from .canvas_scene import CanvasScene


class CanvasView(QGraphicsView):
    """View for the node canvas with pan and zoom."""

    component_dropped = Signal(object, float, float)  # ComponentDefinition, x, y

    def __init__(self, scene: CanvasScene, parent: QWidget = None):
        super().__init__(scene, parent)
        self._scene = scene

        # View settings
        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
        self.setViewportUpdateMode(QGraphicsView.FullViewportUpdate)
        self.setDragMode(QGraphicsView.RubberBandDrag)
        self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)
        self.setResizeAnchor(QGraphicsView.AnchorUnderMouse)

        # Enable drop
        self.setAcceptDrops(True)

        # Pan state
        self._panning = False
        self._pan_start_x = 0
        self._pan_start_y = 0

        # Zoom limits
        self._zoom_factor = 1.0
        self._zoom_min = 0.1
        self._zoom_max = 3.0

    def wheelEvent(self, event: QWheelEvent):
        """Handle zoom with mouse wheel."""
        # Zoom factor
        zoom_in_factor = 1.15
        zoom_out_factor = 1 / zoom_in_factor

        # Calculate zoom
        if event.angleDelta().y() > 0:
            factor = zoom_in_factor
        else:
            factor = zoom_out_factor

        # Check limits
        new_zoom = self._zoom_factor * factor
        if new_zoom < self._zoom_min or new_zoom > self._zoom_max:
            return

        self._zoom_factor = new_zoom
        self.scale(factor, factor)

    def mousePressEvent(self, event: QMouseEvent):
        """Handle mouse press for panning."""
        if event.button() == Qt.MiddleButton:
            self._panning = True
            self._pan_start_x = event.position().x()
            self._pan_start_y = event.position().y()
            self.setCursor(Qt.ClosedHandCursor)
            event.accept()
            return

        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent):
        """Handle mouse move for panning."""
        if self._panning:
            delta_x = event.position().x() - self._pan_start_x
            delta_y = event.position().y() - self._pan_start_y
            self._pan_start_x = event.position().x()
            self._pan_start_y = event.position().y()

            # Pan the view
            self.horizontalScrollBar().setValue(int(self.horizontalScrollBar().value() - delta_x))
            self.verticalScrollBar().setValue(int(self.verticalScrollBar().value() - delta_y))
            event.accept()
            return

        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event: QMouseEvent):
        """Handle mouse release for panning."""
        if event.button() == Qt.MiddleButton and self._panning:
            self._panning = False
            self.setCursor(Qt.ArrowCursor)
            event.accept()
            return

        super().mouseReleaseEvent(event)

    def dragEnterEvent(self, event: QDragEnterEvent):
        """Accept drag events with component data."""
        if event.mimeData().hasFormat("application/x-component"):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dragMoveEvent(self, event):
        """Handle drag move."""
        if event.mimeData().hasFormat("application/x-component"):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event: QDropEvent):
        """Handle component drop onto canvas."""
        if event.mimeData().hasFormat("application/x-component"):
            # Get drop position in scene coordinates
            scene_pos = self.mapToScene(event.position().toPoint())

            # Get component data from mime data
            data = event.mimeData().data("application/x-component")
            component_dict = json.loads(bytes(data).decode("utf-8"))
            component = ComponentDefinition(
                uuid=component_dict["uuid"],
                protocol_type=component_dict["protocol_type"],
                name=component_dict["name"],
                description=component_dict["description"],
                github_commit=component_dict["github_commit"],
                parameters=[ParameterDef(**p) for p in component_dict["parameters"]],
                input_ports=[PortDef(**p) for p in component_dict["input_ports"]],
                output_ports=[PortDef(**p) for p in component_dict["output_ports"]],
                file_path=component_dict.get("file_path", ""),
            )

            # Emit signal for main window to handle
            self.component_dropped.emit(component, scene_pos.x(), scene_pos.y())
            event.acceptProposedAction()
        else:
            event.ignore()

    def fit_in_view(self):
        """Fit all items in view."""
        items_rect = self._scene.itemsBoundingRect()
        if not items_rect.isEmpty():
            self.fitInView(items_rect, Qt.KeepAspectRatio)
            # Update zoom factor
            self._zoom_factor = self.transform().m11()

    def reset_zoom(self):
        """Reset zoom to 100%."""
        self.resetTransform()
        self._zoom_factor = 1.0

    def center_on_origin(self):
        """Center view on origin (0, 0)."""
        self.centerOn(0, 0)
