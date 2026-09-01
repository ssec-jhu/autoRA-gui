"""Data models for experimentalist modules."""

import uuid
from pathlib import Path

import autora_gui.data_model as dm

parameters = [
    dm.PrimitiveVariableType(
        name="num_rewards",
        description="The number of rewards / dimension of each element of the sequence.",
        datatype=dm.Datatype.INTEGER,
        default="required",
        validValues=["int"],
    ),
    dm.PrimitiveVariableType(
        name="sequence_length",
        description="TThe length of the sequence.",
        datatype=dm.Datatype.INTEGER,
        default="required",
        validValues=["int"],
    ),
    dm.PrimitiveVariableType(
        name="initial_probabilities",
        description="A list of initial reward-probabilities.",
        datatype=dm.Datatype.LIST,
        default="none",
        validValues=["float", "Iterable"],
    ),
    dm.PrimitiveVariableType(
        name="sigmas",
        description="A list of constant drift rate for each element of the probabilites.",
        datatype=dm.Datatype.LIST,
        default="none",
        validValues=["float", "Iterable"],
    ),
    dm.PrimitiveVariableType(
        name="num_samples",
        description="The number of experimental conditions to select",
        datatype=dm.Datatype.INTEGER,
        default=1,
        validValues=["int"],
    ),
    dm.PrimitiveVariableType(
        name="random_state",
        description="A seed value for the random number generator.",
        datatype=dm.Datatype.LIST,
        default="none",
        validValues=["optional int"],
    ),
]


bandit_random = dm.Protocol(
    protocolType=dm.ProtocolType.EXPERIMENTALIST,
    uuid=uuid.uuid1(),
    name="Bandit Random Experimentalist",
    githubCommit="",
    description="Returns Sampled pool of experimental conditions.",
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

# test code to generate, read and save schema
if __name__ == "__main__":
    # Save the actual protocol instance data (not just schema)
    bandit_random_path = "autora_gui/JSON/components/experimentalists/bandit_random.json"
    with Path(bandit_random_path).open("w", encoding="utf-8") as f:
        f.write(bandit_random.model_dump_json(indent=2))
