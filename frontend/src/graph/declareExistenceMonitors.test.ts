import { describe, expect, it } from "vitest";

import type { DeclarePredicateGroup } from "./declareConstraints";
import type { DeclareMonitor } from "./declareMonitor";
import type { DeclareTransition } from "./declarePredicates";
import {
  createCoexistenceMonitor,
  createNotCoexistenceMonitor,
  createNotRespondedExistenceMonitor,
  createRespondedExistenceMonitor,
} from "./declareExistenceMonitors";

const group = (name: string): DeclarePredicateGroup => ({
  relation: "or",
  predicates: [
    { transition: { operator: "equals", value: name } },
  ],
});

function run<State>(
  monitor: DeclareMonitor<State>,
  edges: DeclareTransition[],
): State {
  return edges.reduce(
    (state, edge) => monitor.advance(state, edge),
    monitor.initialState(),
  );
}

function status<State>(
  monitor: DeclareMonitor<State>,
  edges: DeclareTransition[],
) {
  return monitor.status(run(monitor, edges));
}

const correlatedActivation: DeclarePredicateGroup = {
  relation: "or",
  predicates: [
    {
      transition: { operator: "equals", value: "A" },
      captures: [
        { alias: "request_id", source: "inputs", path: ["id"] },
      ],
    },
  ],
};

const correlation = {
  type: "comparison" as const,
  left: {
    kind: "target" as const,
    source: "outputs" as const,
    path: ["id"],
  },
  operator: "=" as const,
  right: { kind: "activation" as const, alias: "request_id" },
};

const A = (id: number): DeclareTransition => ({
  transition: "A",
  inputs: { id },
});
const B = (id: number): DeclareTransition => ({
  transition: "B",
  outputs: { id },
});
const X: DeclareTransition = { transition: "X" };

describe("Responded existence", () => {
  it("is vacuously satisfied without an activation", () => {
    const monitor = createRespondedExistenceMonitor(group("A"), group("B"));
    expect(status(monitor, [X])).toEqual({ viable: true, accepting: true });
  });

  it("allows the target before or after the activation", () => {
    const monitor = createRespondedExistenceMonitor(group("A"), group("B"));
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "B" }, { transition: "A" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "A" }])).toEqual({
      viable: true,
      accepting: false,
    });
  });

  it("correlates targets before and after each activation", () => {
    const monitor = createRespondedExistenceMonitor(
      correlatedActivation,
      group("B"),
      correlation,
    );
    expect(status(monitor, [B(10), A(10)]).accepting).toBe(true);
    expect(status(monitor, [B(20), A(10)])).toEqual({
      viable: true,
      accepting: false,
    });
    expect(status(monitor, [A(10), A(20), B(10), B(20)]).accepting).toBe(true);
  });
});

describe("Not responded existence", () => {
  it("forbids a matching pair in either order", () => {
    const monitor = createNotRespondedExistenceMonitor(
      correlatedActivation,
      group("B"),
      correlation,
    );
    expect(status(monitor, [A(10)])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, [B(10)])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, [A(10), B(10)])).toEqual({ viable: false, accepting: false });
    expect(status(monitor, [B(10), A(10)])).toEqual({ viable: false, accepting: false });
    expect(status(monitor, [A(10), B(20)])).toEqual({ viable: true, accepting: true });
  });
});

describe("Coexistence", () => {
  it("requires both sides or neither side", () => {
    const monitor = createCoexistenceMonitor(group("A"), group("B"));
    expect(status(monitor, [])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, [X])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, [{ transition: "A" }])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, [{ transition: "B" }])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "B" }, { transition: "A" }]).accepting).toBe(true);
  });

  it("requires correlated counterparts for every activation and target", () => {
    const monitor = createCoexistenceMonitor(
      correlatedActivation,
      group("B"),
      correlation,
    );
    expect(status(monitor, [A(10), B(10)]).accepting).toBe(true);
    expect(status(monitor, [B(10), A(10)]).accepting).toBe(true);
    expect(status(monitor, [A(10), B(20)])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, [A(10), A(20), B(10)])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, [A(10), B(10), B(20)])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, [A(10), A(20), B(10), B(20)]).accepting).toBe(true);
  });
});

describe("Not coexistence", () => {
  it("accepts either side alone and forbids a correlated pair", () => {
    const monitor = createNotCoexistenceMonitor(
      correlatedActivation,
      group("B"),
      correlation,
    );
    expect(status(monitor, [A(10)])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, [B(10)])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, [A(10), B(20)])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, [A(10), B(10)])).toEqual({ viable: false, accepting: false });
  });
});
