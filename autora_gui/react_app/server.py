"""FastAPI backend for AutoRA Workflow Editor.

Run with: uvicorn server:app --reload --port 8000
"""

import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


@asynccontextmanager
async def lifespan(app: FastAPI):
    components = load_components()
    for cat, items in components.items():
        print(f"  {cat}: {len(items)} components")
    yield


app = FastAPI(title="AutoRA Workflow Editor API", lifespan=lifespan)

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
                    component["file"] = json_file.name
                    components[category].append(component)
            except (OSError, json.JSONDecodeError) as e:
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


class ControlComponent(BaseModel):
    uuid: str
    canvasLocation: CanvasLocation


class FilterComponent(BaseModel):
    uuid: str
    maxCounter: int = 1
    altTarget: str | None = None
    canvasLocation: CanvasLocation


class WorkflowLink(BaseModel):
    source: str
    target: str


class Workflow(BaseModel):
    name: str
    description: str | None = None
    start: ControlComponent | None = None
    end: ControlComponent | None = None
    filters: list[FilterComponent] = []
    components: list[WorkflowComponent] = []
    links: list[WorkflowLink] = []


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
    # Debug: print what we received
    print(f"DEBUG: start={workflow.start}, end={workflow.end}")
    print(f"DEBUG: components count={len(workflow.components)}, links count={len(workflow.links)}")

    components = load_components()
    all_protocols = []
    for category in components.values():
        all_protocols.extend(category)

    protocol_uuids = {p["uuid"] for p in all_protocols}

    # Collect all node uuids (components + start + end + filters)
    node_uuids = {c.uuid for c in workflow.components}
    if workflow.start:
        node_uuids.add(workflow.start.uuid)
    if workflow.end:
        node_uuids.add(workflow.end.uuid)
    for f in workflow.filters:
        node_uuids.add(f.uuid)

    print(f"DEBUG: node_uuids={node_uuids}")
    print(f"DEBUG: filters count={len(workflow.filters)}")

    errors = []

    for comp in workflow.components:
        if comp.protocolUuid not in protocol_uuids:
            errors.append(f"Unknown protocol: {comp.protocolUuid}")

    for link in workflow.links:
        if link.source not in node_uuids:
            errors.append(f"Link source not found: {link.source}")
        if link.target not in node_uuids:
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

    uvicorn.run(app, host="localhost", port=8000)
