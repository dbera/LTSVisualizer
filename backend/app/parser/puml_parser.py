import html
import json
import re
from pathlib import Path

from app.models.graph_model import Edge, Node, ReachabilityGraph
from app.parser.token_parser import (
    parse_marking,
    parse_transition_inputs,
)

EDGE_PATTERN = re.compile(
    r"^\((?P<source>[^)]+)\)"
    r"\s*"
    r"(?P<arrow>.+?>)"
    r"\s*"
    r"\((?P<target>[^)]+)\)"
    r"\s*:\s*"
    r"(?P<transition>.+?)\s*$"
)

COLOR_PATTERN = re.compile(r"\[#(?P<color>[^\]]+)]")


def read_puml_file(file_path: str) -> str:
    """Read and return the complete contents of a PlantUML file."""
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"PlantUML file not found: {file_path}")

    if path.suffix.lower() != ".puml":
        raise ValueError(f"Expected a .puml file, received: {path.suffix}")

    return path.read_text(encoding="utf-8")


def parse_puml(content: str) -> ReachabilityGraph:
    """Parse nodes and edges from PlantUML reachability-graph content."""

    nodes_by_id: dict[str, Node] = {}
    edges: list[Edge] = []

    pending_inputs: str | None = None
    pending_marking: str | None = None
    last_target: str | None = None

    # Convert HTML entities such as &gt; into normal characters.
    decoded_content = html.unescape(content)

    for original_line in decoded_content.splitlines():
        line = original_line.strip()

        if not line:
            continue

        if line.startswith("'Transition Inputs:"):
            pending_inputs = line.removeprefix(
                "'Transition Inputs:"
            ).strip()

            continue

        if line.startswith("'Marking (State):"):
            pending_marking = line.removeprefix(
                "'Marking (State):"
            ).strip()

            continue

        edge_match = EDGE_PATTERN.match(line)

        if edge_match is None:
            continue

        source = edge_match.group("source").strip()
        target = edge_match.group("target").strip()
        transition = edge_match.group("transition").strip()
        arrow = edge_match.group("arrow")

        color_match = COLOR_PATTERN.search(arrow)

        if color_match:
            color = color_match.group("color")
        else:
            color = None

        if source not in nodes_by_id:
            nodes_by_id[source] = Node(
                id=source,
                marking_raw=pending_marking,
                marking=parse_marking(pending_marking),
            )
        elif pending_marking is not None:
            nodes_by_id[source].marking_raw = pending_marking
            nodes_by_id[source].marking = parse_marking(pending_marking)

        if target not in nodes_by_id:
            nodes_by_id[target] = Node(id=target)

        edge_id = f"edge-{len(edges)}"

        edge = Edge(
            id=edge_id,
            source=source,
            target=target,
            transition=transition,
            color=color,
            inputs_raw=pending_inputs,
            inputs=parse_transition_inputs(pending_inputs),
        )

        edges.append(edge)
        last_target = target

        # These comments belong only to the edge just processed.
        pending_inputs = None
        pending_marking = None

    # A terminal state has no outgoing edge. Its marking may therefore
    # appear after the final edge in the PlantUML file.
    if pending_marking is not None and last_target is not None:
        nodes_by_id[last_target].marking_raw = pending_marking
        nodes_by_id[last_target].marking = parse_marking(pending_marking)

    return ReachabilityGraph(
        nodes=list(nodes_by_id.values()),
        edges=edges,
    )


def parse_puml_file(file_path: str) -> ReachabilityGraph:
    """Read and parse a PlantUML reachability-graph file."""
    content = read_puml_file(file_path)
    return parse_puml(content)


def write_graph_json(
    graph: ReachabilityGraph,
    output_path: str,
) -> None:
    """Write the parsed graph to a formatted JSON file."""
    path = Path(output_path)

    path.write_text(
        json.dumps(
            graph.to_dict(),
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    graph = parse_puml_file("../sample-data/example.puml")

    write_graph_json(
        graph,
        "../sample-data/example.json",
    )

    print(f"Parsed nodes: {len(graph.nodes)}")
    print(f"Parsed edges: {len(graph.edges)}")
    print("Created: ../sample-data/example.json")