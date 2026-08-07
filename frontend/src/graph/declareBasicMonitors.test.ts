import { describe, expect, it } from "vitest";

import {
  createAtLeastMonitor,
  createAtMostMonitor,
  createChoiceMonitor,
  createEndMonitor,
  createExactlyConsecutiveMonitor,
  createExactlyMonitor,
  createExclusiveChoiceMonitor,
  createInitMonitor,
} from "./declareBasicMonitors";
import type { DeclareMonitor } from "./declareMonitor";
import type { DeclareTransition } from "./declarePredicates";

const group = (name: string) => ({
  relation: "or" as const,
  predicates: [
    { transition: { operator: "equals" as const, value: name } },
  ],
});

function run<State>(
  monitor: DeclareMonitor<State>,
  transitions: string[],
): State {
  return transitions.reduce(
    (state, transition) => monitor.advance(state, { transition }),
    monitor.initialState(),
  );
}

function status<State>(
  monitor: DeclareMonitor<State>,
  transitions: string[],
) {
  return monitor.status(run(monitor, transitions));
}

describe("cardinality monitors", () => {
  it("implements at least N with an accepting saturated count", () => {
    const monitor = createAtLeastMonitor(group("A"), 2);
    expect(status(monitor, [])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, ["A"])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, ["A", "X", "A"])).toEqual({
      viable: true,
      accepting: true,
    });
    expect(run(monitor, ["A", "A", "A"]).count).toBe(2);
  });

  it("implements at most N and prunes after the limit", () => {
    const monitor = createAtMostMonitor(group("A"), 1);
    expect(status(monitor, [])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, ["A"])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, ["A", "A"])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("implements exactly N with pending and violated states", () => {
    const monitor = createExactlyMonitor(group("A"), 2);
    expect(status(monitor, ["A"])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, ["A", "X", "A"])).toEqual({
      viable: true,
      accepting: true,
    });
    expect(status(monitor, ["A", "A", "A"])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("requires exactly N occurrences to form one consecutive run", () => {
    const monitor = createExactlyConsecutiveMonitor(group("A"), 2);
    expect(status(monitor, ["X", "A", "A", "X"])).toEqual({
      viable: true,
      accepting: true,
    });
    expect(status(monitor, ["A", "X", "A"])).toEqual({
      viable: false,
      accepting: false,
    });
    expect(status(monitor, ["A", "A", "A"])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("supports a zero cardinality", () => {
    expect(status(createExactlyMonitor(group("A"), 0), [])).toEqual({
      viable: true,
      accepting: true,
    });
    expect(status(createAtMostMonitor(group("A"), 0), ["A"])).toEqual({
      viable: false,
      accepting: false,
    });
    expect(status(createExactlyConsecutiveMonitor(group("A"), 0), [])).toEqual({
      viable: true,
      accepting: true,
    });
  });

  it("rejects invalid counts", () => {
    expect(() => createAtLeastMonitor(group("A"), -1)).toThrow(
      "Count must be a non-negative integer.",
    );
    expect(() => createExactlyMonitor(group("A"), 1.5)).toThrow(
      "Count must be a non-negative integer.",
    );
  });
});

describe("position monitors", () => {
  it("requires Init to match the first transition", () => {
    const monitor = createInitMonitor(group("A"));
    expect(status(monitor, [])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, ["A", "X"])).toEqual({
      viable: true,
      accepting: true,
    });
    expect(status(monitor, ["X", "A"])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("requires End to match the final transition", () => {
    const monitor = createEndMonitor(group("A"));
    expect(status(monitor, [])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, ["A", "X"])).toEqual({
      viable: true,
      accepting: false,
    });
    expect(status(monitor, ["X", "A"])).toEqual({
      viable: true,
      accepting: true,
    });
  });
});

describe("choice monitors", () => {
  it("accepts Choice when either side occurs", () => {
    const monitor = createChoiceMonitor(group("A"), group("B"));
    expect(status(monitor, [])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, ["A"])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, ["B"])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, ["A", "B"])).toEqual({
      viable: true,
      accepting: true,
    });
  });

  it("accepts Exclusive Choice only when exactly one side occurs", () => {
    const monitor = createExclusiveChoiceMonitor(group("A"), group("B"));
    expect(status(monitor, [])).toEqual({ viable: true, accepting: false });
    expect(status(monitor, ["A"])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, ["B"])).toEqual({ viable: true, accepting: true });
    expect(status(monitor, ["A", "B"])).toEqual({
      viable: false,
      accepting: false,
    });
  });

  it("treats one edge matching both exclusive-choice sides as a violation", () => {
    const dataGroup = {
      relation: "or" as const,
      predicates: [
        {
          condition: {
            type: "source" as const,
            source: "inputs" as const,
            condition: {
              type: "comparison" as const,
              path: ["value"],
              operator: "=" as const,
              value: 1,
            },
          },
        },
      ],
    };
    const monitor = createExclusiveChoiceMonitor(group("A"), dataGroup);
    const edge: DeclareTransition = { transition: "A", inputs: { value: 1 } };
    const state = monitor.advance(monitor.initialState(), edge);
    expect(monitor.status(state)).toEqual({ viable: false, accepting: false });
  });
});
