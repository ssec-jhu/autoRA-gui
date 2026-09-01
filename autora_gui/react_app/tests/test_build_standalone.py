"""Tests for build_standalone.py"""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from autora_gui.react_app.build_standalone import (
    create_single_html,
    run_npm_build,
)


class TestCreateSingleHtml:
    """Tests for create_single_html function."""

    def test_returns_false_if_index_not_found(self):
        """Test that create_single_html returns False if index.html doesn't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dist_dir = Path(tmpdir) / "dist"
            dist_dir.mkdir()
            output_file = Path(tmpdir) / "output.html"

            result = create_single_html(dist_dir, output_file)

            assert result is False
            assert not output_file.exists()

    def test_inlines_css_with_crossorigin(self):
        """Test that CSS files are inlined correctly with crossorigin attribute."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dist_dir = Path(tmpdir) / "dist"
            assets_dir = dist_dir / "assets"
            assets_dir.mkdir(parents=True)

            # Create index.html with CSS link
            index_html = dist_dir / "index.html"
            index_html.write_text(
                '<html><head><link rel="stylesheet" crossorigin href="./assets/style.css"></head></html>'
            )

            # Create CSS file
            css_file = assets_dir / "style.css"
            css_file.write_text("body { color: red; }")

            output_file = Path(tmpdir) / "output.html"
            result = create_single_html(dist_dir, output_file)

            assert result is True
            content = output_file.read_text()
            assert "<style>body { color: red; }</style>" in content
            assert "href=" not in content

    def test_inlines_css_without_crossorigin(self):
        """Test that CSS files are inlined correctly without crossorigin attribute."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dist_dir = Path(tmpdir) / "dist"
            assets_dir = dist_dir / "assets"
            assets_dir.mkdir(parents=True)

            index_html = dist_dir / "index.html"
            index_html.write_text('<html><head><link rel="stylesheet" href="./assets/style.css"></head></html>')

            css_file = assets_dir / "style.css"
            css_file.write_text(".test { margin: 0; }")

            output_file = Path(tmpdir) / "output.html"
            result = create_single_html(dist_dir, output_file)

            assert result is True
            content = output_file.read_text()
            assert "<style>.test { margin: 0; }</style>" in content

    def test_inlines_js_with_crossorigin(self):
        """Test that JS files are inlined correctly with crossorigin attribute."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dist_dir = Path(tmpdir) / "dist"
            assets_dir = dist_dir / "assets"
            assets_dir.mkdir(parents=True)

            index_html = dist_dir / "index.html"
            index_html.write_text(
                '<html><body><script type="module" crossorigin src="./assets/main.js"></script></body></html>'
            )

            js_file = assets_dir / "main.js"
            js_file.write_text('console.log("hello");')

            output_file = Path(tmpdir) / "output.html"
            result = create_single_html(dist_dir, output_file)

            assert result is True
            content = output_file.read_text()
            assert '<script type="module">console.log("hello");</script>' in content
            assert "src=" not in content

    def test_inlines_js_without_crossorigin(self):
        """Test that JS files are inlined correctly without crossorigin attribute."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dist_dir = Path(tmpdir) / "dist"
            assets_dir = dist_dir / "assets"
            assets_dir.mkdir(parents=True)

            index_html = dist_dir / "index.html"
            index_html.write_text('<html><body><script type="module" src="./assets/app.js"></script></body></html>')

            js_file = assets_dir / "app.js"
            js_file.write_text("const x = 1;")

            output_file = Path(tmpdir) / "output.html"
            result = create_single_html(dist_dir, output_file)

            assert result is True
            content = output_file.read_text()
            assert '<script type="module">const x = 1;</script>' in content

    def test_inlines_multiple_assets(self):
        """Test that multiple CSS and JS files are all inlined."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dist_dir = Path(tmpdir) / "dist"
            assets_dir = dist_dir / "assets"
            assets_dir.mkdir(parents=True)

            index_html = dist_dir / "index.html"
            index_html.write_text(
                "<html>"
                '<head><link rel="stylesheet" crossorigin href="./assets/a.css">'
                '<link rel="stylesheet" crossorigin href="./assets/b.css"></head>'
                '<body><script type="module" crossorigin src="./assets/x.js"></script>'
                '<script type="module" crossorigin src="./assets/y.js"></script></body>'
                "</html>"
            )

            (assets_dir / "a.css").write_text(".a {}")
            (assets_dir / "b.css").write_text(".b {}")
            (assets_dir / "x.js").write_text("let x;")
            (assets_dir / "y.js").write_text("let y;")

            output_file = Path(tmpdir) / "output.html"
            result = create_single_html(dist_dir, output_file)

            assert result is True
            content = output_file.read_text()
            assert "<style>.a {}</style>" in content
            assert "<style>.b {}</style>" in content
            assert '<script type="module">let x;</script>' in content
            assert '<script type="module">let y;</script>' in content


class TestRunNpmBuild:
    """Tests for run_npm_build function."""

    @patch("autora_gui.react_app.build_standalone.subprocess.run")
    def test_returns_true_on_success(self, mock_run):
        """Test that run_npm_build returns True when both commands succeed."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

        result = run_npm_build(Path("/fake/path"))

        assert result is True
        assert mock_run.call_count == 2

    @patch("autora_gui.react_app.build_standalone.subprocess.run")
    def test_returns_false_when_npm_install_fails(self, mock_run):
        """Test that run_npm_build returns False when npm install fails."""
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="npm install error")

        result = run_npm_build(Path("/fake/path"))

        assert result is False
        assert mock_run.call_count == 1  # Should stop after first failure

    @patch("autora_gui.react_app.build_standalone.subprocess.run")
    def test_returns_false_when_npm_build_fails(self, mock_run):
        """Test that run_npm_build returns False when npm build fails."""
        # First call (npm install) succeeds, second call (npm build) fails
        mock_run.side_effect = [
            MagicMock(returncode=0, stdout="", stderr=""),
            MagicMock(returncode=1, stdout="build output", stderr="build error"),
        ]

        result = run_npm_build(Path("/fake/path"))

        assert result is False
        assert mock_run.call_count == 2

    @patch("autora_gui.react_app.build_standalone.subprocess.run")
    def test_calls_npm_install_first(self, mock_run):
        """Test that npm install is called before npm build."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        test_path = Path("/test/react/app")

        run_npm_build(test_path)

        calls = mock_run.call_args_list
        assert calls[0][0][0] == ["npm", "install"]
        assert calls[0][1]["cwd"] == test_path

    @patch("autora_gui.react_app.build_standalone.subprocess.run")
    def test_calls_npm_run_build_second(self, mock_run):
        """Test that npm run build is called after npm install."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        test_path = Path("/test/react/app")

        run_npm_build(test_path)

        calls = mock_run.call_args_list
        assert calls[1][0][0] == ["npm", "run", "build"]
        assert calls[1][1]["cwd"] == test_path

    @patch("autora_gui.react_app.build_standalone.subprocess.run")
    def test_captures_output(self, mock_run):
        """Test that subprocess output is captured."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

        run_npm_build(Path("/fake/path"))

        for call in mock_run.call_args_list:
            assert call[1]["capture_output"] is True
            assert call[1]["text"] is True


class TestMain:
    """Tests for main function."""

    def test_main_exits_on_build_failure(self):
        """Test that main exits with code 1 when build fails."""
        from autora_gui.react_app.build_standalone import main

        with (
            patch("autora_gui.react_app.build_standalone.run_npm_build", return_value=False),
            tempfile.TemporaryDirectory() as tmpdir,
            patch("autora_gui.react_app.build_standalone.Path") as mock_path,
        ):
            mock_path.return_value.parent = Path(tmpdir)

            with pytest.raises(SystemExit) as exc_info:
                main()

            assert exc_info.value.code == 1

    def test_main_calls_all_build_steps(self):
        """Test that main runs the npm build and single-HTML steps."""
        from autora_gui.react_app.build_standalone import main

        with tempfile.TemporaryDirectory() as tmpdir:
            tmppath = Path(tmpdir)

            # Create directory structure: tmpdir/repo/autora_gui/react_app
            react_app_dir = tmppath / "repo" / "autora_gui" / "react_app"
            react_app_dir.mkdir(parents=True, exist_ok=True)

            # root_dir will be tmpdir/repo (react_app_dir.parent.parent)
            root_dir = react_app_dir.parent.parent
            output_file = root_dir / "index.html"

            with (
                patch("autora_gui.react_app.build_standalone.run_npm_build", return_value=True) as mock_npm,
                patch(
                    "autora_gui.react_app.build_standalone.create_single_html",
                    return_value=True,
                ) as mock_html,
                patch("autora_gui.react_app.build_standalone.Path") as mock_path,
            ):
                # Mock Path(__file__).parent to return our test react_app_dir
                mock_path.return_value.parent = react_app_dir

                # Pre-create output file for stat() call
                output_file.write_text("<html></html>")

                main()

                mock_npm.assert_called_once()
                mock_html.assert_called_once()
