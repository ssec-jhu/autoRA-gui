"""
AutoRA workflow to simulate a bandit task with a Q-Learning agent.

Goal: Validate experimental sampling strategy.

Non-Standard State Components:
    - The state has two models for two different theorists that are used in the
        model disagreement sampler

Non-Standard Workflow Components:
    - Switch experimentalist based on weather there are models or not (first experimentalist is random)
    - Break the loop if one theorist reaches a threshold MSE
"""

import random
from dataclasses import dataclass, field
from typing import Optional, List

import pandas as pd

# General AutoRA
from autora.variable import VariableCollection, Variable
from autora.state import State, on_state, Delta

# Experimentalists
from autora.experimentalist.bandit_random import bandit_random_pool
from autora.experimentalist.model_disagreement import model_disagreement_sample

# Experiment Runner
from autora.experiment_runner.synthetic.psychology.q_learning import q_learning

# Theorist
from autora.theorist.rnn_sindy_rl import RNNSindy

import numpy as np

from sklearn.base import BaseEstimator
from src.parse_equation import parse
from src.llm.llm import generate
import torch

TRIALS_PER_PARTICIPANTS = 100
SAMPLES_PER_CYCLE = 10
PARTICIPANTS_PER_CYCLE = 40
CYCLES = 4
INITIAL_REWARD_PROBABILITY_RANGE = [.2, .8]
SIGMA_RANGE = [.2, .2]
MSE_THRESHOLD = 0.1

EPOCHS = 100

seed = 11
np.random.seed(seed)
torch.manual_seed(seed)

# *** Set up variables *** #
# independent variable is "reward-trajectory": A 2 x n_trials Vector with entries between 0 and 1
# dependent variable is "choice-trajectory": A 2 x n_trials Vector with boolean entries (one hot encoded)
variables = VariableCollection(
    independent_variables=[Variable(name="reward-trajectory")],
    dependent_variables=[Variable(name="choice-trajectory")]
)


# *** State *** #
# Here, we use a non-standard State to be able to use a multiple models
# !!! This is not standard !!! #
@dataclass(frozen=True)
class RnnState(State):
    variables: Optional[VariableCollection] = field(
        default=None, metadata={"delta": "replace"}
    )
    conditions: Optional[pd.DataFrame] = field(
        default=None, metadata={"delta": "replace", "converter": pd.DataFrame}
    )
    experiment_data: Optional[pd.DataFrame] = field(
        default=None, metadata={"delta": "extend", "converter": pd.DataFrame}
    )
    models_rnn_linear: List[BaseEstimator] = field(  # <-- this field is not standard
        default_factory=list,
        metadata={"delta": "extend"},
    )
    models_rnn_poly: List[BaseEstimator] = field(  # <-- this field is not standard
        default_factory=list,
        metadata={"delta": "extend"},
    )


state = RnnState(variables=variables)


# *** Components *** #
# ** Experimentalists ** #
# * Random pool * #
@on_state()
def pool_on_state(num_samples, n_trials=TRIALS_PER_PARTICIPANTS):
    """
    This is creates `num_samples` randomized reward trajectories of length `n_trials`
    """
    sigma = np.random.uniform(SIGMA_RANGE[0], SIGMA_RANGE[1])
    _trajectory_array = bandit_random_pool(
        num_rewards=2,
        sequence_length=n_trials,
        initial_probabilities=[INITIAL_REWARD_PROBABILITY_RANGE, INITIAL_REWARD_PROBABILITY_RANGE],
        sigmas=[sigma, sigma],
        num_samples=num_samples
    )
    trajectory_array = [_trajectory_array[0] for _ in range(PARTICIPANTS_PER_CYCLE)]
    trajectory_df = pd.DataFrame({'reward-trajectory': trajectory_array})
    return Delta(conditions=trajectory_df)


# * Model Disagreement Sampler * #
@on_state()
def model_disagreement_on_state(
        conditions, models_rnn_linear, models_rnn_poly, num_samples): # <-- signature has to match state fields
    x = conditions['reward-trajectory']
    conditions = model_disagreement_sample(
        conditions=x,
        models=[models_rnn_linear[-1], models_rnn_poly[-1]],
        num_samples=num_samples,
        auto_transform=False
    )
    _trajectory_array = conditions['reward-trajectory'].tolist()
    trajectory_array = [_trajectory_array[0] for _ in range(PARTICIPANTS_PER_CYCLE)]
    trajectory_df = pd.DataFrame({'reward-trajectory': trajectory_array})
    return Delta(conditions=trajectory_df)


# ** Runner ** #
runner = q_learning()


@on_state()
def runner_on_state(conditions):
    choices, choice_probabilities = runner.run(conditions, return_choice_probabilities=True)
    experiment_data = pd.DataFrame({
        'reward-trajectory': conditions['reward-trajectory'].tolist(),
        'choice-trajectory': choices,
        'choice-probability-trajectory': choice_probabilities
    })
    return Delta(experiment_data=experiment_data)


# ** Theorists ** #
theorist_rnn_linear = RNNSindy(2, epochs=EPOCHS, polynomial_degree=1)
theorist_rnn_poly = RNNSindy(2, epochs=EPOCHS, polynomial_degree=2)


@on_state()
def theorist_linear_on_state(experiment_data):
    x = experiment_data[['reward-trajectory']]
    y = experiment_data[['choice-trajectory']]
    return Delta(models_rnn_linear=[theorist_a.fit(x, y)]) # <-- signature has to match state field


@on_state()
def theorist_poly_on_state(experiment_data):
    x = np.stack(experiment_data['reward-trajectory'].tolist())
    y = np.stack(experiment_data['choice-trajectory'].tolist())
    return Delta(models_rnn_poly=[theorist_b.fit(x, y)]) # <-- signature has to match state field


# ** Workflow ** #
for c in range(1, CYCLES + 1):

    # If no models (first cycle), run random else model disagreement sampler
    if len(state.models_rnn_linear) > 0:
        state = pool_on_state(state, num_samples=SAMPLES_PER_CYCLE)
        state = model_disagreement_on_state(state, num_samples=SAMPLES_PER_CYCLE)
    else:
        state = pool_on_state(state, num_samples=SAMPLES_PER_CYCLE)

    # FOR VISUALISATION: Get reward 1 and reward 2 from conditions
    con = state.conditions['reward-trajectory'].tolist()[0]

    state = runner_on_state(state)


    # Get model accuracy
    state = theorist_linear_on_state(state)
    state = theorist_poly_on_state(state)

    model_rnn_linear = state.models_rnn_linear[-1]
    model_rnn_poly = state.models_rnn_poly[-1]

    exp_data = state.experiment_data.tail(PARTICIPANTS_PER_CYCLE)
    x = np.array(exp_data['reward-trajectory'].tolist())
    y = np.array(exp_data['choice-trajectory'].tolist())

    # Note, we add the
    prediction_rnn_linear = np.array(model_rnn_linear.predict(x, observations=y))
    prediction_rnn_poly = np.array(t_b.predict(x, observations=y))

    mse_rnn_linear = np.mean((x - prediction_rnn_linear) ** 2)
    mse_rnn_poly = np.mean((x - prediction_rnn_poly) ** 2)

    # Break if
    if mse_rnn_linear < MSE_THRESHOLD or mse_rnn_poly < MSE_THRESHOLD:
        break

