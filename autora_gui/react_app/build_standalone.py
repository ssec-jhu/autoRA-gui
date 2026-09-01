#!/usr/bin/env python3
"""Build a standalone version of the React workflow editor.

This script:
1. Builds the React app with Vite
2. Combines the result into a single HTML file at the repo root

The standalone build loads its component catalog from the repository on GitHub
at runtime, so no component data is embedded at build time.
"""

import shutil
import subprocess
import sys
from pathlib import Path


def run_npm_build(react_app_dir):
    """Run npm build to create production bundle."""
    print("Running npm install...")
    result = subprocess.run(["npm", "install"], cwd=react_app_dir, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"npm install failed: {result.stderr}")
        return False

    print("Running npm run build...")
    result = subprocess.run(["npm", "run", "build"], cwd=react_app_dir, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"npm build failed: {result.stderr}")
        print(result.stdout)
        return False

    return True


def create_single_html(dist_dir, output_file):
    """Combine built assets into a single HTML file."""
    index_html = dist_dir / "index.html"
    if not index_html.exists():
        print(f"Error: {index_html} not found")
        return False

    html_content = index_html.read_text()

    # Find and inline CSS files
    assets_dir = dist_dir / "assets"
    for css_file in assets_dir.glob("*.css"):
        css_content = css_file.read_text()
        # Replace link tag with inline style
        css_filename = css_file.name
        html_content = html_content.replace(
            f'<link rel="stylesheet" crossorigin href="./assets/{css_filename}">', f"<style>{css_content}</style>"
        )
        # Also try without crossorigin
        html_content = html_content.replace(
            f'<link rel="stylesheet" href="./assets/{css_filename}">', f"<style>{css_content}</style>"
        )

    # Find and inline JS files
    for js_file in assets_dir.glob("*.js"):
        js_content = js_file.read_text()
        js_filename = js_file.name
        # Replace script tag with inline script
        html_content = html_content.replace(
            f'<script type="module" crossorigin src="./assets/{js_filename}"></script>',
            f'<script type="module">{js_content}</script>',
        )
        # Also try without crossorigin
        html_content = html_content.replace(
            f'<script type="module" src="./assets/{js_filename}"></script>',
            f'<script type="module">{js_content}</script>',
        )

    output_file.write_text(html_content)
    return True


def main():
    react_app_dir = Path(__file__).parent
    root_dir = react_app_dir.parent.parent
    dist_dir = react_app_dir / "dist"

    print("Building standalone React version...")

    # Run npm build
    if not run_npm_build(react_app_dir):
        print("Build failed!")
        sys.exit(1)

    print("Build completed successfully!")

    # Create single HTML file
    output_file = root_dir / "index.html"
    if create_single_html(dist_dir, output_file):
        print(f"Generated: {output_file}")
        print(f"Total size: {output_file.stat().st_size / 1024:.1f} KB")
    else:
        # Fallback: just copy the dist folder contents
        print("Could not create single HTML file, copying dist folder...")
        if output_file.exists():
            output_file.unlink()
        shutil.copy(dist_dir / "index.html", output_file)

        # Copy assets folder
        assets_dest = root_dir / "assets"
        if assets_dest.exists():
            shutil.rmtree(assets_dest)
        shutil.copytree(dist_dir / "assets", assets_dest)
        print(f"Copied: {output_file} and assets/")

    print("\nStandalone build complete!")
    print("Open this file in your browser:")
    print(f"  {output_file.absolute()}")


if __name__ == "__main__":
    main()
