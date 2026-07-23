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

  it('derives variables from the experiment runner in the run cell', () => {
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
    const runCell = nb.cells[nb.cells.length - 1]
    const src = runCell.source.join('')
    expect(src).toContain('runner = expected_value_theory(choice_temperature=0.1)')
    expect(src).toContain('assert runner.variables is not None')
    expect(src).toContain('variables = runner.variables')
    expect(src).not.toContain('np.linspace')
  })

  it('runs the loop at top level and references the sampler num_samples', () => {
    const nb = generateNotebook(buildState())
    const runCell = nb.cells[nb.cells.length - 1]
    const src = runCell.source.join('')
    expect(src).toContain('for i in range(')
    expect(src).toContain('num_samples=5')
    expect(src).toContain('print("Workflow completed!")')
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
