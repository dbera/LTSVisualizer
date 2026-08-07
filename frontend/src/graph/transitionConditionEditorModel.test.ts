import { describe, expect, it } from "vitest";

import {
  createFlatTransitionCondition,
  inferConditionValueType,
  parseConditionValue,
  readFlatTransitionConditions,
} from "./transitionConditionEditorModel";

describe("transition condition editor model", () => {
  it("creates one source comparison", () => {
    expect(
      createFlatTransitionCondition([
        {
          source: "inputs",
          path: ["request", "priority"],
          operator: ">=",
          value: 5,
        },
      ]),
    ).toEqual({
      type: "source",
      source: "inputs",
      condition: {
        type: "comparison",
        path: ["request", "priority"],
        operator: ">=",
        value: 5,
      },
    });
  });

  it("creates a flat AND group for multiple comparisons", () => {
    const condition = createFlatTransitionCondition([
      {
        source: "inputs",
        path: ["request", "priority"],
        operator: ">=",
        value: 5,
      },
      {
        source: "outputs",
        path: ["status"],
        operator: "exists",
      },
    ]);

    expect(condition).toMatchObject({
      type: "group",
      operator: "and",
    });
    expect(readFlatTransitionConditions(condition)).toHaveLength(2);
  });

  it("returns undefined for no comparisons", () => {
    expect(createFlatTransitionCondition([])).toBeUndefined();
  });

  it("does not flatten unsupported nested OR conditions", () => {
    expect(
      readFlatTransitionConditions({
        type: "group",
        operator: "or",
        conditions: [
          {
            type: "source",
            source: "inputs",
            condition: {
              type: "comparison",
              path: ["ready"],
              operator: "=",
              value: true,
            },
          },
        ],
      }),
    ).toBeNull();
  });

  it("parses strict typed values", () => {
    expect(parseConditionValue("string", "42")).toBe("42");
    expect(parseConditionValue("number", "42")).toBe(42);
    expect(parseConditionValue("boolean", "true")).toBe(true);
    expect(parseConditionValue("null", "ignored")).toBeNull();
    expect(() => parseConditionValue("number", "abc")).toThrow(
      "Enter a valid number.",
    );
  });

  it("infers simple scalar types and falls back to string", () => {
    expect(inferConditionValueType(["number"])).toBe("number");
    expect(inferConditionValueType(["boolean"])).toBe("boolean");
    expect(inferConditionValueType(["object"])).toBe("string");
    expect(inferConditionValueType(["string", "null"])).toBe("string");
  });
});
