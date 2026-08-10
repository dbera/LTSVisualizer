import { describe, expect, it } from "vitest";

import type { DeclarePredicateGroup } from "./declareConstraints";
import type { DeclareMonitor } from "./declareMonitor";
import type { DeclareTransition } from "./declarePredicates";
import {
  createAlternatePrecedenceMonitor,
  createChainPrecedenceMonitor,
  createNotChainPrecedenceMonitor,
  createNotPrecedenceMonitor,
  createPrecedenceMonitor,
} from "./declarePrecedenceMonitors";

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

describe("Precedence", () => {
  it("is vacuously satisfied when no target occurs", () => {
    expect(
      status(createPrecedenceMonitor(group("A"), group("B")), [X]),
    ).toEqual({ viable: true, accepting: true });
  });

  it("requires an activation strictly before every target", () => {
    const monitor = createPrecedenceMonitor(group("A"), group("B"));
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }])).toEqual({
      viable: true,
      accepting: true,
    });
    expect(status(monitor, [{ transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("does not allow one edge to precede itself", () => {
    const monitor = createPrecedenceMonitor(group("A"), group("A"));
    expect(status(monitor, [{ transition: "A" }])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("uses a correlated earlier activation", () => {
    const monitor = createPrecedenceMonitor(
      correlatedActivation,
      group("B"),
      correlation,
    );
    expect(status(monitor, [A(10), B(10)]).accepting).toBe(true);
    expect(status(monitor, [A(10), B(20)])).toEqual({
      viable: false,
      accepting: false,
    });
    expect(status(monitor, [A(10), A(20), B(20)]).accepting).toBe(true);
  });
});

describe("Not precedence", () => {
  it("forbids a correlated activation before a target", () => {
    const monitor = createNotPrecedenceMonitor(
      correlatedActivation,
      group("B"),
      correlation,
    );
    expect(status(monitor, [B(10), A(10)]).accepting).toBe(true);
    expect(status(monitor, [A(10), B(20)]).accepting).toBe(true);
    expect(status(monitor, [A(10), B(10)])).toEqual({
      viable: false,
      accepting: false,
    });
  });
});

describe("Chain precedence", () => {
  it("requires the immediately previous edge to be a correlated activation", () => {
    const monitor = createChainPrecedenceMonitor(
      correlatedActivation,
      group("B"),
      correlation,
    );
    expect(status(monitor, [A(10), B(10)])).toEqual({
      viable: true,
      accepting: true,
    });
    expect(status(monitor, [A(10), X, B(10)])).toEqual({
      viable: false,
      accepting: false,
    });
    expect(status(monitor, [A(10), B(20)])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("implements not chain precedence", () => {
    const monitor = createNotChainPrecedenceMonitor(group("A"), group("B"));
    expect(status(monitor, [{ transition: "A" }, X, { transition: "B" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
  });
});

describe("Alternate precedence", () => {
  it("allows unrelated events and requires a fresh activation after the previous target", () => {
    const monitor = createAlternatePrecedenceMonitor(group("A"), group("B"));
    expect(status(monitor, [{ transition: "A" }, X, { transition: "B" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }, { transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }, { transition: "A" }, { transition: "B" }]).accepting).toBe(true);
  });

  it("uses a correlated activation since the previous target", () => {
    const monitor = createAlternatePrecedenceMonitor(
      correlatedActivation,
      group("B"),
      correlation,
    );
    expect(status(monitor, [A(10), B(10)]).accepting).toBe(true);
    expect(status(monitor, [A(10), B(20)])).toEqual({
      viable: false,
      accepting: false,
    });
  });
});
