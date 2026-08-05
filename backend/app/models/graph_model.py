from dataclasses import asdict, dataclass
from typing import Any, Optional


@dataclass
class Node:
    id: str
    marking_raw: Optional[str] = None
    marking: Optional[dict[str, list[Any]]] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Edge:
    id: str
    source: str
    target: str
    transition: str
    color: Optional[str] = None
    inputs_raw: Optional[str] = None
    inputs: Optional[dict[str, Any]] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ReachabilityGraph:
    nodes: list[Node]
    edges: list[Edge]

    def to_dict(self) -> dict:
        return {
            "nodes": [node.to_dict() for node in self.nodes],
            "edges": [edge.to_dict() for edge in self.edges],
        }