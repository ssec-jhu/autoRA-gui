/**
 * Loads the component catalog for the palette.
 *
 * - Local version: served by the FastAPI backend from the JSON files on disk
 *   (`GET /api/components`).
 * - Web/standalone version (no backend): the JSON files are bundled into the
 *   build at build time, so the app ships with them and makes no network call.
 *
 * @module utils/componentLoader
 */

// Component category folders (the `controls` category is provided by the UI).
const CATEGORIES = ['theorists', 'experimentalists', 'experiment_runners']

// Component JSON files bundled at build time from autora_gui/JSON/components.
// Each key is the module path, e.g.
// '../../../JSON/components/theorists/bms_regressor.json'.
const COMPONENT_MODULES = import.meta.glob('../../../JSON/components/*/*.json', {
  eager: true,
  import: 'default',
})

/**
 * Load all components, keyed by category. Tries the local backend first and
 * falls back to the JSON bundled into the build when no backend is present.
 *
 * @returns {Promise<Object.<string, Object[]>>} Components grouped by category.
 */
export async function loadComponents() {
  try {
    const res = await fetch('/api/components')
    if (res.ok) return await res.json()
  } catch {
    // No local backend (web/standalone build) — fall through to bundled JSON.
  }
  return loadBundledComponents()
}

/**
 * Group the JSON files bundled at build time by category, matching the shape
 * returned by the backend's `/api/components`.
 *
 * @returns {Object.<string, Object[]>} Components grouped by category.
 */
export function loadBundledComponents() {
  const components = { controls: [] }
  CATEGORIES.forEach((category) => {
    components[category] = []
  })

  for (const [path, data] of Object.entries(COMPONENT_MODULES)) {
    // path: '../../../JSON/components/<category>/<file>.json'
    const parts = path.split('/')
    const file = parts[parts.length - 1]
    const category = parts[parts.length - 2]
    if (!components[category]) continue
    components[category].push({ ...data, file })
  }

  CATEGORIES.forEach((category) => {
    components[category].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  })

  return components
}
