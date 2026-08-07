import { describe, expect, it } from "vitest";

import type { DeclarePredicateGroup } from "./declareConstraints";
import type { DeclareMonitor } from "./declareMonitor";
import type { DeclareTransition } from "./declarePredicates";
import {
  createAlternateSuccessionMonitor,
  createChainSuccessionMonitor,
  createNotAlternateSuccessionMonitor,
  createNotChainSuccessionMonitor,
  createNotSuccessionMonitor,
  createSuccessionMonitor,
} from "./declareSuccessionMonitors";

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
const C: DeclareTransition = { transition: "C" };

describe("Succession", () => {
  it("combines response and precedence semantics", () => {
    const monitor = createSuccessionMonitor(group("A"), group("B"));
    expect(status(monitor, [])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }])).toEqual({
      viable: true,
      accepting: true,
    });
    expect(status(monitor, [{ transition: "A" }])).toEqual({
      viable: true,
      accepting: false,
    });
    expect(status(monitor, [{ transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("requires correlation in both directions", () => {
    const monitor = createSuccessionMonitor(
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

describe("Not succession", () => {
  it("forbids a target after an activation", () => {
    const monitor = createNotSuccessionMonitor(group("A"), group("B"));
    expect(status(monitor, [{ transition: "A" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "B" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "B" }, { transition: "A" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
  });
});

describe("Chain succession", () => {
  it("requires every A-B relationship to be immediate in both directions", () => {
    const monitor = createChainSuccessionMonitor(group("A"), group("B"));
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }])).toEqual({
      viable: true,
      accepting: true,
    });
    expect(status(monitor, [{ transition: "A" }, X, { transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
    expect(status(monitor, [{ transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("implements negative chain succession", () => {
    const monitor = createNotChainSuccessionMonitor(group("A"), group("B"));
    expect(status(monitor, [{ transition: "A" }, X, { transition: "B" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
  });
});

describe("Alternate succession", () => {
  it("combines alternate response and alternate precedence", () => {
    const monitor = createAlternateSuccessionMonitor(
      group("A"),
      group("B"),
      group("C"),
    );
    expect(status(monitor, [{ transition: "A" }, X, { transition: "B" }])).toEqual({
      viable: true,
      accepting: true,
    });
    expect(status(monitor, [{ transition: "A" }, { transition: "A" }])).toEqual({
      viable: false,
      accepting: false,
    });
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }, { transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
    expect(status(monitor, [{ transition: "A" }, C, { transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("implements specialized negative alternate succession", () => {
    const monitor = createNotAlternateSuccessionMonitor(
      group("A"),
      group("B"),
      group("C"),
    );
    expect(status(monitor, [{ transition: "A" }, C, { transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
    expect(status(monitor, [{ transition: "A" }, X, { transition: "B" }]).accepting).toBe(true);
  });

  it("preserves correlation in the composed alternate monitors", () => {
    const monitor = createAlternateSuccessionMonitor(
      correlatedActivation,
      group("B"),
      group("C"),
      correlation,
    );
    expect(status(monitor, [A(10), B(10)]).accepting).toBe(true);
    expect(status(monitor, [A(10), B(20)])).toEqual({
      viable: false,
      accepting: false,
    });
  });
});
