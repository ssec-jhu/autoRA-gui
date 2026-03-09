"""Integration tests for the workflow editor."""

from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from autora_gui.js_app import main


class TestWorkflowRoundTrip:
    """Tests for saving and loading workflows."""

    def test_save_and_list_workflow(self, client: TestClient, sample_workflow: dict, tmp_path: Path) -> None:
        """Test that a saved workflow appears in the list."""
        workflows_dir = tmp_path / "workflows"
        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            # Save workflow
            response = client.post(
                "/api/workflow/save/roundtrip_test",
                json=sample_workflow,
            )
            assert response.status_code == 200

            # List workflows
            response = client.get("/api/workflows")
            assert response.status_code == 200
            workflows = response.json()

            names = [w["name"] for w in workflows]
            assert "roundtrip_test" in names

    def test_save_multiple_workflows(self, client: TestClient, sample_workflow: dict, tmp_path: Path) -> None:
        """Test saving multiple workflows."""
        workflows_dir = tmp_path / "workflows"
        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            # Save multiple workflows
            for i in range(3):
                workflow = sample_workflow.copy()
                workflow["name"] = f"workflow_{i}"
                response = client.post(
                    f"/api/workflow/save/workflow_{i}",
                    json=workflow,
                )
                assert response.status_code == 200

            # List workflows
            response = client.get("/api/workflows")
            assert response.status_code == 200
            workflows = response.json()
            assert len(workflows) == 3


class TestComponentsAndWorkflow:
    """Tests for components interaction with workflows."""

    def test_get_components_and_create_workflow(
        self, client: TestClient, temp_components_dir: Path, tmp_path: Path
    ) -> None:
        """Test getting components and using them in a workflow."""
        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [temp_components_dir]):
            # Get components
            response = client.get("/api/components")
            assert response.status_code == 200
            components = response.json()

            # Get a specific theorist
            theorist = components["theorists"][0]
            assert "uuid" in theorist

            # Create workflow with this component
            workflow = {
                "name": "component_test",
                "description": "Test workflow with real component",
                "independentVariables": {
                    "name": "X",
                    "description": "Input",
                    "datatype": "real",
                },
                "dependentVariables": {
                    "name": "Y",
                    "description": "Output",
                    "datatype": "real",
                },
                "components": [
                    {
                        "uuid": "node-001",
                        "protocolUuid": theorist["uuid"],
                        "componentType": "theorists",
                        "parameterSetting": [],
                        "canvasLocation": {"x": 100, "y": 100},
                    }
                ],
                "links": [],
            }

            workflows_dir = tmp_path / "workflows"
            with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
                response = client.post(
                    "/api/workflow/save/component_test",
                    json=workflow,
                )
                assert response.status_code == 200


class TestFullPageLoad:
    """Tests for full page loading and functionality."""

    def test_page_loads_with_all_resources(self, client: TestClient) -> None:
        """Test that the main page loads with all required resources."""
        # Load main page
        response = client.get("/")
        assert response.status_code == 200

        # Check CSS loads
        response = client.get("/static/css/styles.css")
        assert response.status_code == 200

        # Check JS module loads
        response = client.get("/static/js/modules/main.js")
        assert response.status_code == 200

    def test_api_endpoints_accessible(self, client: TestClient) -> None:
        """Test that all API endpoints are accessible."""
        # Components endpoint
        response = client.get("/api/components")
        assert response.status_code == 200

        # Workflows endpoint
        response = client.get("/api/workflows")
        assert response.status_code == 200


class TestErrorHandling:
    """Tests for error handling scenarios."""

    def test_invalid_workflow_json(self, client: TestClient, tmp_path: Path) -> None:
        """Test handling of invalid workflow data."""
        workflows_dir = tmp_path / "workflows"
        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            # Send invalid data (missing required fields)
            response = client.post(
                "/api/workflow/save/invalid",
                json={"incomplete": "data"},
            )
            # Should still save (no validation on save)
            assert response.status_code == 200

    def test_special_characters_in_filename(self, client: TestClient, sample_workflow: dict, tmp_path: Path) -> None:
        """Test handling of special characters in workflow filename."""
        workflows_dir = tmp_path / "workflows"
        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            # This should work - underscores and hyphens are fine
            response = client.post(
                "/api/workflow/save/my_workflow-v1",
                json=sample_workflow,
            )
            assert response.status_code == 200

    def test_component_type_not_found(self, client: TestClient, temp_components_dir: Path) -> None:
        """Test requesting a non-existent component type."""
        with patch.object(main, "POSSIBLE_COMPONENT_DIRS", [temp_components_dir]):
            response = client.get("/api/components/nonexistent_type/file.json")
            assert response.status_code == 404


class TestConcurrentOperations:
    """Tests for concurrent operations."""

    def test_multiple_workflow_saves(self, client: TestClient, sample_workflow: dict, tmp_path: Path) -> None:
        """Test saving multiple workflows rapidly."""
        workflows_dir = tmp_path / "workflows"
        with patch.object(main, "get_workflows_dir", return_value=workflows_dir):
            responses = []
            for i in range(5):
                workflow = sample_workflow.copy()
                workflow["name"] = f"concurrent_{i}"
                response = client.post(
                    f"/api/workflow/save/concurrent_{i}",
                    json=workflow,
                )
                responses.append(response)

            # All should succeed
            for response in responses:
                assert response.status_code == 200

            # All should be listed
            response = client.get("/api/workflows")
            assert response.status_code == 200
            workflows = response.json()
            assert len(workflows) == 5
