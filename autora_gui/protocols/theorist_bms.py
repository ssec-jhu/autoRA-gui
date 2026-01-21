
"""Data models for BMS theorist module."""

import uuid
from pathlib import Path

import autora_gui.data_model as dm

parameters = [
    dm.PrimitiveVariableType(
        name="prior_par",
        description="A dictionary of the prior probabilities of different functions based on wikipedia data scraping.",
        datatype=dm.Datatype.DICT,
        default="PRIORS",  # Uses get_priors() from autora.theorist.bms
    ),
    dm.PrimitiveVariableType(
        name="ts",
        description="Contains a list of the temperatures that the parallel machine scientist works at.",
        datatype=dm.Datatype.LIST,
        default="TEMPERATURES",  # [1.0] + [1.04**k for k in range(1, 20)]
    ),
    dm.PrimitiveVariableType(
        name="epochs",
        description="Number of training epochs.",
        datatype=dm.Datatype.INTEGER,
        default=1500,
    ),
]


bms_theorist = dm.Protocol(
    protocolType=dm.ProtocolType.THEORIST,
    uuid=uuid.uuid1(),
    name="BMS Regressor",
    githubCommit="",
    description="Bayesian Machine Scientist that finds an optimal function to explain a dataset, given a set of variables and a pre-defined number of parameters.",
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

# Generate JSON component when run directly
if __name__ == "__main__":
    bms_model_path = "autora_gui/JSON/components/theorists/theorist_bms.json"
    with Path(bms_model_path).open("w", encoding="utf-8") as f:
        f.write(bms_theorist.model_dump_json(indent=2))
