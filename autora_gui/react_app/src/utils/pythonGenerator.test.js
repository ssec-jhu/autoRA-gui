/**
 * Unit tests for `utils/pythonGenerator`.
 *
 * Covers translating a workflow state into runnable Python: name sanitization
 * (toPythonName), execution ordering, import-alias preparation, import and
 * pip-install generation, full code generation, runner parameter grouping,
 * variable initialization, and pip package collection.
 *
 * @module utils/pythonGenerator.test
 */
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

  it('drops parenthesized qualifiers', () => {
    expect(toPythonName('Expected Value Theory (Synthetic, Economics)')).toBe('expected_value_theory')
    expect(toPythonName('Q-Learning (Synthetic, Psychology)')).toBe('q_learning')
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

  it('throws when a filter has no second (loop-back) output connection', () => {
    const { nodes } = buildState()
    nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 3 } })
    // Filter only connects forward to end — no loop-back to close the cycle.
    const connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'end-1' }
    ]
    expect(() => getExecutionOrder(nodes, connections)).toThrow(/second output connection/)
  })

  it('accepts a filter with a loop-back output that closes the cycle', () => {
    const { nodes } = buildState()
    nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 3 } })
    nodes.push({ id: 'loop-1', type: 'component', name: 'Loop Runner', protocolUuid: 'proto-loop' })
    const connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'end-1' },
      { sourceId: 'filt-1', targetId: 'loop-1' }
    ]
    const { loopPath, filterInfo } = getExecutionOrder(nodes, connections)
    expect(loopPath.map(n => n.id)).toEqual(['loop-1'])
    expect(filterInfo).toEqual({ maxCounter: 3 })
  })

  it('puts nodes before the loop-back target into preLoopPath (run once)', () => {
    const { nodes } = buildState()
    nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } })
    // start -> pool -> samp -> theo -> filter; filter loops back to samp (not pool)
    const connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'samp-1' },
      { sourceId: 'filt-1', targetId: 'end-1' }
    ]
    const { preLoopPath, mainPath, loopPath } = getExecutionOrder(nodes, connections)
    // pool runs once (before the loop-back target); samp + theo are the loop body
    expect(preLoopPath.map(n => n.id)).toEqual(['pool-1'])
    expect(mainPath.map(n => n.id)).toEqual(['samp-1', 'theo-1'])
    expect(loopPath).toEqual([])
  })

  it('leaves preLoopPath empty when the loop covers the whole path', () => {
    const { nodes } = buildState()
    nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } })
    // filter loops back to the first component: everything is in the loop
    const connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'pool-1' },
      { sourceId: 'filt-1', targetId: 'end-1' }
    ]
    const { preLoopPath, mainPath } = getExecutionOrder(nodes, connections)
    expect(preLoopPath).toEqual([])
    expect(mainPath.map(n => n.id)).toEqual(['pool-1', 'samp-1', 'theo-1'])
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

  it('never emits unused dataclasses/typing imports', () => {
    const code = generatePythonCode(buildState())
    expect(code).not.toContain('from dataclasses import')
    expect(code).not.toContain('from typing import')
  })

  it('skips Variable and numpy when variables come from a runner', () => {
    const code = generatePythonCode(buildStateWithRunner())
    expect(code).toContain('from autora.variable import VariableCollection\n')
    expect(code).not.toContain('Variable\nimport')
    expect(code).not.toContain(', Variable')
    expect(code).not.toContain('import numpy as np')
    expect(code).toContain('import pandas as pd')
  })

  it('keeps Variable and numpy for the placeholder variables template', () => {
    const code = generatePythonCode(buildState())
    expect(code).toContain('from autora.variable import VariableCollection, Variable')
    expect(code).toContain('import numpy as np')
  })
})

describe('generatePythonCode', () => {
  it('generates a parameter-only wrapper when inputDataType is null', () => {
    const state = buildState()
    state.components.experimentalists[0] = {
      uuid: 'proto-pool',
      importPath: 'autora.experimentalist.bandit_random',
      pythonName: 'pool',
      file: 'bandit_random_pooler.json',
      protocolType: 'experimentalist',
      inputDataType: null,
      outputDataType: { variable: { variable: { name: 'list_of_rewards', datatype: 'real' } } },
      pipInstall: 'autora-experimentalist-bandit-random'
    }
    state.nodes[1].name = 'Bandit Random Pooler'
    state.nodes[1].parameters = { num_rewards: 2, sequence_length: 10, num_samples: 1 }
    const code = generatePythonCode(state)
    expect(code).toContain('def bandit_random_pooler_on_state() -> Delta:')
    expect(code).toContain(
      'return Delta(conditions=pd.DataFrame({"list_of_rewards": ' +
      'bandit_random_pooler(num_rewards=2, sequence_length=10, num_samples=1)}))'
    )
    expect(code).not.toContain('bandit_random_pooler(variables')
  })

  it('emits the bare call for null-input components without a named output', () => {
    const state = buildState()
    state.components.experimentalists[0].inputDataType = null
    state.nodes[1].parameters = { num_samples: 10 }
    const code = generatePythonCode(state)
    expect(code).toContain('def random_pooler_on_state() -> Delta:')
    expect(code).toContain('return Delta(conditions=random_pooler(num_samples=10))')
  })

  it('keeps the variables-based wrapper for poolers that declare state inputs', () => {
    const state = buildState()
    state.components.experimentalists[0].inputDataType = { name: 'variables', datatype: 'string' }
    const code = generatePythonCode(state)
    expect(code).toContain('def random_pooler_on_state(variables: VariableCollection) -> Delta:')
    expect(code).toContain('return Delta(conditions=random_pooler(variables, num_samples=10))')
  })

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

  it('excludes non-__init__ (e.g. fit) params from theorist instantiation', () => {
    const state = buildState()
    // BMSRegressor: epochs/ts are __init__ params, num_param is a fit param
    state.components.theorists[0].parameters = {
      __init__: [{ name: 'epochs' }, { name: 'ts' }],
      fit: [{ name: 'num_param' }]
    }
    state.nodes[3].parameters = { epochs: 100, num_param: 5 }
    const code = generatePythonCode(state)
    expect(code).toContain('bms_regressor_on_state = estimator_on_state(BMSRegressor(epochs=100))')
    expect(code).not.toContain('num_param')
  })

  it('throws when the workflow has no components', () => {
    const empty = { nodes: [{ id: 'start-1', type: 'start_point' }], connections: [], components: {} }
    expect(() => generatePythonCode(empty)).toThrow('No components found')
  })

  it('runs pre-loop nodes once, outside the for loop', () => {
    const state = buildState()
    state.nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } })
    // pool runs once; filter loops back to samp, so samp+theo repeat
    state.connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'samp-1' },
      { sourceId: 'filt-1', targetId: 'end-1' }
    ]
    const code = generatePythonCode(state)
    const forIdx = code.indexOf('for i in range(')
    const poolIdx = code.indexOf('state = random_pooler_on_state(state)')
    const sampIdx = code.indexOf('state = falsification_sampler_on_state(state')
    // The pooler call comes before the loop; the sampler call after it
    expect(poolIdx).toBeGreaterThan(-1)
    expect(poolIdx).toBeLessThan(forIdx)
    expect(sampIdx).toBeGreaterThan(forIdx)
    // The pooler is not indented inside the loop body (8 spaces)
    expect(code).not.toContain('        state = random_pooler_on_state(state)')
  })
})

// Extend the base state with an experiment runner between sampler and theorist
function buildStateWithRunner() {
  const state = buildState()
  state.nodes.splice(3, 0, {
    id: 'run-1',
    type: 'component',
    name: 'Expected Value Theory (Synthetic, Economics)',
    protocolUuid: 'proto-run',
    parameters: { choice_temperature: 0.1, resolution: 10, added_noise: 0.01 }
  })
  state.connections = [
    { sourceId: 'start-1', targetId: 'pool-1' },
    { sourceId: 'pool-1', targetId: 'samp-1' },
    { sourceId: 'samp-1', targetId: 'run-1' },
    { sourceId: 'run-1', targetId: 'theo-1' },
    { sourceId: 'theo-1', targetId: 'end-1' }
  ]
  state.components.experiment_runners = [
    {
      uuid: 'proto-run',
      importPath: 'autora.experiment_runner.synthetic.economics.expected_value_theory',
      pythonName: 'expected_value_theory',
      file: 'synth_econ_expected_value_theory.json',
      protocolType: 'experiment_runner',
      parameters: {
        expected_value_theory: [
          { name: 'choice_temperature', datatype: 'real' },
          { name: 'resolution', datatype: 'integer' }
        ],
        run: [
          { name: 'added_noise', datatype: 'real' },
          { name: 'random_state', datatype: 'integer' }
        ]
      },
      pipInstall: 'autora-synthetic'
    }
  ]
  return state
}

// Extend the base state with a real (non-synthetic) firebase runner
function buildStateWithFirebaseRunner() {
  const state = buildStateWithRunner()
  state.nodes[3] = {
    id: 'run-1',
    type: 'component',
    name: 'Firebase Runner',
    protocolUuid: 'proto-run',
    parameters: { time_out: 300, sleep_time: 30 }
  }
  state.components.experiment_runners = [
    {
      uuid: 'proto-run',
      importPath: 'autora.experiment_runner.firebase_prolific',
      pythonName: 'firebase_runner',
      file: 'firebase_runner.json',
      protocolType: 'experiment_runner',
      parameters: {
        firebase_runner: [
          { name: 'firebase_credentials', datatype: 'string' },
          { name: 'time_out', datatype: 'integer' },
          { name: 'sleep_time', datatype: 'integer' }
        ]
      },
      pipInstall: 'autora[experiment-runner-firebase-prolific]'
    }
  ]
  return state
}

describe('real (non-synthetic) runners', () => {
  it('calls the runner directly instead of runner.run()', () => {
    const code = generatePythonCode(buildStateWithFirebaseRunner())
    expect(code).toContain('return Delta(experiment_data=runner(conditions))')
    expect(code).not.toContain('runner.run')
  })

  it('auto-emits a firebase_credentials template with the other params', () => {
    const code = generatePythonCode(buildStateWithFirebaseRunner())
    expect(code).toContain('runner = firebase_runner(')
    expect(code).toContain('firebase_credentials={')
    expect(code).toContain('"type": "service_account",')
    expect(code).toContain('"private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",')
    // A comment prompts the user to supply their own credentials
    expect(code).toContain('# TODO: replace the placeholders below with your own Firebase service-account credentials')
    // Other factory params trail the credentials dict on the closing line
    expect(code).toContain('}, time_out=300, sleep_time=30)')
    // No PEM file reading
    expect(code).not.toContain('open(')
  })

  it('does not derive variables from the runner (no runner.variables)', () => {
    const code = generatePythonCode(buildStateWithFirebaseRunner())
    expect(code).not.toContain('runner.variables')
    // Falls back to placeholder variables, which need Variable + numpy
    expect(code).toContain('from autora.variable import VariableCollection, Variable')
    expect(code).toContain('import numpy as np')
  })
})

// Extend the base state with the equation_experiment synthetic runner
function buildStateWithEquationRunner() {
  const state = buildStateWithRunner()
  state.nodes[3] = {
    id: 'run-1',
    type: 'component',
    name: 'Equation Experiment (Synthetic, Abstract)',
    protocolUuid: 'proto-run',
    parameters: { expression: 'x_1 ** 2 - x_2 ** 2', rename_output_columns: true, added_noise: 0.01 }
  }
  state.components.experiment_runners = [
    {
      uuid: 'proto-run',
      importPath: 'autora.experiment_runner.synthetic.abstract.equation',
      pythonName: 'equation_experiment',
      file: 'synth_abstr_equation_experiment.json',
      protocolType: 'experiment_runner',
      parameters: {
        equation_experiment: [
          { name: 'expression', datatype: 'string' },
          { name: 'rename_output_columns', datatype: 'boolean' }
        ],
        run: [{ name: 'added_noise', datatype: 'real' }]
      },
      pipInstall: 'autora-synthetic'
    }
  ]
  return state
}

describe('sympify expression params', () => {
  it("wraps equation_experiment's expression in sympify and imports it", () => {
    const code = generatePythonCode(buildStateWithEquationRunner())
    expect(code).toContain('from sympy import sympify')
    // The runner (with its sympified expression) is built once and reused
    const matches = code.match(/expression=sympify\("x_1 \*\* 2 - x_2 \*\* 2"\)/g)
    expect(matches).not.toBeNull()
    expect(matches.length).toBe(1)
    expect(code).not.toContain('expression="x_1 ** 2 - x_2 ** 2"')
  })

  it('does not import sympify when no sympify param is used', () => {
    expect(generatePythonCode(buildStateWithRunner())).not.toContain('sympify')
  })
})

describe('equation_experiment X/y synthesis', () => {
  it('synthesizes one IV per expression symbol plus a DV', () => {
    const code = generatePythonCode(buildStateWithEquationRunner())
    expect(code).toContain('X=[')
    expect(code).toContain('IV(name="x_1", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10)),')
    expect(code).toContain('IV(name="x_2", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10)),')
    expect(code).toContain('y=DV(name="y", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10))')
    expect(code).toContain('# TODO: adjust the variable names and ranges below for your experiment')
  })

  it('imports IV, DV and numpy for the synthesized variables', () => {
    const code = generatePythonCode(buildStateWithEquationRunner())
    expect(code).toContain('from autora.variable import VariableCollection, IV, DV')
    expect(code).toContain('import numpy as np')
  })

  it('names the DV to avoid colliding with an expression symbol', () => {
    const state = buildStateWithEquationRunner()
    state.nodes[3].parameters.expression = 'x ** 2 - y ** 2'
    const code = generatePythonCode(state)
    expect(code).toContain('IV(name="x",')
    expect(code).toContain('IV(name="y",')
    // "y" is taken by an IV, so the DV falls back to the next free name
    expect(code).toContain('y=DV(name="z",')
  })

  it('does not treat function names as variables', () => {
    const state = buildStateWithEquationRunner()
    state.nodes[3].parameters.expression = 'sin(x_1) + cos(x_2)'
    const code = generatePythonCode(state)
    expect(code).toContain('IV(name="x_1",')
    expect(code).toContain('IV(name="x_2",')
    expect(code).not.toContain('IV(name="sin"')
    expect(code).not.toContain('IV(name="cos"')
  })
})

// Extend the base state with the lmm_experiment synthetic runner
function buildStateWithLmmRunner() {
  const state = buildStateWithRunner()
  state.nodes[3] = {
    id: 'run-1',
    type: 'component',
    name: 'Linear Mixed Model Experiment (Synthetic, Abstract)',
    protocolUuid: 'proto-run',
    parameters: { formula: 'rt ~ 1 + x1', fixed_effects: "{'Intercept': 0., 'x1': 2.}" }
  }
  state.components.experiment_runners = [
    {
      uuid: 'proto-run',
      importPath: 'autora.experiment_runner.synthetic.abstract.lmm',
      pythonName: 'lmm_experiment',
      file: 'synth_abstr_lmm_experiment.json',
      protocolType: 'experiment_runner',
      parameters: {
        lmm_experiment: [
          { name: 'formula', datatype: 'string' },
          { name: 'fixed_effects', datatype: 'string' }
        ],
        run: [{ name: 'added_noise', datatype: 'real' }]
      },
      pipInstall: 'autora-synthetic'
    }
  ]
  return state
}

describe('lmm_experiment X synthesis', () => {
  it('synthesizes IVs from the formula RHS and passes no y', () => {
    const code = generatePythonCode(buildStateWithLmmRunner())
    expect(code).toContain('formula="rt ~ 1 + x1"')
    expect(code).toContain("fixed_effects={'Intercept': 0., 'x1': 2.}")
    expect(code).toContain('IV(name="x1", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10)),')
    // lmm takes no y argument; the DV comes from the formula
    expect(code).not.toContain('y=DV(')
    expect(code).toContain('from autora.variable import VariableCollection, IV, DV')
    expect(code).toContain('import numpy as np')
  })

  it('handles multiple IVs and ignores the intercept marker', () => {
    const state = buildStateWithLmmRunner()
    state.nodes[3].parameters.formula = 'rt ~ 1 + x1 + x2'
    const code = generatePythonCode(state)
    expect(code).toContain('IV(name="x1",')
    expect(code).toContain('IV(name="x2",')
    expect(code).not.toContain('IV(name="rt"')  // rt is the DV, not an IV
    expect(code).not.toContain('IV(name="1"')
  })
})

describe('synthetic runner is built once (no duplication)', () => {
  it('constructs the runner in the component section and reuses it for variables', () => {
    const code = generatePythonCode(buildStateWithLmmRunner())
    // Exactly one construction of the runner across the whole file
    expect(code.match(/runner = lmm_experiment\(/g).length).toBe(1)
    // The wrapper and the variables setup both reference the shared runner
    expect(code).toContain('return Delta(experiment_data=runner.run(conditions=conditions))')
    expect(code).toContain('# Variables are governed by the experiment runner defined above')
    expect(code).toContain('variables = runner.variables')
  })
})

describe('runner parameter grouping', () => {
  it('names the wrapper without the parenthesized qualifier', () => {
    const code = generatePythonCode(buildStateWithRunner())
    expect(code).toContain('def expected_value_theory_on_state(conditions: pd.DataFrame) -> Delta:')
    expect(code).not.toContain('synthetic_economics')
  })

  it('passes run-group parameters to run() instead of the factory', () => {
    const code = generatePythonCode(buildStateWithRunner())
    expect(code).toContain('runner = expected_value_theory(choice_temperature=0.1, resolution=10)')
    expect(code).toContain('return Delta(experiment_data=runner.run(conditions=conditions, added_noise=0.01))')
    expect(code).not.toContain('expected_value_theory(choice_temperature=0.1, resolution=10, added_noise=0.01)')
  })

  it('calls run() with conditions only when no run-group parameters are set', () => {
    const state = buildStateWithRunner()
    state.nodes[3].parameters = { choice_temperature: 0.1 }
    const code = generatePythonCode(state)
    expect(code).toContain('return Delta(experiment_data=runner.run(conditions=conditions))')
  })

  it('emits dict/list literal string parameters unquoted', () => {
    const state = buildStateWithRunner()
    state.nodes[3].parameters = {
      fixed_effects: "{'Intercept': 0., 'x1': 2.}",
      allowed: '[1, 2, 3]',
      formula: 'rt ~ 1 + x1'
    }
    const code = generatePythonCode(state)
    expect(code).toContain("fixed_effects={'Intercept': 0., 'x1': 2.}")
    expect(code).toContain('allowed=[1, 2, 3]')
    // Plain strings stay quoted
    expect(code).toContain('formula="rt ~ 1 + x1"')
    expect(code).not.toContain('fixed_effects="')
  })
})

describe('variables initialization', () => {
  it('derives variables from the experiment runner when the workflow has one', () => {
    const code = generatePythonCode(buildStateWithRunner())
    expect(code).toContain('runner = expected_value_theory(choice_temperature=0.1, resolution=10)')
    expect(code).toContain('assert runner.variables is not None')
    expect(code).toContain('variables = runner.variables')
    expect(code).not.toContain('np.linspace')
  })

  it('falls back to the placeholder variables when there is no runner', () => {
    const code = generatePythonCode(buildState())
    expect(code).toContain('Variable(name="x", allowed_values=np.linspace(-1, 1, 100))')
    expect(code).not.toContain('runner.variables')
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
