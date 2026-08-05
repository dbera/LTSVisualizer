from app.parser.token_parser import (
    find_top_level_separator,
    parse_json_token,
    parse_marking,
    parse_token_collection,
    parse_transition_inputs,
    split_top_level,
)


def test_split_top_level_ignores_nested_commas():
    text = (
        "first={'{\"id\": 1, \"name\": \"A, B\"}'}, "
        "second={'{\"values\": [1, 2, 3]}'}, "
        "third={'{\"nested\": {\"enabled\": true}}'}"
    )

    assert split_top_level(text) == [
        "first={'{\"id\": 1, \"name\": \"A, B\"}'}",
        "second={'{\"values\": [1, 2, 3]}'}",
        "third={'{\"nested\": {\"enabled\": true}}'}",
    ]


def test_find_top_level_separator_ignores_nested_content():
    marking_entry = "place={'{\"expression\": \"left=right\"}'}"
    transition_entry = "variable -> '{\"text\": \"a -> b\"}'"

    assert find_top_level_separator(marking_entry, "=") == len("place")
    assert find_top_level_separator(transition_entry, "->") == len("variable ")


def test_parse_json_token_returns_structured_json():
    assert parse_json_token("'{\"id\": 7, \"enabled\": true}'") == {
        "id": 7,
        "enabled": True,
    }


def test_parse_json_token_preserves_non_json_value():
    assert parse_json_token("'not valid json'") == "not valid json"


def test_parse_multiple_tokens_in_collection():
    value = "{'{\"id\": 1}', '{\"id\": 2}'}"

    assert parse_token_collection(value) == [
        {"id": 1},
        {"id": 2},
    ]


def test_parse_empty_token_collection():
    assert parse_token_collection("{}") == []


def test_parse_nested_marking():
    raw = (
        "{input={'{\"request\": {\"id\": 3, \"colors\": [\"RED\", \"BLUE\"]}, "
        "\"description\": \"print, inspect\"}'}, "
        "ctx={'{\"id\": 3}'}}"
    )

    assert parse_marking(raw) == {
        "input": [
            {
                "request": {
                    "id": 3,
                    "colors": ["RED", "BLUE"],
                },
                "description": "print, inspect",
            }
        ],
        "ctx": [{"id": 3}],
    }


def test_parse_marking_with_multiple_tokens_in_one_place():
    raw = "{buffer={'{\"id\": 1}', '{\"id\": 2}'}}"

    assert parse_marking(raw) == {
        "buffer": [
            {"id": 1},
            {"id": 2},
        ]
    }


def test_parse_transition_inputs():
    raw = (
        "{v_request -> '{\"id\": 5, \"payload\": {\"value\": 12}}', "
        "v_context -> '{\"active\": true}'}"
    )

    assert parse_transition_inputs(raw) == {
        "v_request": {
            "id": 5,
            "payload": {"value": 12},
        },
        "v_context": {"active": True},
    }


def test_none_inputs_return_none():
    assert parse_marking(None) is None
    assert parse_transition_inputs(None) is None
