"""Data models for experiment runners modules."""

import json
import uuid
from pathlib import Path

import autora_gui.data_model as dm


parameters = [
    dm.PrimitiveVariableType(
        name="formula",
        description="Formula used in the experiment runner.",
        datatype=dm.Datatype.STRING,
        default=64,
    ),
    dm.PrimitiveVariableType(
        name="fixed_effects",
        description="Type of DARTS algorithm to use.",
        datatype=dm.Datatype.DICT,
    ),
]


synthetic_abstract_lmm_ = dm.Protocol(
    protocolType=dm.ProtocolType.EXPERIMENT_RUNNER,
    uuid=uuid.uuid1(),
    name="Linear Mixed Model",
    githubCommit="",
    description="A synthetic experiment that runs a linear mixed model.",
    parameters=parameters,
    inputDataType=[
        dm.PrimitiveVariableType(
            name="X",
            description="Input features.",
            datatype=dm.Datatype.REAL,
        )
    ],
    outputDataType=[
        dm.PrimitiveVariableType(
            name="y",
            description="Predicted target.",
            datatype=dm.Datatype.REAL,
        )
    ],
)

# test code to generate, read and save instance data
if __name__ == "__main__":
    # Save the actual protocol instance data (not just schema)
    synthetic_abstract_lmm_path = "autora_gui/JSON/components/experiment_runners/synthetic_abstract_lmm.json"
    with Path(synthetic_abstract_lmm_path).open("w", encoding="utf-8") as f:
        f.write(synthetic_abstract_lmm_.model_dump_json(indent=2))
