"""Canvas scene for managing nodes and connections."""

from PySide6.QtCore import QPointF, Qt, Signal
from PySide6.QtGui import QColor
from PySide6.QtWidgets import QGraphicsScene, QGraphicsSceneMouseEvent

from ..models.node import ComponentDefinition, NodeData
from ..models.workflow import Connection, Workflow
from .connection_item import ConnectionItem, TempConnectionItem
from .node_item import NodeItem, PortItem


class CanvasScene(QGraphicsScene):
    """Scene for the node-based workflow canvas."""

    node_selected = Signal(object)  # Emits NodeData or None
    workflow_modified = Signal()  # Emitted when workflow changes

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setSceneRect(-5000, -5000, 10000, 10000)
        self.setBackgroundBrush(QColor("#f8f8f8"))

        # Track items
        self._node_items: dict[str, NodeItem] = {}  # uuid -> NodeItem
        self._connection_items: dict[str, ConnectionItem] = {}  # uuid -> ConnectionItem

        # Connection creation state
        self._temp_connection: TempConnectionItem | None = None
        self._connection_start_port: PortItem | None = None
        self._connection_start_node: NodeItem | None = None
        self._connection_start_side: str = "right"  # "left" or "right"

        # Workflow reference
        self._workflow: Workflow | None = None

    def set_workflow(self, workflow: Workflow):
        """Set and display a workflow."""
        self.clear_all()
        self._workflow = workflow

        # Create node items
        for node_data in workflow.nodes:
            self._create_node_item(node_data)

        # Create connection items
        for connection in workflow.connections:
            self._create_connection_item(connection)

    def clear_all(self):
        """Remove all items from the scene."""
        self.clear()
        self._node_items.clear()
        self._connection_items.clear()
        self._temp_connection = None
        self._connection_start_port = None
        self._connection_start_node = None

    def _create_node_item(self, node_data: NodeData) -> NodeItem:
        """Create and add a node item to the scene."""
        node_item = NodeItem(node_data)
        node_item.signals.selected.connect(self._on_node_selected)
        self.addItem(node_item)
        self._node_items[node_data.uuid] = node_item
        return node_item

    def _create_connection_item(self, connection: Connection) -> ConnectionItem | None:
        """Create and add a connection item to the scene."""
        source_node = self._node_items.get(connection.source_node_id)
        target_node = self._node_items.get(connection.target_node_id)

        if not source_node or not target_node:
            return None

        # Get specific ports or use defaults
        source_port = source_node.get_output_port(connection.source_port)
        target_port = target_node.get_input_port(connection.target_port)

        conn_item = ConnectionItem(connection, source_node, target_node, source_port, target_port)
        self.addItem(conn_item)
        self._connection_items[connection.uuid] = conn_item
        return conn_item

    def add_node(self, component: ComponentDefinition, x: float, y: float) -> NodeItem:
        """Add a new node to the scene from a component definition."""
        node_data = NodeData.create(component, x, y)

        if self._workflow:
            self._workflow.add_node(node_data)

        node_item = self._create_node_item(node_data)
        self.workflow_modified.emit()
        return node_item

    def remove_selected(self):
        """Remove selected nodes and connections."""
        for item in self.selectedItems():
            if isinstance(item, NodeItem):
                self._remove_node(item)
            elif isinstance(item, ConnectionItem):
                self._remove_connection(item)

        self.workflow_modified.emit()

    def _remove_node(self, node_item: NodeItem):
        """Remove a node and its connections."""
        node_id = node_item.node_data.uuid

        # Remove connected connections
        connections_to_remove = [
            conn_item
            for conn_item in self._connection_items.values()
            if conn_item.source_node == node_item or conn_item.target_node == node_item
        ]
        for conn_item in connections_to_remove:
            self._remove_connection(conn_item)

        # Remove from workflow
        if self._workflow:
            self._workflow.remove_node(node_id)

        # Remove from scene
        self.removeItem(node_item)
        del self._node_items[node_id]

    def _remove_connection(self, conn_item: ConnectionItem):
        """Remove a connection."""
        conn_id = conn_item.connection.uuid

        if self._workflow:
            self._workflow.remove_connection(conn_id)

        self.removeItem(conn_item)
        if conn_id in self._connection_items:
            del self._connection_items[conn_id]

    def update_connections(self, node_item: NodeItem):
        """Update all connections attached to a node."""
        for conn_item in self._connection_items.values():
            if conn_item.source_node == node_item or conn_item.target_node == node_item:
                conn_item.update_path()

    def _on_node_selected(self, node_data: NodeData):
        """Handle node selection."""
        self.node_selected.emit(node_data)

    # Connection creation via mouse events

    def start_connection(self, node_item: NodeItem, port_item: PortItem):
        """Start creating a new connection from a port."""
        if port_item.port_type != "output":
            return  # Can only start from output ports

        self._connection_start_node = node_item
        self._connection_start_port = port_item

        start_pos = port_item.get_center_scene_pos()
        self._temp_connection = TempConnectionItem(start_pos)
        self.addItem(self._temp_connection)

    def update_temp_connection(self, scene_pos: QPointF):
        """Update temporary connection end point."""
        if self._temp_connection:
            self._temp_connection.update_end(scene_pos)

    def finish_connection(self, target_node: NodeItem, target_port: PortItem) -> bool:
        """Finish creating a connection to a target port."""
        return self.finish_connection_with_sides(target_node, "left")

    def finish_connection_with_sides(self, target_node: NodeItem, target_side: str) -> bool:
        """Finish creating a connection with specified sides."""
        if not self._temp_connection or not self._connection_start_node:
            self._cancel_connection()
            return False

        # Don't connect to self
        if target_node == self._connection_start_node:
            self._cancel_connection()
            return False

        # Create the connection with side information
        connection = Connection.create(
            self._connection_start_node.node_data.uuid,
            target_node.node_data.uuid,
            self._connection_start_side,  # Store source side
            target_side,  # Store target side
        )

        if self._workflow:
            self._workflow.add_connection(connection)

        self._create_connection_item_with_sides(connection, self._connection_start_side, target_side)
        self._cancel_connection()
        self.workflow_modified.emit()
        return True

    def _create_connection_item_with_sides(
        self, connection: Connection, source_side: str, target_side: str
    ) -> ConnectionItem | None:
        """Create connection item with specified sides."""
        source_node = self._node_items.get(connection.source_node_id)
        target_node = self._node_items.get(connection.target_node_id)

        if not source_node or not target_node:
            return None

        conn_item = ConnectionItem(
            connection, source_node, target_node, source_side=source_side, target_side=target_side
        )
        self.addItem(conn_item)
        self._connection_items[connection.uuid] = conn_item
        return conn_item

    def _cancel_connection(self):
        """Cancel connection creation."""
        if self._temp_connection:
            self.removeItem(self._temp_connection)
            self._temp_connection = None
        self._connection_start_node = None
        self._connection_start_port = None

    def _find_node_at(self, scene_pos: QPointF) -> NodeItem | None:
        """Find a node item at the given scene position."""
        items = self.items(scene_pos)
        for item in items:
            if isinstance(item, NodeItem):
                return item
        return None

    def _get_closest_side_and_distance(self, node: NodeItem, scene_pos: QPointF) -> tuple[str, float]:
        """Determine which side of the node is closest and the distance to it."""
        local_pos = node.mapFromScene(scene_pos)
        x, y = local_pos.x(), local_pos.y()
        w, h = node._width, node._height

        # Calculate distance to each edge
        dist_left = x
        dist_right = w - x
        dist_top = y
        dist_bottom = h - y

        # Find the minimum distance
        min_dist = min(dist_left, dist_right, dist_top, dist_bottom)

        if min_dist == dist_left:
            return "left", min_dist
        if min_dist == dist_right:
            return "right", min_dist
        if min_dist == dist_top:
            return "top", min_dist
        return "bottom", min_dist

    def _get_closest_side(self, node: NodeItem, scene_pos: QPointF) -> str:
        """Determine which side of the node is closest to the given position."""
        side, _ = self._get_closest_side_and_distance(node, scene_pos)
        return side

    def _get_connection_start_pos(self, node: NodeItem, side: str) -> QPointF:
        """Get the connection start position based on side."""
        return node.get_edge_point(side)

    def mousePressEvent(self, event: QGraphicsSceneMouseEvent):
        """Handle mouse press - start connection from edge, or allow node move from center."""
        scene_pos = event.scenePos()
        node = self._find_node_at(scene_pos)

        if node:
            # Check if click is near an edge (within threshold) or in center
            side, distance = self._get_closest_side_and_distance(node, scene_pos)
            edge_threshold = 15  # Pixels from edge to trigger connection

            if distance <= edge_threshold:
                # Near edge - start connection
                self._connection_start_side = side
                self._connection_start_node = node

                start_pos = self._get_connection_start_pos(node, side)
                self._temp_connection = TempConnectionItem(start_pos)
                self._temp_connection.set_start_side(side)
                self.addItem(self._temp_connection)
                event.accept()
                return
            # else: in center - let default behavior handle node movement

        # Clear selection if clicking empty area
        if not self.items(scene_pos):
            self.node_selected.emit(None)

        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QGraphicsSceneMouseEvent):
        """Handle mouse move - update connection line."""
        if self._temp_connection:
            self.update_temp_connection(event.scenePos())
            event.accept()
            return

        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event: QGraphicsSceneMouseEvent):
        """Handle mouse release - complete or cancel connection."""
        if self._temp_connection:
            scene_pos = event.scenePos()
            target_node = self._find_node_at(scene_pos)

            # Complete connection if releasing on a different node
            if target_node and target_node != self._connection_start_node:
                # Determine which side of target to connect to
                target_side = self._get_closest_side(target_node, scene_pos)
                self.finish_connection_with_sides(target_node, target_side)
            else:
                self._cancel_connection()

            event.accept()
            return

        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event: QGraphicsSceneMouseEvent):
        """Handle double-click - select node for property editing."""
        scene_pos = event.scenePos()
        node = self._find_node_at(scene_pos)

        if node:
            # Cancel any pending connection
            self._cancel_connection()
            # Select the node and emit signal for property panel
            node.setSelected(True)
            self.node_selected.emit(node.node_data)
            event.accept()
            return

        super().mouseDoubleClickEvent(event)

    def keyPressEvent(self, event):
        """Handle key presses."""
        if event.key() == Qt.Key_Delete or event.key() == Qt.Key_Backspace:
            self.remove_selected()
            event.accept()
            return

        super().keyPressEvent(event)

    def get_workflow(self) -> Workflow | None:
        """Get the current workflow."""
        return self._workflow
