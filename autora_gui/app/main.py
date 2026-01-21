"""FastAPI application for AutoRA GUI workflow builder."""

import json
import uuid as uuid_lib
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Create FastAPI app
app = FastAPI(title="AutoRA Workflow Builder", version="1.0.0")

# Mount static files
STATIC_PATH = Path(__file__).parent / "static"
TEMPLATES_PATH = Path(__file__).parent / "templates"
app.mount("/static", StaticFiles(directory=str(STATIC_PATH)), name="static")

# Base path for JSON components
COMPONENTS_PATH = Path(__file__).parent.parent / "JSON" / "components"
SCHEMAS_PATH = Path(__file__).parent.parent / "JSON" / "schemas"
WORKFLOWS_PATH = Path(__file__).parent.parent / "JSON" / "workflows"


class WorkflowData(BaseModel):
    """Model for workflow data."""

    name: str
    nodes: list[dict[str, Any]]
    connections: list[dict[str, Any]]


def load_json_file(file_path: Path) -> dict:
    """Load a JSON file and return its contents."""
    with file_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_all_components() -> dict:
    """Load all component JSON files organized by type."""
    components = {}

    # Dynamically discover all subdirectories in the components folder
    if COMPONENTS_PATH.exists():
        for component_dir in COMPONENTS_PATH.iterdir():
            if component_dir.is_dir():
                component_type = component_dir.name
                components[component_type] = []
                for json_file in component_dir.glob("*.json"):
                    try:
                        component_data = load_json_file(json_file)
                        # Add file reference for later use
                        component_data["_file"] = json_file.name
                        component_data["_type"] = component_type
                        components[component_type].append(component_data)
                    except Exception as e:
                        print(f"Error loading {json_file}: {e}")

    return components


@app.get("/", response_class=HTMLResponse)
async def index():
    """Render the main workflow builder page."""
    template_path = TEMPLATES_PATH / "index.html"
    with template_path.open("r", encoding="utf-8") as f:
        content = f.read()
    # Replace Jinja2 url_for with static paths
    content = content.replace(
        "{{ url_for('static', filename='css/styles.css') }}", "/static/css/styles.css"
    )
    content = content.replace(
        "{{ url_for('static', filename='js/app.js') }}", "/static/js/app.js"
    )
    return content


@app.get("/api/components")
async def get_components():
    """API endpoint to get all available components."""
    return get_all_components()


@app.get("/api/components/{component_type}/{filename}")
async def get_component(component_type: str, filename: str):
    """API endpoint to get a specific component."""
    file_path = COMPONENTS_PATH / component_type / filename
    if file_path.exists():
        return load_json_file(file_path)
    raise HTTPException(status_code=404, detail="Component not found")


@app.get("/api/schemas/{schema_name}")
async def get_schema(schema_name: str):
    """API endpoint to get a schema."""
    file_path = SCHEMAS_PATH / schema_name
    if file_path.exists():
        return load_json_file(file_path)
    raise HTTPException(status_code=404, detail="Schema not found")


@app.post("/api/workflow")
async def save_workflow(workflow: WorkflowData):
    """API endpoint to save a workflow."""
    # Generate a unique filename
    workflow_id = str(uuid_lib.uuid4())[:8]
    WORKFLOWS_PATH.mkdir(parents=True, exist_ok=True)
    workflow_path = WORKFLOWS_PATH / f"workflow_{workflow_id}.json"

    with workflow_path.open("w", encoding="utf-8") as f:
        json.dump(workflow.model_dump(), f, indent=2)

    return {"success": True, "workflow_id": workflow_id}


@app.post("/api/workflow/save/{filename}")
async def save_workflow_with_name(filename: str, workflow: WorkflowData):
    """API endpoint to save a workflow with a specific filename."""
    # Ensure filename ends with .json
    if not filename.endswith(".json"):
        filename = f"{filename}.json"
    
    # Sanitize filename to prevent path traversal
    safe_filename = Path(filename).name
    
    WORKFLOWS_PATH.mkdir(parents=True, exist_ok=True)
    workflow_path = WORKFLOWS_PATH / safe_filename

    with workflow_path.open("w", encoding="utf-8") as f:
        json.dump(workflow.model_dump(), f, indent=2)

    return {"success": True, "filename": safe_filename, "path": str(workflow_path)}


@app.get("/api/workflow/{workflow_id}")
async def load_workflow(workflow_id: str):
    """API endpoint to load a workflow."""
    workflow_path = WORKFLOWS_PATH / f"workflow_{workflow_id}.json"
    if workflow_path.exists():
        return load_json_file(workflow_path)
    raise HTTPException(status_code=404, detail="Workflow not found")


@app.get("/api/workflows")
async def list_workflows():
    """API endpoint to list all saved workflows."""
    workflows = []
    if WORKFLOWS_PATH.exists():
        for workflow_file in WORKFLOWS_PATH.glob("workflow_*.json"):
            try:
                data = load_json_file(workflow_file)
                workflow_id = workflow_file.stem.replace("workflow_", "")
                workflows.append({"id": workflow_id, "name": data.get("name", "Unnamed")})
            except Exception:
                pass
    return workflows


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5000)
