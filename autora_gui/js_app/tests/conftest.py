"""Pytest fixtures for js_app tests."""

import json
import tempfile
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient

from autora_gui.js_app.main import app


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def temp_components_dir() -> Generator[Path, None, None]:
    """Create a temporary components directory with sample data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        components_dir = Path(tmpdir) / "components"
        components_dir.mkdir()

        # Create theorists directory with sample component
        theorists_dir = components_dir / "theorists"
        theorists_dir.mkdir()
        sample_theorist = {
            "uuid": "test-theorist-001",
            "name": "Test Theorist",
            "description": "A test theorist component",
            "protocolType": "theorist",
            "parameters": [
                {
                    "name": "learning_rate",
                    "datatype": "real",
                    "default": 0.01,
                    "description": "Learning rate parameter",
                }
            ],
            "inputDataType": [{"name": "X", "datatype": "real"}],
            "outputDataType": [{"name": "y", "datatype": "real"}],
        }
        (theorists_dir / "test_theorist.json").write_text(json.dumps(sample_theorist, indent=2))

        # Create experimentalists directory with sample component
        experimentalists_dir = components_dir / "experimentalists"
        experimentalists_dir.mkdir()
        sample_experimentalist = {
            "uuid": "test-experimentalist-001",
            "name": "Test Experimentalist",
            "description": "A test experimentalist component",
            "protocolType": "experimentalist",
            "parameters": [
                {
                    "name": "num_samples",
                    "datatype": "integer",
                    "default": 10,
                    "description": "Number of samples",
                }
            ],
        }
        (experimentalists_dir / "test_experimentalist.json").write_text(json.dumps(sample_experimentalist, indent=2))

        # Create experiment_runners directory with sample component
        runners_dir = components_dir / "experiment_runners"
        runners_dir.mkdir()
        sample_runner = {
            "uuid": "test-runner-001",
            "name": "Test Runner",
            "description": "A test experiment runner component",
            "protocolType": "experiment_runner",
            "parameters": [],
        }
        (runners_dir / "test_runner.json").write_text(json.dumps(sample_runner, indent=2))

        yield components_dir


@pytest.fixture
def temp_workflows_dir() -> Generator[Path, None, None]:
    """Create a temporary workflows directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        workflows_dir = Path(tmpdir) / "workflows"
        workflows_dir.mkdir()
        yield workflows_dir


@pytest.fixture
def sample_workflow() -> dict:
    """Create a sample workflow for testing."""
    return {
        "name": "test_workflow",
        "description": "A test workflow",
        "independentVariables": {
            "name": "X",
            "description": "Independent variables",
            "datatype": "real",
        },
        "dependentVariables": {
            "name": "Y",
            "description": "Dependent variables",
            "datatype": "real",
        },
        "components": [
            {
                "uuid": "node-001",
                "protocolUuid": "test-theorist-001",
                "componentType": "theorists",
                "parameterSetting": [{"name": "learning_rate", "value": "0.01"}],
                "canvasLocation": {"x": 100, "y": 200},
            }
        ],
        "links": [{"source": "node-001", "target": "node-002"}],
    }


@pytest.fixture
def invalid_json_file(tmp_path: Path) -> Path:
    """Create an invalid JSON file for testing error handling."""
    invalid_file = tmp_path / "invalid.json"
    invalid_file.write_text("{ invalid json }")
    return invalid_file
