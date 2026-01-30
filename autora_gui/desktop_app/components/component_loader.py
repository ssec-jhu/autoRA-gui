"""Component loader for parsing JSON component files."""
import json
from pathlib import Path
from typing import Iterator

from ..models.node import ComponentDefinition


class ComponentLoader:
    """Loads component definitions from JSON files."""

    # Map folder names to protocol types
    CATEGORY_MAP = {
        "experimentalists": "experimentalist",
        "theorists": "theorist",
        "experiment_runners": "experiment_runner",
    }

    def __init__(self, components_dir: str | Path):
        """Initialize the loader.

        Args:
            components_dir: Path to the JSON/components directory.
        """
        self.components_dir = Path(components_dir)
        self._components: dict[str, list[ComponentDefinition]] = {}
        self._by_file_path: dict[str, ComponentDefinition] = {}

    def load_all(self) -> dict[str, list[ComponentDefinition]]:
        """Load all components from the components directory.

        Returns:
            Dict mapping category names to lists of component definitions.
        """
        self._components = {}
        self._by_file_path = {}

        for category_folder in self.CATEGORY_MAP.keys():
            category_path = self.components_dir / category_folder
            if category_path.is_dir():
                components = list(self._load_category(category_path, category_folder))
                if components:
                    self._components[category_folder] = components

        return self._components

    def _load_category(
        self, category_path: Path, category_name: str
    ) -> Iterator[ComponentDefinition]:
        """Load all components from a category folder."""
        for json_file in sorted(category_path.glob("*.json")):
            try:
                component = self._load_component(json_file)
                if component:
                    # Use relative path from components dir as the key
                    relative_path = f"{category_name}/{json_file.name}"
                    self._by_file_path[relative_path] = component
                    self._by_file_path[json_file.name] = component  # Also by filename only
                    yield component
            except Exception as e:
                print(f"Error loading {json_file}: {e}")

    def _load_component(self, file_path: Path) -> ComponentDefinition | None:
        """Load a single component from a JSON file."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Use relative path from components directory
            relative_path = str(file_path.relative_to(self.components_dir))
            return ComponentDefinition.from_json(data, relative_path)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error parsing {file_path}: {e}")
            return None

    def get_by_category(self, category: str) -> list[ComponentDefinition]:
        """Get all components in a category."""
        return self._components.get(category, [])

    def get_by_file_path(self, file_path: str) -> ComponentDefinition | None:
        """Get a component by its file path."""
        return self._by_file_path.get(file_path)

    def get_all_components(self) -> list[ComponentDefinition]:
        """Get all loaded components as a flat list."""
        result = []
        for components in self._components.values():
            result.extend(components)
        return result

    @property
    def categories(self) -> list[str]:
        """Get list of loaded category names."""
        return list(self._components.keys())

    @property
    def component_lookup(self) -> dict[str, ComponentDefinition]:
        """Get dict mapping file paths to components."""
        return self._by_file_path


def get_default_components_dir() -> Path:
    """Get the default path to the components directory."""
    # Relative to this file: ../../JSON/components
    module_dir = Path(__file__).parent.parent.parent
    return module_dir / "JSON" / "components"
