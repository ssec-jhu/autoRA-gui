"""Tests for the main FastAPI application endpoints."""

import json
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from autora_gui.js_app import main
from autora_gui.js_app.main import get_components_dir


class TestGetComponentsDir:
    """Tests for the get_components_dir utility function."""

    def test_returns_first_existing_directory(self, tmp_path: Path) -> None:
        """Test that get_components_dir returns the first existing directory."""
        # Create a temporary components directory
        components_dir = tmp_path / "components"
        components_dir.mkdir()

        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [components_dir]):
            result = get_components_dir()
            assert result == components_dir

    def test_returns_none_when_no_directory_exists(self) -> None:
        """Test that get_components_dir returns None when no directory exists."""
        non_existent = Path("/non/existent/path")
        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [non_existent]):
            result = get_components_dir()
            assert result is None

    def test_skips_non_existent_directories(self, tmp_path: Path) -> None:
        """Test that get_components_dir skips non-existent directories."""
        non_existent = Path("/non/existent/path")
        existing = tmp_path / "components"
        existing.mkdir()

        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [non_existent, existing]):
            result = get_components_dir()
            assert result == existing


class TestIndexEndpoint:
    """Tests for the index endpoint (GET /)."""

    def test_index_returns_html(self, client: TestClient) -> None:
        """Test that index returns HTML content."""
        response = client.get("/")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_index_contains_expected_elements(self, client: TestClient) -> None:
        """Test that index HTML contains expected elements."""
        response = client.get("/")
        assert response.status_code == 200
        assert "Workflow Editor" in response.text
        assert "workflow-canvas" in response.text
        assert "component-palette" in response.text

    def test_index_returns_404_when_template_missing(self, client: TestClient) -> None:
        """Test that index returns 404 when template is missing."""
        with patch.object(main, "TEMPLATES_DIR", Path("/non/existent")):
            response = client.get("/")
            assert response.status_code == 404


class TestGetComponentsEndpoint:
    """Tests for the GET /api/components endpoint."""

    def test_get_components_returns_sample_data_when_no_dir(self, client: TestClient) -> None:
        """Test that sample data is returned when components directory doesn't exist."""
        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [Path("/non/existent")]):
            response = client.get("/api/components")
            assert response.status_code == 200
            data = response.json()
            assert "theorists" in data
            assert "experimentalists" in data
            assert "experiment_runners" in data

    def test_get_components_scans_directory(self, client: TestClient, temp_components_dir: Path) -> None:
        """Test that components are scanned from directory."""
        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [temp_components_dir]):
            response = client.get("/api/components")
            assert response.status_code == 200
            data = response.json()

            # Check theorists
            assert "theorists" in data
            assert len(data["theorists"]) == 1
            assert data["theorists"][0]["name"] == "Test Theorist"
            assert data["theorists"][0]["file"] == "test_theorist.json"

            # Check experimentalists
            assert "experimentalists" in data
            assert len(data["experimentalists"]) == 1
            assert data["experimentalists"][0]["name"] == "Test Experimentalist"

            # Check experiment_runners
            assert "experiment_runners" in data
            assert len(data["experiment_runners"]) == 1
            assert data["experiment_runners"][0]["name"] == "Test Runner"

    def test_get_components_handles_invalid_json(self, client: TestClient, tmp_path: Path) -> None:
        """Test that invalid JSON files are handled gracefully."""
        components_dir = tmp_path / "components"
        theorists_dir = components_dir / "theorists"
        theorists_dir.mkdir(parents=True)

        # Create an invalid JSON file
        (theorists_dir / "invalid.json").write_text("{ invalid json }")

        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [components_dir]):
            response = client.get("/api/components")
            assert response.status_code == 200
            data = response.json()
            # Invalid file should be skipped
            assert "theorists" in data
            assert len(data["theorists"]) == 0

    def test_get_components_adds_file_and_type_metadata(self, client: TestClient, temp_components_dir: Path) -> None:
        """Test that file and _type metadata are added to components."""
        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [temp_components_dir]):
            response = client.get("/api/components")
            assert response.status_code == 200
            data = response.json()

            theorist = data["theorists"][0]
            assert "file" in theorist
            assert "_type" in theorist
            assert theorist["_type"] == "theorists"


class TestGetComponentEndpoint:
    """Tests for the GET /api/components/{type_name}/{filename} endpoint."""

    def test_get_component_returns_component(self, client: TestClient, temp_components_dir: Path) -> None:
        """Test that a specific component can be retrieved."""
        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [temp_components_dir]):
            response = client.get("/api/components/theorists/test_theorist.json")
            assert response.status_code == 200
            data = response.json()
            assert data["name"] == "Test Theorist"
            assert data["uuid"] == "test-theorist-001"

    def test_get_component_returns_404_when_not_found(self, client: TestClient, temp_components_dir: Path) -> None:
        """Test that 404 is returned when component not found."""
        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [temp_components_dir]):
            response = client.get("/api/components/theorists/nonexistent.json")
            assert response.status_code == 404

    def test_get_component_returns_404_when_no_components_dir(self, client: TestClient) -> None:
        """Test that 404 is returned when components directory doesn't exist."""
        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [Path("/non/existent")]):
            response = client.get("/api/components/theorists/test.json")
            assert response.status_code == 404

    def test_get_component_returns_500_for_invalid_json(self, client: TestClient, tmp_path: Path) -> None:
        """Test that 500 is returned for invalid JSON files."""
        components_dir = tmp_path / "components"
        theorists_dir = components_dir / "theorists"
        theorists_dir.mkdir(parents=True)
        (theorists_dir / "invalid.json").write_text("{ invalid json }")

        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [components_dir]):
            response = client.get("/api/components/theorists/invalid.json")
            assert response.status_code == 500


class TestSaveWorkflowEndpoint:
    """Tests for the POST /api/workflow/save/{filename} endpoint."""

    def test_save_workflow_creates_file(self, client: TestClient, sample_workflow: dict, tmp_path: Path) -> None:
        """Test that save_workflow creates a workflow file."""
        workflows_dir = tmp_path / "workflows"

        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            response = client.post(
                "/api/workflow/save/test_workflow",
                json=sample_workflow,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "saved"
            assert data["filename"] == "test_workflow"

            # Verify file was created
            expected_file = workflows_dir / "test_workflow.json"
            assert expected_file.exists()

            # Verify content
            saved_data = json.loads(expected_file.read_text())
            assert saved_data["name"] == "test_workflow"

    def test_save_workflow_creates_directory_if_not_exists(
        self, client: TestClient, sample_workflow: dict, tmp_path: Path
    ) -> None:
        """Test that save_workflow creates the workflows directory if needed."""
        workflows_dir = tmp_path / "workflows"

        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            response = client.post(
                "/api/workflow/save/new_workflow",
                json=sample_workflow,
            )
            assert response.status_code == 200
            assert workflows_dir.exists()

    def test_save_workflow_overwrites_existing(self, client: TestClient, sample_workflow: dict, tmp_path: Path) -> None:
        """Test that save_workflow overwrites existing files."""
        workflows_dir = tmp_path / "workflows"
        workflows_dir.mkdir(parents=True)
        existing_file = workflows_dir / "existing.json"
        existing_file.write_text('{"old": "data"}')

        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            response = client.post(
                "/api/workflow/save/existing",
                json=sample_workflow,
            )
            assert response.status_code == 200

            # Verify content was overwritten
            saved_data = json.loads(existing_file.read_text())
            assert saved_data["name"] == "test_workflow"
            assert "old" not in saved_data


class TestListWorkflowsEndpoint:
    """Tests for the GET /api/workflows endpoint."""

    def test_list_workflows_returns_empty_when_no_dir(self, client: TestClient, tmp_path: Path) -> None:
        """Test that empty list is returned when workflows directory doesn't exist."""
        non_existent = tmp_path / "nonexistent"
        with patch.object(main, "get_workflows_dir", return_value=non_existent):
            response = client.get("/api/workflows")
            assert response.status_code == 200
            assert response.json() == []

    def test_list_workflows_returns_workflow_list(self, client: TestClient, tmp_path: Path) -> None:
        """Test that workflows are listed correctly."""
        workflows_dir = tmp_path / "workflows"
        workflows_dir.mkdir(parents=True)

        # Create some workflow files
        (workflows_dir / "workflow1.json").write_text('{"name": "workflow1"}')
        (workflows_dir / "workflow2.json").write_text('{"name": "workflow2"}')

        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            response = client.get("/api/workflows")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2

            names = [w["name"] for w in data]
            assert "workflow1" in names
            assert "workflow2" in names

    def test_list_workflows_includes_filename(self, client: TestClient, tmp_path: Path) -> None:
        """Test that workflow entries include filename."""
        workflows_dir = tmp_path / "workflows"
        workflows_dir.mkdir(parents=True)
        (workflows_dir / "my_workflow.json").write_text('{"name": "my_workflow"}')

        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            response = client.get("/api/workflows")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["name"] == "my_workflow"
            assert data[0]["filename"] == "my_workflow.json"

    def test_list_workflows_ignores_non_json_files(self, client: TestClient, tmp_path: Path) -> None:
        """Test that non-JSON files are ignored."""
        workflows_dir = tmp_path / "workflows"
        workflows_dir.mkdir(parents=True)

        (workflows_dir / "workflow.json").write_text('{"name": "workflow"}')
        (workflows_dir / "readme.txt").write_text("Not a workflow")
        (workflows_dir / "data.csv").write_text("1,2,3")

        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            response = client.get("/api/workflows")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["name"] == "workflow"
