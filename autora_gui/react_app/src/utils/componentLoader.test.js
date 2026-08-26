/**
 * Unit tests for `utils/componentLoader`.
 *
 * Covers the local-backend path, the GitHub fallback path (when no backend is
 * present), per-category sorting, and sessionStorage caching. All network
 * access is mocked via `vi.stubGlobal` so Vitest can restore it automatically.
 *
 * @module utils/componentLoader.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadComponents, fetchComponentsFromGitHub } from './componentLoader'

/** Build a mock fetch Response resolving to `data`. */
function jsonResponse(data, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(data) })
}

/** Minimal stub for sessionStorage used inside the GitHub fallback path. */
function makeSessionStorageStub() {
  const store = {}
  return {
    getItem: vi.fn((k) => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = v }),
    removeItem: vi.fn((k) => { delete store[k] }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) })
  }
}

describe('componentLoader', () => {
  beforeEach(() => {
    // Replace sessionStorage with an isolated in-memory stub so tests don't
    // share cache state and the real sessionStorage is left untouched.
    vi.stubGlobal('sessionStorage', makeSessionStorageStub())
  })

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

    it('falls back to GitHub when the backend is unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url === '/api/components') return Promise.reject(new Error('no backend'))
        if (url.includes('/contents/') && url.includes('theorists')) {
          return jsonResponse([
            { type: 'file', name: 'a.json', download_url: 'https://raw/a.json' }
          ])
        }
        if (url.includes('/contents/')) return jsonResponse([])
        if (url === 'https://raw/a.json') return jsonResponse({ uuid: 'a', name: 'Alpha' })
        throw new Error('unexpected url ' + url)
      }))

      const result = await loadComponents()

      expect(result.theorists).toEqual([{ uuid: 'a', name: 'Alpha', file: 'a.json' }])
      expect(result.controls).toEqual([])
    })

    it('falls back to GitHub when the backend returns a non-ok status', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url === '/api/components') return jsonResponse(null, false, 404)
        if (url.includes('/contents/')) return jsonResponse([])
        throw new Error('unexpected url ' + url)
      }))

      const result = await loadComponents()

      expect(result).toEqual({
        controls: [],
        theorists: [],
        experimentalists: [],
        experiment_runners: []
      })
    })
  })

  describe('fetchComponentsFromGitHub', () => {
    it('sorts components by name within a category and injects the file name', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.includes('/contents/') && url.includes('experimentalists')) {
          return jsonResponse([
            { type: 'file', name: 'z.json', download_url: 'https://raw/z.json' },
            { type: 'file', name: 'a.json', download_url: 'https://raw/a.json' }
          ])
        }
        if (url.includes('/contents/')) return jsonResponse([])
        if (url === 'https://raw/z.json') return jsonResponse({ uuid: 'z', name: 'Zeta' })
        if (url === 'https://raw/a.json') return jsonResponse({ uuid: 'a', name: 'Alpha' })
        throw new Error('unexpected url ' + url)
      }))

      const result = await fetchComponentsFromGitHub()

      expect(result.experimentalists.map(c => c.name)).toEqual(['Alpha', 'Zeta'])
      expect(result.experimentalists[0].file).toBe('a.json')
    })

    it('serves cached results on the second call without hitting the network', async () => {
      const mockFetch = vi.fn((url) => {
        if (url.includes('/contents/')) return jsonResponse([])
        throw new Error('unexpected url ' + url)
      })
      vi.stubGlobal('fetch', mockFetch)

      // First call — populates the cache.
      await fetchComponentsFromGitHub()
      const firstCallCount = mockFetch.mock.calls.length
      expect(firstCallCount).toBeGreaterThan(0)

      // Second call — should be served from sessionStorage, no new fetch calls.
      await fetchComponentsFromGitHub()
      expect(mockFetch.mock.calls.length).toBe(firstCallCount)
    })
  })
})
