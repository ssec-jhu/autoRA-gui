"""Workflow schema or Autora gui."""

import json
import uuid
from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import BaseModel

# Protocol classes
#################################


class AutoRABaseModel(BaseModel):
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
    min_occurs: int | None = 1
    max_occurs: int | Unlimited | None = 1
    valid_values: list[str] | None = None
    default: Any | None = None


class TupleVariableType(VariableType):
    """A model for tuple variables in the workflow."""

    variables: list[VariableType]


VariableTypes = PrimitiveVariableType | TupleVariableType


class Protocol(AutoRABaseModel):
    """A protocol model for the workflow.

    Presents basic model for components and links.
    """

    protocol_type: ComponentType
    name: str
    description: str | None = None
    github_commit: str
    parameters: list[VariableTypes] | None
    input_data_type: list[VariableTypes] | None  # could be a bunch of allowed datatypes
    output_data_type: list[VariableTypes] | None  # could be a bunch of allowed datatypes


# Workflow classes from here
####################################


class Link(BaseModel):
    """A link (connection) model for Autora gui.

    Includes output and input nodes being connected y the given link.
    """

    source: uuid.UUID  # uuid of the Experiment
    target: uuid.UUID


class Filter(Link):
    """An exit criteria from the potential loop in the workflow.

    Includes the loop counter parameter and alternative target.
    """

    max_counter: int = 1
    alt_target: uuid.UUID | None


class ParameterSetting(AutoRABaseModel):
    """A class for parameter setting.

    Includes the description.
    """

    value: str


class CanvasLocation(BaseModel):
    """A class for node's canvas location.

    Includes x and y oordinates.
    """

    x: int
    y: int


class Component(AutoRABaseModel):
    """A component model for Autora gui.

    Includes node parameters and canvas location.
    """

    protocol_uuid: uuid.UUID  # uuid of the Protocol
    parameter_setting: list[ParameterSetting] | None
    canvas_location: CanvasLocation | None


class Workflow(BaseModel):
    """A workflow model for Autora gui.

    Includes all possible elements like nodes and links.
    """

    name: str
    description: str | None = None
    independent_variables: VariableTypes
    dependent_variables: VariableTypes
    components: list[Component]
    links: list[Link]


class Root(BaseModel):
    """A root model for Autora gui.

    Basic class including workflow.
    """

    workflow: Workflow


# test code to read schema
if __name__ == "__main__":
    main_model_schema = Root.model_json_schema()  # (1)!
    schema_path = "autora_gui/components/workflow_schema.json"
    with Path(schema_path).open("w") as f:
        f.write(json.dumps(main_model_schema, indent=2))  # (2)!
