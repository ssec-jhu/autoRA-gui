from enum import Enum
from typing import Union, List, Optional, Any
import uuid, json

from pydantic import BaseModel

# Protocol classes
#################################

class AutoRABaseModel(BaseModel):
    uuid: uuid.UUID

class Datatype(str, Enum):
    REAL = 'real'
    INTEGER = 'integer'
    BOOLEAN = 'boolean'
    STRING = 'string'
    CATEGORICAL = 'categorical'


class ComponentType(str, Enum):
    THEORIST = 'theorist'
    EXPERIMENTALIST = 'experimentalist'
    EXPERIMENT_RUNNER = 'experiment_runner'

class Unlimited(str, Enum):
    UNLIMITED = 'unlimited'
    
class VariableType(BaseModel):
    name : str
    description : Optional[str]

class PrimitiveVariableType(VariableType):
    datatype : Datatype
    minOccurs: Optional[int] = 1
    maxOccurs: Optional[Union[int, Unlimited]] = 1
    validValues : Optional[List[str]] = None
    default: Optional[Any] = None
    
class TupleVariableType(VariableType):
    variables : List[VariableType]

VariableTypes = Union[PrimitiveVariableType, TupleVariableType]

class Protocol(AutoRABaseModel):
    '''
    ...
    '''
    protocolType: ComponentType
    name: str
    description: Optional[str] = None
    githubCommit: str
    parameters : Optional[List[VariableTypes]]
    inputDataType : Optional[List[VariableTypes]]   # could be a bunch of allowed datatypes
    outputDataType : Optional[List[VariableTypes]]  # could be a bunch of allowed datatypes

# Workflow classes from here
####################################

class Link(BaseModel):
    source : uuid.UUID  # uuid of the Experiment
    target : uuid.UUID

class Filter(Link):
    max_counter: int = 1
    altTarget: Optional[uuid.UUID]

class ParameterSetting(AutoRABaseModel):
    value: str
    
class CanvasLocation(BaseModel):
    x: int
    y: int

class Component(AutoRABaseModel):
    protocol_uuid: uuid.UUID # uuid of the Protocol
    parameter_setting: Optional[List[ParameterSetting]]
    canvas_location: Optional[CanvasLocation]
    

class Workflow(BaseModel):
    name: str
    description: Optional[str] = None
    independentVariables: VariableTypes
    dependentVariables: VariableTypes
    components : List[Component]
    links : List[Link]


class root(BaseModel):
    workflow : Workflow
    
# test code to read schema
if __name__ == "__main__":
    main_model_schema = root.model_json_schema()  # (1)!
    schema_path = "autora_gui/components/workflow_schema.json"
    with open(schema_path,"w") as f:
        f.write(json.dumps(main_model_schema, indent=2))  # (2)!
        print(main_model_schema)
    