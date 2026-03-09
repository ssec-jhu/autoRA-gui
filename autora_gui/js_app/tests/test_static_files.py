"""Tests for static files and templates."""

from fastapi.testclient import TestClient

from autora_gui.js_app.main import BASE_DIR, STATIC_DIR, TEMPLATES_DIR


class TestDirectoryStructure:
    """Tests for verifying the expected directory structure exists."""

    def test_base_dir_exists(self) -> None:
        """Test that the base directory exists."""
        assert BASE_DIR.exists()
        assert BASE_DIR.is_dir()

    def test_static_dir_exists(self) -> None:
        """Test that the static directory exists."""
        assert STATIC_DIR.exists()
        assert STATIC_DIR.is_dir()

    def test_templates_dir_exists(self) -> None:
        """Test that the templates directory exists."""
        assert TEMPLATES_DIR.exists()
        assert TEMPLATES_DIR.is_dir()

    def test_css_directory_exists(self) -> None:
        """Test that the CSS directory exists."""
        css_dir = STATIC_DIR / "css"
        assert css_dir.exists()
        assert css_dir.is_dir()

    def test_js_directory_exists(self) -> None:
        """Test that the JS directory exists."""
        js_dir = STATIC_DIR / "js"
        assert js_dir.exists()
        assert js_dir.is_dir()


class TestStaticFileContent:
    """Tests for verifying static file content."""

    def test_styles_css_exists(self) -> None:
        """Test that styles.css exists."""
        css_file = STATIC_DIR / "css" / "styles.css"
        assert css_file.exists()

    def test_styles_css_contains_expected_content(self) -> None:
        """Test that styles.css contains expected CSS variables."""
        css_file = STATIC_DIR / "css" / "styles.css"
        content = css_file.read_text()

        # Check for CSS variables
        assert "--bg-primary" in content
        assert "--accent-primary" in content
        assert "--color-theorists" in content

        # Check for key classes
        assert ".workflow-node" in content
        assert ".connection-line" in content
        assert ".component-item" in content

    def test_main_js_exists(self) -> None:
        """Test that main.js module exists."""
        js_file = STATIC_DIR / "js" / "modules" / "main.js"
        assert js_file.exists()

    def test_modules_contain_expected_functions(self) -> None:
        """Test that JS modules contain expected functions."""
        modules_dir = STATIC_DIR / "js" / "modules"

        # Check main.js has init
        main_content = (modules_dir / "main.js").read_text()
        assert "function init()" in main_content

        # Check nodes.js has node functions
        nodes_content = (modules_dir / "nodes.js").read_text()
        assert "function createNode" in nodes_content
        assert "function renderNode" in nodes_content

        # Check connections.js has connection functions
        connections_content = (modules_dir / "connections.js").read_text()
        assert "function createConnection" in connections_content

        # Check workflow.js has save/load
        workflow_content = (modules_dir / "workflow.js").read_text()
        assert "function saveWorkflow" in workflow_content
        assert "function loadWorkflow" in workflow_content

    def test_state_module_contains_state_object(self) -> None:
        """Test that state.js contains the state management object."""
        js_file = STATIC_DIR / "js" / "modules" / "state.js"
        content = js_file.read_text()

        assert "export const state = {" in content
        assert "nodes:" in content
        assert "connections:" in content


class TestTemplateContent:
    """Tests for verifying template content."""

    def test_index_html_exists(self) -> None:
        """Test that index.html exists."""
        html_file = TEMPLATES_DIR / "index.html"
        assert html_file.exists()

    def test_index_html_has_required_structure(self) -> None:
        """Test that index.html has required HTML structure."""
        html_file = TEMPLATES_DIR / "index.html"
        content = html_file.read_text()

        # Check for DOCTYPE and basic structure
        assert "<!DOCTYPE html>" in content
        assert "<html" in content
        assert "</html>" in content

        # Check for head elements
        assert "<head>" in content
        assert "<title>" in content
        assert 'rel="stylesheet"' in content

        # Check for body elements
        assert "<body>" in content
        assert "</body>" in content

    def test_index_html_has_three_panel_layout(self) -> None:
        """Test that index.html has the three-panel layout."""
        html_file = TEMPLATES_DIR / "index.html"
        content = html_file.read_text()

        # Left panel - component palette
        assert "component-palette" in content
        assert "panel-left" in content

        # Center panel - canvas
        assert "workflow-canvas" in content
        assert "panel-center" in content

        # Right panel - properties
        assert "properties-panel" in content
        assert "panel-right" in content

    def test_index_html_has_node_template(self) -> None:
        """Test that index.html has the node template."""
        html_file = TEMPLATES_DIR / "index.html"
        content = html_file.read_text()

        assert '<template id="node-template">' in content
        assert "workflow-node" in content
        assert "node-header" in content
        assert "node-body" in content

    def test_index_html_has_toolbar(self) -> None:
        """Test that index.html has the toolbar."""
        html_file = TEMPLATES_DIR / "index.html"
        content = html_file.read_text()

        assert "toolbar" in content
        assert "btn-save" in content
        assert "btn-load" in content
        assert "btn-clear" in content

    def test_index_html_loads_main_module(self) -> None:
        """Test that index.html loads the main ES module."""
        html_file = TEMPLATES_DIR / "index.html"
        content = html_file.read_text()

        assert 'type="module"' in content
        assert "/static/js/modules/main.js" in content


class TestStaticFilesServing:
    """Tests for static file serving via the API."""

    def test_css_file_is_served(self, client: TestClient) -> None:
        """Test that CSS files are served correctly."""
        response = client.get("/static/css/styles.css")
        assert response.status_code == 200
        assert "text/css" in response.headers["content-type"]

    def test_js_file_is_served(self, client: TestClient) -> None:
        """Test that JS files are served correctly."""
        response = client.get("/static/js/modules/main.js")
        assert response.status_code == 200
        assert "javascript" in response.headers["content-type"]

    def test_nonexistent_static_file_returns_404(self, client: TestClient) -> None:
        """Test that 404 is returned for non-existent static files."""
        response = client.get("/static/nonexistent.xyz")
        assert response.status_code == 404
