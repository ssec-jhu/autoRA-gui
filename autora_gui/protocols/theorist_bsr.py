"""Data models for BSR theorist module."""

import uuid
from pathlib import Path

import autora_gui.data_model as dm

parameters = [
    dm.PrimitiveVariableType(
        name="tree_num",
        description="Pre-specified number of SR trees to fit in the model.",
        datatype=dm.Datatype.INTEGER,
        default=3,
    ),
    dm.PrimitiveVariableType(
        name="itr_num",
        description="Number of iteration steps to run for the model fitting process.",
        datatype=dm.Datatype.INTEGER,
        default=5000,
    ),
    dm.PrimitiveVariableType(
        name="alpha1",
        description="Hyper-parameter of priors.",
        datatype=dm.Datatype.REAL,
        default=0.4,
    ),
    dm.PrimitiveVariableType(
        name="alpha2",
        description="Hyper-parameter of priors.",
        datatype=dm.Datatype.REAL,
        default=0.4,
    ),
    dm.PrimitiveVariableType(
        name="beta",
        description="Hyper-parameter of priors.",
        datatype=dm.Datatype.REAL,
        default=-1,
    ),
    dm.PrimitiveVariableType(
        name="prior_name",
        description="The prior distribution type.",
        datatype=dm.Datatype.CATEGORICAL,
        default="Uniform",
        validValues=["Uniform"],
    ),
    dm.PrimitiveVariableType(
        name="show_log",
        description="Whether to output certain logging info.",
        datatype=dm.Datatype.BOOLEAN,
        default=False,
    ),
    dm.PrimitiveVariableType(
        name="val",
        description="Number of validation steps to run for each iteration step.",
        datatype=dm.Datatype.INTEGER,
        default=100,
    ),
    dm.PrimitiveVariableType(
        name="last_idx",
        description="The index of which latest (most best-fit) model to use (-1 means the latest one).",
        datatype=dm.Datatype.INTEGER,
        default=-1,
    ),
]


bsr_theorist = dm.Protocol(
    protocolType=dm.ProtocolType.THEORIST,
    uuid=uuid.uuid1(),
    name="BSR Regressor",
    githubCommit="",
    description="Bayesian Symbolic Regression using MCMC sampling to automatically construct mathematical expressions bridging independent and dependent variables.",
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
    bsr_model_path = "autora_gui/JSON/components/theorists/theorist_bsr.json"
    with Path(bsr_model_path).open("w", encoding="utf-8") as f:
        f.write(bsr_theorist.model_dump_json(indent=2))
