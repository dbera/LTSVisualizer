import { describe, expect, it } from "vitest";

import type { DeclarePredicateGroup } from "./declareConstraints";
import type { DeclareMonitor } from "./declareMonitor";
import type { DeclareTransition } from "./declarePredicates";
import {
  createAlternateResponseMonitor,
  createChainResponseMonitor,
  createNotAlternateResponseMonitor,
  createNotChainResponseMonitor,
  createNotResponseMonitor,
  createResponseMonitor,
} from "./declareResponseMonitors";

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
  left: { kind: "target" as const, source: "outputs" as const, path: ["id"] },
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

describe("Response", () => {
  it("is vacuously satisfied without activations", () => {
    expect(status(createResponseMonitor(group("A"), group("B")), [X])).toEqual({
      viable: true,
      accepting: true,
    });
  });

  it("keeps unmatched activations pending until a target occurs", () => {
    const monitor = createResponseMonitor(group("A"), group("B"));
    expect(status(monitor, [{ transition: "A" }, X])).toEqual({
      viable: true,
      accepting: false,
    });
    expect(status(monitor, [{ transition: "A" }, X, { transition: "B" }])).toEqual({
      viable: true,
      accepting: true,
    });
  });

  it("correlates one target with each pending activation independently", () => {
    const monitor = createResponseMonitor(
      correlatedActivation,
      group("B"),
      correlation,
    );
    const afterOneTarget = run(monitor, [A(10), A(20), B(10)]);
    expect(afterOneTarget.pending).toEqual([{ bindings: { request_id: 20 } }]);
    expect(monitor.status(afterOneTarget).accepting).toBe(false);
    expect(status(monitor, [A(10), A(20), B(10), B(20)]).accepting).toBe(true);
  });

  it("processes a target before adding a same-edge activation", () => {
    const both = group("A");
    const monitor = createResponseMonitor(both, both);
    expect(status(monitor, [{ transition: "A" }]).accepting).toBe(false);
    expect(status(monitor, [{ transition: "A" }, { transition: "A" }]).accepting).toBe(false);
  });
});

describe("Not response", () => {
  it("rejects a later correlated target but permits earlier targets", () => {
    const monitor = createNotResponseMonitor(
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

describe("Chain response", () => {
  it("requires the next edge to be a correlated target", () => {
    const monitor = createChainResponseMonitor(
      correlatedActivation,
      group("B"),
      correlation,
    );
    expect(status(monitor, [A(10)])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, [A(10), B(10)])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, [A(10), X])).toEqual({ viable: false, accepting: false });
    expect(status(monitor, [A(10), B(20)])).toEqual({ viable: false, accepting: false });
  });

  it("implements not chain response", () => {
    const monitor = createNotChainResponseMonitor(group("A"), group("B"));
    expect(status(monitor, [{ transition: "A" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "A" }, X]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "A" }, { transition: "B" }])).toEqual({
      viable: false,
      accepting: false,
    });
  });
});

describe("Alternate response", () => {
  it("requires a target before another activation", () => {
    const monitor = createAlternateResponseMonitor(
      group("A"),
      group("B"),
      group("C"),
    );
    expect(status(monitor, [{ transition: "A" }, X, { transition: "B" }]).accepting).toBe(true);
    expect(status(monitor, [{ transition: "A" }, { transition: "A" }])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("rejects the configured between predicate while waiting", () => {
    const monitor = createAlternateResponseMonitor(
      group("A"),
      group("B"),
      group("C"),
    );
    expect(status(monitor, [{ transition: "A" }, C])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("uses target correlation before fulfilling the activation", () => {
    const monitor = createAlternateResponseMonitor(
      correlatedActivation,
      group("B"),
      group("C"),
      correlation,
    );
    expect(status(monitor, [A(10), B(20)]).accepting).toBe(false);
    expect(status(monitor, [A(10), B(10)]).accepting).toBe(true);
  });
});

describe("Specialized negative alternate response", () => {
  it("rejects A followed by B with only the allowed C predicate between", () => {
    const monitor = createNotAlternateResponseMonitor(
      group("A"),
      group("B"),
      group("C"),
    );
    expect(status(monitor, [{ transition: "A" }, C, { transition: "B" }]).accepting).toBe(false);
    expect(status(monitor, [{ transition: "A" }, X, { transition: "B" }]).accepting).toBe(true);
  });

  it("applies correlation to the forbidden target", () => {
    const monitor = createNotAlternateResponseMonitor(
      correlatedActivation,
      group("B"),
      group("C"),
      correlation,
    );
    expect(status(monitor, [A(10), C, B(20)]).accepting).toBe(true);
    expect(status(monitor, [A(10), C, B(10)]).accepting).toBe(false);
  });
});
