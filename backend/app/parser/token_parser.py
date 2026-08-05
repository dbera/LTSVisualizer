import json


def split_top_level(text, delimiter=","):
    parts = []
    current = []

    depth = 0
    in_single_quote = False
    in_double_quote = False
    escaped = False

    for character in text:
        if escaped:
            current.append(character)
            escaped = False
            continue

        if character == "\\":
            current.append(character)
            escaped = True
            continue

        if character == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
            current.append(character)
            continue

        if character == '"' and not in_single_quote:
            in_double_quote = not in_double_quote
            current.append(character)
            continue

        if not in_single_quote and not in_double_quote:
            if character in "{[(":
                depth += 1
            elif character in "}])":
                depth -= 1

            if character == delimiter and depth == 0:
                parts.append("".join(current).strip())
                current = []
                continue

        current.append(character)

    if current:
        parts.append("".join(current).strip())

    return [part for part in parts if part]


def find_top_level_separator(text, separator):
    depth = 0
    in_single_quote = False
    in_double_quote = False
    escaped = False
    index = 0

    while index < len(text):
        character = text[index]

        if escaped:
            escaped = False
            index += 1
            continue

        if character == "\\":
            escaped = True
            index += 1
            continue

        if character == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
            index += 1
            continue

        if character == '"' and not in_single_quote:
            in_double_quote = not in_double_quote
            index += 1
            continue

        if not in_single_quote and not in_double_quote:
            if character in "{[(":
                depth += 1
            elif character in "}])":
                depth -= 1

            if depth == 0 and text.startswith(separator, index):
                return index

        index += 1

    return -1


def parse_json_token(value):
    value = value.strip()

    if value.startswith("'") and value.endswith("'"):
        value = value[1:-1]

    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def parse_token_collection(value):
    value = value.strip()

    if value.startswith("{") and value.endswith("}"):
        value = value[1:-1].strip()

    if not value:
        return []

    tokens = split_top_level(value)

    return [
        parse_json_token(token)
        for token in tokens
    ]


def parse_marking(raw):
    if raw is None:
        return None

    text = raw.strip()

    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1].strip()

    result = {}

    for entry in split_top_level(text):
        separator_index = find_top_level_separator(entry, "=")

        if separator_index == -1:
            continue

        place = entry[:separator_index].strip()
        value = entry[separator_index + 1:].strip()

        result[place] = parse_token_collection(value)

    return result


def parse_transition_inputs(raw):
    if raw is None:
        return None

    text = raw.strip()

    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1].strip()

    result = {}

    for entry in split_top_level(text):
        separator_index = find_top_level_separator(entry, "->")

        if separator_index == -1:
            continue

        variable = entry[:separator_index].strip()
        value = entry[separator_index + 2:].strip()

        result[variable] = parse_json_token(value)

    return result