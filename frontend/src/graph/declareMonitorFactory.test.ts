import { describe, expect, it } from "vitest";

import {
  DECLARE_TEMPLATE_DEFINITIONS,
  type DeclareConstraint,
  type DeclarePredicateGroup,
  type DeclareTemplateId,
} from "./declareConstraints";
import {
  compileDeclareConstraints,
  createDeclareMonitor,
  validateExecutableDeclareConstraint,
} from "./declareMonitorFactory";

const group = (name: string): DeclarePredicateGroup => ({
  relation: "or",
  predicates: [
    { transition: { operator: "equals", value: name } },
  ],
});

function constraintFor(template: DeclareTemplateId): DeclareConstraint {
  const definition = DECLARE_TEMPLATE_DEFINITIONS.find(
    (candidate) => candidate.id === template,
  );
  if (!definition) {
    throw new Error(`Missing definition for ${template}.`);
  }

  return {
    id: `constraint-${template}`,
    template,
    enabled: true,
    activation: group("A"),
    target: definition.requiredRoles.includes("target")
      ? group("B")
      : undefined,
    count: definition.supportsCount ? 1 : undefined,
  };
}

describe("createDeclareMonitor", () => {
  it("creates an executable monitor for every registered template", () => {
    for (const definition of DECLARE_TEMPLATE_DEFINITIONS) {
      const monitor = createDeclareMonitor(constraintFor(definition.id));
      expect(monitor.initialState()).toBeDefined();
      expect(typeof monitor.advance).toBe("function");
      expect(typeof monitor.status).toBe("function");
      expect(typeof monitor.stateKey).toBe("function");
    }
  });

  it("creates a working cardinality monitor", () => {
    const monitor = createDeclareMonitor({
      id: "at-least-one-a",
      template: "at-least",
      enabled: true,
      activation: group("A"),
      count: 1,
    });
    const initial = monitor.initialState();
    const next = monitor.advance(initial, { transition: "A" });

    expect(monitor.status(initial).accepting).toBe(false);
    expect(monitor.status(next).accepting).toBe(true);
  });

  it("creates a working correlated response monitor", () => {
    const monitor = createDeclareMonitor({
      id: "same-request-response",
      template: "response",
      enabled: true,
      activation: {
        relation: "or",
        predicates: [
          {
            transition: { operator: "equals", value: "A" },
            captures: [
              { alias: "request_id", source: "inputs", path: ["id"] },
            ],
          },
        ],
      },
      target: group("B"),
      correlation: {
        type: "comparison",
        left: {
          kind: "target",
          source: "outputs",
          path: ["id"],
        },
        operator: "=",
        right: { kind: "activation", alias: "request_id" },
      },
    });

    const activated = monitor.advance(monitor.initialState(), {
      transition: "A",
      inputs: { id: 42 },
    });
    const wrongTarget = monitor.advance(activated, {
      transition: "B",
      outputs: { id: 57 },
    });
    const rightTarget = monitor.advance(wrongTarget, {
      transition: "B",
      outputs: { id: 42 },
    });

    expect(monitor.status(activated).accepting).toBe(false);
    expect(monitor.status(wrongTarget).accepting).toBe(false);
    expect(monitor.status(rightTarget).accepting).toBe(true);
  });

  it("rejects unknown correlation aliases before execution", () => {
    const constraint: DeclareConstraint = {
      id: "bad-correlation",
      template: "response",
      enabled: true,
      activation: group("A"),
      target: group("B"),
      correlation: {
        type: "comparison",
        left: { kind: "target", source: "outputs", path: ["id"] },
        operator: "=",
        right: { kind: "activation", alias: "missing" },
      },
    };

    expect(validateExecutableDeclareConstraint(constraint)).toContain(
      "correlation.right references unknown activation variable $missing.",
    );
    expect(() => createDeclareMonitor(constraint)).toThrow(
      "Declare constraint bad-correlation is invalid",
    );
  });

  it("validates duplicate aliases across activation predicates", () => {
    const constraint: DeclareConstraint = {
      id: "duplicate-alias",
      template: "response",
      enabled: true,
      activation: {
        relation: "or",
        predicates: [
          {
            transition: { operator: "equals", value: "A1" },
            captures: [{ alias: "id", source: "inputs", path: ["id"] }],
          },
          {
            transition: { operator: "equals", value: "A2" },
            captures: [{ alias: "id", source: "inputs", path: ["id"] }],
          },
        ],
      },
      target: group("B"),
    };

    expect(validateExecutableDeclareConstraint(constraint)).toContain(
      "Duplicate capture alias: $id.",
    );
  });
});

describe("compileDeclareConstraints", () => {
  it("compiles only enabled constraints and preserves order", () => {
    const result = compileDeclareConstraints([
      {
        id: "first",
        template: "at-least",
        enabled: true,
        activation: group("A"),
        count: 1,
      },
      {
        id: "disabled",
        template: "at-most",
        enabled: false,
        activation: group("B"),
        count: 1,
      },
      {
        id: "second",
        template: "init",
        enabled: true,
        activation: group("A"),
      },
    ]);

    expect(result.map((entry) => entry.id)).toEqual(["first", "second"]);
  });

  it("rejects duplicate enabled IDs", () => {
    expect(() =>
      compileDeclareConstraints([
        {
          id: "duplicate",
          template: "init",
          enabled: true,
          activation: group("A"),
        },
        {
          id: "duplicate",
          template: "end",
          enabled: true,
          activation: group("B"),
        },
      ]),
    ).toThrow("Duplicate enabled Declare constraint ID: duplicate.");
  });

  it("allows a disabled constraint to share an enabled ID", () => {
    expect(
      compileDeclareConstraints([
        {
          id: "same",
          template: "init",
          enabled: true,
          activation: group("A"),
        },
        {
          id: "same",
          template: "end",
          enabled: false,
          activation: group("B"),
        },
      ]),
    ).toHaveLength(1);
  });
});

describe("stable activation alias IDs", () => {
  const constraintWithStableAlias = (template: DeclareConstraint["template"]): DeclareConstraint => ({
    id: `stable-${template}`,
    template,
    enabled: true,
    activation: {
      relation: "or",
      predicates: [{
        transition: { operator: "equals", value: "A" },
        captures: [{
          id: "alias_order_id",
          alias: "renamedOrderId",
          source: "inputs",
          path: ["order", "id"],
        }],
      }],
    },
    target: {
      relation: "or",
      predicates: [{ transition: { operator: "equals", value: "B" } }],
    },
    correlation: {
      type: "comparison",
      left: { kind: "target", source: "outputs", path: ["order", "id"] },
      operator: "=",
      right: { kind: "activation", aliasId: "alias_order_id" },
    },
  });

  it("validates a stable ID reference independently of the display name", () => {
    expect(validateExecutableDeclareConstraint(constraintWithStableAlias("response"))).toEqual([]);
  });

  it.each(["response", "precedence", "responded-existence", "succession"] as const)(
    "executes %s with stable alias IDs",
    (template) => {
      const monitor = createDeclareMonitor(constraintWithStableAlias(template));
      let state = monitor.initialState();
      const activation = { transition: "A", inputs: { order: { id: 42 } } };
      const matchingTarget = { transition: "B", outputs: { order: { id: 42 } } };
      const events = template === "precedence"
        ? [activation, matchingTarget]
        : [activation, matchingTarget];
      for (const event of events) state = monitor.advance(state, event);
      expect(monitor.status(state)).toEqual({ viable: true, accepting: true });
    },
  );

  it("keeps different activation bindings distinguishable at runtime", () => {
    const monitor = createDeclareMonitor(constraintWithStableAlias("response"));
    let state = monitor.initialState();
    state = monitor.advance(state, { transition: "A", inputs: { order: { id: 42 } } });
    state = monitor.advance(state, { transition: "A", inputs: { order: { id: 99 } } });
    const before = monitor.stateKey(state);
    state = monitor.advance(state, { transition: "B", outputs: { order: { id: 42 } } });
    const after = monitor.stateKey(state);
    expect(after).not.toBe(before);
    expect(monitor.status(state)).toEqual({ viable: true, accepting: false });
    state = monitor.advance(state, { transition: "B", outputs: { order: { id: 99 } } });
    expect(monitor.status(state)).toEqual({ viable: true, accepting: true });
  });
});
