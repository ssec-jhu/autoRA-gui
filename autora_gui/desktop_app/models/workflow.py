"""Workflow data model for saving and loading."""

import json
import uuid as uuid_module
from dataclasses import dataclass, field

from .node import ComponentDefinition, NodeData


@dataclass
class Connection:
    """A connection between two nodes."""

    uuid: str
    source_node_id: str
    target_node_id: str
    source_port: str = ""  # Port name on source node
    target_port: str = ""  # Port name on target node

    @classmethod
    def create(
        cls,
        source_node_id: str,
        target_node_id: str,
        source_port: str = "",
        target_port: str = "",
    ) -> "Connection":
        """Create a new connection."""
        return cls(
            uuid=str(uuid_module.uuid4()),
            source_node_id=source_node_id,
            target_node_id=target_node_id,
            source_port=source_port,
            target_port=target_port,
        )


@dataclass
class Workflow:
    """A complete workflow with nodes and connections."""

    name: str = "Untitled Workflow"
    description: str = ""
    nodes: list[NodeData] = field(default_factory=list)
    connections: list[Connection] = field(default_factory=list)

    def add_node(self, node: NodeData) -> None:
        """Add a node to the workflow."""
        self.nodes.append(node)

    def remove_node(self, node_id: str) -> None:
        """Remove a node and its connections from the workflow."""
        self.nodes = [n for n in self.nodes if n.uuid != node_id]
        self.connections = [c for c in self.connections if c.source_node_id != node_id and c.target_node_id != node_id]

    def add_connection(self, connection: Connection) -> None:
        """Add a connection to the workflow."""
        self.connections.append(connection)

    def remove_connection(self, connection_id: str) -> None:
        """Remove a connection from the workflow."""
        self.connections = [c for c in self.connections if c.uuid != connection_id]

    def get_node_by_id(self, node_id: str) -> NodeData | None:
        """Get a node by its UUID."""
        for node in self.nodes:
            if node.uuid == node_id:
                return node
        return None

    def to_dict(self) -> dict:
        """Convert workflow to a dictionary for JSON serialization."""
        return {
            "name": self.name,
            "description": self.description,
            "nodes": [
                {
                    "uuid": node.uuid,
                    "componentUuid": node.component.uuid,
                    "componentFile": node.component.file_path,
                    "protocolType": node.component.protocol_type,
                    "x": node.x,
                    "y": node.y,
                    "parameters": node.parameters,
                }
                for node in self.nodes
            ],
            "connections": [
                {
                    "uuid": conn.uuid,
                    "source": conn.source_node_id,
                    "target": conn.target_node_id,
                    "sourcePort": conn.source_port,
                    "targetPort": conn.target_port,
                }
                for conn in self.connections
            ],
        }

    def save_to_file(self, file_path: str) -> None:
        """Save workflow to a JSON file."""
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load_from_file(
        cls,
        file_path: str,
        component_lookup: dict[str, ComponentDefinition],
    ) -> "Workflow":
        """Load workflow from a JSON file.

        Args:
            file_path: Path to the workflow JSON file.
            component_lookup: Dict mapping component file paths to definitions.
        """
        with open(file_path, encoding="utf-8") as f:
            data = json.load(f)

        workflow = cls(
            name=data.get("name", "Untitled"),
            description=data.get("description", ""),
        )

        # Load nodes
        for node_data in data.get("nodes", []):
            component_file = node_data.get("componentFile", "")
            component = component_lookup.get(component_file)
            if component:
                node = NodeData(
                    uuid=node_data.get("uuid", str(uuid_module.uuid4())),
                    component=component,
                    x=node_data.get("x", 0),
                    y=node_data.get("y", 0),
                    parameters=node_data.get("parameters", {}),
                )
                workflow.add_node(node)

        # Load connections
        for conn_data in data.get("connections", []):
            connection = Connection(
                uuid=conn_data.get("uuid", str(uuid_module.uuid4())),
                source_node_id=conn_data.get("source", ""),
                target_node_id=conn_data.get("target", ""),
                source_port=conn_data.get("sourcePort", ""),
                target_port=conn_data.get("targetPort", ""),
            )
            workflow.add_connection(connection)

        return workflow
