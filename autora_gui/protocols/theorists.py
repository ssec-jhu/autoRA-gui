"""Data models for theorists modules."""

import json
import uuid
from pathlib import Path

import autora_gui.data_model as dm

PRIMITIVES = [
    "none",
    "add",
    "subtract",
    "mult",
    "linear",
    "relu",
    "exp",
    "logistic",
    "sin",
    "cos",
    "tanh",
    "linear_relu",
    "linear_exp",
    "linear_logistic",
    "linear_sin",
    "linear_cos",
    "linear_tanh",
    "reciprocal",
    "ln",
    "softplus",
    "softminus",
]

parameters = [
    dm.PrimitiveVariableType(
        name="batch_size",
        description="...",
        datatype=dm.Datatype.INTEGER,
        default=64,
    ),
    dm.PrimitiveVariableType(
        name="darts_type",
        description="...",
        datatype=dm.Datatype.CATEGORICAL,
        default="original",
        validValues=["original", "fair"],
    ),
    dm.PrimitiveVariableType(
        name="primitives",
        description="...",
        datatype=dm.Datatype.CATEGORICAL,
        minOccurs=1,
        maxOccurs=len(PRIMITIVES),
        default="none",
        validValues=PRIMITIVES,
    ),
]


darts_theorist = dm.Protocol(
    protocolType=dm.ComponentType.THEORIST,
    uuid=uuid.uuid1(),
    name="DARTS Regressor",
    githubCommit="...",
    description="Finds a composition of functions and coefficients to minimize a loss function.",
    parameters=parameters,
    inputDataType=[
        dm.PrimitiveVariableType(
            name="X",
            description="...",
            datatype=dm.Datatype.REAL,
        )
    ],
    outputDataType=[
        dm.PrimitiveVariableType(
            name="y",
            description="...",
            datatype=dm.Datatype.REAL,
        )
    ],
)

# test code to generate, read and save schema
if __name__ == "__main__":
    json_dump = darts_theorist.model_dump_json()
    theorist_dict = json.loads(json_dump)
    darts_theorist = dm.Protocol(**theorist_dict)

    darts_model_path = "autora_gui/components/theorist_darts.json"
    with Path(darts_model_path).open("w") as f:
        json.dump(json_dump, f)
