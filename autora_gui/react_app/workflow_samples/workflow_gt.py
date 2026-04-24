"""
AutoRA workflow to collect data for the unified control paradigm

No theorist is used here, AutoRA is used as a convenient method to
collect large amounts of data via prolific.

Goal: Collect participant data for random conditions in a
        vast experimental design space

Non-Standard State Components:
    - The state has a raw-data field for preprocessing before sending it to a theorist

Non-Standard Workflow Components:
    - Load and save state to resume experiments
"""

from dataclasses import dataclass, field
from typing import Optional, List
import signal
import pathlib
import math

from autora.state import on_state, Delta, estimator_on_state, StandardState
from autora.variable import VariableCollection, Variable
from autora.experimentalist.random import pool, sample
from autora.experiment_runner.synthetic.economics.expected_value_theory import expected_value_theory
from autora.theorist.bms.regressor import BMSRegressor

import pandas as pd
import numpy as np


@on_state()
def pool_on_state(variables: VariableCollection) -> Delta:
    return Delta(conditions=pool(variables, 10_000)) # <- add parameters here

@on_state()
def sample_on_state(conditions: pd.DataFrame, num_samples: int = 1) -> Delta:
    return Delta(conditions=sample(conditions=conditions, num_samples=num_samples)) # <- add parameters here

@on_state()
def runner_on_state(conditions: pd.DataFrame) -> Delta:
    runner = expected_value_theory() # <- add parameters here
    assert runner.run is not None
    return Delta(experiment_data=runner.run(conditions=conditions))


theorist_on_state = estimator_on_state(BMSRegressor()) # <- add parameters here

def main():
    runner = expected_value_theory()
    assert runner.variables is not None # <- here the variables are created and governed by the runner. I think we should make the variables (input/output) "read-only"
    variables = runner.variables
    state = StandardState(variables=variables)

    for i in range(10): # <- filter for max cycles here
        print(f'Cycle {i}')
        print('creating pool')
        state = pool_on_state(state)
        print('sampling')
        state = sample_on_state(state, num_samples=10)
        print('running')
        state = runner_on_state(state)
        print('analysing data')
        state = theorist_on_state(state)
        
if __name__ == '__main__':
    main()