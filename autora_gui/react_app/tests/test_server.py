"""Tests for server.py FastAPI backend."""

from fastapi.testclient import TestClient

from autora_gui.react_app.server import (
    CanvasLocation,
    ControlComponent,
    FilterComponent,
    Workflow,
    WorkflowComponent,
    WorkflowLink,
    app,
    load_components,
)

client = TestClient(app)


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
