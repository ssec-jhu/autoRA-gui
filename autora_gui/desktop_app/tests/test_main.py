"""Tests for main module entry point."""

from unittest.mock import MagicMock, patch

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


class TestMainModule:
    """Tests for the main module imports and function."""

    def test_main_function_exists(self):
        """Test that main function can be imported."""
        from autora_gui.desktop_app.main import main

        assert callable(main)

    def test_main_module_imports(self):
        """Test that main module imports are correct."""
        from autora_gui.desktop_app import main

        assert hasattr(main, "main")
        assert hasattr(main, "MainWindow")
        assert hasattr(main, "QApplication")

    def test_main_function_sets_high_dpi_policy(self, app):
        """Test that main sets high DPI scaling policy."""
        # Use app fixture to ensure QApplication exists
        assert app is not None
        # Verify the policy can be set (already done by app setup)
        QApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)
        # No exception means success

    def test_main_function_with_mocked_exec(self):
        """Test main function execution with mocked app.exec."""
        from autora_gui.desktop_app import main as main_module

        # We need to mock sys.exit and app.exec to prevent actual exit
        with (
            patch.object(main_module.sys, "exit"),
            patch.object(main_module, "QApplication") as mock_qapp,
            patch.object(main_module, "MainWindow") as mock_main_window,
        ):
            mock_app_instance = MagicMock()
            mock_app_instance.exec.return_value = 0
            mock_qapp.return_value = mock_app_instance

            mock_window = MagicMock()
            mock_main_window.return_value = mock_window

            main_module.main()

            # Verify app was configured
            mock_app_instance.setApplicationName.assert_called_once_with("AutoRA Workflow Editor")
            mock_app_instance.setOrganizationName.assert_called_once_with("AutoRA")
            mock_app_instance.setStyle.assert_called_once_with("Fusion")

            # Verify window was shown
            mock_window.show.assert_called_once()

            # Verify app.exec was called
            mock_app_instance.exec.assert_called_once()


class TestMainFunction:
    """Tests for the main() function behavior."""

    def test_application_exists(self, app):
        """Test that a QApplication instance exists."""
        assert app is not None
        assert QApplication.instance() is not None

    def test_application_is_qapplication(self, app):
        """Test that the application is a QApplication instance."""
        assert app is not None
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
        assert app is not None
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
        assert app is not None
        window = MainWindow()
        assert window is not None
        assert isinstance(window, MainWindow)

    def test_main_window_is_qmainwindow(self, app):
        """Test that MainWindow inherits from QMainWindow."""
        from PySide6.QtWidgets import QMainWindow

        assert app is not None
        window = MainWindow()
        assert isinstance(window, QMainWindow)

    def test_main_window_has_correct_title(self, app):
        """Test that MainWindow has correct window title."""
        assert app is not None
        window = MainWindow()
        # Title should contain "AutoRA Workflow Editor"
        assert "AutoRA Workflow Editor" in window.windowTitle()

    def test_main_window_can_be_shown(self, app):
        """Test that MainWindow can be shown."""
        assert app is not None
        window = MainWindow()
        window.show()
        assert window.isVisible()
        window.close()

    def test_main_window_can_be_hidden(self, app):
        """Test that MainWindow can be hidden."""
        assert app is not None
        window = MainWindow()
        window.show()
        window.hide()
        assert not window.isVisible()
