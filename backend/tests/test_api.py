from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "message": "Reachability Graph Dashboard API is running"
    }


def test_upload_valid_puml_file():
    content = b"""@startuml
'Transition Inputs: {v_p0 -> '{\"unit\": 0}'}
'Marking (State): {p0={'{\"unit\": 0}'}}
(0) --> (1): StartTransition
'Marking (State): {done={'{\"value\": true}'}}
@enduml
"""

    response = client.post(
        "/graph/upload",
        files={
            "file": (
                "example.puml",
                content,
                "text/plain",
            )
        },
    )

    assert response.status_code == 200

    graph = response.json()

    assert len(graph["nodes"]) == 2
    assert len(graph["edges"]) == 1

    nodes_by_id = {node["id"]: node for node in graph["nodes"]}

    assert nodes_by_id["0"]["marking"] == {
        "p0": [{"unit": 0}],
    }
    assert nodes_by_id["1"]["marking"] == {
        "done": [{"value": True}],
    }

    edge = graph["edges"][0]

    assert edge["source"] == "0"
    assert edge["target"] == "1"
    assert edge["transition"] == "StartTransition"
    assert edge["inputs"] == {
        "v_p0": {"unit": 0},
    }


def test_upload_valid_plantuml_extension():
    content = b"""@startuml
(10) --> (11): ExampleTransition
@enduml
"""

    response = client.post(
        "/graph/upload",
        files={
            "file": (
                "example.plantuml",
                content,
                "text/plain",
            )
        },
    )

    assert response.status_code == 200
    assert len(response.json()["nodes"]) == 2
    assert len(response.json()["edges"]) == 1


def test_upload_rejects_unsupported_extension():
    response = client.post(
        "/graph/upload",
        files={
            "file": (
                "example.json",
                b'{"not": "plantuml"}',
                "application/json",
            )
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Please select a .puml or .plantuml file."
    }


def test_upload_rejects_file_without_startuml():
    content = b"""(0) --> (1): MissingStartDirective
"""

    response = client.post(
        "/graph/upload",
        files={
            "file": (
                "invalid.puml",
                content,
                "text/plain",
            )
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "The selected file does not contain @startuml."
    }


def test_upload_rejects_invalid_utf8():
    response = client.post(
        "/graph/upload",
        files={
            "file": (
                "invalid.puml",
                b"@startuml\xff\xfe@enduml",
                "text/plain",
            )
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "The selected file is not valid UTF-8 text."
    }


def test_upload_rejects_plantuml_without_graph_nodes():
    content = b"""@startuml
title Empty graph
@enduml
"""

    response = client.post(
        "/graph/upload",
        files={
            "file": (
                "empty.puml",
                content,
                "text/plain",
            )
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "No graph nodes were found in the selected file."
    }


def test_upload_requires_file_field():
    response = client.post("/graph/upload")

    assert response.status_code == 422
