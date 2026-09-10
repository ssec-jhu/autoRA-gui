import { describe, it, expect } from 'vitest'
import {
  parseGithubUrl,
  deriveImportPath,
  deriveCategory,
  splitTopLevel,
  parseParam,
  parsePythonLiteral,
  extractDefinition,
  extractNestedRun,
  extractVariableDefs,
  parseDocstring,
  inferDatatype,
  displayName,
  fileNameFor,
  buildComponent,
  createComponentJson
} from './JsonGenerator'

const BANDIT_URL =
  'https://github.com/AutoResearch/autora-experimentalist-bandit-random/blob/main/src/autora/experimentalist/bandit_random/__init__.py#L137'

const FUNCTION_SOURCE = `"""Module docstring."""

import numpy as np

from typing import Union, List, Optional
from collections.abc import Iterable


def helper(x):
    return x


def pool(
        num_rewards: int,
        sequence_length: int,
        initial_probabilities: Optional[Iterable[Union[float, Iterable]]] = None,
        num_samples: int = 1,
        random_state: Optional[int] = None,
) -> List[List[List[float]]]:
    """
    Returns a list of rewards.

    Args:
        num_rewards: the number of rewards
        sequence_length: the length of the sequence
        initial_probabilities: a list of initial values. Each
            entry can be a range.
        num_samples: number of experimental conditions to select
        random_state: the seed value for the random number generator
    Returns:
        Sampled pool of experimental conditions
    """
    return []
`

const SAMPLER_SOURCE = `def sample(
    conditions,
    model,
    num_samples,
    measure="least_confident",
):
    """

    Args:
        conditions: pool of IV conditions to evaluate uncertainty
        model: Scikit-learn model, must have predict_proba method.
        num_samples: number of samples to select
        measure: method to evaluate uncertainty. Options:

            - \`'least_confident'\`: description one
            - \`'margin'\`: description two
            - \`'entropy'\`: description three

    Returns: Sampled conditions

    """
    return conditions
`

const CLASS_SOURCE = `class BMSRegressor(BaseEstimator, RegressorMixin):
    """
    Bayesian Machine Scientist.

    BMS finds an optimal function to explain a dataset.

    Attributes:
        pms: the model
    """

    def __init__(
        self,
        prior_par: dict = PRIORS,
        ts: List[float] = TEMPERATURES,
        epochs: int = 1500,
    ):
        """
        Arguments:
            prior_par: a dictionary of prior probabilities
            ts: a list of the temperatures
        """
        self.ts = ts

    def fit(
        self,
        X: np.ndarray,
        y: np.ndarray,
        num_param: int = 1,
        root=None,
    ) -> BMSRegressor:
        """
        Runs the optimization.

        Arguments:
            X: independent variables in an n-dimensional array
            y: dependent variables in an n-dimensional array
            num_param: number of parameters

        Returns:
            self (BMS): the fitted estimator
        """
        return self
`

const RUNNER_SOURCE = `def weber_fechner_law(
    name="Weber-Fechner Law",
    resolution=100,
    constant=1.0,
):
    """
    Weber-Fechner Law

    Args:
        name: name of the experiment
        resolution: number of allowed values
        constant: constant multiplier
    """
    iv1 = IV(
        name="S1",
        variable_label="Stimulus 1 Intensity",
        type=ValueType.REAL,
    )
    dv1 = DV(
        name="difference_detected",
        variable_label="Sensation",
        type=ValueType.REAL,
    )

    def run(
        conditions,
        added_noise=0.01,
        random_state=None,
    ):
        return conditions

    return SyntheticExperimentCollection(run=run)
`

describe('parseGithubUrl', () => {
  it('parses owner, repo, ref, path and line', () => {
    const link = parseGithubUrl(BANDIT_URL)
    expect(link.owner).toBe('AutoResearch')
    expect(link.repo).toBe('autora-experimentalist-bandit-random')
    expect(link.ref).toBe('main')
    expect(link.filePath).toBe('src/autora/experimentalist/bandit_random/__init__.py')
    expect(link.line).toBe(137)
    expect(link.rawUrl).toBe(
      'https://raw.githubusercontent.com/AutoResearch/autora-experimentalist-bandit-random/main/src/autora/experimentalist/bandit_random/__init__.py'
    )
  })

  it('defaults to line 1 without a fragment', () => {
    const link = parseGithubUrl(BANDIT_URL.replace('#L137', ''))
    expect(link.line).toBe(1)
  })

  it('rejects non-file links', () => {
    expect(() => parseGithubUrl('https://github.com/AutoResearch/autora')).toThrow()
  })
})

describe('deriveImportPath / deriveCategory', () => {
  it('converts a src path to a dotted import path', () => {
    expect(deriveImportPath('src/autora/experimentalist/bandit_random/__init__.py'))
      .toBe('autora.experimentalist.bandit_random')
    expect(deriveImportPath('src/autora/theorist/bms/regressor.py'))
      .toBe('autora.theorist.bms.regressor')
  })

  it('maps import paths to protocol types and folders', () => {
    expect(deriveCategory('autora.experimentalist.novelty'))
      .toEqual({ protocolType: 'experimentalist', folder: 'experimentalists' })
    expect(deriveCategory('autora.theorist.bms.regressor'))
      .toEqual({ protocolType: 'theorist', folder: 'theorists' })
    expect(deriveCategory('autora.experiment_runner.synthetic.psychophysics.weber_fechner_law'))
      .toEqual({ protocolType: 'experiment_runner', folder: 'experiment_runners' })
  })
})

describe('signature parsing', () => {
  it('splits on top-level commas only', () => {
    expect(splitTopLevel('a: int, b: Union[float, Iterable] = None, c="x,y"'))
      .toEqual(['a: int', 'b: Union[float, Iterable] = None', 'c="x,y"'])
  })

  it('parses names, annotations and defaults', () => {
    expect(parseParam('num_samples: int = 1'))
      .toEqual({ name: 'num_samples', annotation: 'int', defaultText: '1' })
    expect(parseParam('measure="least_confident"'))
      .toEqual({ name: 'measure', annotation: null, defaultText: '"least_confident"' })
    expect(parseParam('self')).toBeNull()
    expect(parseParam('**kwargs')).toBeNull()
  })

  it('parses python literals', () => {
    expect(parsePythonLiteral('None')).toBeNull()
    expect(parsePythonLiteral('True')).toBe(true)
    expect(parsePythonLiteral('42')).toBe(42)
    expect(parsePythonLiteral('0.01')).toBe(0.01)
    expect(parsePythonLiteral('"abc"')).toBe('abc')
    expect(parsePythonLiteral('PRIORS')).toBeUndefined()
  })
})

describe('extractDefinition', () => {
  it('extracts a function with params and docstring', () => {
    const def = extractDefinition(FUNCTION_SOURCE, 14)
    expect(def.kind).toBe('function')
    expect(def.name).toBe('pool')
    expect(def.params.map(p => p.name)).toEqual([
      'num_rewards', 'sequence_length', 'initial_probabilities', 'num_samples', 'random_state'
    ])
    expect(def.docstring).toContain('Returns a list of rewards.')
  })

  it('finds the enclosing definition when the line points into the body', () => {
    const def = extractDefinition(FUNCTION_SOURCE, 30)
    expect(def.name).toBe('pool')
  })

  it('extracts a class with __init__ and fit methods', () => {
    const def = extractDefinition(CLASS_SOURCE, 1)
    expect(def.kind).toBe('class')
    expect(def.name).toBe('BMSRegressor')
    expect(Object.keys(def.methods)).toEqual(['__init__', 'fit'])
    expect(def.methods.__init__.params.map(p => p.name)).toEqual(['prior_par', 'ts', 'epochs'])
    expect(def.methods.fit.params.map(p => p.name)).toEqual(['X', 'y', 'num_param', 'root'])
  })

  it('extracts a nested run function from a factory body', () => {
    const def = extractDefinition(RUNNER_SOURCE, 1)
    const run = extractNestedRun(def.body)
    expect(run.params.map(p => p.name)).toEqual(['conditions', 'added_noise', 'random_state'])
  })

  it('extracts IV/DV declarations from a factory body', () => {
    const def = extractDefinition(RUNNER_SOURCE, 1)
    expect(extractVariableDefs(def.body)).toEqual([
      { role: 'IV', name: 'S1', label: 'Stimulus 1 Intensity' },
      { role: 'DV', name: 'difference_detected', label: 'Sensation' }
    ])
  })
})

describe('parseDocstring', () => {
  it('parses summary, args and a Returns section', () => {
    const def = extractDefinition(FUNCTION_SOURCE, 14)
    const doc = parseDocstring(def.docstring, def.params.map(p => p.name))
    expect(doc.summary).toBe('Returns a list of rewards.')
    expect(doc.args.num_rewards).toBe('the number of rewards')
    expect(doc.args.initial_probabilities)
      .toBe('a list of initial values. Each entry can be a range.')
    expect(doc.returns.description).toBe('Sampled pool of experimental conditions')
  })

  it('handles an inline "Returns: text" header', () => {
    const def = extractDefinition(SAMPLER_SOURCE, 1)
    const doc = parseDocstring(def.docstring, def.params.map(p => p.name))
    expect(doc.returns.description).toBe('Sampled conditions')
    expect(doc.args.measure).not.toContain('Sampled conditions')
  })
})

describe('inferDatatype', () => {
  it('maps annotations to datatypes', () => {
    expect(inferDatatype('int').datatype).toBe('integer')
    expect(inferDatatype('float').datatype).toBe('real')
    expect(inferDatatype('bool').datatype).toBe('boolean')
    expect(inferDatatype('str').datatype).toBe('string')
    expect(inferDatatype('Optional[Iterable[Union[float, Iterable]]]').datatype).toBe('real')
  })

  it('extracts Literal values as categorical', () => {
    const result = inferDatatype('Literal["a", "b"]')
    expect(result.datatype).toBe('categorical')
    expect(result.validValues).toEqual(['a', 'b'])
  })

  it('falls back to the default literal text, keeping 1.0 real', () => {
    expect(inferDatatype(null, '1.0').datatype).toBe('real')
    expect(inferDatatype(null, '100').datatype).toBe('integer')
    expect(inferDatatype(null, 'False').datatype).toBe('boolean')
  })

  it('uses well-known parameter names as a last resort', () => {
    expect(inferDatatype(null, undefined, 'num_samples').datatype).toBe('integer')
  })
})

describe('displayName / fileNameFor', () => {
  const fn = name => ({ kind: 'function', name })

  it('combines module and function names without repeating words', () => {
    expect(displayName(fn('pool'), 'autora.experimentalist.bandit_random'))
      .toBe('Bandit Random Pooler')
    expect(displayName(fn('sample'), 'autora.experimentalist.uncertainty'))
      .toBe('Uncertainty Sampler')
    expect(displayName(fn('score_sample'), 'autora.experimentalist.novelty'))
      .toBe('Novelty Score Sampler')
    expect(displayName(fn('grid_pool'), 'autora.experimentalist.grid'))
      .toBe('Grid Pooler')
    expect(displayName(fn('filter'), 'autora.experimentalist.prediction_filter'))
      .toBe('Prediction Filter')
    expect(displayName(
      fn('weber_fechner_law'),
      'autora.experiment_runner.synthetic.psychophysics.weber_fechner_law'
    )).toBe('Weber Fechner Law')
  })

  it('splits class camel case keeping acronyms', () => {
    expect(displayName({ kind: 'class', name: 'BMSRegressor' }, 'autora.theorist.bms.regressor'))
      .toBe('BMS Regressor')
    expect(displayName({ kind: 'class', name: 'DARTSRegressor' }, 'autora.theorist.darts.regressor'))
      .toBe('DARTS Regressor')
  })

  it('derives the json file name from the display name', () => {
    expect(fileNameFor('Bandit Random Pooler')).toBe('bandit_random_pooler.json')
    expect(fileNameFor('BMS Regressor')).toBe('bms_regressor.json')
  })
})

describe('buildComponent', () => {
  it('builds an experimentalist pooler component', () => {
    const { component, folder, fileName } = buildComponent({
      url: BANDIT_URL,
      source: FUNCTION_SOURCE,
      uuid: 'test-uuid'
    })
    expect(folder).toBe('experimentalists')
    expect(fileName).toBe('bandit_random_pooler.json')
    expect(component.uuid).toBe('test-uuid')
    expect(component.protocolType).toBe('experimentalist')
    expect(component.name).toBe('Bandit Random Pooler')
    expect(component.pythonName).toBe('pool')
    expect(component.importPath).toBe('autora.experimentalist.bandit_random')
    expect(component.githubCommit).toBe(BANDIT_URL)

    const params = component.parameters.pool
    expect(params.map(p => p.name)).toEqual([
      'num_rewards', 'sequence_length', 'initial_probabilities', 'num_samples', 'random_state'
    ])
    const numSamples = params.find(p => p.name === 'num_samples')
    expect(numSamples.datatype).toBe('integer')
    expect(numSamples.default).toBe(1)
    expect(numSamples.cardinality).toEqual({ minOccurs: 1, maxOccurs: 1, unique: true })
    const randomState = params.find(p => p.name === 'random_state')
    expect(randomState.cardinality.minOccurs).toBe(0)

    // no data-like arguments: everything is configuration
    expect(component.inputDataType).toBeNull()
    expect(component.outputDataType.description).toBe('Sampled pool of experimental conditions')
  })

  it('builds a sampler with input data and categorical options', () => {
    const url =
      'https://github.com/AutoResearch/autora-experimentalist-uncertainty/blob/main/src/autora/experimentalist/uncertainty/__init__.py#L10'
    const { component } = buildComponent({ url, source: SAMPLER_SOURCE, uuid: 'u' })

    expect(component.inputDataType.variables.map(v => v.name)).toEqual(['conditions', 'model'])
    const measure = component.parameters.sample.find(p => p.name === 'measure')
    expect(measure.datatype).toBe('categorical')
    expect(measure.validValues).toEqual(['least_confident', 'margin', 'entropy'])
    expect(measure.default).toBe('least_confident')
    const numSamples = component.parameters.sample.find(p => p.name === 'num_samples')
    expect(numSamples.datatype).toBe('integer')
  })

  it('builds a theorist component from a class', () => {
    const url =
      'https://github.com/AutoResearch/autora-theorist-bms/blob/main/src/autora/theorist/bms/regressor.py#L1'
    const { component, folder, fileName } = buildComponent({
      url, source: CLASS_SOURCE, uuid: 'u'
    })
    expect(folder).toBe('theorists')
    expect(fileName).toBe('bms_regressor.json')
    expect(component.pythonName).toBe('BMSRegressor')

    // dict-typed prior_par is not GUI-settable and is skipped
    expect(component.parameters.__init__.map(p => p.name)).toEqual(['ts', 'epochs'])
    // only annotated non-data fit params are kept
    expect(component.parameters.fit.map(p => p.name)).toEqual(['num_param'])
    expect(component.inputDataType.name).toBe('X')
    expect(component.outputDataType.name).toBe('y')
  })

  it('builds an experiment runner with run params and IV/DV data types', () => {
    const url =
      'https://github.com/AutoResearch/autora-synthetic/blob/main/src/autora/experiment_runner/synthetic/psychophysics/weber_fechner_law.py#L1'
    const { component, folder } = buildComponent({ url, source: RUNNER_SOURCE, uuid: 'u' })

    expect(folder).toBe('experiment_runners')
    expect(component.protocolType).toBe('experiment_runner')
    // the factory's display-label `name` argument is skipped
    expect(component.parameters.weber_fechner_law.map(p => p.name))
      .toEqual(['resolution', 'constant'])
    expect(component.parameters.weber_fechner_law.find(p => p.name === 'constant').datatype)
      .toBe('real')
    expect(component.parameters.run.map(p => p.name)).toEqual(['added_noise', 'random_state'])
    expect(component.inputDataType.name).toBe('S1')
    expect(component.outputDataType.name).toBe('difference_detected')
  })
})

describe('createComponentJson', () => {
  it('fetches the source and resolves the pip install spec', async () => {
    const fetchImpl = async url => {
      if (url.endsWith('__init__.py')) {
        return { ok: true, text: async () => FUNCTION_SOURCE }
      }
      if (url.endsWith('pyproject.toml')) {
        return {
          ok: true,
          text: async () => '[project]\nname = "autora-experimentalist-bandit-random"\n'
        }
      }
      if (url.startsWith('https://pypi.org/pypi/')) {
        expect(url).toBe('https://pypi.org/pypi/autora-experimentalist-bandit-random/json')
        return { ok: true, json: async () => ({ info: { version: '1.0.0' } }) }
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }

    const { component, folder, fileName } = await createComponentJson(
      BANDIT_URL.replace('#L137', '#L14'),
      { fetchImpl, uuid: 'fixed-uuid' }
    )
    expect(folder).toBe('experimentalists')
    expect(fileName).toBe('bandit_random_pooler.json')
    expect(component.uuid).toBe('fixed-uuid')
    expect(component.pipInstall).toBe('autora-experimentalist-bandit-random==1.0.0')
  })

  it('falls back to the repo name when pip resolution fails', async () => {
    const fetchImpl = async url => {
      if (url.endsWith('__init__.py')) {
        return { ok: true, text: async () => FUNCTION_SOURCE }
      }
      return { ok: false, status: 404 }
    }
    const { component } = await createComponentJson(
      BANDIT_URL.replace('#L137', '#L14'),
      { fetchImpl, uuid: 'u' }
    )
    expect(component.pipInstall).toBe('autora-experimentalist-bandit-random')
  })
})
