import { describe, expect, it } from "vitest";

import {
  advanceMonitorSet,
  canonicalMonitorStateKey,
  createMonitorSet,
  getMonitorSetStatus,
  monitorSetStateKey,
  type DeclareMonitor,
} from "./declareMonitor";

type TestState = {
  count: number;
  violated: boolean;
};

function atLeastMonitor(minimum: number): DeclareMonitor<TestState> {
  return {
    initialState: () => ({ count: 0, violated: false }),
    advance: (state, edge) => ({
      ...state,
      count: state.count + (edge.transition === "A" ? 1 : 0),
    }),
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated && state.count >= minimum,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

function forbidMonitor(name: string): DeclareMonitor<TestState> {
  return {
    initialState: () => ({ count: 0, violated: false }),
    advance: (state, edge) => ({
      count: state.count,
      violated: state.violated || edge.transition === name,
    }),
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

describe("canonicalMonitorStateKey", () => {
  it("is stable across object property insertion order", () => {
    expect(canonicalMonitorStateKey({ b: 2, a: { d: 4, c: 3 } })).toBe(
      canonicalMonitorStateKey({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });
});

describe("monitor sets", () => {
  it("distinguishes viable pending states from accepting states", () => {
    const initial = createMonitorSet([
      { id: "at-least-two-a", monitor: atLeastMonitor(2) },
    ]);

    expect(getMonitorSetStatus(initial)).toEqual({
      viable: true,
      accepting: false,
      rejectedConstraintIds: [],
      pendingConstraintIds: ["at-least-two-a"],
    });

    const once = advanceMonitorSet(initial, { transition: "A" });
    const twice = advanceMonitorSet(once, { transition: "A" });
    expect(getMonitorSetStatus(twice).accepting).toBe(true);
  });

  it("reports irreversible violations separately", () => {
    const initial = createMonitorSet([
      { id: "needs-a", monitor: atLeastMonitor(1) },
      { id: "forbid-x", monitor: forbidMonitor("X") },
    ]);
    const next = advanceMonitorSet(initial, { transition: "X" });

    expect(getMonitorSetStatus(next)).toEqual({
      viable: false,
      accepting: false,
      rejectedConstraintIds: ["forbid-x"],
      pendingConstraintIds: ["needs-a"],
    });
  });

  it("does not mutate earlier monitor states", () => {
    const initial = createMonitorSet([
      { id: "needs-a", monitor: atLeastMonitor(1) },
    ]);
    const next = advanceMonitorSet(initial, { transition: "A" });

    expect(getMonitorSetStatus(initial).accepting).toBe(false);
    expect(getMonitorSetStatus(next).accepting).toBe(true);
  });

  it("creates a deterministic combined state key", () => {
    const entries = createMonitorSet([
      { id: "first", monitor: atLeastMonitor(1) },
      { id: "second", monitor: forbidMonitor("X") },
    ]);

    expect(monitorSetStateKey(entries)).toBe(monitorSetStateKey(entries));
  });
});
