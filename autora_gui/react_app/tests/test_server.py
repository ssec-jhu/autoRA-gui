"""Tests for server.py FastAPI backend."""

import json

import pytest
from fastapi.testclient import TestClient

import autora_gui.react_app.server as server_module
from autora_gui.react_app.server import (
    CanvasLocation,
    ControlComponent,
    FilterComponent,
    ParameterSetting,
    Workflow,
    WorkflowComponent,
    WorkflowLink,
    app,
    load_components,
)

client = TestClient(app)


class TestLifespan:
    """Tests for the lifespan startup handler."""

    def test_lifespan_prints_category_counts(self, capsys):
        """Test that startup prints one line per component category."""
        with TestClient(app):
            pass
        captured = capsys.readouterr()
        for category in ("controls", "theorists", "experimentalists", "experiment_runners"):
            assert category in captured.out


class TestLoadComponents:
    """Tests for the load_components function."""

    def test_returns_dict(self):
        """Test that load_components returns a dictionary."""
        components = load_components()
        assert isinstance(components, dict)

    def test_has_default_categories(self):
        """Test that load_components has default categories."""
        components = load_components()
        expected = {"controls", "theorists", "experimentalists", "experiment_runners"}
        assert expected.issubset(set(components.keys()))

    def test_components_are_sorted_by_name(self):
        """Test that components in each category are sorted by name."""
        components = load_components()
        for category, items in components.items():
            if len(items) > 1:
                names = [item.get("name", "") for item in items]
                assert names == sorted(names), f"{category} components not sorted"


class TestPydanticModels:
    """Tests for Pydantic model validation."""

    def test_canvas_location_valid(self):
        """Test CanvasLocation with valid data."""
        loc = CanvasLocation(x=100.0, y=200.0)
        assert loc.x == 100.0
        assert loc.y == 200.0

    def test_control_component_valid(self):
        """Test ControlComponent with valid data."""
        comp = ControlComponent(uuid="test-uuid", canvasLocation=CanvasLocation(x=0, y=0))
        assert comp.uuid == "test-uuid"

    def test_filter_component_defaults(self):
        """Test FilterComponent default values."""
        fc = FilterComponent(uuid="filter-1", canvasLocation=CanvasLocation(x=0, y=0))
        assert fc.maxCounter == 1
        assert fc.altTarget is None

    def test_workflow_component_valid(self):
        """Test WorkflowComponent with valid data."""
        comp = WorkflowComponent(
            uuid="comp-1",
            protocolUuid="proto-1",
            canvasLocation=CanvasLocation(x=50, y=100),
        )
        assert comp.uuid == "comp-1"
        assert comp.parameterSetting == []

    def test_parameter_setting_valid(self):
        """Test ParameterSetting with valid data."""
        ps = ParameterSetting(uuid="ps-1", name="learning_rate", value=0.01)
        assert ps.uuid == "ps-1"
        assert ps.name == "learning_rate"
        assert ps.value == 0.01

    def test_parameter_setting_optional_name(self):
        """Test ParameterSetting with no name."""
        ps = ParameterSetting(uuid="ps-2", value=42)
        assert ps.name is None

    def test_workflow_link_valid(self):
        """Test WorkflowLink with valid data."""
        link = WorkflowLink(source="node-1", target="node-2")
        assert link.source == "node-1"
        assert link.target == "node-2"

    def test_workflow_minimal(self):
        """Test Workflow with minimal required data."""
        wf = Workflow(name="Test Workflow")
        assert wf.name == "Test Workflow"
        assert wf.description is None
        assert wf.components == []
        assert wf.links == []


class TestAPIEndpoints:
    """Tests for FastAPI endpoints."""

    def test_get_components(self):
        """Test GET /api/components endpoint."""
        response = client.get("/api/components")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "theorists" in data

    def test_get_components_by_category_valid(self):
        """Test GET /api/components/{category} with valid category."""
        response = client.get("/api/components/theorists")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_components_by_category_invalid(self):
        """Test GET /api/components/{category} with invalid category."""
        response = client.get("/api/components/nonexistent")
        assert response.status_code == 404

    def test_validate_workflow_valid(self):
        """Test POST /api/workflow/validate with valid workflow."""
        workflow = {
            "name": "Test Workflow",
            "description": "A test workflow",
            "components": [],
            "links": [],
        }
        response = client.post("/api/workflow/validate", json=workflow)
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True

    def test_validate_workflow_invalid_link(self):
        """Test POST /api/workflow/validate with invalid link reference."""
        workflow = {
            "name": "Invalid Workflow",
            "components": [],
            "links": [{"source": "nonexistent-1", "target": "nonexistent-2"}],
        }
        response = client.post("/api/workflow/validate", json=workflow)
        assert response.status_code == 400

    def test_save_workflow(self):
        """Test POST /api/workflow/save endpoint."""
        workflow = {
            "name": "My Workflow",
            "description": "Test save",
            "components": [],
            "links": [],
        }
        response = client.post("/api/workflow/save", json=workflow)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["workflow_id"] == "My Workflow"

    def test_get_schema_valid(self):
        """Test GET /api/schema/{name} with a known schema."""
        response = client.get("/api/schema/workflow_model")
        assert response.status_code == 200
        assert isinstance(response.json(), dict)

    def test_get_schema_invalid(self):
        """Test GET /api/schema/{name} with an unknown schema returns 404."""
        response = client.get("/api/schema/nonexistent_schema")
        assert response.status_code == 404


class TestAddComponent:
    """Tests for POST /api/components (component upload)."""

    filename = "11111111111111111111111111111111.json"

    @pytest.fixture
    def isolated_components_dir(self, tmp_path, monkeypatch):
        """Store uploaded components in a temporary catalog during each test."""
        components_dir = tmp_path / "components"
        monkeypatch.setattr(server_module, "COMPONENTS_DIR", components_dir)
        return components_dir

    def _component(self, **overrides) -> dict:
        component = {
            "uuid": "11111111-1111-1111-1111-111111111111",
            "protocolType": "experimentalist",
            "name": "Zzz Test Upload",
            "description": "Uploaded during tests.",
            "githubCommit": "https://example.com/commit",
            "github_io": "https://example.com/docs",
            "pythonName": "zzz_test_upload",
            "importPath": "autora.experimentalist.test_upload",
            "pipInstall": "autora-test-upload",
            "parameters": None,
            "inputDataType": None,
            "outputDataType": None,
        }
        component.update(overrides)
        return component

    def test_add_component_persists_to_disk(self, isolated_components_dir):
        """A valid component is written into its category folder and returned."""
        expected_file = isolated_components_dir / "experimentalists" / self.filename

        response = client.post("/api/components", json=self._component())

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "experimentalists"
        assert data["component"]["file"] == self.filename
        assert expected_file.exists()

    def test_add_component_unknown_protocol_type(self):
        """An unknown protocolType is rejected with 400."""
        response = client.post("/api/components", json=self._component(protocolType="bogus"))
        assert response.status_code == 400

    def test_add_component_missing_name(self):
        """A component missing a required field is rejected with 400."""
        component = self._component()
        del component["name"]
        response = client.post("/api/components", json=component)
        assert response.status_code == 400

    def test_add_component_rejects_incomplete_protocol(self):
        """A component missing schema-required fields is rejected with 400."""
        response = client.post(
            "/api/components",
            json=self._component(description=None),
        )
        assert response.status_code == 400

    def test_add_component_duplicate_filename(self, isolated_components_dir):
        """Uploading a component whose file already exists returns 409."""
        expected_file = isolated_components_dir / "experimentalists" / self.filename

        first = client.post("/api/components", json=self._component())
        assert first.status_code == 200
        assert expected_file.exists()

        second = client.post("/api/components", json=self._component())
        assert second.status_code == 409

    def test_add_component_does_not_persist_file_field(self, isolated_components_dir):
        """The injected 'file' field is stripped before writing to disk."""
        expected_file = isolated_components_dir / "experimentalists" / self.filename

        client.post("/api/components", json=self._component(file="should_be_dropped.json"))

        with expected_file.open() as f:
            saved = json.load(f)
        assert "file" not in saved
