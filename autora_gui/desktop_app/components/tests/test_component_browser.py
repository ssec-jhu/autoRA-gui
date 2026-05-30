"""Tests for ComponentBrowser and DraggableTreeWidget classes."""

import dataclasses
import json

import pytest
from PySide6.QtCore import QByteArray, QMimeData, Qt
from PySide6.QtWidgets import QAbstractItemView, QApplication, QTreeWidgetItem

from autora_gui.desktop_app.components.component_browser import (
    CATEGORY_COLORS,
    CATEGORY_DISPLAY_NAMES,
    ComponentBrowser,
    DraggableTreeWidget,
)
from autora_gui.desktop_app.components.component_loader import ComponentLoader
from autora_gui.desktop_app.models.node import ComponentDefinition


@pytest.fixture(scope="module")
def app():
    """Create QApplication instance for tests."""
    app = QApplication.instance()
    if app is None:
        app = QApplication([])
    yield app


@pytest.fixture
def temp_components_dir(tmp_path):
    """Create a temporary components directory with test JSON files."""
    (tmp_path / "experimentalists").mkdir()
    (tmp_path / "theorists").mkdir()

    exp1 = {
        "uuid": "exp-1",
        "protocolType": "experimentalist",
        "name": "Novelty Sampler",
        "description": "Samples novel conditions",
        "githubCommit": "abc123",
    }
    with open(tmp_path / "experimentalists" / "novelty.json", "w") as f:
        json.dump(exp1, f)

    exp2 = {
        "uuid": "exp-2",
        "protocolType": "experimentalist",
        "name": "Random Sampler",
        "description": "Random sampling strategy",
        "githubCommit": "abc123",
    }
    with open(tmp_path / "experimentalists" / "random.json", "w") as f:
        json.dump(exp2, f)

    theo1 = {
        "uuid": "theo-1",
        "protocolType": "theorist",
        "name": "BMS Regressor",
        "description": "Bayesian Machine Scientist",
        "githubCommit": "def456",
    }
    with open(tmp_path / "theorists" / "bms.json", "w") as f:
        json.dump(theo1, f)

    return tmp_path


@pytest.fixture
def component_loader(temp_components_dir):
    """Create a ComponentLoader with test data."""
    loader = ComponentLoader(temp_components_dir)
    loader.load_all()
    return loader


@pytest.fixture
def sample_component():
    """Create a sample component definition."""
    return ComponentDefinition(
        uuid="test-uuid",
        protocol_type="experimentalist",
        name="Test Component",
        description="A test component",
        github_commit="abc123",
        parameters=[],
        input_ports=[],
        output_ports=[],
        file_path="test.json",
    )


class TestCategoryConstants:
    """Tests for category display names and colors."""

    def test_category_display_names_experimentalists(self):
        """Test display name for experimentalists."""
        assert CATEGORY_DISPLAY_NAMES["experimentalists"] == "Experimentalists"

    def test_category_display_names_theorists(self):
        """Test display name for theorists."""
        assert CATEGORY_DISPLAY_NAMES["theorists"] == "Theorists"

    def test_category_display_names_experiment_runners(self):
        """Test display name for experiment_runners."""
        assert CATEGORY_DISPLAY_NAMES["experiment_runners"] == "Experiment Runners"

    def test_category_display_names_controls(self):
        """Test display name for controls."""
        assert CATEGORY_DISPLAY_NAMES["controls"] == "Controls"

    def test_category_colors_experimentalists(self):
        """Test color for experimentalists."""
        assert CATEGORY_COLORS["experimentalists"] == "#4CAF50"

    def test_category_colors_theorists(self):
        """Test color for theorists."""
        assert CATEGORY_COLORS["theorists"] == "#2196F3"

    def test_category_colors_experiment_runners(self):
        """Test color for experiment_runners."""
        assert CATEGORY_COLORS["experiment_runners"] == "#FF9800"

    def test_category_colors_controls(self):
        """Test color for controls."""
        assert CATEGORY_COLORS["controls"] == "#9C27B0"


class TestDraggableTreeWidget:
    """Tests for DraggableTreeWidget class."""

    def test_init(self, app):
        """Test DraggableTreeWidget initialization."""
        tree = DraggableTreeWidget()

        assert tree.dragEnabled()
        assert tree.dragDropMode() == QAbstractItemView.DragOnly

    def test_mime_types(self, app):
        """Test mimeTypes returns correct MIME type."""
        tree = DraggableTreeWidget()

        mime_types = tree.mimeTypes()

        assert "application/x-component" in mime_types

    def test_mime_data_with_component(self, app, sample_component):
        """Test mimeData creates correct data for component item."""
        tree = DraggableTreeWidget()

        # Create item with component data
        item = QTreeWidgetItem(tree)
        item.setData(0, Qt.UserRole, sample_component)

        # Get mime data
        mime_data = tree.mimeData([item])

        assert mime_data.hasFormat("application/x-component")

        # Verify the data can be deserialized
        data = bytes(mime_data.data("application/x-component"))
        component_dict = json.loads(data.decode("utf-8"))

        assert component_dict["uuid"] == "test-uuid"
        assert component_dict["name"] == "Test Component"

    def test_mime_data_without_component(self, app):
        """Test mimeData handles items without component data."""
        tree = DraggableTreeWidget()

        # Create item without component data
        item = QTreeWidgetItem(tree)
        item.setText(0, "Category")

        # Get mime data
        mime_data = tree.mimeData([item])

        # Should not have component data
        assert not mime_data.hasFormat("application/x-component")

    def test_mime_data_only_first_item(self, app, sample_component):
        """Test mimeData only handles first item."""
        tree = DraggableTreeWidget()

        # Create two items with component data
        item1 = QTreeWidgetItem(tree)
        item1.setData(0, Qt.UserRole, sample_component)

        component2 = ComponentDefinition(
            uuid="second-uuid",
            protocol_type="theorist",
            name="Second Component",
            description="",
            github_commit="",
        )
        item2 = QTreeWidgetItem(tree)
        item2.setData(0, Qt.UserRole, component2)

        # Get mime data for both items
        mime_data = tree.mimeData([item1, item2])

        # Should only contain first component
        data = bytes(mime_data.data("application/x-component"))
        component_dict = json.loads(data.decode("utf-8"))

        assert component_dict["uuid"] == "test-uuid"

    def test_start_drag_no_current_item(self, app):
        """Test startDrag does nothing without current item."""
        tree = DraggableTreeWidget()

        # Should not raise an error
        tree.startDrag(Qt.CopyAction)

    def test_start_drag_category_item_no_drag(self, app):
        """Test startDrag doesn't drag category items."""
        tree = DraggableTreeWidget()

        # Create category item (no component data)
        item = QTreeWidgetItem(tree)
        item.setText(0, "Category")
        tree.setCurrentItem(item)

        # Should not raise an error (returns early)
        tree.startDrag(Qt.CopyAction)


class TestComponentBrowser:
    """Tests for ComponentBrowser class."""

    def test_init(self, app, component_loader):
        """Test ComponentBrowser initialization."""
        browser = ComponentBrowser(component_loader)

        assert browser.component_loader == component_loader
        assert browser.minimumWidth() == 200

    def test_has_search_box(self, app, component_loader):
        """Test browser has search box."""
        browser = ComponentBrowser(component_loader)

        assert browser.search_box is not None
        assert browser.search_box.placeholderText() == "Search components..."

    def test_has_tree_widget(self, app, component_loader):
        """Test browser has tree widget."""
        browser = ComponentBrowser(component_loader)

        assert browser.tree is not None
        assert isinstance(browser.tree, DraggableTreeWidget)

    def test_tree_is_header_hidden(self, app, component_loader):
        """Test tree header is hidden."""
        browser = ComponentBrowser(component_loader)

        assert browser.tree.isHeaderHidden()

    def test_tree_selection_mode(self, app, component_loader):
        """Test tree selection mode."""
        browser = ComponentBrowser(component_loader)

        assert browser.tree.selectionMode() == QAbstractItemView.SingleSelection

    def test_tree_populated_with_categories(self, app, component_loader):
        """Test tree is populated with categories."""
        browser = ComponentBrowser(component_loader)

        # Should have 2 top-level items (experimentalists, theorists)
        assert browser.tree.topLevelItemCount() == 2

    def test_tree_category_has_count(self, app, component_loader):
        """Test category items show component count."""
        browser = ComponentBrowser(component_loader)

        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            text = category_item.text(0)

            # Should have format "Name (count)"
            assert "(" in text
            assert ")" in text

    def test_tree_categories_expanded(self, app, component_loader):
        """Test categories are expanded by default."""
        browser = ComponentBrowser(component_loader)

        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            assert category_item.isExpanded()

    def test_tree_component_items_have_tooltips(self, app, component_loader):
        """Test component items have description tooltips."""
        browser = ComponentBrowser(component_loader)

        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            for j in range(category_item.childCount()):
                comp_item = category_item.child(j)
                assert comp_item.toolTip(0) != ""

    def test_tree_component_items_have_data(self, app, component_loader):
        """Test component items have ComponentDefinition data."""
        browser = ComponentBrowser(component_loader)

        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            for j in range(category_item.childCount()):
                comp_item = category_item.child(j)
                data = comp_item.data(0, Qt.UserRole)
                assert isinstance(data, ComponentDefinition)

    def test_tree_component_items_have_icons(self, app, component_loader):
        """Test component items have icons."""
        browser = ComponentBrowser(component_loader)

        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            for j in range(category_item.childCount()):
                comp_item = category_item.child(j)
                icon = comp_item.icon(0)
                assert not icon.isNull()

    def test_tree_category_not_draggable(self, app, component_loader):
        """Test category items are not draggable."""
        browser = ComponentBrowser(component_loader)

        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            # ItemIsDragEnabled should be disabled
            assert not (category_item.flags() & Qt.ItemIsDragEnabled)


class TestComponentBrowserFiltering:
    """Tests for component filtering functionality."""

    def test_filter_by_name(self, app, component_loader):
        """Test filtering by component name."""
        browser = ComponentBrowser(component_loader)

        # Filter for "novelty"
        browser._filter_components("novelty")

        # Count visible items
        visible_count = 0
        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            if not category_item.isHidden():
                for j in range(category_item.childCount()):
                    comp_item = category_item.child(j)
                    if not comp_item.isHidden():
                        visible_count += 1

        assert visible_count == 1

    def test_filter_by_description(self, app, component_loader):
        """Test filtering by component description."""
        browser = ComponentBrowser(component_loader)

        # Filter for "bayesian" (in BMS description)
        browser._filter_components("bayesian")

        # Find visible items
        visible_items = []
        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            for j in range(category_item.childCount()):
                comp_item = category_item.child(j)
                if not comp_item.isHidden():
                    visible_items.append(comp_item.text(0))

        assert "BMS Regressor" in visible_items

    def test_filter_case_insensitive(self, app, component_loader):
        """Test filtering is case insensitive."""
        browser = ComponentBrowser(component_loader)

        # Filter with different cases
        browser._filter_components("NOVELTY")

        visible_count = 0
        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            if not category_item.isHidden():
                for j in range(category_item.childCount()):
                    if not category_item.child(j).isHidden():
                        visible_count += 1

        assert visible_count == 1

    def test_filter_hides_empty_categories(self, app, component_loader):
        """Test that categories with no matches are hidden."""
        browser = ComponentBrowser(component_loader)

        # Filter for "bms" - only in theorists
        browser._filter_components("bms")

        # Find category visibility
        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            text = category_item.text(0)

            if "Experimentalists" in text:
                # Should be hidden (no BMS in experimentalists)
                assert category_item.isHidden()
            elif "Theorists" in text:
                # Should be visible
                assert not category_item.isHidden()

    def test_filter_empty_string_shows_all(self, app, component_loader):
        """Test that empty filter shows all items."""
        browser = ComponentBrowser(component_loader)

        # First filter
        browser._filter_components("novelty")

        # Then clear filter
        browser._filter_components("")

        # All items should be visible
        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            assert not category_item.isHidden()
            for j in range(category_item.childCount()):
                assert not category_item.child(j).isHidden()

    def test_filter_no_matches(self, app, component_loader):
        """Test filtering with no matches."""
        browser = ComponentBrowser(component_loader)

        browser._filter_components("nonexistent_component_xyz")

        # All categories should be hidden
        for i in range(browser.tree.topLevelItemCount()):
            category_item = browser.tree.topLevelItem(i)
            assert category_item.isHidden()


class TestComponentBrowserCreateColorIcon:
    """Tests for _create_color_icon method."""

    def test_create_color_icon_returns_icon(self, app, component_loader):
        """Test _create_color_icon returns a QIcon."""
        from PySide6.QtGui import QIcon

        browser = ComponentBrowser(component_loader)

        icon = browser._create_color_icon("#FF0000")

        assert isinstance(icon, QIcon)
        assert not icon.isNull()

    def test_create_color_icon_default_size(self, app, component_loader):
        """Test _create_color_icon uses default size."""
        browser = ComponentBrowser(component_loader)

        icon = browser._create_color_icon("#00FF00")

        # Get pixmap from icon to check size
        sizes = icon.availableSizes()
        assert len(sizes) > 0
        assert sizes[0].width() == 12
        assert sizes[0].height() == 12

    def test_create_color_icon_custom_size(self, app, component_loader):
        """Test _create_color_icon with custom size."""
        browser = ComponentBrowser(component_loader)

        icon = browser._create_color_icon("#0000FF", size=20)

        sizes = icon.availableSizes()
        assert len(sizes) > 0
        assert sizes[0].width() == 20
        assert sizes[0].height() == 20


class TestComponentBrowserPopulateTree:
    """Tests for _populate_tree method."""

    def test_populate_tree_clears_existing(self, app, component_loader):
        """Test _populate_tree clears existing items."""
        browser = ComponentBrowser(component_loader)

        # Get initial count
        initial_count = browser.tree.topLevelItemCount()

        # Populate again
        browser._populate_tree()

        # Count should be same (not doubled)
        assert browser.tree.topLevelItemCount() == initial_count

    def test_populate_tree_uses_display_names(self, app, component_loader):
        """Test _populate_tree uses display names for categories."""
        browser = ComponentBrowser(component_loader)

        category_texts = []
        for i in range(browser.tree.topLevelItemCount()):
            category_texts.append(browser.tree.topLevelItem(i).text(0))

        # Should have "Experimentalists" not "experimentalists"
        assert any("Experimentalists" in text for text in category_texts)
        assert any("Theorists" in text for text in category_texts)
