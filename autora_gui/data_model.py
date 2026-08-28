"""Workflow schema for Autora gui."""

import json
import uuid
from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import BaseModel

# Protocol classes
#################################


class AutoraBaseModel(BaseModel):
    """Autora base model for the workflow."""

    uuid: uuid.UUID


class Datatype(str, Enum):
    """Datatype model for the workflow."""

    REAL = "real"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    STRING = "string"
    CATEGORICAL = "categorical"
    ANY = "any"
    IV = "IV"
    DV = "DV"


class ProtocolType(str, Enum):
    """Protocol type model for the workflow."""

    THEORIST = "theorist"
    EXPERIMENTALIST = "experimentalist"
    EXPERIMENT_RUNNER = "experiment_runner"


class VariableType(BaseModel):
    """Variable type model for the workflow."""

    name: str | None = None
    description: str | None = None


class Cardinality(BaseModel):
    """A model for cardinality in the workflow."""

    minOccurs: int = 0
    maxOccurs: int = 1
    unique: bool = True


class PrimitiveVariableType(VariableType):
    """Primitive variable type model for the workflow."""

    datatype: Datatype
    cardinality: Cardinality | None = None
    validValues: list[str] | None = None
    default: Any | None = None


class ListVariableType(VariableType):
    """A model for list variables in the workflow."""

    variable: "VariableTypes"


class DictVariableType(VariableType):
    """A model for dictionary variables in the workflow."""

    variables: "VariableTypes | list[VariableTypes]"


VariableTypes = PrimitiveVariableType | ListVariableType | DictVariableType

ListVariableType.model_rebuild()
DictVariableType.model_rebuild()


class Protocol(AutoraBaseModel):
    """A protocol model for the workflow.

    Presents basic model for components and links.
    """

    protocolType: ProtocolType
    name: str
    description: str
    githubCommit: str
    github_io: str  # GitHub Pages (github.io) documentation/user-guide URL
    pythonName: str
    importPath: str
    pipInstall: str
    parameters: dict[str, list[VariableTypes]] | None
    inputDataType: VariableTypes | None  # could be a bunch of allowed datatypes
    outputDataType: VariableTypes | None  # could be a bunch of allowed datatypes
    # True for experiment runners whose `.run()` returns the dependent-variable
    # values (a list, one per condition) rather than a full experiment_data
    # DataFrame (e.g. the bandit/Q-learning synthetic runner). The code generator
    # then assembles experiment_data by pairing the conditions with these values.
    runReturnsDV: bool = False


# Workflow classes from here
####################################


class Link(BaseModel):
    """A link (connection) model for Autora gui.

    Includes output and input nodes being connected by the given link.
    """

    source: uuid.UUID  # uuid of the Experiment
    target: uuid.UUID


class Filter(Link):
    """A filter link model for AutoRA GUI.

    A specialized link with counter and alternative target.
    """

    maxCounter: int = 1
    altTarget: uuid.UUID | None = None


class ParameterSetting(AutoraBaseModel):
    """A class for parameter setting.

    Includes the description.
    """

    value: str


class CanvasLocation(BaseModel):
    """A class for node's canvas location.

    Includes x and y coordinates.
    """

    x: int
    y: int


class Component(AutoraBaseModel):
    """A component model for AutoRA GUI.

    Includes canvas location.
    """

    canvasLocation: CanvasLocation | None


class ProtocolComponent(Component):
    """A protocol component model for AutoRA GUI.

    Includes node parameters.
    """

    protocolUuid: uuid.UUID  # uuid of the Protocol
    parameterSetting: list[ParameterSetting] | None


class StartComponent(Component):
    """A start component model for AutoRA GUI.

    Serves as the starting point of the workflow.
    """


class EndComponent(Component):
    """An end component model for AutoRA GUI.

    Serves as the ending point of the workflow.
    """


class FilterComponent(Component):
    """A filter component model for AutoRA GUI.

    Serves as a decision/filter point in the workflow.
    """

    maxCounter: int = 1
    altTarget: uuid.UUID | None = None


class Workflow(BaseModel):
    """A workflow model for AutoRA GUI.

    Includes all possible elements like nodes and links.
    """

    name: str
    description: str | None = None
    start: StartComponent | None = None
    end: EndComponent | None = None
    filters: list[FilterComponent] | None = None
    independentVariables: VariableTypes
    dependentVariables: VariableTypes
    components: list[ProtocolComponent]
    links: list[Link]


# Create and save schemas
####################################


def generate_schemas(output_dir: Path | str = "autora_gui/JSON/schemas") -> None:
    """Generate JSON schemas from Pydantic models.

    Args:
        output_dir: Directory to write schema files. Defaults to autora_gui/JSON/schemas.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    workflow_model_schema = Workflow.model_json_schema()
    with (output_dir / "workflow_model.json").open("w", encoding="utf-8") as f:
        f.write(json.dumps(workflow_model_schema, indent=2, ensure_ascii=False))

    protocol_model_schema = Protocol.model_json_schema()
    with (output_dir / "protocol_model.json").open("w", encoding="utf-8") as f:
        f.write(json.dumps(protocol_model_schema, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    generate_schemas()
