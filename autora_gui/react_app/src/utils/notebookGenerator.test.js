/**
 * Unit tests for `utils/notebookGenerator`.
 *
 * Covers generation of a Jupyter notebook (nbformat 4) object and its JSON string
 * form from a workflow state, verifying cell structure, metadata/kernelspec, and
 * that workflow components are translated into the expected notebook content.
 *
 * @module utils/notebookGenerator.test
 */
import { describe, it, expect } from 'vitest'
import { generateNotebook, generateNotebookString } from './notebookGenerator'

// A minimal workflow: start -> sampler experimentalist -> theorist -> end
function buildState() {
  return {
    nodes: [
      { id: 'start-1', type: 'start_point' },
      {
        id: 'exp-1',
        type: 'component',
        name: 'Random Sampler',
        protocolUuid: 'proto-exp',
        parameters: { num_samples: 5 }
      },
      {
        id: 'theo-1',
        type: 'component',
        name: 'BMS Regressor',
        protocolUuid: 'proto-theo',
        parameters: { epochs: 100 }
      },
      { id: 'end-1', type: 'end_point' }
    ],
    connections: [
      { sourceId: 'start-1', targetId: 'exp-1' },
      { sourceId: 'exp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'end-1' }
    ],
    components: {
      experimentalists: [
        {
          uuid: 'proto-exp',
          importPath: 'autora.experimentalist.random',
          pythonName: 'sample',
          file: 'random_sampler.json',
          protocolType: 'experimentalist',
          pipInstall: 'autora-core'
        }
      ],
      theorists: [
        {
          uuid: 'proto-theo',
          importPath: 'autora.theorist.bms',
          pythonName: 'BMSRegressor',
          protocolType: 'theorist',
          pipInstall: 'autora[theorist-bms]'
        }
      ]
    }
  }
}

describe('generateNotebook', () => {
  it('produces a valid nbformat 4 notebook object', () => {
    const nb = generateNotebook(buildState())
    expect(nb.nbformat).toBe(4)
    expect(Array.isArray(nb.cells)).toBe(true)
    expect(nb.metadata.kernelspec.name).toBe('python3')
  })

  it('puts pip install in the first code cell, covering every package', () => {
    const nb = generateNotebook(buildState())
    const firstCode = nb.cells.find(c => c.cell_type === 'code')
    const src = firstCode.source.join('')
    expect(src.startsWith('%pip install')).toBe(true)
    expect(src).toContain('autora-core')
    expect(src).toContain('autora[theorist-bms]')
  })

  it('orders sections: install -> imports -> definitions -> run', () => {
    const nb = generateNotebook(buildState())
    const headers = nb.cells
      .filter(c => c.cell_type === 'markdown')
      .map(c => c.source.join(''))
    expect(headers).toContain('## 1. Install dependencies')
    expect(headers).toContain('## 2. Imports')
    expect(headers).toContain('## 3. Component definitions')
    expect(headers).toContain('## 4. Run the workflow')
  })

  it('emits the component imports in the imports cell', () => {
    const nb = generateNotebook(buildState())
    const allCode = nb.cells
      .filter(c => c.cell_type === 'code')
      .map(c => c.source.join(''))
      .join('\n')
    expect(allCode).toContain('from autora.experimentalist.random import sample as random_sampler')
    expect(allCode).toContain('from autora.theorist.bms import BMSRegressor')
  })

  it('calls experimentalists through the aliased import in wrapper definitions', () => {
    const nb = generateNotebook(buildState())
    const allCode = nb.cells
      .filter(c => c.cell_type === 'code')
      .map(c => c.source.join(''))
      .join('\n')
    expect(allCode).toContain('random_sampler(conditions=conditions, num_samples=num_samples)')
    expect(allCode).not.toMatch(/=sample\(/)
  })

  it('builds the runner once and reuses it for variables in the run cell', () => {
    const state = buildState()
    state.nodes.splice(3, 0, {
      id: 'run-1',
      type: 'component',
      name: 'Expected Value Theory',
      protocolUuid: 'proto-run',
      parameters: { choice_temperature: 0.1 }
    })
    state.connections = [
      { sourceId: 'start-1', targetId: 'exp-1' },
      { sourceId: 'exp-1', targetId: 'run-1' },
      { sourceId: 'run-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'end-1' }
    ]
    state.components.experiment_runners = [
      {
        uuid: 'proto-run',
        importPath: 'autora.experiment_runner.synthetic.economics.expected_value_theory',
        pythonName: 'expected_value_theory',
        protocolType: 'experiment_runner',
        pipInstall: 'autora-synthetic'
      }
    ]
    const nb = generateNotebook(state)
    const allCode = nb.cells.filter(c => c.cell_type === 'code').map(c => c.source.join('')).join('\n')
    const runCell = nb.cells[nb.cells.length - 1].source.join('')
    // The runner is constructed exactly once, in its component-definition cell
    expect(allCode.match(/expected_value_theory_runner = expected_value_theory\(choice_temperature=0\.1\)/g).length).toBe(1)
    expect(runCell).not.toContain('expected_value_theory_runner = expected_value_theory')
    // The run cell reuses that runner for the variables
    expect(runCell).toContain('assert expected_value_theory_runner.variables is not None')
    expect(runCell).toContain('variables = expected_value_theory_runner.variables')
    expect(runCell).not.toContain('np.linspace')
  })

  it('emits an identical component definition in a single cell, called at every site', () => {
    // Two samplers with the same name and parameters produce identical wrappers.
    const state = buildState()
    state.nodes.splice(2, 0, {
      id: 'exp-2', type: 'component', name: 'Random Sampler',
      protocolUuid: 'proto-exp', parameters: { num_samples: 5 }
    })
    state.connections = [
      { sourceId: 'start-1', targetId: 'exp-1' },
      { sourceId: 'exp-1', targetId: 'exp-2' },
      { sourceId: 'exp-2', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'end-1' }
    ]
    const nb = generateNotebook(state)
    const defCells = nb.cells.filter(c =>
      c.cell_type === 'code' && c.source.join('').includes('def random_sampler_on_state('))
    expect(defCells.length).toBe(1)
    // Both call sites remain in the run cell
    const runCell = nb.cells.at(-1).source.join('')
    expect(runCell.match(/state = random_sampler_on_state\(state/g).length).toBe(2)
  })

  it('keeps nested loops while de-duplicating identical definitions', () => {
    // A duplicated sampler (deduped to one def) sits in an outer loop that wraps
    // an inner loop — dedup must not flatten or drop the nesting.
    const state = buildState()
    state.nodes.splice(2, 0, {
      id: 'exp-2', type: 'component', name: 'Random Sampler',
      protocolUuid: 'proto-exp', parameters: { num_samples: 5 }
    })
    state.nodes.push(
      { id: 'filt-in', type: 'filter_point', filterParams: { maxCounter: 5 } },
      { id: 'filt-out', type: 'filter_point', filterParams: { maxCounter: 2 } }
    )
    state.connections = [
      { sourceId: 'start-1', targetId: 'exp-1' },
      { sourceId: 'exp-1', targetId: 'exp-2' },
      { sourceId: 'exp-2', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-in' },
      { sourceId: 'filt-in', targetId: 'theo-1' },    // inner back-edge
      { sourceId: 'filt-in', targetId: 'filt-out' },
      { sourceId: 'filt-out', targetId: 'exp-1' },     // outer back-edge (spans all)
      { sourceId: 'filt-out', targetId: 'end-1' }
    ]
    const nb = generateNotebook(state)
    // Identical sampler defined once
    const defCells = nb.cells.filter(c =>
      c.cell_type === 'code' && c.source.join('').includes('def random_sampler_on_state('))
    expect(defCells.length).toBe(1)
    // Nesting preserved in the run cell
    const runCell = nb.cells.at(-1).source.join('')
    expect(runCell).toContain('\nfor cycle_0 in range(2):')
    expect(runCell).toContain('\n    for cycle_1 in range(5):')
    expect(runCell).toContain("    print(f'Cycle {cycle_0}')")
    expect(runCell).toContain("        print(f'Cycle {cycle_1}')")
    // Both duplicated call sites remain
    expect(runCell.match(/state = random_sampler_on_state\(state/g).length).toBe(2)
  })

  it('runs the loop at top level and references the sampler num_samples', () => {
    const state = buildState()
    // Add a filter that loops back over the components so there is a real loop
    state.nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 3 } })
    state.connections = [
      { sourceId: 'start-1', targetId: 'exp-1' },
      { sourceId: 'exp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'exp-1' },
      { sourceId: 'filt-1', targetId: 'end-1' }
    ]
    const nb = generateNotebook(state)
    const runCell = nb.cells[nb.cells.length - 1]
    const src = runCell.source.join('')
    expect(src).toContain('for cycle_0 in range(')
    expect(src).toContain('num_samples=5')
    expect(src).toContain('print("Workflow completed!")')
  })

  it('respects an explicit num_samples of 0 in the run cell', () => {
    // num_samples: 0 is falsy; it must still be passed, not dropped as "unset".
    const state = buildState()
    state.nodes[1].parameters = { num_samples: 0 }
    const src = generateNotebook(state).cells.at(-1).source.join('')
    expect(src).toContain('state = random_sampler_on_state(state, num_samples=0)')
  })

  it('renders nested loops as nested for-loops in the run cell', () => {
    // Inner filter loops back to the theorist; outer filter loops back to the
    // sampler, wrapping the whole thing — so the theorist becomes an inner loop
    // nested inside the outer loop, with the sampler running once per outer cycle.
    const state = buildState()
    state.nodes.push(
      { id: 'filt-in', type: 'filter_point', filterParams: { maxCounter: 5 } },
      { id: 'filt-out', type: 'filter_point', filterParams: { maxCounter: 2 } }
    )
    state.connections = [
      { sourceId: 'start-1', targetId: 'exp-1' },
      { sourceId: 'exp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-in' },
      { sourceId: 'filt-in', targetId: 'theo-1' },    // inner back-edge
      { sourceId: 'filt-in', targetId: 'filt-out' },
      { sourceId: 'filt-out', targetId: 'exp-1' },     // outer back-edge (spans all)
      { sourceId: 'filt-out', targetId: 'end-1' }
    ]
    const src = generateNotebook(state).cells.at(-1).source.join('')
    // Outer loop at top level, inner loop indented one level in
    expect(src).toContain('\nfor cycle_0 in range(2):')
    expect(src).toContain('\n    for cycle_1 in range(5):')
    expect(src).toContain("    print(f'Cycle {cycle_0}')")
    expect(src).toContain("        print(f'Cycle {cycle_1}')")
    // Sampler runs once per outer cycle (4 spaces); theorist is in the inner loop (8)
    expect(src).toContain('\n    state = random_sampler_on_state(state, num_samples=5)')
    expect(src).toContain('\n        state = bms_regressor_on_state(state)')
    expect(src.indexOf('for cycle_0 in range(2):')).toBeLessThan(src.indexOf('for cycle_1 in range(5):'))
  })

  it('runs pre-loop nodes once, before the loop', () => {
    const state = buildState()
    // Insert a pooler before the sampler; filter loops back to the sampler only
    state.nodes.splice(1, 0, {
      id: 'pool-1', type: 'component', name: 'Grid Pooler', protocolUuid: 'proto-pool', parameters: {}
    })
    state.nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 4 } })
    state.components.experimentalists.push({
      uuid: 'proto-pool', importPath: 'autora.experimentalist.grid', pythonName: 'grid_pool',
      file: 'grid_pooler.json', protocolType: 'experimentalist', pipInstall: 'autora-core'
    })
    state.connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'exp-1' },
      { sourceId: 'exp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'exp-1' },
      { sourceId: 'filt-1', targetId: 'end-1' }
    ]
    const src = generateNotebook(state).cells[generateNotebook(state).cells.length - 1].source.join('')
    const forIdx = src.indexOf('for cycle_0 in range(')
    const poolIdx = src.indexOf('state = grid_pooler_on_state(state)')
    // The pooler runs before the loop and is not indented into the loop body
    expect(poolIdx).toBeGreaterThan(-1)
    expect(poolIdx).toBeLessThan(forIdx)
    expect(src).not.toContain('    state = grid_pooler_on_state(state)')
  })

  it('serializes to parseable JSON', () => {
    const json = generateNotebookString(buildState())
    expect(() => JSON.parse(json)).not.toThrow()
    expect(JSON.parse(json).nbformat).toBe(4)
  })

  it('throws when the workflow has no components', () => {
    const empty = { nodes: [{ id: 'start-1', type: 'start_point' }], connections: [], components: {} }
    expect(() => generateNotebook(empty)).toThrow()
  })

  it('uses a no-package comment when nothing needs installing', () => {
    const state = buildState()
    state.components.experimentalists[0].pipInstall = null
    state.components.theorists[0].pipInstall = null
    const nb = generateNotebook(state)
    const firstCode = nb.cells.find(c => c.cell_type === 'code')
    expect(firstCode.source.join('')).toBe('# No additional packages required')
  })
})
