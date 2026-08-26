/**
 * Loads the component catalog for the palette.
 *
 * - Local version: served by the FastAPI backend from the JSON files on disk
 *   (`GET /api/components`).
 * - Web/standalone version (no backend): read the same JSON files directly from
 *   the repository on GitHub at runtime.
 *
 * @module utils/componentLoader
 */

// Repository the web version reads components from.
const GITHUB_REPO = 'ssec-jhu/autoRA-gui'
const GITHUB_REF = 'main'
const COMPONENTS_PATH = 'autora_gui/JSON/components'

// Component category folders (the `controls` category is provided by the UI).
const CATEGORIES = ['theorists', 'experimentalists', 'experiment_runners']

// SessionStorage cache key and TTL (5 minutes) for the GitHub component catalog.
const CACHE_KEY = 'componentCache'
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Load all components, keyed by category. Tries the local backend first and
 * falls back to reading the JSON files from GitHub when no backend is present.
 *
 * @returns {Promise<Object.<string, Object[]>>} Components grouped by category.
 */
export async function loadComponents() {
  try {
    const res = await fetch('/api/components')
    if (res.ok) return await res.json()
  } catch {
    // No local backend (web/standalone build) — fall through to GitHub.
  }
  return fetchComponentsFromGitHub()
}

/**
 * Read every component JSON file from the repository on GitHub and group them by
 * category, matching the shape returned by the backend's `/api/components`.
 *
 * Results are cached in sessionStorage for CACHE_TTL_MS to avoid hitting the
 * GitHub API rate limit on repeated page loads.
 *
 * @returns {Promise<Object.<string, Object[]>>} Components grouped by category.
 */
export async function fetchComponentsFromGitHub() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const { timestamp, data } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_TTL_MS) {
        return data
      }
    }
  } catch {
    // sessionStorage unavailable or corrupted — proceed without cache.
  }

  const lists = await Promise.all(CATEGORIES.map(fetchCategoryFromGitHub))
  const components = { controls: [] }
  CATEGORIES.forEach((category, i) => {
    components[category] = lists[i]
  })

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: components }))
  } catch {
    // sessionStorage full or unavailable — skip caching.
  }

  return components
}

/**
 * Fetch and parse all component JSON files for a single category folder.
 *
 * @param {string} category - Category folder name (e.g. `theorists`).
 * @returns {Promise<Object[]>} Parsed components, sorted by name.
 */
async function fetchCategoryFromGitHub(category) {
  const listUrl =
    `https://api.github.com/repos/${GITHUB_REPO}/contents/` +
    `${COMPONENTS_PATH}/${category}?ref=${GITHUB_REF}`
  const res = await fetch(listUrl)
  if (!res.ok) {
    throw new Error(`Failed to list ${category} on GitHub: ${res.status}`)
  }

  const files = (await res.json()).filter(
    f => f.type === 'file' && f.name.endsWith('.json')
  )
  const items = await Promise.all(
    files.map(async (f) => {
      const fileRes = await fetch(f.download_url)
      if (!fileRes.ok) {
        throw new Error(`Failed to fetch ${f.name}: ${fileRes.status}`)
      }
      const data = await fileRes.json()
      data.file = f.name
      return data
    })
  )
  return items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}
