import { describe, it, expect } from 'vitest'
import {
  CodeBuilder,
  collectPipPackages,
  generateImports,
  generatePipInstalls,
  generatePythonCode,
  getExecutionOrder,
  prepareWorkflow,
  toPythonName
} from './pythonGenerator'

// A minimal workflow: start -> pooler -> sampler -> theorist -> end,
// using the current component format (bare pythonName + file for aliasing)
function buildState() {
  return {
    nodes: [
      { id: 'start-1', type: 'start_point' },
      {
        id: 'pool-1',
        type: 'component',
        name: 'Random Pooler',
        protocolUuid: 'proto-pool',
        parameters: { num_samples: 10 }
      },
      {
        id: 'samp-1',
        type: 'component',
        name: 'Falsification Sampler',
        protocolUuid: 'proto-samp',
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
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'end-1' }
    ],
    components: {
      experimentalists: [
        {
          uuid: 'proto-pool',
          importPath: 'autora.experimentalist.random',
          pythonName: 'pool',
          file: 'random_pooler.json',
          protocolType: 'experimentalist',
          pipInstall: 'autora-experimentalist-random'
        },
        {
          uuid: 'proto-samp',
          importPath: 'autora.experimentalist.falsification',
          pythonName: 'sample',
          file: 'falsification_sampler.json',
          protocolType: 'experimentalist',
          pipInstall: 'autora-experimentalist-falsification'
        }
      ],
      theorists: [
        {
          uuid: 'proto-theo',
          importPath: 'autora.theorist.bms.regressor',
          pythonName: 'BMSRegressor',
          file: 'bms_regressor.json',
          protocolType: 'theorist',
          pipInstall: 'autora[theorist-bms]'
        }
      ]
    }
  }
}

describe('toPythonName', () => {
  it('lowercases and replaces non-alphanumerics with underscores', () => {
    expect(toPythonName('Random Sampler')).toBe('random_sampler')
    expect(toPythonName('Latin-Hypercube  Pooler!')).toBe('latin_hypercube_pooler')
  })

  it('strips leading and trailing underscores', () => {
    expect(toPythonName('  BMS Regressor  ')).toBe('bms_regressor')
  })
})

describe('getExecutionOrder', () => {
  it('throws when the workflow has no start node', () => {
    expect(() => getExecutionOrder([], [])).toThrow('Start node')
  })

  it('returns component nodes between start and end in path order', () => {
    const { nodes, connections } = buildState()
    const { mainPath, loopPath, filterInfo } = getExecutionOrder(nodes, connections)
    expect(mainPath.map(n => n.id)).toEqual(['pool-1', 'samp-1', 'theo-1'])
    expect(loopPath).toEqual([])
    expect(filterInfo).toBeNull()
  })
})

describe('prepareWorkflow aliasing', () => {
  it('aliases experimentalist imports to the JSON file name', () => {
    const { imports } = prepareWorkflow(buildState())
    expect([...imports.get('autora.experimentalist.random')])
      .toEqual(['pool as random_pooler'])
    expect([...imports.get('autora.experimentalist.falsification')])
      .toEqual(['sample as falsification_sampler'])
  })

  it('stores the alias as the pythonName used in generated code', () => {
    const { componentMeta } = prepareWorkflow(buildState())
    expect(componentMeta.get('pool-1').pythonName).toBe('random_pooler')
    expect(componentMeta.get('samp-1').pythonName).toBe('falsification_sampler')
  })

  it('does not alias theorists even when they carry a file field', () => {
    const { imports, componentMeta } = prepareWorkflow(buildState())
    expect([...imports.get('autora.theorist.bms.regressor')]).toEqual(['BMSRegressor'])
    expect(componentMeta.get('theo-1').pythonName).toBe('BMSRegressor')
  })

  it('falls back to the plain import when the file field is missing', () => {
    const state = buildState()
    delete state.components.experimentalists[0].file
    const { imports, componentMeta } = prepareWorkflow(state)
    expect([...imports.get('autora.experimentalist.random')]).toEqual(['pool'])
    expect(componentMeta.get('pool-1').pythonName).toBe('pool')
  })

  it('skips the alias when the file name equals the pythonName', () => {
    const state = buildState()
    state.components.experimentalists[0].pythonName = 'random_pooler'
    const { imports } = prepareWorkflow(state)
    expect([...imports.get('autora.experimentalist.random')]).toEqual(['random_pooler'])
  })

  it('merges two components from the same module into one import entry set', () => {
    const state = buildState()
    state.components.experimentalists[1].importPath = 'autora.experimentalist.random'
    const { imports } = prepareWorkflow(state)
    expect([...imports.get('autora.experimentalist.random')])
      .toEqual(['pool as random_pooler', 'sample as falsification_sampler'])
  })
})

describe('generateImports', () => {
  it('emits aliased names on a single line per module', () => {
    const { imports } = prepareWorkflow(buildState())
    const code = new CodeBuilder()
    generateImports(code, imports)
    const text = code.toString()
    expect(text).toContain('from autora.experimentalist.random import pool as random_pooler')
    expect(text).toContain('from autora.experimentalist.falsification import sample as falsification_sampler')
    expect(text).toContain('from autora.theorist.bms.regressor import BMSRegressor')
  })
})

describe('generatePythonCode', () => {
  it('calls experimentalists through their aliases in the wrappers', () => {
    const code = generatePythonCode(buildState())
    expect(code).toContain('return Delta(conditions=random_pooler(variables, num_samples=10))')
    expect(code).toContain(
      'return Delta(conditions=falsification_sampler(conditions=conditions, num_samples=num_samples))'
    )
    expect(code).not.toMatch(/=pool\(/)
    expect(code).not.toMatch(/=sample\(/)
  })

  it('gives the sampler wrapper a num_samples default and passes it in the loop', () => {
    const code = generatePythonCode(buildState())
    expect(code).toContain('def falsification_sampler_on_state(conditions: pd.DataFrame, num_samples: int = 5)')
    expect(code).toContain('state = falsification_sampler_on_state(state, num_samples=5)')
  })

  it('wraps theorists with estimator_on_state using constructor parameters', () => {
    const code = generatePythonCode(buildState())
    expect(code).toContain('bms_regressor_on_state = estimator_on_state(BMSRegressor(epochs=100))')
  })

  it('throws when the workflow has no components', () => {
    const empty = { nodes: [{ id: 'start-1', type: 'start_point' }], connections: [], components: {} }
    expect(() => generatePythonCode(empty)).toThrow('No components found')
  })
})

describe('pip package collection', () => {
  it('collects one entry per unique package, skipping control nodes', () => {
    const packages = collectPipPackages(buildState())
    expect(packages).toEqual([
      'autora-experimentalist-random',
      'autora-experimentalist-falsification',
      'autora[theorist-bms]'
    ])
  })

  it('generates a single pip install command', () => {
    expect(generatePipInstalls(buildState())).toBe(
      'pip install autora-experimentalist-random autora-experimentalist-falsification autora[theorist-bms]'
    )
  })

  it('returns a comment when nothing needs installing', () => {
    const state = buildState()
    state.components.experimentalists.forEach(c => { c.pipInstall = null })
    state.components.theorists[0].pipInstall = null
    expect(generatePipInstalls(state)).toBe('# No additional packages required')
  })
})
