import { describe, expect, it } from "vitest";
import { describeDataPath, evaluateTransitionCondition, matchesPartialObject, resolveDataPath, validateTransitionCondition, type TransitionCondition } from "./transitionConditions";

const transition = {
  inputs: { request: { id: 42, priority: 7, urgent: false, optional: null, type: "imaging" } },
  outputs: { completed: [{ id: 12, status: "queued" }, { id: 42, status: "ok", details: { duration: 15 } }], tensor: [[[1, 2], [3, 4]], [[5, 6], [7, 8]]], objectTensor: [[[{ code: "deep" }]]] },
};

function sourceCondition(source: "inputs" | "outputs", condition: Extract<TransitionCondition, { type: "source" }>["condition"]): TransitionCondition {
  return { type: "source", source, condition };
}

describe("resolveDataPath", () => {
  it("resolves nested object properties and zero-based array indexes", () => {
    expect(resolveDataPath(transition.outputs, ["completed", 1, "id"])).toEqual({ found: true, value: 42 });
  });
  it("treats negative, out-of-range, and non-array indexes as missing", () => {
    expect(resolveDataPath(transition.outputs, ["completed", 7])).toEqual({ found: false, value: undefined });
    expect(resolveDataPath(transition.outputs, ["completed", -1])).toEqual({ found: false, value: undefined });
    expect(resolveDataPath(transition.inputs, ["request", 0])).toEqual({ found: false, value: undefined });
  });
  it("distinguishes a missing field from an existing null value", () => {
    expect(resolveDataPath(transition.inputs, ["request", "optional"])).toEqual({ found: true, value: null });
    expect(resolveDataPath(transition.inputs, ["request", "missing"])).toEqual({ found: false, value: undefined });
  });
  it("formats indexed paths for explanations", () => {
    expect(describeDataPath("outputs", ["completed", 1, "id"])).toBe("outputs.completed[1].id");
  });
});

describe("matchesPartialObject", () => {
  it("matches a recursive object subset while allowing additional fields", () => {
    expect(matchesPartialObject(transition.inputs.request, { id: 42 })).toBe(true);
    expect(matchesPartialObject(transition.outputs.completed[1], { details: { duration: 15 } })).toBe(true);
  });
  it("uses exact semantics for arrays inside partial objects", () => {
    expect(matchesPartialObject({ values: [1, 2], extra: true }, { values: [1, 2] })).toBe(true);
    expect(matchesPartialObject({ values: [1, 2, 3] }, { values: [1, 2] })).toBe(false);
  });
});

describe("evaluateTransitionCondition", () => {
  it("supports strict equality and numeric ordering without coercion", () => {
    expect(evaluateTransitionCondition(sourceCondition("inputs", { type: "comparison", path: ["request", "id"], operator: "=", value: 42 }), transition).matches).toBe(true);
    expect(evaluateTransitionCondition(sourceCondition("inputs", { type: "comparison", path: ["request", "id"], operator: "=", value: "42" }), transition).matches).toBe(false);
    expect(evaluateTransitionCondition(sourceCondition("inputs", { type: "comparison", path: ["request", "priority"], operator: ">=", value: 7 }), transition).matches).toBe(true);
  });
  it("supports indexed equality and existence", () => {
    expect(evaluateTransitionCondition(sourceCondition("outputs", { type: "comparison", path: ["completed", 1, "status"], operator: "=", value: "ok" }), transition).matches).toBe(true);
    expect(evaluateTransitionCondition(sourceCondition("outputs", { type: "comparison", path: ["completed", 2], operator: "does-not-exist" }), transition).matches).toBe(true);
    expect(evaluateTransitionCondition(sourceCondition("outputs", { type: "comparison", path: ["completed", 1], operator: "exists" }), transition).matches).toBe(true);
  });
  it("supports exists without confusing null and missing", () => {
    expect(evaluateTransitionCondition(sourceCondition("inputs", { type: "comparison", path: ["request", "optional"], operator: "exists" }), transition).matches).toBe(true);
    expect(evaluateTransitionCondition(sourceCondition("inputs", { type: "comparison", path: ["request", "missing"], operator: "does-not-exist" }), transition).matches).toBe(true);
  });
  it("supports partial object matching", () => {
    expect(evaluateTransitionCondition(sourceCondition("inputs", { type: "partial-object", path: ["request"], value: { priority: 7, type: "imaging" } }), transition).matches).toBe(true);
  });
  it("supports nested AND and OR across inputs and outputs", () => {
    const condition: TransitionCondition = { type: "group", operator: "and", conditions: [
      sourceCondition("inputs", { type: "group", operator: "or", conditions: [
        { type: "comparison", path: ["request", "priority"], operator: ">=", value: 10 },
        { type: "comparison", path: ["request", "type"], operator: "=", value: "imaging" },
      ] }),
      sourceCondition("outputs", { type: "contains-item", path: ["completed"], condition: { type: "comparison", path: ["status"], operator: "=", value: "ok" } }),
    ] };
    expect(evaluateTransitionCondition(condition, transition).matches).toBe(true);
  });
  it("supports contains-item with nested conditions relative to each item", () => {
    const condition = sourceCondition("outputs", { type: "contains-item", path: ["completed"], condition: { type: "group", operator: "and", conditions: [
      { type: "comparison", path: ["id"], operator: "=", value: 42 },
      { type: "comparison", path: ["status"], operator: "=", value: "ok" },
      { type: "comparison", path: ["details", "duration"], operator: "<=", value: 20 },
    ] } });
    expect(evaluateTransitionCondition(condition, transition)).toEqual({ matches: true, errors: [] });
  });
  it("supports arbitrary-depth indexed array paths", () => {
    expect(evaluateTransitionCondition(sourceCondition("outputs", { type: "comparison", path: ["tensor", 1, 0, 1], operator: "=", value: 6 }), transition).matches).toBe(true);
    expect(evaluateTransitionCondition(sourceCondition("outputs", { type: "comparison", path: ["tensor", 1, 0, 2], operator: "does-not-exist" }), transition).matches).toBe(true);
  });
  it("supports arbitrary-depth nested contains-item conditions", () => {
    const condition = sourceCondition("outputs", {
      type: "contains-item", path: ["objectTensor"], condition: {
        type: "contains-item", path: [], condition: {
          type: "contains-item", path: [], condition: {
            type: "comparison", path: ["code"], operator: "=", value: "deep",
          },
        },
      },
    });
    expect(evaluateTransitionCondition(condition, transition).matches).toBe(true);
  });
  it("supports mixed indexed and contains-item array levels", () => {
    const condition = sourceCondition("outputs", {
      type: "contains-item", path: ["tensor", 1], condition: {
        type: "comparison", path: [1], operator: "=", value: 8,
      },
    });
    expect(evaluateTransitionCondition(condition, transition).matches).toBe(true);
  });
  it("returns validation errors instead of evaluating malformed conditions", () => {
    const missingValue = sourceCondition("inputs", { type: "comparison", path: ["request", "id"], operator: "=" });
    expect(validateTransitionCondition(missingValue)).toEqual(["inputs requires a comparison value."]);
    expect(evaluateTransitionCondition(missingValue, transition).matches).toBe(false);
  });
});
