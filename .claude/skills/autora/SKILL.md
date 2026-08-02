---
name: autora
description: Study AutoRA theorist, experimentalist, and experiment-runner components to understand their architecture, parameters, and integration into autoRA-gui
disable-model-invocation: true
---

# AutoRA Research Skill

Study the AutoRA framework and its components to understand their implementation and how to integrate them into the autoRA-gui project.

## Source of Truth: the local component catalog

**The authoritative catalog lives in `autora_gui/JSON/components/`** — one JSON file per component, grouped into `theorists/`, `experimentalists/`, and `experiment_runners/`. Each file is a `Protocol` record (see `autora_gui/data_model.py`) that pins the exact Python name, import path, install version, and full parameter schema the GUI exposes.

**Always read the JSON first.** Web docs (below) explain *concepts*; the JSON files are the ground truth for names, versions, defaults, and valid values. When they disagree, the JSON wins.

**Documentation (concepts only)**: https://autoresearch.github.io/autora/

## Component JSON schema

Each file conforms to the `Protocol` model. Top-level fields:

| Field | Meaning |
|-------|---------|
| `uuid` | Stable identifier for the protocol |
| `protocolType` | `theorist` \| `experimentalist` \| `experiment_runner` |
| `name` | Human-readable label shown in the GUI |
| `description` | One-line summary |
| `githubCommit` | Permalink to the pinned source implementation |
| `pythonName` | Class/function to call (e.g. `DARTSRegressor`, `sample`) |
| `importPath` | Module to import `pythonName` from |
| `pipInstall` | Exact pinned dependency (e.g. `autora-theorist-darts==1.1.0`) |
| `parameters` | `dict[str, list[VariableType]]` — keyed by callable name |
| `inputDataType` | Expected input variable(s) |
| `outputDataType` | Produced output variable(s) |

**`parameters` keying**: the dict key is the name of the callable the parameters belong to, not a fixed literal:
- Theorists key on `__init__` (constructor args); some add `fit` (e.g. `bms_regressor`).
- Experimentalists key on their function name (e.g. `sample`, `pool`, `grid_pool`, `novelty_sampler`).
- Experiment runners key on their factory (e.g. `firebase_runner`, `q_learning`); synthetic runners add `run` for the runner callable.

**Each parameter** (a `PrimitiveVariableType`) has:
- `name`, `description`
- `datatype`: `real` \| `integer` \| `boolean` \| `string` \| `categorical` \| `any`
- `cardinality`: `{minOccurs, maxOccurs, unique}` — `maxOccurs: -1` means unbounded (a list); `>1` means a multi-select
- `validValues`: allowed options for `categorical`, else `null`
- `default`: default value (`null` if required with no default)

`inputDataType`/`outputDataType` are either a single `PrimitiveVariableType` (e.g. DARTS `X` → `y`) or a `{ "variables": [...] }` group (e.g. Firebase `conditions` → `observations`).

## Component catalog

Names/paths/versions below are copied from the JSON; treat the JSON as canonical if this drifts.

### Theorists (`theorists/`)

| File | pythonName | importPath | pipInstall |
|------|-----------|-----------|-----------|
| `bms_regressor` | `BMSRegressor` | `autora.theorist.bms.regressor` | `autora-theorist-bms==1.0.6` |
| `bsr_regressor` | `BSRRegressor` | `autora.theorist.bsr.regressor` | `autora-theorist-bsr==1.0.0` |
| `darts_regressor` | `DARTSRegressor` | `autora.theorist.darts.regressor` | `autora-theorist-darts==1.1.0` |

- **BMS** — Bayesian Machine Scientist; symbolic equation discovery via MCMC with informed priors.
- **BSR** — Bayesian Symbolic Regression; builds expressions from basic functions via MCMC.
- **DARTS** — Differentiable Architecture Search; composition of functions/coefficients minimizing a loss. Rich `__init__` (batch size, graph nodes, `output_type`, `darts_type` original/fair, learning-rate schedules, `primitives` multi-select, sampling strategy).

### Experimentalists (`experimentalists/`)

Split into **poolers** (generate a pool of conditions) and **samplers** (select from a pool). A given repo may provide both.

| File | pythonName | importPath | pipInstall |
|------|-----------|-----------|-----------|
| `random_pooler` | `pool` | `autora.experimentalist.random` | `autora-core==5.0.3` |
| `random_sampler` | `sample` | `autora.experimentalist.random` | `autora-core==5.0.3` |
| `grid_pooler` | `pool` | `autora.experimentalist.grid` | `autora-core==5.0.3` |
| `latin_hypercube_pooler` | `pool` | `autora.experimentalist.lhs` | `autora==4.2.0` |
| `latin_hypercube_sampler` | `sample` | `autora.experimentalist.lhs` | `autora==4.2.0` |
| `bandit_random_pooler` | `pool` | `autora.experimentalist.bandit_random` | `autora-experimentalist-bandit-random==1.0.0` |
| `falsification_pooler` | `pool` | `autora.experimentalist.falsification` | `autora-experimentalist-falsification==2.2.0` |
| `falsification_sampler` | `sample` | `autora.experimentalist.falsification` | `autora-experimentalist-falsification==2.2.0` |
| `novelty_sampler` | `sample` | `autora.experimentalist.novelty` | `autora-experimentalist-novelty==2.2.0` |
| `novelty_score_sampler` | `score_sample` | `autora.experimentalist.novelty` | `autora-experimentalist-novelty==2.2.0` |
| `uncertainty_sampler` | `sample` | `autora.experimentalist.uncertainty` | `autora-experimentalist-uncertainty==2.1.0` |
| `model_disagreement_sampler` | `sample` | `autora.experimentalist.model_disagreement` | `autora-experimentalist-model-disagreement==2.2.0` |
| `leverage_sampler` | `sample` | `autora.experimentalist.leverage` | `autora-experimentalist-leverage==1.10` |
| `nearest_values_sampler` | `sample` | `autora.experimentalist.nearest_value` | `autora-experimentalist-nearest-value==2.2.0` |
| `summed_inequality_sampler` | `sample` | `autora.experimentalist.inequality` | `autora-experimentalist-inequality==2.2.0` |
| `prediction_filter` | `filter` | `autora.experimentalist.prediction_filter` | `autora-experimentalist-prediction-filter==1.1.0` |
| `mixture_sampler` | `sample` | `autora.experimentalist.mixture` | `mixture-experimentalist==1.0.0a7` |

Behavior notes: **falsification** targets conditions likely to break the current model; **novelty** maximizes distance from existing data (`score_sample` also returns scores); **uncertainty** selects highest-uncertainty conditions (active learning); **model_disagreement** picks where models diverge most; **leverage** does leave-one-out refitting (computationally expensive); **nearest_value** snaps to allowed values; **inequality** samples by inequality vs. a reference pool; **prediction_filter** keeps conditions whose predicted outcome passes a filter; **mixture** aggregates multiple rankers with temperature-scaled weights; **grid**/**random**/**lhs** are the space-coverage poolers.

### Experiment runners (`experiment_runners/`)

Two families: **human-data runners** (Firebase/Prolific) and **synthetic runners** (`autora-synthetic`, ground-truth simulators for testing).

| File | pythonName | importPath | pipInstall |
|------|-----------|-----------|-----------|
| `firebase_runner` | `firebase_runner` | `autora.experiment_runner.firebase_prolific` | `autora-experiment-runner-firebase-prolific==1.0.1` |
| `firebase_prolific_runner` | `firebase_prolific_runner` | `autora.experiment_runner.firebase_prolific` | `autora-experiment-runner-firebase-prolific==1.0.1` |
| `synth_abstr_equation_experiment` | `equation_experiment` | `autora.experiment_runner.synthetic.abstract.equation` | `autora-synthetic==2.2.0` |
| `synth_abstr_lmm_experiment` | `lmm_experiment` | `autora.experiment_runner.synthetic.abstract.lmm` | `autora-synthetic==2.2.0` |
| `synth_econ_expected_value_theory` | `expected_value_theory` | `autora.experiment_runner.synthetic.economics.expected_value_theory` | `autora-synthetic==2.2.0` |
| `synth_econ_prospect_theory` | `prospect_theory` | `autora.experiment_runner.synthetic.economics.prospect_theory` | `autora-synthetic==2.2.0` |
| `synth_neuro_task_switching` | `task_switching` | `autora.experiment_runner.synthetic.neuroscience.task_switching` | `autora-synthetic==2.2.0` |
| `synth_psychol_exp_learning` | `exp_learning` | `autora.experiment_runner.synthetic.psychology.exp_learning` | `autora-synthetic==2.2.0` |
| `synth_psychol_luce_choice_ratio` | `luce_choice_ratio` | `autora.experiment_runner.synthetic.psychology.luce_choice_ratio` | `autora-synthetic==2.2.0` |
| `synth_psychol_q_learning` | `q_learning` | `autora.experiment_runner.synthetic.psychology.q_learning` | `autora-synthetic==2.2.0` |
| `synth_psychop_stevens_power_law` | `stevens_power_law` | `autora.experiment_runner.synthetic.psychophysics.stevens_power_law` | `autora-synthetic==2.2.0` |
| `synth_psychop_weber_fechner_law` | `weber_fechner_law` | `autora.experiment_runner.synthetic.psychophysics.weber_fechner_law` | `autora-synthetic==2.2.0` |

- **Firebase / Firebase-Prolific** — host web experiments on Firebase and collect Firestore responses; the Prolific variant also handles participant recruitment. Input `conditions` → output `observations`.
- **Synthetic runners** — SymPy-equation, linear-mixed-model, and domain models (economics, neuroscience, psychology, psychophysics) that produce noisy ground-truth data for testing pipelines without human subjects.

## Core AutoRA concepts

AutoRA (Automated Research Assistant) automates empirical research: model discovery, experimental design, data collection, documentation.

**Closed loop**: Experimentalist → generates conditions → Experiment Runner → executes, collects data → Theorist → fits/refines models → repeat. Supports fixed iterations, stopping criteria, or conditional cycling (see `Filter` in `data_model.py`).

**State mechanism**: every procedure takes and returns a `StandardState` with four fields:
- `variables` — experimental variable/parameter definitions
- `conditions` — conditions to run
- `experiment_data` — collected observations
- `models` — fitted models

```python
from autora.state import StandardState

state = StandardState(variables=variables)
```

## Code style (AutoRA contribution guidelines)

- `snake_case` variables/modules, `CamelCase` classes
- Docstrings on public elements, PEP 8

## Doc links (concepts)

- Main docs: https://autoresearch.github.io/autora/
- State mechanism: https://autoresearch.github.io/autora/core/docs/The%20State%20Mechanism/
- Contribution guide: https://autoresearch.github.io/autora/contribute/
- Forum: https://github.com/orgs/AutoResearch/discussions

## When invoked

1. **Start from the JSON** in `autora_gui/JSON/components/` for the component in question — it is the exact contract the GUI uses.
2. Cross-check the pinned source via `githubCommit` when parameter semantics are unclear.
3. Consult web docs only for conceptual background.

Report findings relevant to autoRA-gui integration:
- Parameter definitions (name, datatype, cardinality, validValues, default) — quote from the JSON
- Input/output data type specifications
- Whether a new/edited JSON conforms to the `Protocol` model in `data_model.py` (validate against `autora_gui/JSON/schemas/protocol_model.json`)
- Implementation recommendations

$ARGUMENTS
