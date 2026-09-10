"""Tests for component loader."""

import json
from pathlib import Path

import pytest

from autora_gui.desktop_app.components.component_loader import ComponentLoader, get_default_components_dir


@pytest.fixture
def temp_components_dir(tmp_path):
    """Create a temporary components directory with test JSON files."""
    # Create category folders
    (tmp_path / "experimentalists").mkdir()
    (tmp_path / "theorists").mkdir()
    (tmp_path / "experiment_runners").mkdir()

    # Create test component files
    exp1 = {
        "uuid": "exp-1",
        "protocolType": "experimentalist",
        "name": "Test Experimentalist",
        "description": "A test experimentalist",
        "githubCommit": "abc123",
        "parameters": [{"name": "n_samples", "datatype": "integer", "default": 10}],
        "inputDataType": [{"name": "data", "datatype": "object"}],
        "outputDataType": [{"name": "conditions", "datatype": "object"}],
    }
    with open(tmp_path / "experimentalists" / "exp1.json", "w") as f:
        json.dump(exp1, f)

    theo1 = {
        "uuid": "theo-1",
        "protocolType": "theorist",
        "name": "Test Theorist",
        "description": "A test theorist",
        "githubCommit": "def456",
    }
    with open(tmp_path / "theorists" / "theo1.json", "w") as f:
        json.dump(theo1, f)

    theo2 = {
        "uuid": "theo-2",
        "protocolType": "theorist",
        "name": "Another Theorist",
        "description": "Another test",
        "githubCommit": "ghi789",
    }
    with open(tmp_path / "theorists" / "theo2.json", "w") as f:
        json.dump(theo2, f)

    return tmp_path


class TestComponentLoader:
    """Tests for ComponentLoader class."""

    def test_init(self, temp_components_dir):
        loader = ComponentLoader(temp_components_dir)
        assert loader.components_dir == temp_components_dir

    def test_load_all(self, temp_components_dir):
        loader = ComponentLoader(temp_components_dir)
        components = loader.load_all()

        assert "experimentalists" in components
        assert "theorists" in components
        assert len(components["experimentalists"]) == 1
        assert len(components["theorists"]) == 2

    def test_loaded_component_data(self, temp_components_dir):
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        exp_comps = loader.get_by_category("experimentalists")
        assert len(exp_comps) == 1
        assert exp_comps[0].name == "Test Experimentalist"
        assert exp_comps[0].uuid == "exp-1"
        assert len(exp_comps[0].parameters) == 1
        assert exp_comps[0].parameters[0].name == "n_samples"

    def test_get_by_category(self, temp_components_dir):
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        theorists = loader.get_by_category("theorists")
        assert len(theorists) == 2
        names = {t.name for t in theorists}
        assert "Test Theorist" in names
        assert "Another Theorist" in names

    def test_get_by_category_empty(self, temp_components_dir):
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        # No experiment_runners in test data
        runners = loader.get_by_category("experiment_runners")
        assert runners == []

    def test_get_by_file_path(self, temp_components_dir):
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        # Test with relative path
        comp = loader.get_by_file_path("experimentalists/exp1.json")
        assert comp is not None
        assert comp.name == "Test Experimentalist"

        # Test with filename only
        comp = loader.get_by_file_path("exp1.json")
        assert comp is not None
        assert comp.name == "Test Experimentalist"

    def test_get_by_file_path_not_found(self, temp_components_dir):
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        comp = loader.get_by_file_path("nonexistent.json")
        assert comp is None

    def test_get_all_components(self, temp_components_dir):
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        all_comps = loader.get_all_components()
        assert len(all_comps) == 3  # 1 experimentalist + 2 theorists

    def test_categories_property(self, temp_components_dir):
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        cats = loader.categories
        assert "experimentalists" in cats
        assert "theorists" in cats

    def test_component_lookup_property(self, temp_components_dir):
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        lookup = loader.component_lookup
        assert "experimentalists/exp1.json" in lookup
        assert "exp1.json" in lookup

    def test_handles_invalid_json(self, tmp_path):
        """Test that loader handles invalid JSON files gracefully."""
        (tmp_path / "theorists").mkdir()

        # Create an invalid JSON file
        with open(tmp_path / "theorists" / "invalid.json", "w") as f:
            f.write("not valid json {{{")

        # Create a valid file too
        valid = {"uuid": "valid", "protocolType": "theorist", "name": "Valid"}
        with open(tmp_path / "theorists" / "valid.json", "w") as f:
            json.dump(valid, f)

        loader = ComponentLoader(tmp_path)
        components = loader.load_all()

        # Should only load the valid component
        assert len(components.get("theorists", [])) == 1
        assert components["theorists"][0].name == "Valid"

    def test_handles_missing_category_folders(self, tmp_path):
        """Test that loader handles missing category folders gracefully."""
        # Only create experimentalists folder
        (tmp_path / "experimentalists").mkdir()
        exp = {"uuid": "exp", "protocolType": "experimentalist", "name": "Exp"}
        with open(tmp_path / "experimentalists" / "exp.json", "w") as f:
            json.dump(exp, f)

        loader = ComponentLoader(tmp_path)
        components = loader.load_all()

        assert "experimentalists" in components
        assert "theorists" not in components
        assert "experiment_runners" not in components


class TestComponentLoaderInit:
    """Tests for ComponentLoader initialization."""

    def test_init_with_path_object(self, temp_components_dir):
        """Test initialization with Path object."""
        loader = ComponentLoader(temp_components_dir)
        assert loader.components_dir == temp_components_dir
        assert isinstance(loader.components_dir, Path)

    def test_init_with_string_path(self, temp_components_dir):
        """Test initialization with string path."""
        loader = ComponentLoader(str(temp_components_dir))
        assert loader.components_dir == temp_components_dir
        assert isinstance(loader.components_dir, Path)

    def test_init_empty_collections(self, temp_components_dir):
        """Test that collections are initialized empty."""
        loader = ComponentLoader(temp_components_dir)
        assert loader._components == {}
        assert loader._by_file_path == {}


class TestComponentLoaderLoadAll:
    """Tests for load_all method."""

    def test_load_all_clears_previous(self, temp_components_dir):
        """Test that load_all clears previous data."""
        loader = ComponentLoader(temp_components_dir)

        # Load once
        loader.load_all()
        first_count = len(loader.get_all_components())

        # Load again
        loader.load_all()
        second_count = len(loader.get_all_components())

        assert first_count == second_count

    def test_load_all_returns_dict(self, temp_components_dir):
        """Test that load_all returns a dictionary."""
        loader = ComponentLoader(temp_components_dir)
        result = loader.load_all()

        assert isinstance(result, dict)

    def test_loaded_component_has_input_ports(self, temp_components_dir):
        """Test that loaded components have input ports."""
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        exp = loader.get_by_file_path("exp1.json")
        assert exp is not None
        assert len(exp.input_ports) == 1
        assert exp.input_ports[0].name == "data"

    def test_loaded_component_has_output_ports(self, temp_components_dir):
        """Test that loaded components have output ports."""
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        exp = loader.get_by_file_path("exp1.json")
        assert exp is not None
        assert len(exp.output_ports) == 1
        assert exp.output_ports[0].name == "conditions"

    def test_loaded_component_has_file_path(self, temp_components_dir):
        """Test that loaded components have file_path set."""
        loader = ComponentLoader(temp_components_dir)
        loader.load_all()

        exp = loader.get_by_file_path("exp1.json")
        assert exp is not None
        assert exp.file_path == "experimentalists/exp1.json"


class TestComponentLoaderCategoryMap:
    """Tests for CATEGORY_MAP constant."""

    def test_category_map_has_experimentalists(self):
        """Test CATEGORY_MAP has experimentalists."""
        assert "experimentalists" in ComponentLoader.CATEGORY_MAP
        assert ComponentLoader.CATEGORY_MAP["experimentalists"] == "experimentalist"

    def test_category_map_has_theorists(self):
        """Test CATEGORY_MAP has theorists."""
        assert "theorists" in ComponentLoader.CATEGORY_MAP
        assert ComponentLoader.CATEGORY_MAP["theorists"] == "theorist"

    def test_category_map_has_experiment_runners(self):
        """Test CATEGORY_MAP has experiment_runners."""
        assert "experiment_runners" in ComponentLoader.CATEGORY_MAP
        assert ComponentLoader.CATEGORY_MAP["experiment_runners"] == "experiment_runner"

    def test_category_map_has_controls(self):
        """Test CATEGORY_MAP has controls."""
        assert "controls" in ComponentLoader.CATEGORY_MAP
        assert ComponentLoader.CATEGORY_MAP["controls"] == "control"


class TestComponentLoaderEdgeCases:
    """Tests for edge cases."""

    def test_handles_unexpected_exception_in_load_component(self, tmp_path):
        """Test that loader handles unexpected exceptions in _load_component gracefully."""
        from unittest.mock import patch

        (tmp_path / "theorists").mkdir()

        # Create a valid JSON file
        valid = {"uuid": "valid", "protocolType": "theorist", "name": "Valid"}
        with open(tmp_path / "theorists" / "valid.json", "w") as f:
            json.dump(valid, f)

        loader = ComponentLoader(tmp_path)

        # Mock _load_component to raise an unexpected exception (not JSONDecodeError/KeyError)
        original_load = loader._load_component

        def mock_load(file_path):
            if "valid.json" in str(file_path):
                raise RuntimeError("Unexpected error during loading")
            return original_load(file_path)

        with patch.object(loader, "_load_component", side_effect=mock_load):
            # Should not raise, should handle gracefully
            components = loader.load_all()

        # Category should be empty since the only file raised an exception
        assert "theorists" not in components

    def test_empty_directory(self, tmp_path):
        """Test loading from empty directory."""
        loader = ComponentLoader(tmp_path)
        result = loader.load_all()

        assert result == {}
        assert loader.get_all_components() == []
        assert loader.categories == []

    def test_nonexistent_directory(self, tmp_path):
        """Test loading from nonexistent directory."""
        nonexistent = tmp_path / "does_not_exist"
        loader = ComponentLoader(nonexistent)
        result = loader.load_all()

        assert result == {}

    def test_empty_category_folder(self, tmp_path):
        """Test loading from empty category folder."""
        (tmp_path / "experimentalists").mkdir()  # Empty folder

        loader = ComponentLoader(tmp_path)
        result = loader.load_all()

        assert "experimentalists" not in result  # Empty categories not included

    def test_files_sorted_by_name(self, tmp_path):
        """Test that components are loaded in sorted order."""
        (tmp_path / "theorists").mkdir()

        # Create files in reverse order
        for name in ["z_last.json", "a_first.json", "m_middle.json"]:
            data = {"uuid": name, "protocolType": "theorist", "name": name}
            with open(tmp_path / "theorists" / name, "w") as f:
                json.dump(data, f)

        loader = ComponentLoader(tmp_path)
        loader.load_all()

        components = loader.get_by_category("theorists")
        names = [c.name for c in components]

        assert names == ["a_first.json", "m_middle.json", "z_last.json"]


class TestGetDefaultComponentsDir:
    """Tests for get_default_components_dir function."""

    def test_returns_path(self):
        """Test that function returns a Path object."""
        result = get_default_components_dir()
        assert isinstance(result, Path)

    def test_path_ends_with_expected_structure(self):
        """Test that path ends with JSON/components."""
        result = get_default_components_dir()
        assert result.name == "components"
        assert result.parent.name == "JSON"

    def test_path_is_absolute(self):
        """Test that returned path is absolute."""
        result = get_default_components_dir()
        assert result.is_absolute()
