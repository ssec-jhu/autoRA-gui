"""Entry point for the AutoRA desktop GUI application."""

import sys

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication

from .main_window import MainWindow


def main():
    """Run the application."""
    # Enable high DPI scaling
    QApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)

    app = QApplication(sys.argv)
    app.setApplicationName("AutoRA Workflow Editor")
    app.setOrganizationName("AutoRA")

    # Set application style
    app.setStyle("Fusion")

    # Create and show main window
    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
