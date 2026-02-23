"""
Workflow Editor - FastAPI Backend
Serves the frontend and provides API endpoints for components.
"""

import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse

app = FastAPI(title="Workflow Editor")

# Paths
BASE_DIR = Path(__file__).parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

# Possible locations for JSON components (checked in order)
# js_app is at autora_gui/js_app/, so paths are relative to that
POSSIBLE_COMPONENT_DIRS = [
    BASE_DIR.parent.parent / "JSON" / "components",       # Root level: JSON/components/
    BASE_DIR.parent / "JSON" / "components",              # autora_gui/JSON/components/
]

def get_components_dir() -> Path | None:
    """Find the first existing components directory."""
    for path in POSSIBLE_COMPONENT_DIRS:
        if path.exists():
            return path
    return None

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve the main HTML page."""
    html_file = TEMPLATES_DIR / "index.html"
    if not html_file.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return html_file.read_text()


@app.get("/api/components")
async def get_components():
    """
    Get all available components organized by type.
    Automatically scans JSON/components directory for node definitions.
    Returns: {type: [component, ...], ...}
    """
    components = {}
    components_dir = get_components_dir()

    if not components_dir:
        # Return sample data if no components directory found
        return {
            "theorists": [
                {"name": "Sample Theorist", "description": "A sample theorist component", "parameters": []}
            ],
            "experimentalists": [
                {"name": "Sample Experimentalist", "description": "A sample experimentalist component", "parameters": []}
            ],
            "experiment_runners": [
                {"name": "Sample Runner", "description": "A sample experiment runner component", "parameters": []}
            ]
        }

    # Scan all subdirectories for JSON files
    for type_dir in components_dir.iterdir():
        if type_dir.is_dir():
            type_name = type_dir.name
            components[type_name] = []

            for json_file in sorted(type_dir.glob("*.json")):
                try:
                    with open(json_file) as f:
                        data = json.load(f)
                        # Add file reference for later use
                        data["file"] = json_file.name
                        data["_type"] = type_name
                        components[type_name].append(data)
                except (json.JSONDecodeError, IOError) as e:
                    print(f"Error loading {json_file}: {e}")

    return components


@app.get("/api/components/{type_name}/{filename}")
async def get_component(type_name: str, filename: str):
    """Get a specific component by type and filename."""
    components_dir = get_components_dir()
    if not components_dir:
        raise HTTPException(status_code=404, detail="Components directory not found")

    file_path = components_dir / type_name / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Component not found")

    try:
        with open(file_path) as f:
            return json.load(f)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid JSON")


@app.post("/api/workflow/save/{filename}")
async def save_workflow(filename: str, workflow: dict):
    """Save a workflow to a JSON file."""
    # Save workflows alongside components in autora_gui/JSON/workflows
    workflows_dir = BASE_DIR.parent / "JSON" / "workflows"
    workflows_dir.mkdir(parents=True, exist_ok=True)

    file_path = workflows_dir / f"{filename}.json"
    with open(file_path, "w") as f:
        json.dump(workflow, f, indent=2)

    return {"status": "saved", "filename": filename}


@app.get("/api/workflows")
async def list_workflows():
    """List all saved workflows."""
    workflows_dir = BASE_DIR.parent / "JSON" / "workflows"

    if not workflows_dir.exists():
        return []

    workflows = []
    for json_file in workflows_dir.glob("*.json"):
        workflows.append({
            "name": json_file.stem,
            "filename": json_file.name
        })

    return workflows


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
