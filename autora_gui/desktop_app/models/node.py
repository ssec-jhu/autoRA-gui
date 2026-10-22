"""Data models for nodes and components."""

import uuid as uuid_module
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ParameterDef:
    """Definition of a component parameter."""

    name: str
    description: str
    datatype: str  # integer, real, boolean, string, categorical, object
    min_occurs: int = 1
    max_occurs: int = 1
    valid_values: list[str] | None = None
    default: Any = None


@dataclass
class PortDef:
    """Definition of an input/output port."""

    name: str
    description: str
    datatype: str
    min_occurs: int = 1
    max_occurs: int = -1  # -1 means unlimited


@dataclass
class ComponentDefinition:
    """Definition of a component loaded from JSON."""

    uuid: str
    protocol_type: str  # experimentalist, theorist, experiment_runner
    name: str
    description: str
    github_commit: str
    parameters: list[ParameterDef] = field(default_factory=list)
    input_ports: list[PortDef] = field(default_factory=list)
    output_ports: list[PortDef] = field(default_factory=list)
    file_path: str = ""  # Path to the JSON file

    @classmethod
    def from_json(cls, data: dict, file_path: str = "") -> "ComponentDefinition":
        """Create a ComponentDefinition from JSON data."""
        parameters = [
            ParameterDef(
                name=p["name"],
                description=p.get("description", ""),
                datatype=p.get("datatype", "string"),
                min_occurs=p.get("minOccurs", 1),
                max_occurs=p.get("maxOccurs", 1),
                valid_values=p.get("validValues"),
                default=p.get("default"),
            )
            for p in data.get("parameters", [])
        ]

        input_ports = [
            PortDef(
                name=p["name"],
                description=p.get("description", ""),
                datatype=p.get("datatype", "object"),
                min_occurs=p.get("minOccurs", 1),
                max_occurs=p.get("maxOccurs", -1),
            )
            for p in data.get("inputDataType", [])
        ]

        output_ports = [
            PortDef(
                name=p["name"],
                description=p.get("description", ""),
                datatype=p.get("datatype", "object"),
                min_occurs=p.get("minOccurs", 1),
                max_occurs=p.get("maxOccurs", -1),
            )
            for p in data.get("outputDataType", [])
        ]

        return cls(
            uuid=data.get("uuid", ""),
            protocol_type=data.get("protocolType", ""),
            name=data.get("name", "Unknown"),
            description=data.get("description", ""),
            github_commit=data.get("githubCommit", ""),
            parameters=parameters,
            input_ports=input_ports,
            output_ports=output_ports,
            file_path=file_path,
        )


@dataclass
class PortData:
    """Runtime data for a port on a node instance."""

    name: str
    port_type: str  # "input" or "output"
    datatype: str


@dataclass
class NodeData:
    """Runtime data for a node instance on the canvas."""

    uuid: str
    component: ComponentDefinition
    x: float = 0
    y: float = 0
    parameters: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        # Initialize parameters with defaults from component definition
        if not self.parameters:
            self.parameters = {}
            for param in self.component.parameters:
                if param.default is not None:
                    self.parameters[param.name] = param.default

    @classmethod
    def create(cls, component: ComponentDefinition, x: float = 0, y: float = 0) -> "NodeData":
        """Create a new node instance from a component definition."""
        return cls(
            uuid=str(uuid_module.uuid4()),
            component=component,
            x=x,
            y=y,
        )
