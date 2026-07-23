# SSEC-JHU autora_gui

[![CI](https://github.com/ssec-jhu/autoRA-gui/actions/workflows/ci.yml/badge.svg)](https://github.com/ssec-jhu/autoRA-gui/actions/workflows/ci.yml)
[![Docs](https://github.com/ssec-jhu/autoRA-gui/actions/workflows/deploy-pages.yml/badge.svg)](https://ssec-jhu.github.io/autoRA-gui)
[![codecov](https://codecov.io/gh/ssec-jhu/autoRA-gui/branch/main/graph/badge.svg?token=Ry6ZXSfGa3)](https://codecov.io/gh/ssec-jhu/autoRA-gui)
[![Security](https://github.com/ssec-jhu/autoRA-gui/actions/workflows/security.yml/badge.svg)](https://github.com/ssec-jhu/autoRA-gui/actions/workflows/security.yml)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21515099.svg)](https://doi.org/10.5281/zenodo.21515099)
[![PyPI](https://img.shields.io/pypi/v/autora-gui.svg)](https://pypi.org/project/autora-gui/)


![SSEC-JHU Logo](docs/_static/SSEC_logo_horiz_blue_1152x263.png)

**autora-gui** is a browser-based, visual workflow editor for
[AutoRA](https://autoresearch.github.io/autora/) (Automated Research Assistant). It lets you
assemble AutoRA theorists, experimentalists, and experiment runners into a closed-loop research
workflow by dragging components onto a canvas, wiring them together, and editing their parameters —
then export the result to a runnable AutoRA workflow.

The editor is served by a [FastAPI](https://fastapi.tiangolo.com/) backend that reads component and
schema definitions from `autora_gui/JSON/`, with a [React](https://react.dev/) front-end
(`autora_gui/react_app`). A live, self-contained build is deployed to GitHub Pages:

**🔗 Live demo: https://ssec-jhu.github.io/autoRA-gui**

## Repository layout

| Path | Description |
| --- | --- |
| `autora_gui/react_app/` | Primary React + Vite front-end and its FastAPI backend (`server.py`). |
| `autora_gui/JSON/` | Component and JSON-schema definitions that drive the editor. |
| `autora_gui/data_model.py` | Pydantic data models describing workflows and components. |
| `autora_gui/workflow_samples/` | Example exported workflows (`.py`, `.ipynb`, `.json`). |
| `docs/` | Sphinx documentation sources. |

---

# Quickstart Guide

```bash
# 1. Clone the repository
git clone git@github.com:ssec-jhu/autoRA-gui.git
cd autoRA-gui

# 2. Create and activate a conda environment
conda create -n autora_gui python=3.11 pip
conda activate autora_gui

# 3. Install the package (editable) with dev dependencies
pip install -e ".[dev]"

# 4. Start the FastAPI backend (from the react_app directory)
cd autora_gui/react_app
uvicorn server:app --reload --port 8000

# 5. In a second terminal, start the React dev server
cd autora_gui/react_app
npm install
npm run dev
```

The editor is then available at **http://localhost:3000** (the front-end talks to the backend on
port 8000). Prefer no local setup at all? Use the [live demo](https://ssec-jhu.github.io/autoRA-gui).

---

# Installation

### Create a conda virtual environment

For additional commands see the [Conda cheat-sheet](https://docs.conda.io/projects/conda/en/4.6.0/_downloads/52a95608c49671267e40c689e0bc00ca/conda-cheatsheet.pdf).

 * Download and install either [miniconda](https://docs.conda.io/en/latest/miniconda.html#installing) or [anaconda](https://docs.anaconda.com/free/anaconda/install/index.html).
 * Create a new environment: ``conda create -n autora_gui python=3.11 pip`` (Python 3.11+ is required).
 * Activate it: ``conda activate autora_gui``.
 * ``cd`` into the repo directory.
 * Install the Python dependencies. There are two common options:
   * **For development with tox (recommended):** ``pip install -r requirements/dev.txt``.
   * **To run everything outside of tox:** ``pip install -r requirements/all.txt``.

### Install the front-end dependencies (Node.js)

The React front-end requires [Node.js](https://nodejs.org/) (v20 recommended):

```bash
cd autora_gui/react_app
npm install
```

# Build with Python

  * ``cd`` into the repo directory and activate your environment: ``conda activate autora_gui``.
  * Build and install the package: ``pip install .``.
  * For dev/editable mode (repo changes are reflected in the installed package on kernel restart —
    the preferred method for development): ``pip install -e .``.
    _NOTE: to pull in the looser-constrained dev extras at the same time, use ``pip install -e ".[dev]"``._
  * To build the distributable wheel and source tarball (this is what CI publishes to PyPI):
    ``tox -e build-dist`` (or ``python -m build``). Artifacts are written to ``dist/``.

# Run with Python

The editor has two processes: the FastAPI backend and the React front-end.

  * Activate your environment and ``cd`` into the front-end directory:
    ```bash
    conda activate autora_gui
    cd autora_gui/react_app
    ```
  * Start the backend API:
    ```bash
    uvicorn server:app --reload --port 8000
    ```
  * In a second terminal, start the front-end dev server:
    ```bash
    cd autora_gui/react_app
    npm run dev
    ```
  * Open **http://localhost:3000** in your browser.

To produce the single-file, self-contained build (the one deployed to GitHub Pages), run
``python build_standalone.py`` from ``autora_gui/react_app`` and open the generated ``index.html``.

---

# Docker

The repository ships a [`Dockerfile`](Dockerfile) that installs the production dependencies
(``requirements/prd.txt``) and serves the FastAPI backend. On every push, CI builds this image and
publishes it to the GitHub Container Registry at ``ghcr.io/ssec-jhu/autora-gui``
(see [ci.yml](https://github.com/ssec-jhu/autoRA-gui/blob/main/.github/workflows/ci.yml)).

### Build

  * Download & install Docker — see the [Docker install docs](https://docs.docker.com/get-docker/).
  * ``cd`` into the repo directory.
  * Build the image: ``docker build -t autora-gui .``.

### Run

  * Run a container, mapping the backend port:
    ```bash
    docker run -d -p 8000:8000 autora-gui
    ```
    The backend API is then available at http://localhost:8000.
  * Alternatively, pull the pre-built image from the registry, e.g.:
    ```bash
    docker pull ghcr.io/ssec-jhu/autora-gui:main
    ```

The container serves the backend API only; the React front-end is built and served separately (see
[Run with Python](#run-with-python) or the [live demo](https://ssec-jhu.github.io/autoRA-gui)).

---

# Testing

_NOTE: The following steps require ``pip install -r requirements/dev.txt``._

## Using tox

Tox runs each check in its own isolated virtual environment, matching the CI on GitHub Actions
(see [ci.yml](https://github.com/ssec-jhu/autoRA-gui/blob/main/.github/workflows/ci.yml)).

* Run the full suite (style, security, tests, docs, and package build): ``tox``.
* Run an individual environment with ``tox -e {env}``:

  | Command | What it does |
  | --- | --- |
  | ``tox -e check-style`` | Lint and format check with ruff. |
  | ``tox -e check-security`` | Security scan with bandit. |
  | ``tox -e format`` | Auto-format code and sort imports with ruff. |
  | ``tox -e test`` | Run the pytest suite with coverage. |
  | ``tox -e build-docs`` | Build the Sphinx HTML docs. |
  | ``tox -e build-dist`` | Build the wheel and source distribution. |

## Outside of tox

The following assume all requirements are installed into your conda environment, e.g. with
``pip install -r requirements/all.txt``.

_NOTE: Tox will run these for you; the steps below are for running them directly._

### Linting

Checks style, imports, and simple code-analysis issues using [ruff](https://docs.astral.sh/ruff/).
  * ``cd`` into the repo directory and activate your environment.
  * Check formatting: ``ruff format . --check``.
  * Check lint rules: ``ruff check .``.
  * These can run automatically on every ``git push`` by installing the provided ``pre-push`` git
    hook: ``cp ./githooks/pre-push .git/hooks/; chmod +x .git/hooks/pre-push``.

### Security Checks

Checks for security concerns using [Bandit](https://bandit.readthedocs.io/en/latest/index.html).
  * ``cd`` into the repo directory.
  * Run: ``bandit -c pyproject.toml --severity-level=medium -r autora_gui``.

### Unit Tests

Tests core package functionality at a modular level with [pytest](https://docs.pytest.org/). Test
suites live under ``autora_gui/tests``, ``autora_gui/js_app/tests``, and
``autora_gui/react_app/tests``.
  * ``cd`` into the repo directory.
  * Run all Python tests with coverage: ``pytest --cov=./``.
  * Run a specific test: ``pytest autora_gui/tests/test_util.py``.
  * Run the React front-end tests: from ``autora_gui/react_app`` run ``npm test`` (or
    ``npm run test:coverage``).

### Build Docs

Builds, tests, and lets you view the [Sphinx](https://www.sphinx-doc.org/) documentation.
  * The simplest route is ``tox -e build-docs``.
  * To build manually:
    * ``pip install -r requirements/docs.txt``.
    * ``cd docs``.
    * ``make clean``.
    * ``make html``.
    * View the docs in your browser: ``open docs/_build/html/index.html``.

The docs are automatically built and deployed to https://ssec-jhu.github.io/autoRA-gui.
