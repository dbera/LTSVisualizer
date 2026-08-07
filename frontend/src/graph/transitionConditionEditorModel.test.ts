import { describe, expect, it } from "vitest";
import {
  countArrayLevels,
  createDefaultArrayAccesses,
  createFlatTransitionCondition,
  createValueCondition,
  formatConfiguredPath,
  inferConditionValueType,
  parseConditionValue,
  readFlatTransitionConditions,
  type FlatTransitionCondition,
} from "./transitionConditionEditorModel";

function flat(overrides: Partial<FlatTransitionCondition> = {}): FlatTransitionCondition {
  return {
    source: "outputs",
    path: ["matrix", "[]", "[]", "value"],
    arrayAccesses: [
      { mode: "contains-item" },
      { mode: "contains-item" },
    ],
    operator: "=",
    value: 42,
    ...overrides,
  };
}

describe("transition condition editor model", () => {
  it("creates and reads ordinary source comparisons", () => {
    const item = flat({ source: "inputs", path: ["request", "priority"], arrayAccesses: [], operator: ">=", value: 5 });
    const condition = createFlatTransitionCondition([item]);
    expect(condition).toEqual({ type: "source", source: "inputs", condition: { type: "comparison", path: ["request", "priority"], operator: ">=", value: 5 } });
    expect(readFlatTransitionConditions(condition)).toEqual([item]);
  });

  it("supports arbitrary all-indexed array depth", () => {
    const item = flat({
      path: ["tensor", "[]", "[]", "[]", "value"],
      arrayAccesses: [
        { mode: "indexed-item", index: 1 },
        { mode: "indexed-item", index: 2 },
        { mode: "indexed-item", index: 3 },
      ],
    });
    expect(createValueCondition(item)).toEqual({ type: "comparison", path: ["tensor", 1, 2, 3, "value"], operator: "=", value: 42 });
    expect(readFlatTransitionConditions(createFlatTransitionCondition([item]))).toEqual([item]);
  });

  it("supports arbitrary all-existential array depth", () => {
    const item = flat({ path: ["tensor", "[]", "[]", "[]", "value"], arrayAccesses: [
      { mode: "contains-item" }, { mode: "contains-item" }, { mode: "contains-item" },
    ] });
    expect(createValueCondition(item)).toEqual({
      type: "contains-item", path: ["tensor"], condition: {
        type: "contains-item", path: [], condition: {
          type: "contains-item", path: [], condition: {
            type: "comparison", path: ["value"], operator: "=", value: 42,
          },
        },
      },
    });
    expect(readFlatTransitionConditions(createFlatTransitionCondition([item]))).toEqual([item]);
  });

  it("supports mixed indexed and existential levels", () => {
    const item = flat({ path: ["tensor", "[]", "rows", "[]", "[]", "value"], arrayAccesses: [
      { mode: "indexed-item", index: 2 },
      { mode: "contains-item" },
      { mode: "indexed-item", index: 4 },
    ] });
    expect(createValueCondition(item)).toEqual({
      type: "contains-item", path: ["tensor", 2, "rows"], condition: {
        type: "comparison", path: [4, "value"], operator: "=", value: 42,
      },
    });
    expect(readFlatTransitionConditions(createFlatTransitionCondition([item]))).toEqual([item]);
  });

  it("supports arrays of primitive values", () => {
    const item = flat({ path: ["values", "[]"], arrayAccesses: [{ mode: "contains-item" }], value: "ready" });
    expect(createValueCondition(item)).toEqual({ type: "contains-item", path: ["values"], condition: { type: "comparison", path: [], operator: "=", value: "ready" } });
  });

  it("counts levels, creates defaults, and formats mixed paths", () => {
    const path = ["tensor", "[]", "rows", "[]", "value"] as const;
    expect(countArrayLevels(path)).toBe(2);
    expect(createDefaultArrayAccesses(path)).toEqual([{ mode: "contains-item" }, { mode: "contains-item" }]);
    expect(formatConfiguredPath("outputs", path, [{ mode: "indexed-item", index: 2 }, { mode: "contains-item" }])).toBe("outputs.tensor[2].rows[*].value");
  });

  it("rejects incomplete or invalid array-level configuration", () => {
    expect(() => createValueCondition(flat({ arrayAccesses: [{ mode: "contains-item" }] }))).toThrow("Configure all 2 array levels.");
    expect(() => createValueCondition(flat({ arrayAccesses: [{ mode: "indexed-item", index: -1 }, { mode: "contains-item" }] }))).toThrow("Enter a non-negative array index.");
  });

  it("creates a flat AND group and rejects unsupported OR groups", () => {
    const condition = createFlatTransitionCondition([flat(), flat({ path: ["status"], arrayAccesses: [], value: "ok" })]);
    expect(condition).toMatchObject({ type: "group", operator: "and" });
    expect(readFlatTransitionConditions({ type: "group", operator: "or", conditions: [] })).toBeNull();
  });

  it("parses strict typed values and infers scalar types", () => {
    expect(parseConditionValue("string", "42")).toBe("42");
    expect(parseConditionValue("number", "42")).toBe(42);
    expect(parseConditionValue("boolean", "true")).toBe(true);
    expect(parseConditionValue("null", "ignored")).toBeNull();
    expect(() => parseConditionValue("number", "abc")).toThrow("Enter a valid number.");
    expect(inferConditionValueType(["number"])).toBe("number");
    expect(inferConditionValueType(["object"])).toBe("string");
  });

  it("creates empty condition lists as undefined", () => {
    expect(createFlatTransitionCondition([])).toBeUndefined();
    expect(readFlatTransitionConditions(undefined)).toEqual([]);
  });

  it.each(["exists", "does-not-exist"] as const)(
    "round-trips %s without a value",
    (operator) => {
      const item = flat({
        path: ["matrix", "[]", "status"],
        arrayAccesses: [{ mode: "indexed-item", index: 3 }],
        operator,
        value: "discarded",
      });
      const condition = createFlatTransitionCondition([item]);
      expect(condition).toEqual({
        type: "source",
        source: "outputs",
        condition: {
          type: "comparison",
          path: ["matrix", 3, "status"],
          operator,
        },
      });
      const { value: _discarded, ...expected } = item;
      expect(readFlatTransitionConditions(condition)).toEqual([expected]);
    },
  );

  it("preserves mixed sources and repeated fields in one AND group", () => {
    const items = [
      flat({
        source: "inputs",
        path: ["request", "status"],
        arrayAccesses: [],
        value: "ready",
      }),
      flat({
        source: "outputs",
        path: ["request", "status"],
        arrayAccesses: [],
        operator: "!=",
        value: "blocked",
      }),
      flat({
        source: "outputs",
        path: ["request", "status"],
        arrayAccesses: [],
        operator: "exists",
        value: undefined,
      }),
    ];
    expect(readFlatTransitionConditions(createFlatTransitionCondition(items))).toEqual(items);
  });

  it("round-trips mixed traversal through every multidimensional path level", () => {
    const item = flat({
      path: ["tensor", "[]", "rows", "[]", "cells", "[]", "value"],
      arrayAccesses: [
        { mode: "contains-item" },
        { mode: "indexed-item", index: 4 },
        { mode: "contains-item" },
      ],
      operator: ">=",
      value: 9,
    });
    expect(readFlatTransitionConditions(createFlatTransitionCondition([item]))).toEqual([item]);
  });

  it("parses all supported primitive values", () => {
    expect(parseConditionValue("string", "false")).toBe("false");
    expect(parseConditionValue("number", "-12.5")).toBe(-12.5);
    expect(parseConditionValue("boolean", "false")).toBe(false);
    expect(parseConditionValue("null", "anything")).toBeNull();
    expect(() => parseConditionValue("boolean", "yes")).toThrow("Choose true or false.");
  });

});
