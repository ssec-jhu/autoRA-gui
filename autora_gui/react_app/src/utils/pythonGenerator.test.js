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

  // Map blocks to a compact shape for readable assertions. A loop that simply
  // wraps a single run of components is flattened to `ids`; a loop containing
  // nested loops keeps its `children` so the nesting is visible.
  const shape = blocks => blocks.map(b => {
    if (b.type === 'once') return { type: 'once', ids: b.nodes.map(n => n.id) }
    const simple = b.children.length === 1 && b.children[0].type === 'once'
    return simple
      ? { type: 'loop', maxCounter: b.maxCounter, ids: b.children[0].nodes.map(n => n.id) }
      : { type: 'loop', maxCounter: b.maxCounter, children: shape(b.children) }
  })

  it('runs a filter-less workflow once, with no loop', () => {
    const { nodes, connections } = buildState()
    const { blocks } = getExecutionOrder(nodes, connections)
    expect(shape(blocks)).toEqual([
      { type: 'once', ids: ['pool-1', 'samp-1', 'theo-1'] }
    ])
  })

  it('throws when the workflow has no end node', () => {
    const { nodes, connections } = buildState()
    const noEnd = nodes.filter(n => n.type !== 'end_point')
    expect(() => getExecutionOrder(noEnd, connections)).toThrow('End node')
  })

  it('defaults a filter loop to 1 cycle when maxCounter is unset', () => {
    const { nodes } = buildState()
    nodes.push({ id: 'filt-1', type: 'filter_point' })  // no filterParams
    const connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'pool-1' },
      { sourceId: 'filt-1', targetId: 'end-1' }
    ]
    const { blocks } = getExecutionOrder(nodes, connections)
    expect(shape(blocks)).toEqual([
      { type: 'loop', maxCounter: 1, ids: ['pool-1', 'samp-1', 'theo-1'] }
    ])
  })

  it('throws when a filter has no loop-back output connection', () => {
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
    expect(() => getExecutionOrder(nodes, connections)).toThrow(/loop-back output/)
  })

  it('uses the filter maxCounter as the loop cycle count', () => {
    const { nodes } = buildState()
    nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 3 } })
    // filter loops back to the first component: everything is in the loop
    const connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'pool-1' },
      { sourceId: 'filt-1', targetId: 'end-1' }
    ]
    const { blocks } = getExecutionOrder(nodes, connections)
    expect(shape(blocks)).toEqual([
      { type: 'loop', maxCounter: 3, ids: ['pool-1', 'samp-1', 'theo-1'] }
    ])
  })

  it('puts nodes before the loop-back target into a run-once block', () => {
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
    const { blocks } = getExecutionOrder(nodes, connections)
    // pool runs once (before the loop-back target); samp + theo are the loop body
    expect(shape(blocks)).toEqual([
      { type: 'once', ids: ['pool-1'] },
      { type: 'loop', maxCounter: 10, ids: ['samp-1', 'theo-1'] }
    ])
  })

  it('routes the filter exit path (to end) into a trailing run-once block', () => {
    // Mirrors workflow_2026-08-11: a pooler before the loop, and a second
    // pooler on the filter's exit branch that must run once *after* the loop.
    const { nodes } = buildState()
    nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } })
    nodes.push({
      id: 'pool-2', type: 'component', name: 'Random Pooler 2',
      protocolUuid: 'proto-pool', parameters: { num_samples: 10 }
    })
    // start -> pool-1 -> samp -> theo -> filter; filter loops back to samp
    // and exits through pool-2 -> end.
    const connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'samp-1' },
      { sourceId: 'filt-1', targetId: 'pool-2' },
      { sourceId: 'pool-2', targetId: 'end-1' }
    ]
    const { blocks } = getExecutionOrder(nodes, connections)
    expect(shape(blocks)).toEqual([
      { type: 'once', ids: ['pool-1'] },
      { type: 'loop', maxCounter: 10, ids: ['samp-1', 'theo-1'] },
      { type: 'once', ids: ['pool-2'] }
    ])
  })

  it('detects the loop-back target regardless of filter output order', () => {
    // The exit branch is listed *before* the loop-back branch; the loop-back
    // must still be identified by rejoining the path, not by list position.
    const { nodes } = buildState()
    nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } })
    nodes.push({
      id: 'pool-2', type: 'component', name: 'Random Pooler 2',
      protocolUuid: 'proto-pool', parameters: { num_samples: 10 }
    })
    const connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'pool-2' },   // exit branch first
      { sourceId: 'pool-2', targetId: 'end-1' },
      { sourceId: 'filt-1', targetId: 'samp-1' }     // loop-back branch second
    ]
    const { blocks } = getExecutionOrder(nodes, connections)
    expect(shape(blocks)).toEqual([
      { type: 'once', ids: ['pool-1'] },
      { type: 'loop', maxCounter: 10, ids: ['samp-1', 'theo-1'] },
      { type: 'once', ids: ['pool-2'] }
    ])
  })

  it('produces one loop block per filter for a multi-loop workflow', () => {
    // Two sequential loops: start -> a -> b -> filter1 (loops to a, exits to c)
    // -> c -> d -> filter2 (loops to c, exits to end).
    const nodes = [
      { id: 'start-1', type: 'start_point' },
      { id: 'a', type: 'component', name: 'A', protocolUuid: 'proto-pool' },
      { id: 'b', type: 'component', name: 'B', protocolUuid: 'proto-theo' },
      { id: 'c', type: 'component', name: 'C', protocolUuid: 'proto-pool' },
      { id: 'd', type: 'component', name: 'D', protocolUuid: 'proto-theo' },
      { id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } },
      { id: 'filt-2', type: 'filter_point', filterParams: { maxCounter: 2 } },
      { id: 'end-1', type: 'end_point' }
    ]
    const connections = [
      { sourceId: 'start-1', targetId: 'a' },
      { sourceId: 'a', targetId: 'b' },
      { sourceId: 'b', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'a' },
      { sourceId: 'filt-1', targetId: 'c' },
      { sourceId: 'c', targetId: 'd' },
      { sourceId: 'd', targetId: 'filt-2' },
      { sourceId: 'filt-2', targetId: 'c' },
      { sourceId: 'filt-2', targetId: 'end-1' }
    ]
    const { blocks } = getExecutionOrder(nodes, connections)
    expect(shape(blocks)).toEqual([
      { type: 'loop', maxCounter: 10, ids: ['a', 'b'] },
      { type: 'loop', maxCounter: 2, ids: ['c', 'd'] }
    ])
  })

  it('nests loops when one filter spans another (mirrors workflow_nested_loops)', () => {
    // Outer filter (F3) loops back to the first component, wrapping two inner
    // loops: F1 over [a, b] and F2 over [c, d].
    // start -> a -> b -> F1(loops to a) -> c -> d -> F2(loops to c) -> F3(loops to a) -> end
    const nodes = [
      { id: 'start-1', type: 'start_point' },
      { id: 'a', type: 'component', name: 'A', protocolUuid: 'proto-pool' },
      { id: 'b', type: 'component', name: 'B', protocolUuid: 'proto-theo' },
      { id: 'c', type: 'component', name: 'C', protocolUuid: 'proto-pool' },
      { id: 'd', type: 'component', name: 'D', protocolUuid: 'proto-theo' },
      { id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } },
      { id: 'filt-2', type: 'filter_point', filterParams: { maxCounter: 1 } },
      { id: 'filt-3', type: 'filter_point', filterParams: { maxCounter: 2 } },
      { id: 'end-1', type: 'end_point' }
    ]
    const connections = [
      { sourceId: 'start-1', targetId: 'a' },
      { sourceId: 'a', targetId: 'b' },
      { sourceId: 'b', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'a' },   // inner loop 1 back-edge
      { sourceId: 'filt-1', targetId: 'c' },   // exit to inner loop 2
      { sourceId: 'c', targetId: 'd' },
      { sourceId: 'd', targetId: 'filt-2' },
      { sourceId: 'filt-2', targetId: 'c' },   // inner loop 2 back-edge
      { sourceId: 'filt-2', targetId: 'filt-3' },
      { sourceId: 'filt-3', targetId: 'a' },   // outer loop back-edge (spans a..d)
      { sourceId: 'filt-3', targetId: 'end-1' }
    ]
    const { blocks } = getExecutionOrder(nodes, connections)
    expect(shape(blocks)).toEqual([
      {
        type: 'loop',
        maxCounter: 2,
        children: [
          { type: 'loop', maxCounter: 10, ids: ['a', 'b'] },
          { type: 'loop', maxCounter: 1, ids: ['c', 'd'] }
        ]
      }
    ])
  })

  it('throws when two filters enclose exactly the same components', () => {
    // Two filters chained back-to-back with no component between them, both
    // looping back to the first component, span the identical interval [a, b].
    // Nesting them would silently multiply cycle counts, so this is rejected.
    // start -> a -> b -> F1(loops to a, exits to F2) -> F2(loops to a) -> end
    const nodes = [
      { id: 'start-1', type: 'start_point' },
      { id: 'a', type: 'component', name: 'A', protocolUuid: 'proto-pool' },
      { id: 'b', type: 'component', name: 'B', protocolUuid: 'proto-theo' },
      { id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } },
      { id: 'filt-2', type: 'filter_point', filterParams: { maxCounter: 2 } },
      { id: 'end-1', type: 'end_point' }
    ]
    const connections = [
      { sourceId: 'start-1', targetId: 'a' },
      { sourceId: 'a', targetId: 'b' },
      { sourceId: 'b', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'a' },      // loop-back (spans a..b)
      { sourceId: 'filt-1', targetId: 'filt-2' }, // exit into the second filter
      { sourceId: 'filt-2', targetId: 'a' },      // loop-back (also spans a..b)
      { sourceId: 'filt-2', targetId: 'end-1' }
    ]
    expect(() => getExecutionOrder(nodes, connections)).toThrow(/exactly the same components/)
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

  it('gives the sampler wrapper a num_samples default and passes it in the call', () => {
    const code = generatePythonCode(buildState())
    expect(code).toContain('def falsification_sampler_on_state(conditions: pd.DataFrame, num_samples: int = 5)')
    expect(code).toContain('state = falsification_sampler_on_state(state, num_samples=5)')
  })

  it('respects an explicit num_samples of 0 instead of defaulting to 1', () => {
    // num_samples: 0 is falsy; it must not be treated as "unset" and overridden.
    const state = buildState()
    state.nodes[2].parameters = { num_samples: 0 }
    const code = generatePythonCode(state)
    expect(code).toContain('def falsification_sampler_on_state(conditions: pd.DataFrame, num_samples: int = 0)')
    expect(code).toContain('state = falsification_sampler_on_state(state, num_samples=0)')
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

  it('emits an identical component definition once but calls it at every site', () => {
    // Two poolers with the same name and parameters produce identical wrappers.
    const state = buildState()
    state.nodes.splice(2, 0, {
      id: 'pool-2', type: 'component', name: 'Random Pooler',
      protocolUuid: 'proto-pool', parameters: { num_samples: 10 }
    })
    state.connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'pool-2' },
      { sourceId: 'pool-2', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'end-1' }
    ]
    const code = generatePythonCode(state)
    // Defined once, called at both sites
    expect(code.match(/def random_pooler_on_state\(/g).length).toBe(1)
    expect(code.match(/state = random_pooler_on_state\(state\)/g).length).toBe(2)
  })

  it('throws when the workflow has no components', () => {
    const empty = {
      nodes: [{ id: 'start-1', type: 'start_point' }, { id: 'end-1', type: 'end_point' }],
      connections: [{ sourceId: 'start-1', targetId: 'end-1' }],
      components: {}
    }
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
    const forIdx = code.indexOf('for cycle_0 in range(')
    const poolIdx = code.indexOf('state = random_pooler_on_state(state)')
    const sampIdx = code.indexOf('state = falsification_sampler_on_state(state')
    // The pooler call comes before the loop; the sampler call after it
    expect(poolIdx).toBeGreaterThan(-1)
    expect(poolIdx).toBeLessThan(forIdx)
    expect(sampIdx).toBeGreaterThan(forIdx)
    // The pooler is not indented inside the loop body (8 spaces)
    expect(code).not.toContain('        state = random_pooler_on_state(state)')
  })

  it('runs a filter-exit (post-loop) node once, after the for loop', () => {
    // workflow_2026-08-11 shape: pooler#1 before the loop, samp+theo in the
    // loop, pooler#2 on the exit branch — pooler#2 must run once after the loop.
    const state = buildState()
    state.nodes.push({ id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } })
    state.nodes.push({
      id: 'pool-2', type: 'component', name: 'Random Pooler 2',
      protocolUuid: 'proto-pool', parameters: { num_samples: 10 }
    })
    state.connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'samp-1' },
      { sourceId: 'filt-1', targetId: 'pool-2' },
      { sourceId: 'pool-2', targetId: 'end-1' }
    ]
    const code = generatePythonCode(state)
    const forIdx = code.indexOf('for cycle_0 in range(')
    const pool1Idx = code.indexOf('    state = random_pooler_on_state(state)')
    const pool2Idx = code.indexOf('    state = random_pooler_2_on_state(state)')
    // pooler#1 before the loop, pooler#2 after it
    expect(pool1Idx).toBeGreaterThan(-1)
    expect(pool1Idx).toBeLessThan(forIdx)
    expect(pool2Idx).toBeGreaterThan(forIdx)
    // pooler#2 runs once at function-body indent (4 spaces), not inside the loop (8)
    expect(code).toContain('    state = random_pooler_2_on_state(state)')
    expect(code).not.toContain('        state = random_pooler_2_on_state(state)')
  })

  it('throws when filter loops partially overlap', () => {
    const state = buildState()
    state.nodes.push(
      { id: 'pool-2', type: 'component', name: 'Random Pooler 2', protocolUuid: 'proto-pool', parameters: {} },
      { id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } },
      { id: 'filt-2', type: 'filter_point', filterParams: { maxCounter: 2 } }
    )
    state.connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'pool-1' },
      { sourceId: 'filt-1', targetId: 'pool-2' },
      { sourceId: 'pool-2', targetId: 'filt-2' },
      { sourceId: 'filt-2', targetId: 'samp-1' },
      { sourceId: 'filt-2', targetId: 'end-1' }
    ]
    expect(() => generatePythonCode(state)).toThrow(/Partially overlapping loops/)
  })

  it('renders nested loops as nested for-loops', () => {
    // Outer filter loops back to the pooler (wrapping everything); inner filter
    // loops back to the sampler only, so the sampler+theorist form an inner loop
    // nested inside the outer loop, with the pooler running once per outer cycle.
    const state = buildState()
    state.nodes.push(
      { id: 'filt-in', type: 'filter_point', filterParams: { maxCounter: 5 } },
      { id: 'filt-out', type: 'filter_point', filterParams: { maxCounter: 2 } }
    )
    state.connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'samp-1' },
      { sourceId: 'samp-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-in' },
      { sourceId: 'filt-in', targetId: 'samp-1' },    // inner back-edge
      { sourceId: 'filt-in', targetId: 'filt-out' },
      { sourceId: 'filt-out', targetId: 'pool-1' },    // outer back-edge (spans all)
      { sourceId: 'filt-out', targetId: 'end-1' }
    ]
    const code = generatePythonCode(state)
    // Outer loop at the function-body indent (4 spaces), inner loop one level in
    expect(code).toContain('    for cycle_0 in range(2):')
    expect(code).toContain('        for cycle_1 in range(5):')
    expect(code).toContain("        print(f'Cycle {cycle_0}')")
    expect(code).toContain("            print(f'Cycle {cycle_1}')")
    // Pooler runs once per outer cycle (8 spaces), sampler is in the inner loop (12)
    expect(code).toContain('        state = random_pooler_on_state(state)')
    expect(code).toContain('            state = falsification_sampler_on_state(state, num_samples=5)')
    // The inner loop opens after the pooler call and before the sampler call
    const outerIdx = code.indexOf('for cycle_0 in range(2):')
    const innerIdx = code.indexOf('for cycle_1 in range(5):')
    const poolIdx = code.indexOf('        state = random_pooler_on_state(state)')
    const sampIdx = code.indexOf('            state = falsification_sampler_on_state(state')
    expect(outerIdx).toBeLessThan(poolIdx)
    expect(poolIdx).toBeLessThan(innerIdx)
    expect(innerIdx).toBeLessThan(sampIdx)
  })

  it('emits a separate for-loop per filter for a multi-loop workflow', () => {
    // Two sequential loops (mirrors workflow_2loops.json): pool+theo repeat 10x,
    // then a second pool2+theo2 repeat 2x. Each loop body is indented into its
    // own `for cycle_0 in range(...)`.
    const state = buildState()
    state.nodes.push(
      { id: 'pool-2', type: 'component', name: 'Random Pooler 2', protocolUuid: 'proto-pool', parameters: {} },
      { id: 'theo-2', type: 'component', name: 'BMS Regressor 2', protocolUuid: 'proto-theo', parameters: {} },
      { id: 'filt-1', type: 'filter_point', filterParams: { maxCounter: 10 } },
      { id: 'filt-2', type: 'filter_point', filterParams: { maxCounter: 2 } }
    )
    state.connections = [
      { sourceId: 'start-1', targetId: 'pool-1' },
      { sourceId: 'pool-1', targetId: 'theo-1' },
      { sourceId: 'theo-1', targetId: 'filt-1' },
      { sourceId: 'filt-1', targetId: 'pool-1' },   // loop 1 back-edge
      { sourceId: 'filt-1', targetId: 'pool-2' },   // exit into loop 2
      { sourceId: 'pool-2', targetId: 'theo-2' },
      { sourceId: 'theo-2', targetId: 'filt-2' },
      { sourceId: 'filt-2', targetId: 'pool-2' },   // loop 2 back-edge
      { sourceId: 'filt-2', targetId: 'end-1' }
    ]
    const code = generatePythonCode(state)
    // Two independent for-loops, with the second one's cycle count
    expect(code.match(/for cycle_0 in range\(/g).length).toBe(2)
    expect(code).toContain('for cycle_0 in range(10):')
    expect(code).toContain('for cycle_0 in range(2):')
    // Each loop's nodes are indented into the loop body (8 spaces)
    expect(code).toContain('        state = random_pooler_on_state(state)')
    expect(code).toContain('        state = random_pooler_2_on_state(state)')
    // Loop 2 comes after loop 1
    expect(code.indexOf('for cycle_0 in range(2):')).toBeGreaterThan(code.indexOf('for cycle_0 in range(10):'))
    expect(code.indexOf('state = random_pooler_2_on_state(state)'))
      .toBeGreaterThan(code.indexOf('for cycle_0 in range(2):'))
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

describe('runReturnsDV runners assemble experiment_data', () => {
  it('assembles experiment_data from conditions + run() DV values', () => {
    const state = buildStateWithRunner()
    state.components.experiment_runners[0].runReturnsDV = true
    const code = generatePythonCode(state)
    expect(code).toContain('dv_values = runner.run(')
    expect(code).toContain('experiment_data = pd.DataFrame({')
    expect(code).toContain('runner.variables.independent_variables[0].name: list(conditions.iloc[:, 0]),')
    expect(code).toContain('runner.variables.dependent_variables[0].name: dv_values,')
    expect(code).toContain('return Delta(experiment_data=experiment_data)')
    // The plain single-line form must not be used for this runner.
    expect(code).not.toContain('return Delta(experiment_data=runner.run(')
  })

  it('uses the plain run() return for a normal synthetic runner', () => {
    const code = generatePythonCode(buildStateWithRunner())
    expect(code).toContain('return Delta(experiment_data=runner.run(')
    expect(code).not.toContain('dv_values = runner.run(')
  })
})

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
          {
            name: 'X',
            datatype: 'IV',
            default: '[IV(name="x", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10)), IV(name="y", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10))]'
          },
          {
            name: 'y',
            datatype: 'DV',
            default: 'DV(name="z", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10))'
          },
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

describe('equation_experiment X/y from IV/DV params', () => {
  it('emits X and y verbatim from the IV/DV parameter defaults, under a TODO', () => {
    const code = generatePythonCode(buildStateWithEquationRunner())
    expect(code).toContain('# TODO: adjust the variable names and ranges below for your experiment')
    expect(code).toContain(
      'X=[IV(name="x", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10)), ' +
        'IV(name="y", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10))],'
    )
    // y is the final factory argument, so its literal closes the runner call.
    expect(code).toContain(
      'y=DV(name="z", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10)))'
    )
    // The expression is still sympified and precedes the IV/DV arguments.
    expect(code).toContain('expression=sympify("x_1 ** 2 - x_2 ** 2"),')
  })

  it('imports IV, DV and numpy for the IV/DV literals', () => {
    const code = generatePythonCode(buildStateWithEquationRunner())
    expect(code).toContain('from autora.variable import VariableCollection, IV, DV')
    expect(code).toContain('import numpy as np')
  })

  it('uses the node value over the default when the user sets X', () => {
    const state = buildStateWithEquationRunner()
    state.nodes[3].parameters.X = '[IV(name="a", value_range=(0, 1))]'
    const code = generatePythonCode(state)
    expect(code).toContain('X=[IV(name="a", value_range=(0, 1))],')
    // The unset y still falls back to its declared default.
    expect(code).toContain('y=DV(name="z",')
  })
})

describe('LHS pooler strips allowed_values from IVs', () => {
  // Turn the workflow's random pooler into the LHS pooler, which raises on any
  // IV carrying allowed_values.
  function buildStateWithLhsPooler() {
    const state = buildStateWithEquationRunner()
    const pooler = state.components.experimentalists.find(c => c.uuid === 'proto-pool')
    pooler.importPath = 'autora.experimentalist.lhs'
    return state
  }

  it('drops allowed_values from IV declarations but keeps value_range', () => {
    const code = generatePythonCode(buildStateWithLhsPooler())
    expect(code).toContain(
      'X=[IV(name="x", value_range=(-10, 10)), IV(name="y", value_range=(-10, 10))],'
    )
    expect(code).not.toMatch(/IV\([^)]*allowed_values/)
  })

  it('keeps allowed_values on the DV (the pooler samples IVs only)', () => {
    const code = generatePythonCode(buildStateWithLhsPooler())
    expect(code).toContain(
      'y=DV(name="z", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10)))'
    )
  })

  it('leaves IV allowed_values intact when no LHS pooler is present', () => {
    const code = generatePythonCode(buildStateWithEquationRunner())
    expect(code).toMatch(/IV\(name="x", allowed_values=np\.linspace/)
  })

  it('strips allowed_values with whitespace around = (e.g. allowed_values = values)', () => {
    const state = buildStateWithLhsPooler()
    const xParam = state.components.experiment_runners[0].parameters.equation_experiment.find(p => p.name === 'X')
    xParam.default = `[IV(name="x", allowed_values = values, value_range=(-10, 10))]`
    const code = generatePythonCode(state)
    expect(code).not.toMatch(/IV\([^)]*allowed_values/)
    expect(code).toContain('value_range=(-10, 10)')
  })

  it('strips allowed_values with a plain number value (e.g. allowed_values=42)', () => {
    const state = buildStateWithLhsPooler()
    const xParam = state.components.experiment_runners[0].parameters.equation_experiment.find(p => p.name === 'X')
    xParam.default = `[IV(name="x", allowed_values=42, value_range=(-10, 10))]`
    const code = generatePythonCode(state)
    expect(code).not.toMatch(/IV\([^)]*allowed_values/)
    expect(code).toContain('value_range=(-10, 10)')
  })

  it('strips allowed_values with a quoted string value (e.g. allowed_values="auto")', () => {
    const state = buildStateWithLhsPooler()
    const xParam = state.components.experiment_runners[0].parameters.equation_experiment.find(p => p.name === 'X')
    xParam.default = `[IV(name="x", allowed_values="auto", value_range=(-10, 10))]`
    const code = generatePythonCode(state)
    expect(code).not.toMatch(/IV\([^)]*allowed_values/)
    expect(code).toContain('value_range=(-10, 10)')
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
          { name: 'fixed_effects', datatype: 'string' },
          {
            name: 'X',
            datatype: 'IV',
            default: '[IV(name="x1", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10))]'
          }
        ],
        run: [{ name: 'added_noise', datatype: 'real' }]
      },
      pipInstall: 'autora-synthetic'
    }
  ]
  return state
}

describe('lmm_experiment X from IV param (no DV)', () => {
  it('emits X verbatim from its default and passes no y', () => {
    const code = generatePythonCode(buildStateWithLmmRunner())
    expect(code).toContain('formula="rt ~ 1 + x1"')
    expect(code).toContain("fixed_effects={'Intercept': 0., 'x1': 2.}")
    // X is the only IV/DV param, so its literal closes the runner call.
    expect(code).toContain(
      'X=[IV(name="x1", allowed_values=np.linspace(-10, 10, 100), value_range=(-10, 10))])'
    )
    // lmm declares no DV param, so no y argument is emitted.
    expect(code).not.toContain('y=DV(')
    expect(code).toContain('from autora.variable import VariableCollection, IV, DV')
    expect(code).toContain('import numpy as np')
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
