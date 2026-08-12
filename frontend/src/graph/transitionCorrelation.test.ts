import { describe, expect, it } from "vitest";

import {
  captureActivationValues,
  evaluateCorrelationCondition,
  validateCaptureDefinitions,
  validateCorrelationCondition,
  type CorrelationCondition,
} from "./transitionCorrelation";

const activation = {
  inputs: {
    request: {
      id: 42,
      priority: 7,
      amount: 100,
    },
  },
};

const target = {
  outputs: {
    completed: [
      { id: 12, status: "queued", amount: 125 },
      { id: 42, status: "ok", amount: 80 },
    ],
  },
};

describe("captureActivationValues", () => {
  it("captures referenced activation values under readable aliases", () => {
    expect(
      captureActivationValues(
        [
          {
            alias: "request_id",
            source: "inputs",
            path: ["request", "id"],
          },
          {
            alias: "request_amount",
            source: "inputs",
            path: ["request", "amount"],
          },
        ],
        activation,
      ),
    ).toEqual({
      bindings: {
        request_id: 42,
        request_amount: 100,
      },
      errors: [],
    });
  });

  it("rejects invalid and duplicate aliases", () => {
    expect(
      validateCaptureDefinitions([
        { alias: "1bad", source: "inputs", path: [] },
        { alias: "valid", source: "inputs", path: [] },
        { alias: "valid", source: "outputs", path: [] },
      ]),
    ).toEqual([
      "captures[0].alias must start with a letter or underscore and contain only letters, numbers, and underscores.",
      "Duplicate capture alias: $valid.",
    ]);
  });

  it("fails clearly when a capture path is missing", () => {
    expect(
      captureActivationValues(
        [
          {
            alias: "missing_id",
            source: "inputs",
            path: ["request", "missing"],
          },
        ],
        activation,
      ),
    ).toEqual({
      bindings: {},
      errors: ["Capture $missing_id could not resolve its data path."],
    });
  });
});

describe("evaluateCorrelationCondition", () => {
  const bindings = {
    request_id: 42,
    request_amount: 100,
  };

  it("compares a target field with a captured activation value", () => {
    const condition: CorrelationCondition = {
      type: "comparison",
      left: {
        kind: "target",
        source: "outputs",
        path: ["completed", 1, "id"],
      },
      operator: "=",
      right: { kind: "activation", alias: "request_id" },
    };

    expect(evaluateCorrelationCondition(condition, target, bindings)).toEqual({
      matches: true,
      errors: [],
    });
  });

  it("supports correlated array item matching", () => {
    const condition: CorrelationCondition = {
      type: "contains-item",
      source: "outputs",
      path: ["completed"],
      condition: {
        type: "group",
        operator: "and",
        conditions: [
          {
            type: "comparison",
            left: { kind: "item", path: ["id"] },
            operator: "=",
            right: { kind: "activation", alias: "request_id" },
          },
          {
            type: "comparison",
            left: { kind: "item", path: ["status"] },
            operator: "=",
            right: { kind: "literal", value: "ok" },
          },
          {
            type: "comparison",
            left: { kind: "item", path: ["amount"] },
            operator: "<",
            right: {
              kind: "activation",
              alias: "request_amount",
            },
          },
        ],
      },
    };

    expect(evaluateCorrelationCondition(condition, target, bindings).matches).toBe(
      true,
    );
  });

  it("evaluates each pending activation independently", () => {
    const condition: CorrelationCondition = {
      type: "contains-item",
      source: "outputs",
      path: ["completed"],
      condition: {
        type: "comparison",
        left: { kind: "item", path: ["id"] },
        operator: "=",
        right: { kind: "activation", alias: "request_id" },
      },
    };

    expect(
      evaluateCorrelationCondition(condition, target, { request_id: 42 }).matches,
    ).toBe(true);
    expect(
      evaluateCorrelationCondition(condition, target, { request_id: 57 }).matches,
    ).toBe(false);
  });

  it("supports nested AND and OR correlation expressions", () => {
    const condition: CorrelationCondition = {
      type: "group",
      operator: "or",
      conditions: [
        {
          type: "comparison",
          left: { kind: "target", source: "outputs", path: ["missing"] },
          operator: "=",
          right: { kind: "literal", value: true },
        },
        {
          type: "contains-item",
          source: "outputs",
          path: ["completed"],
          condition: {
            type: "comparison",
            left: { kind: "item", path: ["id"] },
            operator: "=",
            right: { kind: "activation", alias: "request_id" },
          },
        },
      ],
    };

    expect(evaluateCorrelationCondition(condition, target, bindings).matches).toBe(
      true,
    );
  });

  it("distinguishes missing target values from null values", () => {
    const targetWithNull = { outputs: { result: null } };
    const exists: CorrelationCondition = {
      type: "reference-exists",
      reference: { kind: "target", source: "outputs", path: ["result"] },
      exists: true,
    };
    const missing: CorrelationCondition = {
      type: "reference-exists",
      reference: { kind: "target", source: "outputs", path: ["missing"] },
      exists: false,
    };

    expect(
      evaluateCorrelationCondition(exists, targetWithNull, bindings).matches,
    ).toBe(true);
    expect(
      evaluateCorrelationCondition(missing, targetWithNull, bindings).matches,
    ).toBe(true);
  });

  it("rejects unknown aliases and item references outside arrays", () => {
    const unknownAlias: CorrelationCondition = {
      type: "comparison",
      left: { kind: "target", source: "outputs", path: [] },
      operator: "=",
      right: { kind: "activation", alias: "unknown" },
    };
    const misplacedItem: CorrelationCondition = {
      type: "comparison",
      left: { kind: "item", path: ["id"] },
      operator: "=",
      right: { kind: "literal", value: 42 },
    };

    expect(validateCorrelationCondition(unknownAlias, ["request_id"])).toEqual([
      "correlation.right references unknown activation variable $unknown.",
    ]);
    expect(validateCorrelationCondition(misplacedItem, [])).toEqual([
      "correlation.left uses an item reference outside contains-item.",
    ]);
  });

  it("uses strict numeric comparisons without coercion", () => {
    const condition: CorrelationCondition = {
      type: "comparison",
      left: { kind: "activation", alias: "request_amount" },
      operator: ">",
      right: { kind: "literal", value: "80" },
    };

    expect(evaluateCorrelationCondition(condition, target, bindings).matches).toBe(
      false,
    );
  });
});

describe("stable scalar correlation aliases", () => {
  it("binds a scalar under a stable ID and resolves it after a display-name rename", () => {
    const capture = captureActivationValues(
      [{ id: "alias_order_id", alias: "renamedOrderId", source: "inputs", path: ["order", "id"] }],
      { inputs: { order: { id: 42 } } },
    );
    expect(capture).toEqual({ bindings: { alias_order_id: 42 }, errors: [] });
    expect(
      evaluateCorrelationCondition(
        {
          type: "comparison",
          left: { kind: "target", source: "outputs", path: ["completed", "id"] },
          operator: "=",
          right: { kind: "activation", aliasId: "alias_order_id" },
        },
        { outputs: { completed: { id: 42 } } },
        capture.bindings,
      ),
    ).toEqual({ matches: true, errors: [] });
  });

  it("rejects object and array capture values for scalar aliases", () => {
    const definitions = [
      { id: "alias_order", alias: "order", source: "inputs" as const, path: ["order"] },
      { id: "alias_ids", alias: "ids", source: "inputs" as const, path: ["ids"] },
    ];
    const result = captureActivationValues(definitions, {
      inputs: { order: { id: 42 }, ids: [42, 99] },
    });
    expect(result.bindings).toEqual({});
    expect(result.errors).toEqual([
      "Capture $order must resolve to exactly one scalar value.",
      "Capture $ids must resolve to exactly one scalar value.",
    ]);
  });

  it("validates duplicate and malformed stable IDs", () => {
    expect(
      validateCaptureDefinitions([
        { id: "bad-id", alias: "first", source: "inputs", path: ["id"] },
        { id: "shared", alias: "second", source: "inputs", path: ["id"] },
        { id: "shared", alias: "third", source: "inputs", path: ["id"] },
      ]),
    ).toEqual([
      "captures[0].id must start with a letter or underscore and contain only letters, numbers, and underscores.",
      "Duplicate capture ID: shared.",
    ]);
  });
});
