# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

autoRA-gui is a Python package for building a graphical user interface to define and visualize scientific research workflows in the AutoRA (Automated Research Automation) framework. Maintained by the Scientific Software Engineering Center at Johns Hopkins University.

## Common Commands

### Development Setup
```bash
conda create -n autora_gui python=3.11 pip
conda activate autora_gui
pip install -r requirements/dev.txt
pip install -e .  # Editable install
```

### Testing
```bash
tox -e test                                    # Run all tests via tox (recommended)
pytest .                                       # Run all tests directly
pytest tests/test_util.py::test_base_dummy    # Run specific test
```

### Linting and Formatting
```bash
tox -e check-style                # Check linting and formatting
tox -e format                     # Auto-format code
ruff format .                     # Format directly
ruff check .                      # Lint directly
```

### Security Checks
```bash
bandit -c pyproject.toml --severity-level=medium -r autora_gui
```

### Generate JSON Schemas
```bash
python -m autora_gui.data_model           # Generate workflow/protocol schemas
python -m autora_gui.protocols.theorists  # Generate theorist component JSON
```

### Build Documentation
```bash
tox -e build-docs
# Or manually: pip install -r requirements/docs.txt && cd docs && make html
```

## Architecture

### Data Model Layer (`autora_gui/data_model.py`)

The core consists of Pydantic models divided into two groups:

**Protocol Classes** - Reusable component definitions:
- `Protocol`: Full component definition with type (theorist/experimentalist/experiment_runner), parameters, input/output datatypes, and GitHub commit reference
- `VariableType`, `PrimitiveVariableType`, `TupleVariableType`: Parameter type definitions
- `Datatype` enum: REAL, INTEGER, BOOLEAN, STRING, CATEGORICAL
- `ProtocolType` enum: THEORIST, EXPERIMENTALIST, EXPERIMENT_RUNNER

**Workflow Classes** - Runtime instance definitions:
- `Workflow`: Complete workflow with name, variables, components list, links list
- `Component`: Instance of a protocol with parameter settings and canvas position
- `Link`: Connection between nodes (source→target UUIDs)
- `Filter`: Loop exit criteria with counter and alternative target
- `CanvasLocation`: x,y coordinates for UI positioning

### Protocol Definitions (`autora_gui/protocols/`)

Component definitions that specify parameters and I/O types. Currently includes:
- `theorists.py`: DARTS regressor protocol definition

### JSON Storage (`autora_gui/JSON/`)

- `schemas/`: Auto-generated JSON schemas from Pydantic models
- `components/`: Component instance definitions (e.g., theorists/)

### Data Flow

1. Define `Protocol` classes with metadata and parameters
2. Instantiate `Component` instances referencing protocols
3. Connect components with `Link` objects
4. Serialize complete `Workflow` to JSON
5. UI visualizes workflow with nodes at specified canvas positions

## Code Style

- Python 3.11+ required
- Ruff for linting/formatting with 120 char line length
- Google-style docstrings
- Type hints for function arguments and returns
- Pydantic v2 for data validation

## Git Workflow

- Main branch: `main`
- Pre-push hook available: `cp ./githooks/pre-push .git/hooks/; chmod +x .git/hooks/pre-push`
