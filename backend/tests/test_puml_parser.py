from app.parser.puml_parser import parse_puml


def test_parse_small_reachability_graph():
    content = """@startuml
'Transition Inputs: {v_p0 -> '{\"unit\": 0}'}
'Marking (State): {p0={'{\"unit\": 0}'}}
(0) --> (1): StartTransition
'Transition Inputs: {v_p1 -> '{\"id\": 1}'}
'Marking (State): {ctx={'{\"id\": 1}'}, p1={'{\"unit\": 0}'}}
(1) -[#darkorange]-> (2): ColoredTransition
'Marking (State): {done={'{\"value\": true}'}}
title State space: 3 nodes and 2 edges
@enduml
"""

    graph = parse_puml(content)

    assert len(graph.nodes) == 3
    assert len(graph.edges) == 2

    nodes_by_id = {node.id: node for node in graph.nodes}

    assert set(nodes_by_id) == {"0", "1", "2"}

    assert nodes_by_id["0"].marking == {
        "p0": [{"unit": 0}],
    }

    assert nodes_by_id["1"].marking == {
        "ctx": [{"id": 1}],
        "p1": [{"unit": 0}],
    }

    assert nodes_by_id["2"].marking == {
        "done": [{"value": True}],
    }

    first_edge = graph.edges[0]

    assert first_edge.id == "edge-0"
    assert first_edge.source == "0"
    assert first_edge.target == "1"
    assert first_edge.transition == "StartTransition"
    assert first_edge.color is None
    assert first_edge.inputs == {
        "v_p0": {"unit": 0},
    }

    second_edge = graph.edges[1]

    assert second_edge.id == "edge-1"
    assert second_edge.source == "1"
    assert second_edge.target == "2"
    assert second_edge.transition == "ColoredTransition"
    assert second_edge.color == "darkorange"
    assert second_edge.inputs == {
        "v_p1": {"id": 1},
    }


def test_parse_html_escaped_arrows():
    content = """@startuml
(10) --&gt; (11): PlainEscapedArrow
(11) -[#darkorange]-&gt; (12): ColoredEscapedArrow
@enduml
"""

    graph = parse_puml(content)

    assert len(graph.nodes) == 3
    assert len(graph.edges) == 2

    assert graph.edges[0].source == "10"
    assert graph.edges[0].target == "11"
    assert graph.edges[0].transition == "PlainEscapedArrow"
    assert graph.edges[0].color is None

    assert graph.edges[1].source == "11"
    assert graph.edges[1].target == "12"
    assert graph.edges[1].transition == "ColoredEscapedArrow"
    assert graph.edges[1].color == "darkorange"


def test_parse_graph_without_semantic_comments():
    content = """@startuml
(0) --> (1): First
(1) --> (2): Second
@enduml
"""

    graph = parse_puml(content)

    assert len(graph.nodes) == 3
    assert len(graph.edges) == 2

    assert all(node.marking is None for node in graph.nodes)
    assert all(node.marking_raw is None for node in graph.nodes)
    assert all(edge.inputs is None for edge in graph.edges)
    assert all(edge.inputs_raw is None for edge in graph.edges)
