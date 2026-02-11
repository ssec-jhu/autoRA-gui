---
name: autora
description: Study AutoRA theorist, experimentalist, and experiment-runner repositories to understand their architecture, parameters, and integration patterns
disable-model-invocation: true
allowed-tools: WebFetch, WebSearch, Read, Grep
---

# AutoRA Research Skill

Study the AutoRA framework and repositories to understand their implementation and how to integrate them into the autoRA-gui project.

## AutoRA Overview

**Documentation**: https://autoresearch.github.io/autora/

AutoRA (Automated Research Assistant) is an open-source framework that automates empirical research phases: model discovery, experimental design, data collection, and documentation. Originally developed for behavioral and brain sciences, it's adaptable to materials science, physics, and other empirical disciplines.

### Core Architecture: Autonomous Empirical Research

AutoRA implements a two-agent closed-loop system:
1. **Theorist Agent**: Constructs computational models linking experimental conditions to outcomes
2. **Experimentalist Agent**: Designs follow-up experiments to refine and validate models

### The State Mechanism

Every procedure accepts a State object and returns a State object. The `StandardState` contains four fields:
- **variables**: Definitions of experimental variables and parameters
- **conditions**: Experimental conditions or configurations
- **experiment_data**: Collected experimental results and observations
- **models**: Fitted theoretical models or learned representations

```python
from autora.state import StandardState
state = StandardState(variables=variables)
```

### Functional Workflow

Components chain together operating on shared state:
1. **Experimentalist** → generates novel experiment conditions
2. **Experiment Runner** → executes experiments, updates state with results
3. **Theorist** → analyzes data, refines theoretical models

Supports fixed iterations, stopping criteria, or conditional cycling.

### Package Structure

Parent-child package model: the parent `autora` package depends on `autora-core` and `autora-synthetic`, plus optional module dependencies.

## Theorist Repositories

### 1. DARTS (Differentiable Architecture Search)
- **Repository**: https://github.com/AutoResearch/autora-theorist-darts
- **Purpose**: Automated model discovery through neural architecture optimization
- **Main class**: `DARTSRegressor` from `autora.theorist.darts`
- **Install**: `pip install -U "autora[theorist-darts]"`

### 2. BMS (Bayesian Machine Scientist)
- **Repository**: https://github.com/AutoResearch/autora-theorist-bms
- **Purpose**: Equation discovery using Bayesian methods for symbolic regression
- **Main class**: `BMSRegressor` from `autora.theorist.bms`
- **Install**: `pip install -U "autora[theorist-bms]"`

### 3. BSR (Bayesian Symbolic Regression)
- **Repository**: https://github.com/AutoResearch/autora-theorist-bsr
- **Purpose**: Discover equations that fit data using probabilistic symbolic regression
- **Main class**: `BSRRegressor` from `autora.theorist.bsr`
- **Install**: `pip install -U "autora[theorist-bsr]"`

## Experimentalist Repositories

### 1. Falsification
- **Repository**: https://github.com/AutoResearch/autora-experimentalist-falsification
- **Purpose**: Identifies conditions where candidate model is predicted to perform worst
- **Main function**: `falsification_pool` from `autora.experimentalist.falsification`
- **Install**: `pip install -U "autora[experimentalist-falsification]"`

### 2. Novelty
- **Repository**: https://github.com/AutoResearch/autora-experimentalist-novelty
- **Purpose**: Samples conditions based on maximum distance from existing data
- **Main functions**: `novelty_sampler`, `novelty_score_sampler` from `autora.experimentalist.novelty`
- **Install**: `pip install -U "autora[experimentalist-novelty]"`

### 3. Uncertainty
- **Repository**: https://github.com/AutoResearch/autora-experimentalist-uncertainty
- **Purpose**: Selects conditions where model is most uncertain (least confident, margin, entropy)
- **Main function**: `uncertainty_sample` from `autora.experimentalist.uncertainty`
- **Install**: `pip install -U "autora[experimentalist-uncertainty]"`

### 4. Model Disagreement
- **Repository**: https://github.com/AutoResearch/autora-experimentalist-model-disagreement
- **Purpose**: Identifies conditions where two models make divergent predictions
- **Main function**: `model_disagreement_sample` from `autora.experimentalist.model_disagreement`
- **Install**: `pip install -U "autora[experimentalist-model-disagreement]"`

### 5. LHS (Latin Hypercube Sampling)
- **Repository**: https://github.com/AutoResearch/autora-experimentalist-lhs
- **Purpose**: Generates evenly-distributed samples accounting for existing data
- **Main methods**: `sample`, `pool` from `autora.experimentalist.lhs`
- **Install**: `pip install -U "autora[experimentalist-lhs]"`

### 6. Prediction Filter
- **Repository**: https://github.com/AutoResearch/autora-experimentalist-prediction-filter
- **Purpose**: Filters conditions based on model predictions (removes invalid/null predictions)
- **Install**: `pip install -U "autora[experimentalist-prediction-filter]"`

### 7. Bandit Random
- **Repository**: https://github.com/AutoResearch/autora-experimentalist-bandit-random
- **Purpose**: Multi-armed bandit strategy with random sampling for exploration
- **Install**: `pip install -U "autora[experimentalist-bandit-random]"`

### 8. Inequality
- **Repository**: https://github.com/AutoResearch/autora-experimentalist-inequality
- **Purpose**: Sampling based on inequality/variance measures
- **Main function**: `summed_inequality_sample` from `autora.experimentalist.inequality`
- **Install**: `pip install -U "autora[experimentalist-inequality]"`

### 9. Nearest Value
- **Repository**: https://github.com/AutoResearch/autora-experimentalist-nearest-value
- **Purpose**: Returns nearest values between input samples and allowed values
- **Main function**: `nearest_values_sampler` from `autora.experimentalist.nearest_value`
- **Install**: `pip install -U "autora[experimentalist-nearest-value]"`

### 10. Leverage
- **Repository**: https://github.com/AutoResearch/autora-experimentalist-leverage
- **Purpose**: Identifies influential datapoints via leave-one-out refitting
- **Main function**: `leverage_sample` from `autora.experimentalist.leverage`
- **Note**: Computationally expensive - scales with data size and model count
- **Install**: `pip install -U "autora[experimentalist-leverage]"`

## Experiment Runner Repositories

### 1. Firebase Experimentation Manager
- **Repository**: https://github.com/AutoResearch/autora-experiment-runner-experimentation-manager-firebase
- **Purpose**: Manages communication between AutoRA and Firebase-hosted experiments
- **Install**: `pip install "autora[experiment-runner-experimentation-manager-firebase]"`

### 2. Prolific Recruitment Manager
- **Repository**: https://github.com/AutoResearch/autora-experiment-runner-recruitment-manager-prolific
- **Purpose**: Recruit participants via Prolific for AutoRA experiments
- **Main function**: `setup_study` from `autora.experiment_runner.recruitment_manager.prolific`
- **Install**: `pip install "autora[experiment-runner-recruitment-manager-prolific]"`

### 3. Firebase Prolific Runner
- **Repository**: https://github.com/AutoResearch/autora-experiment-runner-firebase-prolific
- **Purpose**: Run experiments with Firebase and Prolific, automates study creation
- **Note**: Early alpha version - use with caution
- **Install**: `pip install "autora[experiment-runner-firebase-prolific]"`

## Code Style (from AutoRA contribution guidelines)

- Snake case for variables/modules (`example_name`)
- Camel case for classes (`ExampleClass`)
- Comprehensive docstrings for public elements
- PEP 8 style guide compliance

## Key Documentation Links

- Main docs: https://autoresearch.github.io/autora/
- Tutorials: https://autoresearch.github.io/autora/tutorials/
- State Mechanism: https://autoresearch.github.io/autora/core/docs/The%20State%20Mechanism/
- Contribution guide: https://autoresearch.github.io/autora/contribute/
- Forum: https://github.com/orgs/AutoResearch/discussions

## Research Focus

When invoked, study these repositories for:

1. **Parameters**: What configuration options does each class/function accept?
2. **Input/Output Types**: What data formats do they expect and produce?
3. **State Integration**: How do components read from and write to StandardState?
4. **GUI Considerations**: What parameters should be exposed in the autoRA-gui interface?

## Output

Provide findings relevant to autoRA-gui integration:
- Parameter definitions for each component (name, type, defaults, valid values)
- Input/output data type specifications
- Suggested Protocol model definitions matching the data_model.py structure
- Any implementation recommendations

$ARGUMENTS
