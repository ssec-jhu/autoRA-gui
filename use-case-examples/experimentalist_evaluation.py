"""
AutoRA workflow to evaluate experimental sampling strategies
        on synthetic data

Goal: Validate experimental sampling strategy.

Non-Standard State Components:
    - The state is largely expanded with models, conditions and experimental data to
        accommodate multiple sampling strategies

Non-Standard Workflow Components:
    - Switch sampler based on custom condition
"""

from dataclasses import dataclass, field
from typing import List
from string import ascii_lowercase
import random

import pysr
from pysr import PySRRegressor

if debug:
    from pympler import asizeof
    from memory_profiler import profile

pysr.julia_helpers.init_julia()

from sklearn.base import BaseEstimator
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, max_error, \
    median_absolute_error

import numpy as np
import math
from autora.variable import VariableCollection, Variable
from autora.state import StandardState
from autora.state import on_state
from equation_tree import sample
from equation_tree.sample import sample_fast
from equation_tree.tree import instantiate_constants
from equation_tree.prior import DEFAULT_PRIOR_FUNCTIONS, structure_prior_from_depth, \
    priors_from_space
from autora.experiment_runner.synthetic.abstract.equation import equation_experiment
from autora.experimentalist.random import random_sample, random_pool
from autora.state import Delta
from autora.experimentalist.falsification import falsification_score_sample
from autora.experimentalist.novelty import novelty_score_sample
import sys
import sympy

if sys.version[0] == '3':
    import pickle
else:
    import cPickle as pickle

# CONSTANTS
debug = True

# MARGIN FOR METRICS (if < NAN_MARGIN of elements are nan/inf, drop them and calculate the metric
# else, metric == inf)
NAN_MARGIN = .1

# SAMPLING
NUM_SAMPLES = 1
POOL_RANGE = 5
CONDITION_RETRIES = 10_000_000

# EVALUATION
NUM_EVAL_SAMPLES = 10000

# EQUATION
MAX_NUM_VARIABLES = 10
NUM_POOL_SAMPLES = 10_000
CONSTANT_SIZE = 5

# SIMULATION
CYCLES = 150
NITER = 100

# SAMPLING RANGES
MAX_TEMPERATURE = 2
MAX_ADDED_NOISE = 2

# SAMPLING CONSTANTS FOR THE SIMULATIONS

TEMPERATURE = np.random.random() * MAX_TEMPERATURE

ANNEALING = bool(np.random.choice([False, True], 1))

falsification_weight = np.random.rand(1)[0]
novelty_weight = np.random.rand(1)[0]
disagreement_weight = np.random.rand(1)[0]
WEIGHTS = {'falsification': falsification_weight, 'novelty': novelty_weight,
           'disagreement': disagreement_weight}

TREE_DEPTH = np.random.choice([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])

N_DEAD_VARS = int(np.floor(np.random.gamma(1, 2, 1)))
DEAD_VARIABLES_ = ["d_1", "d_2", "d_3", "d_4", "d_5", "d_6", "d_7", "d_8", "d_9", "d_10", "d_11",
                   "d_12", "d_13", "d_14", "d_15"][:N_DEAD_VARS]
DEAD_VARIABLES = []
for d in DEAD_VARIABLES_:
    DEAD_VARIABLES.append(Variable(d, value_range=(-POOL_RANGE, POOL_RANGE)))

ADDED_NOISE = np.random.random() * MAX_ADDED_NOISE

# Tempfile for pysr
PYSR_EQUATION_FILE = ''.join(random.choice(ascii_lowercase) for _ in range(16)) + '.csv'


# Annealing function
def cos_annealed_t(T_0, cycles, i):
    """
    Args:
        T_0: Start temperature
        cycles: number of cycles
        i: current cycle
    """

    return T_0 * math.cos(i * math.pi / (2 * cycles))


# SAMPLE EQUATION

feature_prior = {'constants': .5, 'variables': .5}
operator_pior = priors_from_space(["+", "-", "*", "/", "^"])

if TREE_DEPTH <= 8:
    structure_prior = structure_prior_from_depth(TREE_DEPTH)
    prior = {'functions': DEFAULT_PRIOR_FUNCTIONS, 'operators': operator_pior,
             'structures': structure_prior, 'features': feature_prior}
    equation_raw = sample(n=1, prior=prior, max_num_variables=MAX_NUM_VARIABLES)
else:
    prior = {'functions': DEFAULT_PRIOR_FUNCTIONS, 'operators': operator_pior,
             'features': feature_prior}
    equation_raw = sample_fast(n=1, prior=prior, tree_depth=TREE_DEPTH,
                               max_num_variables=MAX_NUM_VARIABLES)

equation = instantiate_constants(equation_raw[0], lambda: np.random.rand() * CONSTANT_SIZE)

features = {}
for v in range(equation.n_variables_unique):
    array = np.linspace(-POOL_RANGE, POOL_RANGE, 1000)
    np.random.shuffle(array)
    features[equation.variables_unique[v]] = array

# Defining the metadata based on the sampled ground truth.

independent_variables = []
for v in range(equation.n_variables_unique):
    independent_variables.append(
        Variable(equation.variables_unique[v], value_range=(-POOL_RANGE, POOL_RANGE)))

variables_for_the_experiment = VariableCollection(
    independent_variables=independent_variables,
    dependent_variables=[Variable("y")]
)

independent_variables_ = independent_variables.copy()
# variables with dead variables
if len(DEAD_VARIABLES) > 0:
    for i in range(len(DEAD_VARIABLES)):
        independent_variables_.append(DEAD_VARIABLES[i])

variables = VariableCollection(
    independent_variables=independent_variables_,
    dependent_variables=[Variable("y")]
)

# Defining experiment runner from the equation and the variable collection

experiment = equation_experiment(equation.sympy_expr,
                                 variables_for_the_experiment.independent_variables,
                                 variables_for_the_experiment.dependent_variables[0],
                                 rename_output_columns=False)


# Defining the state.
# We can define an initial state for our discovery problem based on the variable specification
# above.
# Wrapping experiment runner into the state.


@dataclass(frozen=True)
class ExtendedState(StandardState):
    models_pysr: List[BaseEstimator] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    models_linear: List[BaseEstimator] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    models_polynom: List[BaseEstimator] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    rejections: List[int] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mad: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    cycle_step: int = field(
        default_factory=int,
        metadata={"delta": "replace"},
    )
    mad_pysr_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mad_linear_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mad_poly_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    msd_pysr_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    msd_linear_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    msd_poly_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mxe_pysr_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mxe_linear_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mxe_poly_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    med_pysr_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    med_linear_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    med_poly_oos: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mad_pysr_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mad_linear_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mad_poly_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    msd_pysr_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    msd_linear_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    msd_poly_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mxe_pysr_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mxe_linear_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    mxe_poly_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    med_pysr_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    med_linear_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )
    med_poly_is: List[float] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )


state = ExtendedState(
    variables=variables
)

runner_on_state = on_state(experiment.experiment_runner, output=["experiment_data"])


# Pooler
@on_state()
def experimentalist_pooler(variables, equation, dead_variables=None):
    column_names = [v.name for v in variables.independent_variables]
    if dead_variables:
        column_names += dead_variables

    conditions_ = pd.DataFrame(columns=column_names)

    i = 0
    n = 0
    while i < CONDITION_RETRIES and len(conditions_.index) < NUM_POOL_SAMPLES:  # <-- rejection sampling
        _sample = random_pool(variables, NUM_POOL_SAMPLES)
        if dead_variables:
            _dead_sample = random_pool(dead_variables, NUM_POOL_SAMPLES)
            _sample = pd.concat([_sample, _dead_sample], axis=1)

        n += NUM_POOL_SAMPLES
        evaluation = equation.evaluate(_sample)

        evaluation[np.isnan(evaluation) | np.isinf(evaluation)] = -5001

        # Find indices that are outside the desired threshold range
        bad_indices = np.where((evaluation < -5000) | (evaluation > 5000))[0]

        # bad_indices = np.where(np.isnan(evaluation) | np.isinf(evaluation))[0]
        _sample = _sample.drop(bad_indices)
        if np.isnan(evaluation).any() or np.isinf(evaluation).any():
            i += len(bad_indices)
        conditions_ = pd.concat([conditions_, _sample], ignore_index=True)
    if i >= CONDITION_RETRIES:
        return None
    conditions_ = conditions_.head(NUM_POOL_SAMPLES)

    return Delta(conditions=conditions_, rejections=[i / n])


# Mixture experimentalist Defining the mixture experimentalist and wrapping it into the state

"""
Mixture Experimentalist Sampler
"""

import numpy as np
from typing import Optional, Union

import pandas as pd


def adjust_distribution(p_, temperature):
    # temperature cannot be 0
    assert temperature != 0, 'Temperature cannot be 0'
    p = np.array(p_)
    # If the temperature is very low (close to 0), then the sampling will become almost
    # deterministic, picking the event with the highest probability.

    # If the temperature is very high, then the sampling will be closer to uniform,
    # with all events having roughly equal probability.

    p = p / np.sum(np.abs(p))  # Normalizing the initial distribution

    p = np.exp(p / temperature)
    final_p = p / np.sum(p)  # Normalizing the final distribution
    return final_p


def sample(conditions: Union[pd.DataFrame, np.ndarray], temperature: float,
           samplers: list, params: dict,
           num_samples: Optional[int] = None) -> pd.DataFrame:
    """

    Args:
        conditions: pool of experimental conditions to evaluate: pd.Dataframe
        temperature: how random is selection of conditions (cannot be 0; (0:1) - the choices are more deterministic than the choices made wrt
        samplers: tuple containing sampler functions, their names, and weights
        for sampler functions that return both positive and negative scores, user can provide a list with two weights: the first one will be applied to positive scores, the second one -- to the negative
        params: nested dictionary. keys correspond to the sampler function names (same as provided in samplers),
        values correspond to the dictionaries of function arguments (argument name: its value)
        num_samples: number of experimental conditions to select

    Returns:
        Sampled pool of experimental conditions with the scores attached to them
    """

    condition_pool = pd.DataFrame(conditions)

    rankings = pd.DataFrame()
    mixture_scores = np.zeros(len(condition_pool))
    # getting rankings and weighted scores from each function
    for (function, name, weight) in samplers:

        sampler_params = params[name]
        pd_ranking = function(conditions=condition_pool, **sampler_params)

        # except:
        #     pd_ranking = function(conditions=condition_pool)
        # sorting by index
        pd_ranking = pd_ranking.sort_index()
        # if only one weight is provided, use it for both negative and positive dimensions
        if isinstance(weight, float) or isinstance(weight, int):
            pd_ranking["score"] = pd_ranking["score"] * weight
        else:
            if len(pd_ranking["score"] < 0) > 0 and len(
                    pd_ranking["score"] > 0) > 0:  # there are both positive and negative values
                pd_ranking.loc[pd_ranking["score"] > 0]["score"] = \
                    pd_ranking.loc[pd_ranking["score"] > 0]["score"] * weight[
                        0]  # positive dimension gets the first weight
                pd_ranking.loc[pd_ranking["score"] < 0]["score"] = \
                    pd_ranking.loc[pd_ranking["score"] < 0]["score"] * weight[
                        1]  # negative dimension gets the second weight
            else:
                pd_ranking["score"] = pd_ranking["score"] * weight[0]

        pd_ranking.rename(columns={"score": f"{name}_score"}, inplace=True)
        # sum_scores are arranged based on the original conditions_ indices
        mixture_scores = mixture_scores + pd_ranking[f"{name}_score"]

        rankings = pd.merge(rankings, pd_ranking, left_index=True, right_index=True, how="outer")

    weighted_mixture_scores_adjusted = adjust_distribution(mixture_scores, temperature)

    if num_samples is None:
        num_samples = condition_pool.shape[0]

    weighted_mixture_scores_adjusted = np.nan_to_num(weighted_mixture_scores_adjusted, nan=0.0)
    if np.sum(weighted_mixture_scores_adjusted) != 0:
        normalized_scores = weighted_mixture_scores_adjusted / np.sum(
            weighted_mixture_scores_adjusted)
    else:
        normalized_scores = np.ones_like(weighted_mixture_scores_adjusted) / len(
            weighted_mixture_scores_adjusted)

    condition_indices = np.random.choice(np.arange(len(condition_pool)), num_samples,
                                         p=normalized_scores, replace=False)
    conditions_ = condition_pool.iloc[condition_indices]
    conditions_["score"] = mixture_scores

    return conditions_


mixture_sample_test = sample

"""
Model Disagreement Experimentalist
"""

import itertools
import warnings
from typing import Iterable, List, Optional, Union

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from autora.utils.deprecation import deprecated_alias


def score_sample(
        conditions: Union[pd.DataFrame, np.ndarray],
        models: List,
        num_samples: Optional[int] = None,
):
    """
    A experimentalist that returns selected samples for independent variables
    for which the models disagree the most in terms of their predictions.

    Args:
        conditions: pool of IV conditions to evaluate in terms of model disagreement
        models: List of Scikit-learn (regression or classification) models to compare
        num_samples: number of samples to select

    Returns: Sampled pool

    Examples:
        If a model is undefined at a certain condition, the disagreement on that point is set to 0:
        >>> class ModelUndefined:
        ...     def predict(self, X):
        ...         return np.log(X)
        >>> class ModelDefinined:
        ...     def predict(self, X):
        ...         return X
        >>> modelUndefined = ModelUndefined()
        >>> modelDefined = ModelDefinined()
        >>> conditions_defined = np.array([1, 2, 3])
        >>> score_sample(conditions_defined, [modelUndefined, modelDefined], 3)
           0     score
        2  3  1.364948
        1  2 -0.362023
        0  1 -1.002924

        >>> conditions_undefined = np.array([-1, 0, 1, 2, 3])
        >>> score_sample(conditions_undefined, [modelUndefined, modelDefined], 5)
           0     score
        4  3  1.752985
        3  2  0.330542
        2  1 -0.197345
        0 -1 -0.943091
        1  0 -0.943091
    """

    if isinstance(conditions, Iterable) and not isinstance(conditions, pd.DataFrame):
        conditions = np.array(list(conditions))

    condition_pool_copy = conditions.copy()
    conditions = np.array(conditions)

    X_predict = np.array(conditions)
    if len(X_predict.shape) == 1:
        X_predict = X_predict.reshape(-1, 1)

    model_disagreement = list()

    # collect diagreements for each model pair
    for model_a, model_b in itertools.combinations(models, 2):

        # determine the prediction method
        if hasattr(model_a, "predict_proba") and hasattr(model_b, "predict_proba"):
            model_a_predict = model_a.predict_proba
            model_b_predict = model_b.predict_proba
        elif hasattr(model_a, "predict") and hasattr(model_b, "predict"):
            model_a_predict = model_a.predict
            model_b_predict = model_b.predict
        else:
            raise AttributeError(
                "Models must both have `predict_proba` or `predict` method."
            )

        # get predictions from both models
        y_a = model_a_predict(X_predict)
        y_b = model_b_predict(X_predict)

        y_a[np.where(np.isnan(y_a) | np.isinf(y_a))[0]] = 0.
        y_b[np.where(np.isnan(y_b) | np.isinf(y_b))[0]] = 0.

        assert y_a.shape == y_b.shape, "Models must have same output shape."

        # determine the disagreement between the two models in terms of mean-squared error
        if len(y_a.shape) == 1:
            disagreement = (y_a - y_b) ** 2
        else:
            disagreement = np.mean((y_a - y_b) ** 2, axis=1)

        if np.isinf(disagreement).any() or np.isnan(disagreement).any():
            warnings.warn('Found nan or inf values in model predictions, '
                          'setting disagreement there to 0')
        disagreement[np.isinf(disagreement)] = 0
        disagreement = np.nan_to_num(disagreement)

        model_disagreement.append(disagreement)

    assert len(model_disagreement) >= 1, "No disagreements to compare."

    # sum up all model disagreements
    summed_disagreement = np.sum(model_disagreement, axis=0)

    if isinstance(condition_pool_copy, pd.DataFrame):
        conditions = pd.DataFrame(conditions, columns=condition_pool_copy.columns)
    else:
        conditions = pd.DataFrame(conditions)

    # normalize the distances
    scaler = StandardScaler()
    score = scaler.fit_transform(summed_disagreement.reshape(-1, 1)).flatten()

    # order rows in Y from highest to lowest
    conditions["score"] = score
    conditions = conditions.sort_values(by="score", ascending=False)

    if num_samples is None:
        return conditions
    else:
        return conditions.head(num_samples)


def sample_(
        conditions: Union[pd.DataFrame, np.ndarray], models: List, num_samples: int = 1
):
    """
    A experimentalist that returns selected samples for independent variables
    for which the models disagree the most in terms of their predictions.

    Args:
        conditions: pool of IV conditions to evaluate in terms of model disagreement
        models: List of Scikit-learn (regression or classification) models to compare
        num_samples: number of samples to select

    Returns: Sampled pool
    """

    selected_conditions = score_sample(conditions, models, num_samples)
    selected_conditions.drop(columns=["score"], inplace=True)

    return selected_conditions


model_disagreement_sample = sample_
model_disagreement_score_sample = score_sample
model_disagreement_sampler = deprecated_alias(
    model_disagreement_sample, "model_disagreement_sampler"
)


def metric_nan_zero(metric, x, y):
    """
    Wrapper to sort out elements with nan or inf values before applying the metric.
    If more thn margin (as fraction) of the elements are nan or inf value, return inf

    Examples:
        >>> y_1 = np.array([0] * 10)
        >>> y_1
        array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

        >>> y_2 = np.array([0] * 9 + [np.infty])
        >>> y_2
        array([ 0.,  0.,  0.,  0.,  0.,  0.,  0.,  0.,  0., inf])

        >>> (mean_squared_error, y_1, y_2)
        0.0

        >>> y_1 = np.array([np.nan] + [0] * 8 + [np.infty])
        >>> (mean_squared_error, y_1, y_2)
        0.0

    """
    x_ = x.copy()
    y_ = y.copy()
    x_[np.where(np.isnan(x) | np.isinf(x))[0]] = 0.
    y_[np.where(np.isnan(y) | np.isinf(y))[0]] = 0.

    return metric(x_, y_)


def get_best_model(models, X, y):
    mads = []
    for m in models:
        prediction = m.predict(X)
        mad = metric_nan_zero(median_absolute_error, y, prediction)
        mads.append(mad)
    min_value = min(mads)
    min_index = mads.index(min_value)
    mads[min_index] = math.inf
    min_value_second = min(mads)
    min_index_second = mads.index(min_value_second)
    return models[min_index], models[min_index_second], min_value


@on_state()
def experimentalist_sample(conditions,
                           models,
                           models_pysr,
                           models_linear,
                           models_polynom,
                           experiment_data,
                           variables,
                           temperature,
                           weights,
                           num_samples):
    if models is None or experiment_data is None:
        conditions_ = random_sample(conditions, num_samples)
    else:
        experiment_conditions = experiment_data[[v.name for v in variables.independent_variables]]
        experiment_observations = experiment_data[[v.name for v in variables.dependent_variables]]
        params_ = {}
        params_["falsification"] = {"reference_conditions": experiment_conditions,
                                    "reference_observations": experiment_observations,
                                    "model": models[0], "num_samples": NUM_POOL_SAMPLES}
        params_["novelty"] = {"reference_conditions": experiment_conditions,
                              "num_xsamples": NUM_POOL_SAMPLES}

        second_best_pysr = models_pysr[-1]  # SecondBestPySR(models_pysr[-1])

        models_to_consider = [models_pysr[-1], second_best_pysr, models_linear[-1],
                              models_polynom[-1]]
        best_model, second_best_model, mad = get_best_model(models_to_consider,
                                                            experiment_conditions,
                                                            experiment_observations)

        params_["disagreement"] = {"models": [best_model, second_best_model],
                                   "num_samples": NUM_POOL_SAMPLES}

        samplers = [
            [novelty_score_sample, "novelty", weights["novelty"]],
            [falsification_score_sample, "falsification", weights["falsification"]],
            [model_disagreement_score_sample, "disagreement", weights["disagreement"]]
        ]

        conditions_ = mixture_sample_test(conditions, temperature, samplers, params_, num_samples)
        conditions_ = conditions_.drop("score", axis=1)
    d = Delta(conditions=conditions_)
    return d


class AdjustedPySRRegressor(PySRRegressor):
    def predict(self, X, index=None):
        y = super().predict(X, index)
        if len(y.shape) < 2:
            return np.array([[el] for el in y])
        return y


def idx_model_selection(equations):
    threshold = 1.5 * equations["loss"].min()
    filtered_equations = equations.query(f"loss <= {threshold}")
    sorted_indices = filtered_equations['score'].sort_values(ascending=False).index
    if len(sorted_indices) > 1:
        idx = sorted_indices[1]
    else:
        idx = sorted_indices[0]
    return idx


class SecondBestPySR(BaseEstimator):
    def __init__(self, model):
        self.model = model

    def fit(self, X, y):
        self.model.fit(X, y)

    def predict(self, X):
        index = idx_model_selection(self.model.equations_)
        return self.model.predict(X, index)


binary_operators = ["+", "-", "*", "/", "^"]
unary_operators = ["sin", "cos", "tan", "exp", "log", "sqrt", "abs",
                   "my_acos(x) = abs(x) > 1 ? convert(typeof(x), NaN) : asin(x)",
                   "my_asin(x) = abs(x) > 1 ? convert(typeof(x), NaN) : asin(x)"]
# Theorists
PYSR_REGRESSOR = AdjustedPySRRegressor(niterations=NITER,  # add the regressor outside
                                       binary_operators=binary_operators,
                                       unary_operators=unary_operators,
                                       extra_sympy_mappings={
                                           "my_asin": lambda x: sympy.asin(x),
                                           "my_acos": lambda x: sympy.acos(x)},
                                       equation_file=PYSR_EQUATION_FILE,
                                       batching=True,
                                       multithreading=True,
                                       temp_equation_file=True,
                                       # verbosity=0
                                       # procs=8,
                                       # cluster_manager='slurm',
                                       )


@on_state()
def pysr_theorist(experiment_data: pd.DataFrame, variables: VariableCollection):
    ivs = [v.name for v in variables.independent_variables]
    dvs = [v.name for v in variables.dependent_variables]
    X, y = experiment_data[ivs], experiment_data[dvs]
    new_model = PYSR_REGRESSOR.fit(X, y)
    return Delta(models_pysr=[new_model])


@on_state()
def linear_theorist(experiment_data: pd.DataFrame, variables: VariableCollection, **kwargs):
    ivs = [v.name for v in variables.independent_variables]
    dvs = [v.name for v in variables.dependent_variables]
    X, y = experiment_data[ivs], experiment_data[dvs]
    new_model = LinearRegression().set_params(**kwargs).fit(X, y)
    return Delta(models_linear=[new_model])


def PolynomialRegression(degree=3, **kwargs):
    return make_pipeline(PolynomialFeatures(degree), LinearRegression(**kwargs))


@on_state()
def polynomial_theorist(experiment_data: pd.DataFrame, variables: VariableCollection, **kwargs):
    ivs = [v.name for v in variables.independent_variables]
    dvs = [v.name for v in variables.dependent_variables]
    X, y = experiment_data[ivs], experiment_data[dvs]
    new_model = PolynomialRegression()
    new_model.fit(X, y)
    return Delta(models_polynom=[new_model])


# Model evaluation

@on_state()
def best_model(models_pysr, models_linear, models_polynom, experiment_data, variables, cycle_step):
    ivs = [v.name for v in variables.independent_variables]
    dvs = [v.name for v in variables.dependent_variables]
    X, y = experiment_data[ivs], experiment_data[dvs]
    prediction_pysr = models_pysr[-1].predict(X)
    prediction_linear = models_linear[-1].predict(X)
    prediction_polynomial = models_polynom[-1].predict(X)

    mad_pysr = metric_nan_zero(mean_absolute_error, y, prediction_pysr)
    mad_linear = metric_nan_zero(mean_absolute_error, y, prediction_linear)
    mad_poly = metric_nan_zero(mean_absolute_error, y, prediction_polynomial)

    msd_pysr = metric_nan_zero(mean_squared_error, y, prediction_pysr)
    msd_linear = metric_nan_zero(mean_squared_error, y, prediction_linear)
    msd_poly = metric_nan_zero(mean_squared_error, y, prediction_polynomial)

    mxe_pysr = metric_nan_zero(max_error, y, prediction_pysr)
    mxe_linear = metric_nan_zero(max_error, y, prediction_linear)
    mxe_poly = metric_nan_zero(max_error, y, prediction_polynomial)

    med_pysr = metric_nan_zero(median_absolute_error, y, prediction_pysr)
    med_linear = metric_nan_zero(median_absolute_error, y, prediction_linear)
    med_poly = metric_nan_zero(median_absolute_error, y, prediction_polynomial)

    new_model = models_pysr[-1]
    if med_pysr <= med_linear and med_pysr <= med_poly:
        new_model = models_pysr[-1]
    elif med_linear <= med_pysr and med_linear <= med_poly:
        new_model = models_linear[-1]
    elif med_poly <= msd_linear and med_poly <= med_pysr:
        new_model = models_polynom[-1]

    cycle_step_ = cycle_step + 1

    return Delta(model=new_model, cycle_step=cycle_step_, mad_pysr_is=[mad_pysr],
                 mad_linear_is=[mad_linear], mad_poly_is=[mad_poly], msd_pysr_is=[msd_pysr],
                 msd_linear_is=[msd_linear], msd_poly_is=[msd_poly], mxe_pysr_is=[mxe_pysr],
                 mxe_linear_is=[mxe_linear], mxe_poly_is=[mxe_poly], med_linear_is=[med_linear],
                 med_poly_is=[med_poly], med_pysr_is=[med_pysr])


@on_state()
def evaluation_oos(models_pysr, models_linear, models_polynom, variables, dead_variables=None):
    ivs = [v.name for v in variables.independent_variables]
    if dead_variables:
        ivs += dead_variables
    dvs = [v.name for v in variables.dependent_variables]

    conditions_ = pd.DataFrame(columns=ivs)

    i = 0
    n = 0
    while i < CONDITION_RETRIES * 10 and len(conditions_.index) < NUM_EVAL_SAMPLES:
        _sample = random_pool(variables, NUM_EVAL_SAMPLES)
        if dead_variables:
            _dead_sample = random_pool(dead_variables, NUM_EVAL_SAMPLES)
            _sample = pd.concat([_sample, _dead_sample], axis=1)

        n += NUM_EVAL_SAMPLES
        evaluation = equation.evaluate(_sample)
        bad_indices = np.where(np.isnan(evaluation) | np.isinf(evaluation))[0]
        _sample = _sample.drop(bad_indices)
        if np.isnan(evaluation).any() or np.isinf(evaluation).any():
            i += len(bad_indices)
        conditions_ = pd.concat([conditions_, _sample], ignore_index=True)
    if i >= CONDITION_RETRIES * 10:
        return None
    conditions_ = conditions_.head(NUM_EVAL_SAMPLES)
    experiment_data = experiment.experiment_runner(conditions_, added_noise=0.0)
    X, y = experiment_data[ivs], experiment_data[dvs]
    prediction_pysr = models_pysr[-1].predict(X)
    prediction_linear = models_linear[-1].predict(X)
    prediction_polynomial = models_polynom[-1].predict(X)

    mad_pysr_oos = metric_nan_zero(mean_absolute_error, y, prediction_pysr)
    mad_linear_oos = metric_nan_zero(mean_absolute_error, y, prediction_linear)
    mad_poly_oos = metric_nan_zero(mean_absolute_error, y, prediction_polynomial)

    msd_pysr_oos = metric_nan_zero(mean_squared_error, y, prediction_pysr)
    msd_linear_oos = metric_nan_zero(mean_squared_error, y, prediction_linear)
    msd_poly_oos = metric_nan_zero(mean_squared_error, y, prediction_polynomial)

    mxe_pysr_oos = metric_nan_zero(max_error, y, prediction_pysr)
    mxe_linear_oos = metric_nan_zero(max_error, y, prediction_linear)
    mxe_poly_oos = metric_nan_zero(max_error, y, prediction_polynomial)

    med_pysr_oos = metric_nan_zero(median_absolute_error, y, prediction_pysr)
    med_linear_oos = metric_nan_zero(median_absolute_error, y, prediction_linear)
    med_poly_oos = metric_nan_zero(median_absolute_error, y, prediction_polynomial)

    return Delta(mad_pysr_oos=[mad_pysr_oos], mad_linear_oos=[mad_linear_oos],
                 mad_poly_oos=[mad_poly_oos], msd_pysr_oos=[msd_pysr_oos],
                 msd_linear_oos=[msd_linear_oos], msd_poly_oos=[msd_poly_oos],
                 mxe_pysr_oos=[mxe_pysr_oos], mxe_linear_oos=[mxe_linear_oos],
                 mxe_poly_oos=[mxe_poly_oos], med_linear_oos=[med_linear_oos],
                 med_poly_oos=[med_poly_oos], med_pysr_oos=[med_pysr_oos])


# *** Workflow *** #
def cycle(s):
    # if len(DEAD_VARIABLES)>0:
    #    s_pool = experimentalist_pooler(s, equation=equation)#, dead_variables=DEAD_VARIABLES)
    # else:
    s_pool = experimentalist_pooler(s, equation=equation)
    temperature_now = cos_annealed_t(TEMPERATURE, CYCLES, s.cycle_step)
    if temperature_now > 1e-8:
        s_conditions = experimentalist_sample(s_pool, temperature=temperature_now, weights=WEIGHTS,
                                              num_samples=NUM_SAMPLES)
    else:
        s_conditions = experimentalist_sample(s_pool, temperature=TEMPERATURE, weights=WEIGHTS,
                                              num_samples=NUM_SAMPLES)

    s_run = runner_on_state(s_conditions, added_noise=ADDED_NOISE)
    s_theory = pysr_theorist(s_run)
    s_theory = linear_theorist(s_theory)
    s_theory = polynomial_theorist(s_theory)
    s_best = best_model(s_theory)
    s_oos = evaluation_oos(s_best)

    return s_oos


def main():
    # *** Workflow *** # <-- initialize the state
    # a pysr model with all NR_POOL conditions
    state_full_pool = ExtendedState(variables=variables)
    state_full_pool = experimentalist_pooler(state_full_pool, equation=equation)
    state_full_pool = runner_on_state(state_full_pool, added_noise=ADDED_NOISE)
    state_full_pool = pysr_theorist(state_full_pool)
    state_full_pool = linear_theorist(state_full_pool)
    state_full_pool = polynomial_theorist(state_full_pool)
    state_full_pool = best_model(state_full_pool)
    state_full_pool = evaluation_oos(state_full_pool)
    #
    # # a pysr model with cycles * NUM_SAMPLES immediately (no updates)
    state_full_conditions = ExtendedState(variables=variables)
    state_full_conditions = experimentalist_pooler(state_full_conditions, equation=equation)
    state_full_conditions = experimentalist_sample(state_full_conditions, temperature=TEMPERATURE,
                                                   weights=WEIGHTS,
                                                   num_samples=NUM_SAMPLES * CYCLES)
    state_full_conditions = runner_on_state(state_full_conditions, added_noise=ADDED_NOISE)
    state_full_conditions = pysr_theorist(state_full_conditions)
    state_full_conditions = linear_theorist(state_full_conditions)
    state_full_conditions = polynomial_theorist(state_full_conditions)
    state_full_conditions = best_model(state_full_conditions)
    state_full_conditions = evaluation_oos(state_full_conditions)

    # the models
    state = ExtendedState(variables=variables)
    for _ in range(CYCLES):
        state = cycle(state)
        if debug:
            print('memory of state:')
            print(asizeof.asizeof(state))
        df = [NUM_SAMPLES, POOL_RANGE, NUM_EVAL_SAMPLES, MAX_NUM_VARIABLES, NUM_POOL_SAMPLES, NITER,
              CONSTANT_SIZE, CYCLES, TEMPERATURE, ANNEALING, falsification_weight, novelty_weight,
              disagreement_weight, TREE_DEPTH, N_DEAD_VARS, ADDED_NOISE, state.models_pysr,
              state.models_linear, state.models_polynom, state.rejections, state.mad,
              state.mad_pysr_oos, state.mad_linear_oos, state.mad_poly_oos, state.msd_pysr_oos,
              state.msd_linear_oos, state.msd_poly_oos, state.mxe_pysr_oos, state.mxe_linear_oos,
              state.mxe_poly_oos, state.med_pysr_oos, state.med_linear_oos,
              state.med_poly_oos, state.mad_pysr_is, state.mad_linear_is, state.mad_poly_is,
              state.msd_pysr_is, state.msd_linear_is, state.msd_poly_is, state.mxe_pysr_is,
              state.mxe_linear_is, state.mxe_poly_is, state.med_pysr_is,
              state.med_linear_is, state.med_poly_is, state.experiment_data, state.conditions,
              state.models, equation_raw, equation, state,
              state_full_pool, state_full_pool.models_pysr, state_full_pool.models_linear,
              state_full_pool.models_polynom, state_full_pool.rejections, state_full_pool.mad,
              state_full_pool.mad_pysr_oos, state_full_pool.mad_linear_oos,
              state_full_pool.mad_poly_oos, state_full_pool.msd_pysr_oos,
              state_full_pool.msd_linear_oos, state_full_pool.msd_poly_oos,
              state_full_pool.mxe_pysr_oos, state.mxe_linear_oos,
              state_full_pool.mxe_poly_oos, state_full_pool.med_pysr_oos,
              state_full_pool.med_linear_oos,
              state_full_pool.med_poly_oos, state_full_pool.mad_pysr_is,
              state_full_pool.mad_linear_is, state_full_pool.mad_poly_is,
              state_full_pool.msd_pysr_is, state_full_pool.msd_linear_is,
              state_full_pool.msd_poly_is, state_full_pool.mxe_pysr_is,
              state_full_pool.mxe_linear_is, state_full_pool.mxe_poly_is,
              state_full_pool.med_pysr_is,
              state_full_conditions, state_full_conditions.models_pysr,
              state_full_conditions.models_linear, state_full_conditions.models_polynom,
              state_full_conditions.rejections, state_full_conditions.mad,
              state_full_conditions.mad_pysr_oos, state_full_conditions.mad_linear_oos,
              state_full_conditions.mad_poly_oos, state_full_conditions.msd_pysr_oos,
              state_full_conditions.msd_linear_oos, state_full_conditions.msd_poly_oos,
              state_full_conditions.mxe_pysr_oos, state.mxe_linear_oos,
              state_full_conditions.mxe_poly_oos, state_full_conditions.med_pysr_oos,
              state_full_conditions.med_linear_oos,
              state_full_conditions.med_poly_oos, state_full_conditions.mad_pysr_is,
              state_full_conditions.mad_linear_is, state_full_conditions.mad_poly_is,
              state_full_conditions.msd_pysr_is, state_full_conditions.msd_linear_is,
              state_full_conditions.msd_poly_is, state_full_conditions.mxe_pysr_is,
              state_full_conditions.mxe_linear_is, state_full_conditions.mxe_poly_is,
              state_full_conditions.med_pysr_is,
              ]

        with open(PATH.format(sim_index), "wb") as fp:  # Pickling
            pickle.dump(df, fp, protocol=pickle.HIGHEST_PROTOCOL)
        del df


if __name__ == '__main__':
    main()
