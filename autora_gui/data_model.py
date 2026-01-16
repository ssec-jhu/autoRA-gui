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


class ComponentType(str, Enum):
    """Component type model for the workflow."""

    THEORIST = "theorist"
    EXPERIMENTALIST = "experimentalist"
    EXPERIMENT_RUNNER = "experiment_runner"


class Unlimited(str, Enum):
    """Unlimited model for the workflow."""

    UNLIMITED = "unlimited"


class VariableType(BaseModel):
    """Variable type model for the workflow."""

    name: str
    description: str | None


class PrimitiveVariableType(VariableType):
    """Primitive variable type model for the workflow."""

    datatype: Datatype
    minOccurs: int | None = 1
    maxOccurs: int | None = -1
    validValues: list[str] | None = None
    default: Any | None = None


class TupleVariableType(VariableType):
    """A model for tuple variables in the workflow."""

    variables: list[VariableType]


VariableTypes = PrimitiveVariableType | TupleVariableType


class Protocol(AutoraBaseModel):
    """A protocol model for the workflow.

    Presents basic model for components and links.
    """

    protocolType: ComponentType
    name: str
    description: str | None = None
    githubCommit: str
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
    """A component model for Autora gui.

    Includes node parameters and canvas location.
    """

    protocolUuid: uuid.UUID  # uuid of the Protocol
    parameterSetting: list[ParameterSetting] | None
    canvasLocation: CanvasLocation | None


class Workflow(BaseModel):
    """A workflow model for Autora gui.

    Includes all possible elements like nodes and links.
    """

    name: str
    description: str | None = None
    independentVariables: VariableTypes
    dependentVariables: VariableTypes
    components: list[Component]
    links: list[Link]


class Root(BaseModel):
    """A root model for Autora gui.

    Basic class including workflow.
    """

    workflow: Workflow


# Create and save schemas
####################################
if __name__ == "__main__":
    root_model_schema = Root.model_json_schema()
    schema_path = "autora_gui/components/root_schema.json"
    with Path(schema_path).open("w", encoding="utf-8") as f:
        f.write(json.dumps(root_model_schema, indent=2, ensure_ascii=False))

    workflow_model_schema = Root.model_json_schema()
    schema_path = "autora_gui/components/workflow_schema.json"
    with Path(schema_path).open("w", encoding="utf-8") as f:
        f.write(json.dumps(workflow_model_schema, indent=2, ensure_ascii=False))

    protocol_model_schema = Root.model_json_schema()
    schema_path = "autora_gui/components/protocol_schema.json"
    with Path(schema_path).open("w", encoding="utf-8") as f:
        f.write(json.dumps(protocol_model_schema, indent=2, ensure_ascii=False))
