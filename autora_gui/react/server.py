"""
FastAPI backend for AutoRA Workflow Editor.

Run with: uvicorn server:app --reload --port 8000
"""

import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="AutoRA Workflow Editor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COMPONENTS_DIR = Path(__file__).parent.parent / "JSON" / "components"
SCHEMAS_DIR = Path(__file__).parent.parent / "JSON" / "schemas"

print(f"Components directory: {COMPONENTS_DIR}")
print(f"Components directory exists: {COMPONENTS_DIR.exists()}")


def load_components() -> dict[str, list[dict]]:
    """Load all component JSON files organized by type."""
    components = {
        "controls": [],
        "theorists": [],
        "experimentalists": [],
        "experiment_runners": [],
    }

    if not COMPONENTS_DIR.exists():
        return components

    for category_dir in COMPONENTS_DIR.iterdir():
        if not category_dir.is_dir():
            continue

        category = category_dir.name
        if category not in components:
            components[category] = []

        for json_file in category_dir.glob("*.json"):
            try:
                with open(json_file) as f:
                    component = json.load(f)
                    components[category].append(component)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error loading {json_file}: {e}")

    for category in components:
        components[category].sort(key=lambda x: x.get("name", ""))

    return components


def load_schema(name: str) -> dict:
    """Load a JSON schema file."""
    schema_file = SCHEMAS_DIR / f"{name}.json"
    if not schema_file.exists():
        raise HTTPException(status_code=404, detail=f"Schema {name} not found")

    with open(schema_file) as f:
        return json.load(f)


class CanvasLocation(BaseModel):
    x: float
    y: float


class ParameterSetting(BaseModel):
    uuid: str
    name: str | None = None
    value: Any


class WorkflowComponent(BaseModel):
    uuid: str
    protocolUuid: str
    parameterSetting: list[ParameterSetting] = []
    canvasLocation: CanvasLocation


class WorkflowLink(BaseModel):
    source: str
    target: str


class Workflow(BaseModel):
    name: str
    description: str | None = None
    components: list[WorkflowComponent] = []
    links: list[WorkflowLink] = []


@app.on_event("startup")
def startup_event():
    components = load_components()
    for cat, items in components.items():
        print(f"  {cat}: {len(items)} components")


@app.get("/api/components")
def get_components() -> dict[str, list[dict]]:
    """Get all available components organized by category."""
    return load_components()


@app.get("/api/components/{category}")
def get_components_by_category(category: str) -> list[dict]:
    """Get components for a specific category."""
    components = load_components()
    if category not in components:
        raise HTTPException(status_code=404, detail=f"Category {category} not found")
    return components[category]


@app.get("/api/schema/{name}")
def get_schema(name: str) -> dict:
    """Get a JSON schema by name."""
    return load_schema(name)


@app.post("/api/workflow/validate")
def validate_workflow(workflow: Workflow) -> dict:
    """Validate a workflow against the schema."""
    components = load_components()
    all_protocols = []
    for category in components.values():
        all_protocols.extend(category)

    protocol_uuids = {p["uuid"] for p in all_protocols}
    component_uuids = {c.uuid for c in workflow.components}

    errors = []

    for comp in workflow.components:
        if comp.protocolUuid not in protocol_uuids:
            errors.append(f"Unknown protocol: {comp.protocolUuid}")

    for link in workflow.links:
        if link.source not in component_uuids:
            errors.append(f"Link source not found: {link.source}")
        if link.target not in component_uuids:
            errors.append(f"Link target not found: {link.target}")

    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    return {"valid": True, "message": "Workflow is valid"}


@app.post("/api/workflow/save")
def save_workflow(workflow: Workflow) -> dict:
    """Save a workflow to the server (placeholder for future implementation)."""
    return {
        "success": True,
        "message": "Workflow saved successfully",
        "workflow_id": workflow.name,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
