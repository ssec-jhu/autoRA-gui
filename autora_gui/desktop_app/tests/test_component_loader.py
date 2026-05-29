"""Tests for component loader."""

import json
from pathlib import Path

import pytest

from autora_gui.desktop_app.components.component_loader import ComponentLoader, get_default_components_dir


class TestComponentLoader:
    """Tests for ComponentLoader class."""

    @pytest.fixture
    def temp_components_dir(self, tmp_path):
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


class TestGetDefaultComponentsDir:
    """Tests for get_default_components_dir function."""

    def test_returns_path(self):
        result = get_default_components_dir()
        assert isinstance(result, Path)

    def test_path_ends_with_expected_structure(self):
        result = get_default_components_dir()
        assert result.name == "components"
        assert result.parent.name == "JSON"
