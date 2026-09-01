"""Component browser tree widget for the left panel."""

import dataclasses
import json

from PySide6.QtCore import QByteArray, QMimeData, Qt
from PySide6.QtGui import QColor, QDrag, QIcon, QPainter, QPixmap
from PySide6.QtWidgets import (
    QAbstractItemView,
    QLabel,
    QLineEdit,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)

from ..models.node import ComponentDefinition
from .component_loader import ComponentLoader

# Display names for categories
CATEGORY_DISPLAY_NAMES = {
    "experimentalists": "Experimentalists",
    "theorists": "Theorists",
    "experiment_runners": "Experiment Runners",
    "controls": "Controls",
}

# Colors for categories
CATEGORY_COLORS = {
    "experimentalists": "#4CAF50",
    "theorists": "#2196F3",
    "experiment_runners": "#FF9800",
    "controls": "#9C27B0",
}


class DraggableTreeWidget(QTreeWidget):
    """Tree widget that supports dragging component items."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setDragEnabled(True)
        self.setDragDropMode(QAbstractItemView.DragOnly)

    def mimeTypes(self):
        """Return supported MIME types for drag."""
        return ["application/x-component"]

    def mimeData(self, items):
        """Create MIME data for dragged items."""
        mime_data = QMimeData()

        for item in items:
            component = item.data(0, Qt.UserRole)
            if isinstance(component, ComponentDefinition):
                data = json.dumps(dataclasses.asdict(component)).encode("utf-8")
                mime_data.setData("application/x-component", QByteArray(data))
                break  # Only handle first item

        return mime_data

    def startDrag(self, supportedActions):
        """Start drag with custom pixmap."""
        item = self.currentItem()
        if not item:
            return

        component = item.data(0, Qt.UserRole)
        if not isinstance(component, ComponentDefinition):
            return  # Don't drag category items

        # Create mime data
        mime_data = self.mimeData([item])

        # Create drag
        drag = QDrag(self)
        drag.setMimeData(mime_data)

        # Create drag pixmap
        pixmap = QPixmap(160, 30)
        pixmap.fill(QColor("#e3f2fd"))
        painter = QPainter(pixmap)
        painter.setPen(QColor("#1976D2"))
        painter.drawText(10, 20, component.name)
        painter.setPen(QColor("#1976D2"))
        painter.drawRect(0, 0, 159, 29)
        painter.end()
        drag.setPixmap(pixmap)
        drag.setHotSpot(pixmap.rect().center())

        drag.exec(Qt.CopyAction)


class ComponentBrowser(QWidget):
    """Browser widget showing available components in a tree."""

    def __init__(self, component_loader: ComponentLoader, parent=None):
        super().__init__(parent)
        self.component_loader = component_loader

        # Layout
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(5)

        # Header
        header = QLabel("Components")
        header.setStyleSheet("font-weight: bold; padding: 5px;")
        layout.addWidget(header)

        # Search box
        self.search_box = QLineEdit()
        self.search_box.setPlaceholderText("Search components...")
        self.search_box.textChanged.connect(self._filter_components)
        layout.addWidget(self.search_box)

        # Tree widget (custom draggable tree)
        self.tree = DraggableTreeWidget()
        self.tree.setHeaderHidden(True)
        self.tree.setSelectionMode(QAbstractItemView.SingleSelection)
        self.tree.setIndentation(20)
        self.tree.setAnimated(True)
        layout.addWidget(self.tree)

        # Style
        self.setMinimumWidth(200)

        # Populate tree
        self._populate_tree()

    def _populate_tree(self):
        """Populate the tree with components from the loader."""
        self.tree.clear()

        components_by_category = self.component_loader.load_all()

        for category, components in components_by_category.items():
            # Create category item
            category_item = QTreeWidgetItem(self.tree)
            display_name = CATEGORY_DISPLAY_NAMES.get(category, category.title())
            category_item.setText(0, f"{display_name} ({len(components)})")
            category_item.setFlags(category_item.flags() & ~Qt.ItemIsDragEnabled)

            # Style category
            color = CATEGORY_COLORS.get(category, "#666666")
            category_item.setForeground(0, QColor(color))

            # Add component items
            for component in components:
                comp_item = QTreeWidgetItem(category_item)
                comp_item.setText(0, component.name)
                comp_item.setToolTip(0, component.description)
                comp_item.setData(0, Qt.UserRole, component)

                # Add icon
                icon = self._create_color_icon(color)
                comp_item.setIcon(0, icon)

            # Expand by default
            category_item.setExpanded(True)

    def _create_color_icon(self, color: str, size: int = 12) -> QIcon:
        """Create a small colored circle icon."""
        pixmap = QPixmap(size, size)
        pixmap.fill(Qt.transparent)

        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setBrush(QColor(color))
        painter.setPen(Qt.NoPen)
        painter.drawEllipse(1, 1, size - 2, size - 2)
        painter.end()

        return QIcon(pixmap)

    def _filter_components(self, text: str):
        """Filter components based on search text."""
        text = text.lower()

        for i in range(self.tree.topLevelItemCount()):
            category_item = self.tree.topLevelItem(i)
            visible_count = 0

            for j in range(category_item.childCount()):
                comp_item = category_item.child(j)
                component: ComponentDefinition = comp_item.data(0, Qt.UserRole)

                # Check if matches search
                matches = text in component.name.lower() or text in component.description.lower()
                comp_item.setHidden(not matches)

                if matches:
                    visible_count += 1

            # Hide category if no visible children
            category_item.setHidden(visible_count == 0)
