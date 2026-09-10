/**
 * Unit tests for `utils/componentLoader`.
 *
 * Covers the local-backend path and the bundled-JSON fallback (when no backend
 * is present). The component JSON is bundled at build time via
 * `import.meta.glob`, which Vitest evaluates against the real repository files,
 * so the fallback tests assert on the actual bundled catalog. All network
 * access is mocked via `vi.stubGlobal` so Vitest can restore it automatically.
 *
 * @module utils/componentLoader.test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadComponents, loadBundledComponents } from './componentLoader'

/** Build a mock fetch Response resolving to `data`. */
function jsonResponse(data, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(data) })
}

const CATEGORIES = ['controls', 'theorists', 'experimentalists', 'experiment_runners']

describe('componentLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loadComponents', () => {
    it('uses the local backend when /api/components responds', async () => {
      const backend = {
        controls: [],
        theorists: [{ uuid: 't', name: 'T' }],
        experimentalists: [],
        experiment_runners: []
      }
      vi.stubGlobal('fetch', vi.fn((url) => {
        expect(url).toBe('/api/components')
        return jsonResponse(backend)
      }))

      const result = await loadComponents()

      expect(result).toEqual(backend)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('falls back to the bundled JSON when the backend is unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no backend'))))

      const result = await loadComponents()

      expect(result).toEqual(loadBundledComponents())
    })

    it('falls back to the bundled JSON when the backend returns a non-ok status', async () => {
      vi.stubGlobal('fetch', vi.fn(() => jsonResponse(null, false, 404)))

      const result = await loadComponents()

      expect(result).toEqual(loadBundledComponents())
    })
  })

  describe('loadBundledComponents', () => {
    it('groups the bundled JSON into every category and adds an empty controls list', () => {
      const result = loadBundledComponents()

      CATEGORIES.forEach((category) => {
        expect(Array.isArray(result[category])).toBe(true)
      })
      expect(result.controls).toEqual([])
      // The repository ships component files, so at least one category is populated.
      const total =
        result.theorists.length +
        result.experimentalists.length +
        result.experiment_runners.length
      expect(total).toBeGreaterThan(0)
    })

    it('sorts components by name within a category and injects the file name', () => {
      const result = loadBundledComponents()

      for (const category of ['theorists', 'experimentalists', 'experiment_runners']) {
        const names = result[category].map(c => c.name || '')
        const sorted = [...names].sort((a, b) => a.localeCompare(b))
        expect(names).toEqual(sorted)
        result[category].forEach((c) => {
          expect(typeof c.file).toBe('string')
          expect(c.file.endsWith('.json')).toBe(true)
        })
      }
    })
  })
})
