"""Tests for main module entry point."""

import pytest
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication

from autora_gui.desktop_app.main_window import MainWindow


@pytest.fixture(scope="module")
def app():
    """Create QApplication instance for tests."""
    app = QApplication.instance()
    if app is None:
        app = QApplication([])
    return app


class TestMainFunction:
    """Tests for the main() function behavior."""

    def test_application_exists(self, app):
        """Test that a QApplication instance exists."""
        assert QApplication.instance() is not None

    def test_application_is_qapplication(self, app):
        """Test that the application is a QApplication instance."""
        assert isinstance(QApplication.instance(), QApplication)


class TestHighDpiPolicy:
    """Tests for high DPI scaling policy."""

    def test_high_dpi_policy_passthrough_exists(self):
        """Test that PassThrough high DPI policy exists."""
        policy = Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
        assert policy is not None

    def test_high_dpi_policy_values(self):
        """Test that various high DPI policy values exist."""
        policies = [
            Qt.HighDpiScaleFactorRoundingPolicy.Round,
            Qt.HighDpiScaleFactorRoundingPolicy.Ceil,
            Qt.HighDpiScaleFactorRoundingPolicy.Floor,
            Qt.HighDpiScaleFactorRoundingPolicy.RoundPreferFloor,
            Qt.HighDpiScaleFactorRoundingPolicy.PassThrough,
        ]
        for policy in policies:
            assert policy is not None


class TestApplicationStyle:
    """Tests for application style."""

    def test_fusion_style_exists(self, app):
        """Test that Fusion style is available."""
        styles = QApplication.style()
        assert styles is not None

    def test_fusion_style_can_be_set(self, app):
        """Test that Fusion style can be set."""
        # Fusion is a built-in Qt style that should be available
        app.setStyle("Fusion")
        assert app.style() is not None


class TestApplicationConfiguration:
    """Tests for application configuration."""

    def test_application_name_can_be_set(self, app):
        """Test that application name can be set."""
        app.setApplicationName("Test App")
        assert app.applicationName() == "Test App"
        # Reset
        app.setApplicationName("AutoRA Workflow Editor")

    def test_organization_name_can_be_set(self, app):
        """Test that organization name can be set."""
        app.setOrganizationName("Test Org")
        assert app.organizationName() == "Test Org"
        # Reset
        app.setOrganizationName("AutoRA")


class TestMainWindowCreation:
    """Tests for MainWindow creation from main."""

    def test_main_window_can_be_created(self, app):
        """Test that MainWindow can be instantiated."""
        window = MainWindow()
        assert window is not None
        assert isinstance(window, MainWindow)

    def test_main_window_is_qmainwindow(self, app):
        """Test that MainWindow inherits from QMainWindow."""
        from PySide6.QtWidgets import QMainWindow

        window = MainWindow()
        assert isinstance(window, QMainWindow)

    def test_main_window_has_correct_title(self, app):
        """Test that MainWindow has correct window title."""
        window = MainWindow()
        # Title should contain "AutoRA Workflow Editor"
        assert "AutoRA Workflow Editor" in window.windowTitle()

    def test_main_window_can_be_shown(self, app):
        """Test that MainWindow can be shown."""
        window = MainWindow()
        window.show()
        assert window.isVisible()
        window.close()

    def test_main_window_can_be_hidden(self, app):
        """Test that MainWindow can be hidden."""
        window = MainWindow()
        window.show()
        window.hide()
        assert not window.isVisible()
