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

from autora.state import State, on_state, Delta
from autora.serializer import load_state, dump_state
from autora.variable import VariableCollection, Variable
from autora.experimentalist import random
from autora.experiment_runner.firebase_prolific import firebase_prolific_runner

import pandas as pd
import numpy as np
from sklearn.base import BaseEstimator

from sweetpea import Level, Factor, MinimumTrials, MultiCrossBlock, synthesize_trials, CMSGen, \
    Transition, WithinTrial, DerivedLevel, experiments_to_dicts
from data.download_data import get_observations

TRIALS_PER_PARTICIPANT = 40
PARTICIPANTS_PER_CYCLE = 20
SWEETPEA_TIMEOUT = 2
MIN_REACTION_TIME = 500
MIN_REACTION_PERCENTAGE = .5
NR_CYCLES = 10

FIREBASE_CREDENTIALS = {
    "type": '...',
    "project_id": '...',
    "private_key_id": '...',
    "private_key": '...',
    "client_email": '...',
    "client_id": '...',
    "auth_uri": '...',
    "token_uri": '...',
    "auth_provider_x509_cert_url": '...',
    "client_x509_cert_url": '...',
    "universe_domain": '...'
}


# region Helper Functions
def _max_alignment(freq_1, freq_2):
    return min(freq_1, freq_2) + min(100 - freq_1, 100 - freq_2)


def _min_alignment(freq_1, freq_2):
    return 100 - (min(freq_1, 100 - freq_2) + min(100 - freq_1, freq_2))


def map_ratio_to_weight(ratio):
    res = {
        0: (0, 1),
        25: (1, 3),
        50: (1, 1),
        75: (3, 1),
        100: (1, 0)
    }
    return res[ratio]


# RUN WITH TIMEOUT
def timeout_handler(signum, frame):
    raise TimeoutError("Function execution exceeded the allowed time limit.")


def set_timeout(seconds):
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(seconds)


def run_with_timeout(block, n, sampling_strategy, timeout_seconds):
    try:
        set_timeout(timeout_seconds)
        result = synthesize_trials(block, n, sampling_strategy)
        signal.alarm(0)  # Disable the alarm
        return result
    except TimeoutError as e:
        raise Exception("sweetPea took too long")


def calculate_overlap(start1, duration1, start2, duration2):
    """
    Find overlap between two intervals
    """
    end1 = start1 + duration1
    end2 = start2 + duration2

    # Find the maximum of the start times
    overlap_start = max(start1, start2)

    # Find the minimum of the end times
    overlap_end = min(end1, end2)

    # Calculate overlap duration
    overlap_duration = max(0, overlap_end - overlap_start)

    if overlap_duration > 0:
        return (overlap_start, overlap_duration)
    else:
        return None  # No overlap


def check_sequence(sequence, n, min_timing=400):
    reactions = 0

    for s in sequence:
        task_1 = s['task_1']
        task_2 = s['task_2']
        start_1 = s['start_1']
        dur_1 = s['dur_1']
        start_2 = s['start_2']
        dur_2 = s['dur_2']
        start_mov = s['start_mov_1']
        dur_mov = s['dur_mov_1']
        start_or = s['start_or_1']
        dur_or = s['dur_or_1']

        cue_1_mov_overlap = calculate_overlap(start_1, dur_1, start_mov, dur_mov)
        cue_1_or_overlap = calculate_overlap(start_1, dur_1, start_or, dur_or)
        cue_2_mov_overlap = calculate_overlap(start_2, dur_2, start_mov, dur_mov)
        cue_2_or_overlap = calculate_overlap(start_2, dur_2, start_or, dur_or)

        if task_1 == 'mov':
            if cue_1_mov_overlap is not None:
                if cue_1_mov_overlap[1] < min_timing and cue_1_mov_overlap[1] > 0:
                    print('participant has too little time')
                    return False
                elif cue_1_mov_overlap[1] > 0:
                    reactions += 1
        if task_1 == 'or':
            if cue_1_or_overlap is not None:
                if cue_1_or_overlap[1] < min_timing and cue_1_or_overlap[1] > 0:
                    print('participant has too little time')
                    return False
                elif cue_1_or_overlap[1] > 0:
                    reactions += 1

        if task_2 == 'mov':
            if cue_2_mov_overlap is not None:
                if cue_2_mov_overlap[1] < min_timing and cue_2_mov_overlap[1] > 0:
                    print('participant has too little time')
                    return False
                elif cue_2_mov_overlap[1] > 0:
                    reactions += 1
        if task_2 == 'or':
            if cue_2_or_overlap is not None:
                if cue_2_or_overlap[1] < min_timing and cue_2_or_overlap[1] > 0:
                    print('participant has too little time')
                    return False
                elif cue_2_or_overlap[1] > 0:
                    reactions += 1

    if reactions < 2 * n * MIN_REACTION_PERCENTAGE:
        print('not enough reactions in sequence')
        return False
    return True


def filter_on_alignment(row):
    min_alignment = _min_alignment(row['task_1_mov_frequency'], row['task_2_mov_frequency'])
    max_alignment = _max_alignment(row['task_1_mov_frequency'], row['task_2_mov_frequency'])
    return min_alignment <= row['task_equality_frequency'] <= max_alignment


def filter_on_switch_task_1(row):
    return ((row['task_1_mov_frequency'] == 0 and row['task_1_switch_frequency'] == 0) or
            (row['task_1_mov_frequency'] == 100 and row['task_1_switch_frequency'] == 0) or
            (row['task_1_switch_frequency'] == 100 and row['task_1_mov_frequency'] == 50) or
            (row['task_1_switch_frequency'] != 100 and row['task_1_switch_frequency'] != 0 and
             row['task_1_mov_frequency'] != 0 and row['task_1_mov_frequency'] != 100))


def filter_on_switch_task_2(row):
    return ((row['task_2_mov_frequency'] == 0 and row['task_2_switch_frequency'] == 0) or
            (row['task_2_mov_frequency'] == 100 and row['task_2_switch_frequency'] == 0) or
            (row['task_2_switch_frequency'] == 100 and row['task_2_mov_frequency'] == 50) or
            (row['task_2_switch_frequency'] != 100 and row['task_2_switch_frequency'] != 0 and
             row['task_2_mov_frequency'] != 0 and row['task_2_mov_frequency'] != 100))


def filter_timing(row):
    return ((row['cue_1_duration'] > MIN_REACTION_TIME
             or row['cue_2_duration'] > MIN_REACTION_TIME)
            and
            (row['mov_duration'] > MIN_REACTION_TIME
             or row['or_duration'] > MIN_REACTION_TIME))


def get_task_sequence(sample):
    # counterbalance
    task_1_mov_frequency = sample['task_1_mov_frequency'].iloc[0]
    task_2_mov_frequency = sample['task_2_mov_frequency'].iloc[0]
    task_1_switch_frequency = sample['task_1_switch_frequency'].iloc[0]
    task_2_switch_frequency = sample['task_2_switch_frequency'].iloc[0]
    task_equality_frequency = sample['task_equality_frequency'].iloc[0]

    direction_mov_switch_frequency = sample['direction_mov_switch_frequency'].iloc[0]
    direction_or_switch_frequency = sample['direction_or_switch_frequency'].iloc[0]
    direction_equality_frequency = sample['direction_equality_frequency'].iloc[0]

    design = []
    crossing = [[], []]
    has_task_1 = True
    has_task_2 = True
    has_mov = True
    has_or = True
    if sample['cue_1_duration'].iloc[0] == 0:
        has_task_1 = False
    if sample['cue_2_duration'].iloc[0] == 0:
        has_task_2 = False
    if sample['mov_duration'].iloc[0] == 0:
        has_mov = False
    if sample['or_duration'].iloc[0] == 0:
        has_or = False

    if not has_task_1 and not has_task_2:
        return False
    if not has_mov and not has_or:
        return False

    def _congruent(_1, _2):
        return _1 == _2

    def _incongruent(_1, _2):
        return not _congruent(_1, _2)

    def _repeat(_):
        return _[0] == _[-1]

    def _switch(_):
        return not _repeat(_)

    # REGULAR TASK FACTORS
    task_1 = None
    if not has_task_1:
        task_1 = 'mov'
    elif task_1_mov_frequency == 0:
        task_1 = 'or'
    elif task_1_mov_frequency == 100:
        task_1 = 'mov'
    else:
        weights = map_ratio_to_weight(task_1_mov_frequency)
        mov_task_1 = Level('mov', weights[0])
        or_task_1 = Level('or', weights[1])
        task_1_f = Factor('task_1', initial_levels=[mov_task_1, or_task_1])
        design.append(task_1_f)
        crossing.append([task_1_f])

    task_2 = None
    if not has_task_2:
        task_2 = 'mov'
    if task_2_mov_frequency == 0:
        task_2 = 'or'
    elif task_2_mov_frequency == 100:
        task_2 = 'mov'
    else:
        weights = map_ratio_to_weight(task_2_mov_frequency)
        mov_task_2 = Level('mov', weights[0])
        or_task_2 = Level('or', weights[1])
        task_2_f = Factor('task_2', initial_levels=[mov_task_2, or_task_2])
        design.append(task_2_f)
        crossing.append([task_2_f])

    # DERIVED TASK FACTORS
    # TRANSITION
    if task_1_switch_frequency != 0 and has_task_1:
        weights = map_ratio_to_weight(task_1_switch_frequency)
        task_1_transition = Factor("task_1_transition", [
            DerivedLevel("switch", Transition(_switch, [task_1_f]), weight=weights[0]),
            DerivedLevel("repeat", Transition(_repeat, [task_1_f]), weight=weights[1]),
        ])
        design.append(task_1_transition)
        crossing[0].append(task_1_transition)

    if task_2_switch_frequency != 0 and has_task_2:
        weights = map_ratio_to_weight(task_1_switch_frequency)
        task_2_transition = Factor("task_2_transition", [
            DerivedLevel("switch", Transition(_switch, [task_2_f]), weight=weights[0]),
            DerivedLevel("repeat", Transition(_repeat, [task_2_f]), weight=weights[1]),
        ])
        design.append(task_2_transition)
        crossing[0].append(task_2_transition)

    # TASK CONGRUENCY
    if task_1 is None and task_2 is None:
        weights = map_ratio_to_weight(task_equality_frequency)

        task_congruency = Factor("task_congruency", [
            DerivedLevel("congruent", WithinTrial(_congruent, [task_1_f, task_2_f]),
                         weight=weights[0]),
            DerivedLevel("incongruent", WithinTrial(_incongruent, [task_1_f, task_2_f]),
                         weight=weights[1]),
        ])
        design.append(task_congruency)
        crossing.append([task_congruency])

    # REGULAR DIRECTION FACTORS
    if has_mov:
        direction_mov_f = Factor('direction_mov', initial_levels=[0, 180])
        design.append(direction_mov_f)
        crossing.append([direction_mov_f])

    if has_or:
        direction_or_f = Factor('direction_or', initial_levels=[0, 180])
        design.append(direction_or_f)
        crossing.append([direction_or_f])

    # DERIVED DIRECTION FACTORS
    # TRANSITION
    if has_mov:
        weights = map_ratio_to_weight(direction_mov_switch_frequency)
        direction_mov_transition = Factor("direction_mov_transition", [
            DerivedLevel("switch", Transition(_switch, [direction_mov_f]), weight=weights[0]),
            DerivedLevel("repeat", Transition(_repeat, [direction_mov_f]), weight=weights[1]),
        ])
        design.append(direction_mov_transition)
        crossing[1].append(direction_mov_transition)

    if has_or:
        weights = map_ratio_to_weight(direction_or_switch_frequency)
        direction_or_transition = Factor("direction_or_transition", [
            DerivedLevel("switch", Transition(_switch, [direction_or_f]), weight=weights[0]),
            DerivedLevel("repeat", Transition(_repeat, [direction_or_f]), weight=weights[1]),
        ])
        design.append(direction_or_transition)
        crossing[1].append(direction_or_transition)

    # DIRECTION CONGRUENCY
    weights = map_ratio_to_weight(direction_equality_frequency)
    if has_or and has_mov:
        direction_congruency = Factor("direction_congruency", [
            DerivedLevel("congruent", WithinTrial(_congruent, [direction_mov_f, direction_or_f]),
                         weight=weights[0]),
            DerivedLevel("incongruent",
                         WithinTrial(_incongruent, [direction_mov_f, direction_or_f]),
                         weight=weights[1]),
        ])
        design.append(direction_congruency)
        crossing.append([direction_congruency])

    crossing_clean = []
    for c in crossing:
        if len(c) > 0:
            crossing_clean.append(c)

    constraints_train = [MinimumTrials(TRIALS_PER_PARTICIPANT // 4)]
    constraints_test = [MinimumTrials(TRIALS_PER_PARTICIPANT)]
    block_train = MultiCrossBlock(design=design, crossings=crossing_clean,
                                  constraints=constraints_train)
    block_test = MultiCrossBlock(design=design, crossings=crossing_clean,
                                 constraints=constraints_test)

    experiments_train = run_with_timeout(block_train, PARTICIPANTS_PER_CYCLE * 2, CMSGen,
                                         SWEETPEA_TIMEOUT)
    experiments_test = run_with_timeout(block_test, PARTICIPANTS_PER_CYCLE * 6, CMSGen,
                                        SWEETPEA_TIMEOUT * 100)

    exp_dicts_train = experiments_to_dicts(block_train, experiments_train)
    exp_dicts = experiments_to_dicts(block_test, experiments_test)

    conditions = []

    # parameters

    for idx_p, p in enumerate(range(PARTICIPANTS_PER_CYCLE)):
        experiment = []
        _train = exp_dicts_train[2 * p:2 * p + 2]
        _test = exp_dicts[6 * p:6 * p + 6]
        all = _train + _test
        for idx_s, exp in enumerate(all):
            sequence = []
            for t in exp:
                trial = {}
                if task_1:
                    trial['task_1'] = task_1
                else:
                    trial['task_1'] = t['task_1']
                if task_2:
                    trial['task_2'] = task_2
                else:
                    trial['task_2'] = t['task_2']

                trial['start_1'] = sample['cue_1_start'].iloc[0]
                trial['dur_1'] = sample['cue_1_duration'].iloc[0]
                trial['start_2'] = sample['cue_2_start'].iloc[0]
                trial['dur_2'] = sample['cue_2_duration'].iloc[0]

                trial['start_mov_1'] = sample['mov_start'].iloc[0]
                trial['dur_mov_1'] = sample['mov_duration'].iloc[0]
                trial['coh_mov_1'] = sample['mov_coherence'].iloc[0]
                if has_mov:
                    trial['dir_mov_1'] = t['direction_mov']
                else:
                    trial['dir_mov_1'] = 0

                trial['start_or_1'] = sample['or_start'].iloc[0]
                trial['dur_or_1'] = sample['or_duration'].iloc[0]
                trial['coh_or_1'] = sample['or_coherence'].iloc[0]
                if has_or:
                    trial['dir_or_1'] = t['direction_or']
                else:
                    trial['dir_or_1'] = 0

                trial['start_mov_2'] = 0
                trial['dur_mov_2'] = 0
                trial['coh_mov_2'] = 0
                trial['dir_mov_2'] = 0

                trial['start_or_2'] = 0
                trial['dur_or_2'] = 0
                trial['coh_or_2'] = 0
                trial['dir_or_2'] = 0

                trial['start_go_1'] = trial['start_1']
                trial['dur_go_1'] = trial['dur_1']
                trial['start_go_2'] = trial['start_2']
                trial['dur_go_2'] = trial['dur_2']

                sequence.append(trial)
            if not check_sequence(sequence, len(exp), MIN_REACTION_TIME):
                return False
            experiment.append(sequence)
        conditions.append(experiment)
    return conditions, str(crossing_clean)


# endregion

# Non-standard raw_data field that contains processed experimental data
@dataclass(frozen=True)
class SuperState(State):
    variables: Optional[VariableCollection] = field(
        default=None, metadata={"delta": "replace"}
    )
    conditions: List[pd.DataFrame] = field(
        default_factory=list, metadata={"delta": "extend"}
    )
    raw_data: List[dict] = field(
        default_factory=list, metadata={"delta": "extend"}
    )
    experiment_data: List[dict] = field(
        default_factory=list, metadata={"delta": "extend"}
    )
    models: List[BaseEstimator] = field(
        default_factory=list,
        metadata={"delta": "extend"},
    )


def main():
    cue_1_duration_v = Variable(name='cue_1_duration',
                                value_range=(0, 3000),
                                allowed_values=np.linspace(0, 3000, 13))

    cue_2_duration_v = Variable(name='cue_2_duration',
                                value_range=(0, 3000),
                                allowed_values=np.linspace(0, 3000, 13))

    mov_duration_v = Variable(name='mov_duration',
                              value_range=(0, 3000),
                              allowed_values=np.linspace(0, 3000, 13))
    or_duration_v = Variable(name='or_duration',
                             value_range=(0, 3000),
                             allowed_values=np.linspace(0, 3000, 13))

    cue_1_start_v = Variable(name='cue_1_start',
                             value_range=(0, 800),
                             allowed_values=np.linspace(0, 800, 9))

    cue_2_start_v = Variable(name='cue_2_start',
                             value_range=(0, 800),
                             allowed_values=np.linspace(0, 800, 9))

    mov_start_v = Variable(name='mov_start',
                           value_range=(0, 800),
                           allowed_values=np.linspace(0, 800, 9))

    or_start_v = Variable(name='or_start',
                          value_range=(0, 800),
                          allowed_values=np.linspace(0, 800, 9))

    coherency_mov_v = Variable(name='mov_coherence',
                               value_range=(0, 1),
                               allowed_values=np.linspace(.11, 1., 90))

    coherency_or_v = Variable(name='or_coherence',
                              value_range=(0, 1),
                              allowed_values=np.linspace(.11, 1., 90))

    task_1_mov_frequency = Variable(name='task_1_mov_frequency',
                                    value_range=(0, 100),
                                    allowed_values=[0, 25, 50, 75, 100])
    task_2_mov_frequency = Variable(name='task_2_mov_frequency',
                                    value_range=(0, 100),
                                    allowed_values=[0, 25, 50, 75, 100])

    task_1_switch_frequency = Variable(name='task_1_switch_frequency',
                                       value_range=(0, 100),
                                       allowed_values=[0, 25, 50, 75, 100])

    task_2_switch_frequency = Variable(name='task_2_switch_frequency',
                                       value_range=(0, 100),
                                       allowed_values=[0, 25, 50, 75, 100])

    task_equality_frequency = Variable(name='task_equality_frequency',
                                       value_range=(0, 100),
                                       allowed_values=[0, 25, 50, 75, 100])

    direction_equality_frequency = Variable(name='direction_equality_frequency',
                                            value_range=(0, 100),
                                            allowed_values=[0, 25, 50, 75, 100])

    direction_mov_switch_frequency = Variable(name='direction_mov_switch_frequency',
                                              value_range=(0, 100),
                                              allowed_values=[25, 50, 75, 100])

    direction_or_switch_frequency = Variable(name='direction_or_switch_frequency',
                                             value_range=(0, 100),
                                             allowed_values=[25, 50, 75, 100])

    independent_variables = [
        cue_1_duration_v, cue_2_duration_v, mov_duration_v, or_duration_v,
        cue_1_start_v, cue_2_start_v, mov_start_v, or_start_v,
        coherency_mov_v, coherency_or_v,
        task_1_mov_frequency, task_2_mov_frequency, task_equality_frequency,
        task_1_switch_frequency, task_2_switch_frequency,
        direction_equality_frequency,
        direction_mov_switch_frequency, direction_or_switch_frequency
    ]

    variables = VariableCollection(dependent_variables=[],
                                   independent_variables=independent_variables)

    state = SuperState(variables=variables)

    # ** Experimentalist ** #
    @on_state()
    def experimentalist(variables):
        # get a random experimental condition
        _pool = random.pool(variables, 10_000)
        # add filters for "sensible" task configurations
        _pool = _pool[_pool.apply(filter_on_alignment, axis=1)]
        _pool = _pool[_pool.apply(filter_on_switch_task_1, axis=1)]
        _pool = _pool[_pool.apply(filter_timing, axis=1)]
        pool = _pool[_pool.apply(filter_on_switch_task_2, axis=1)]

        trial_sequences = None
        crossing = None
        sample = None
        # rejection sampling of trial_sequences
        while trial_sequences is None:
            print('')
            print('new cycle')
            sample = pool.sample(n=1)
            sample_df = sample.copy()
            pool = pool.drop(sample.index)
            try:
                _trial_sequence, _crossing = get_task_sequence(sample_df)
                if _trial_sequence != False:
                    trial_sequences = _trial_sequence
                    crossing = _crossing
            except Exception as e:
                print(e)
        print('success')
        return Delta(conditions=[
            {'sample': sample, 'trial_sequences': trial_sequences, 'crossing': crossing}])

    # ** Experiment Runner ** #
    @on_state()
    def experiment_runner(conditions):
        sample = conditions[-1]['sample']
        trial_sequences = conditions[-1]['trial_sequences']
        crossing = conditions[-1]['crossing']
        trial_duration = max([sample['cue_1_start'].iloc[0] + sample['cue_1_duration'].iloc[0],
                              sample['cue_2_start'].iloc[0] + sample['cue_2_duration'].iloc[0],
                              sample['mov_start'].iloc[0] + sample['mov_duration'].iloc[0],
                              sample['or_start'].iloc[0] + sample['or_duration'].iloc[0]])
        seqs = trial_sequences[0]
        dur = 0
        for seq in seqs:
            dur += len(seq) * trial_duration

        dur /= 1000
        dur /= 60
        dur += 9
        dur = math.ceil(round(dur) / 5) * 5
        comp = dur / 60 * 12

        print(f'duration: {dur}', f'compensation: {comp}')

        if comp >= 12:
            raise Exception("This costs a lot")

        _experiment_runner = firebase_prolific_runner(
            firebase_credentials=FIREBASE_CREDENTIALS,
            sleep_time=30,
            study_name='fish 5',
            study_description=f'Fish concentration game in {dur} minutes. You can earn ${comp}.',
            study_url='https://first-closed-loop.web.app',
            study_completion_time=dur,
            prolific_token='...',
            completion_code='...',
            exclude_studies=[
                'fish 5', 'fish 4', 'fish 3', 'fish 2', 'fish',
                'fish 5 Copy', 'fish 4 Copy', 'fish 3 Copy', 'fish 2 Copy', 'fish Copy']
        )
        data = _experiment_runner(trial_sequences)
        return Delta(raw_data=[
            {'sample': sample, 'trial_sequences': trial_sequences, 'experiment_data': data,
             'crossing': crossing}])

    PATH = pathlib.Path('./data/autora_super_experiment/state_random.pkl')

    # ** Workflow ** #
    cycle = 0
    # Load state if it exists and continue from there
    if PATH.exists():
        state = load_state(PATH)
        cycle = len(state.experiment_data)
    while cycle < NR_CYCLES:
        state = experimentalist(state)
        state = experiment_runner(state)
        dump_state(state, PATH)
        get_observations(directory='./data/autora_super_experiment/res/')
        cycle += 1


if __name__ == '__main__':
    main()
