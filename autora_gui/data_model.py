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


class ProtocolType(str, Enum):
    """Protocol type model for the workflow."""

    THEORIST = "theorist"
    EXPERIMENTALIST = "experimentalist"
    EXPERIMENT_RUNNER = "experiment_runner"


class VariableType(BaseModel):
    """Variable type model for the workflow."""

    name: str
    description: str | None


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


class DictVariableType(VariableType):
    """A model for dictionary variables in the workflow."""

    variables: list["VariableTypes"]


VariableTypes = PrimitiveVariableType | DictVariableType

DictVariableType.model_rebuild()


class Protocol(AutoraBaseModel):
    """A protocol model for the workflow.

    Presents basic model for components and links.
    """

    protocolType: ProtocolType
    name: str
    description: str
    githubCommit: str
    className: str | None = None
    importPath: str
    pipInstall: str
    pipVersion: str
    parameters: list[VariableTypes] | None
    inputDataType: list[VariableTypes] | None  # could be a bunch of allowed datatypes
    outputDataType: list[VariableTypes] | None  # could be a bunch of allowed datatypes


# Workflow classes from here
####################################


class Link(BaseModel):
    """A link (connection) model for Autora gui.

    Includes output and input nodes being connected by the given link.
    """

    source: uuid.UUID  # uuid of the Experiment
    target: uuid.UUID


class Filter(Link):
    """An exit criteria from the potential loop in the workflow.

    Includes the loop counter parameter and alternative target.
    """

    maxCounter: int = 1
    altTarget: uuid.UUID | None


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


class Workflow(BaseModel):
    """A workflow model for AutoRA GUI.

    Includes all possible elements like nodes and links.
    """

    name: str
    description: str | None = None
    start: StartComponent | None = None
    end: EndComponent | None = None
    independentVariables: VariableTypes
    dependentVariables: VariableTypes
    components: list[ProtocolComponent]
    links: list[Link]


# Create and save schemas
####################################
if __name__ == "__main__":
    workflow_model_schema = Workflow.model_json_schema()
    schema_path = "autora_gui/JSON/schemas/workflow_model.json"
    with Path(schema_path).open("w", encoding="utf-8") as f:
        f.write(json.dumps(workflow_model_schema, indent=2, ensure_ascii=False))

    protocol_model_schema = Protocol.model_json_schema()
    schema_path = "autora_gui/JSON/schemas/protocol_model.json"
    with Path(schema_path).open("w", encoding="utf-8") as f:
        f.write(json.dumps(protocol_model_schema, indent=2, ensure_ascii=False))
