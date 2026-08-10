import { describe, expect, it } from "vitest";

import {
  findKShortestBoundedPaths,
  type PathSearchEdge,
  type PathSearchInput,
} from "./pathSearch";

function searchInput(
  nodeIds: string[],
  edges: PathSearchEdge[],
  overrides: Partial<PathSearchInput> = {},
): PathSearchInput {
  return {
    nodeIds,
    edges,
    sourceNodeId: nodeIds[0] ?? "source",
    targetNodeId: nodeIds[nodeIds.length - 1] ?? "target",
    requestedPathCount: 5,
    maximumVisitsPerState: 1,
    constraints: {},
    ...overrides,
  };
}

describe("findKShortestBoundedPaths", () => {
  it("finds a direct path", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B"],
        [{ id: "ab", source: "A", target: "B" }],
      ),
    );

    expect(result.paths).toEqual([
      { startNodeId: "A", edgeIds: ["ab"] },
    ]);
    expect(result.exhausted).toBe(true);
  });

  it("orders paths by increasing transition count", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B", "C", "D"],
        [
          { id: "ab", source: "A", target: "B" },
          { id: "bd", source: "B", target: "D" },
          { id: "ad", source: "A", target: "D" },
          { id: "ac", source: "A", target: "C" },
          { id: "cd", source: "C", target: "D" },
        ],
        { requestedPathCount: 3 },
      ),
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([
      ["ad"],
      ["ab", "bd"],
      ["ac", "cd"],
    ]);
  });

  it("uses input edge order for equal-length paths", () => {
    const input = searchInput(
      ["A", "B", "C", "D"],
      [
        { id: "ac", source: "A", target: "C" },
        { id: "ab", source: "A", target: "B" },
        { id: "cd", source: "C", target: "D" },
        { id: "bd", source: "B", target: "D" },
      ],
      { requestedPathCount: 2 },
    );

    expect(
      findKShortestBoundedPaths(input).paths.map((path) => path.edgeIds),
    ).toEqual([
      ["ac", "cd"],
      ["ab", "bd"],
    ]);
    expect(findKShortestBoundedPaths(input)).toEqual(
      findKShortestBoundedPaths(input),
    );
  });

  it("preserves parallel edges as distinct paths", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B"],
        [
          { id: "ab-primary", source: "A", target: "B" },
          { id: "ab-alternative", source: "A", target: "B" },
        ],
        { requestedPathCount: 2 },
      ),
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([
      ["ab-primary"],
      ["ab-alternative"],
    ]);
  });

  it("returns no path for disconnected states", () => {
    const result = findKShortestBoundedPaths(
      searchInput(["A", "B"], []),
    );

    expect(result.paths).toEqual([]);
    expect(result.exhausted).toBe(true);
    expect(result.stopReason).toBe("exhausted");
  });

  it("returns fewer than K paths when the search space is exhausted", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B"],
        [{ id: "ab", source: "A", target: "B" }],
        { requestedPathCount: 10 },
      ),
    );

    expect(result.paths).toHaveLength(1);
    expect(result.exhausted).toBe(true);
  });

  it("rejects revisiting a state when the visit limit is one", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B", "C"],
        [
          { id: "ab", source: "A", target: "B" },
          { id: "ba", source: "B", target: "A" },
          { id: "ac", source: "A", target: "C" },
        ],
        {
          requestedPathCount: 5,
          maximumVisitsPerState: 1,
        },
      ),
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([["ac"]]);
  });

  it("allows a bounded revisit when the visit limit is two", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B", "C"],
        [
          { id: "ab", source: "A", target: "B" },
          { id: "ba", source: "B", target: "A" },
          { id: "ac", source: "A", target: "C" },
        ],
        {
          requestedPathCount: 2,
          maximumVisitsPerState: 2,
        },
      ),
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([
      ["ac"],
      ["ab", "ba", "ac"],
    ]);
  });

  it("counts each self-loop traversal as another visit", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B"],
        [
          { id: "loop", source: "A", target: "A" },
          { id: "ab", source: "A", target: "B" },
        ],
        {
          requestedPathCount: 2,
          maximumVisitsPerState: 2,
        },
      ),
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([
      ["ab"],
      ["loop", "ab"],
    ]);
  });

  it("returns the zero-transition path when source equals target", () => {
    const result = findKShortestBoundedPaths(
      searchInput(["A"], [], {
        sourceNodeId: "A",
        targetNodeId: "A",
        requestedPathCount: 1,
      }),
    );

    expect(result.paths).toEqual([
      { startNodeId: "A", edgeIds: [] },
    ]);
    expect(result.stopReason).toBe("requested-count-reached");
  });

  it("finds returning paths after the zero-transition path", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B", "C"],
        [
          { id: "ab", source: "A", target: "B" },
          { id: "ba", source: "B", target: "A" },
          { id: "ac", source: "A", target: "C" },
          { id: "ca", source: "C", target: "A" },
        ],
        {
          sourceNodeId: "A",
          targetNodeId: "A",
          requestedPathCount: 3,
          maximumVisitsPerState: 2,
        },
      ),
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([
      [],
      ["ab", "ba"],
      ["ac", "ca"],
    ]);
  });

  it("returns only the zero-transition path for equal endpoints with limit one", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B"],
        [
          { id: "ab", source: "A", target: "B" },
          { id: "ba", source: "B", target: "A" },
        ],
        {
          sourceNodeId: "A",
          targetNodeId: "A",
          requestedPathCount: 3,
          maximumVisitsPerState: 1,
        },
      ),
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([[]]);
    expect(result.exhausted).toBe(true);
  });

  it("finds a self-loop returning path when source equals target", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A"],
        [{ id: "loop", source: "A", target: "A" }],
        {
          sourceNodeId: "A",
          targetNodeId: "A",
          requestedPathCount: 2,
          maximumVisitsPerState: 2,
        },
      ),
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([
      [],
      ["loop"],
    ]);
  });

  it("reports when the expanded-candidate limit is reached", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B", "C", "D"],
        [
          { id: "ab", source: "A", target: "B" },
          { id: "ac", source: "A", target: "C" },
          { id: "bd", source: "B", target: "D" },
          { id: "cd", source: "C", target: "D" },
        ],
        { requestedPathCount: 2 },
      ),
      { maximumExpandedCandidates: 1 },
    );

    expect(result.paths).toEqual([]);
    expect(result.resourceLimitReached).toBe(true);
    expect(result.stopReason).toBe("resource-limit-reached");
  });

  it("reports when the queued-candidate limit is reached", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B", "C", "D"],
        [
          { id: "ab", source: "A", target: "B" },
          { id: "ac", source: "A", target: "C" },
          { id: "ad", source: "A", target: "D" },
          { id: "bd", source: "B", target: "D" },
          { id: "cd", source: "C", target: "D" },
        ],
      ),
      { maximumQueuedCandidates: 1 },
    );

    expect(result.resourceLimitReached).toBe(true);
    expect(result.stopReason).toBe("resource-limit-reached");
  });

  it("supports cancellation", () => {
    let cancellationChecks = 0;
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B", "C"],
        [
          { id: "ab", source: "A", target: "B" },
          { id: "bc", source: "B", target: "C" },
        ],
      ),
      {
        shouldCancel: () => {
          cancellationChecks += 1;
          return cancellationChecks > 1;
        },
      },
    );

    expect(result.cancelled).toBe(true);
    expect(result.stopReason).toBe("cancelled");
  });

  it("accepts an empty Declare constraint list", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B"],
        [{ id: "ab", source: "A", target: "B" }],
        { constraints: { declare: [] } },
      ),
    );
    expect(result.paths.map((path) => path.edgeIds)).toEqual([["ab"]]);
  });

  it("filters paths using a Declare Init constraint", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["source", "left", "right", "target"],
        [
          { id: "bad-start", source: "source", target: "left", transition: "X" },
          { id: "bad-end", source: "left", target: "target", transition: "B" },
          { id: "good-start", source: "source", target: "right", transition: "A" },
          { id: "good-end", source: "right", target: "target", transition: "B" },
        ],
        {
          requestedPathCount: 2,
          constraints: {
            declare: [{
              id: "starts-with-a",
              template: "init",
              enabled: true,
              activation: {
                relation: "or",
                predicates: [{ transition: { operator: "equals", value: "A" } }],
              },
            }],
          },
        },
      ),
    );
    expect(result.paths.map((path) => path.edgeIds)).toEqual([
      ["good-start", "good-end"],
    ]);
  });

  it("continues beyond an early target while Response is pending", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["source", "target", "middle"],
        [
          { id: "activate", source: "source", target: "target", transition: "A" },
          { id: "fulfil", source: "target", target: "middle", transition: "B" },
          { id: "return", source: "middle", target: "target", transition: "X" },
        ],
        {
          targetNodeId: "target",
          requestedPathCount: 1,
          maximumVisitsPerState: 2,
          constraints: {
            declare: [{
              id: "a-responded-by-b",
              template: "response",
              enabled: true,
              activation: { relation: "or", predicates: [{ transition: { operator: "equals", value: "A" } }] },
              target: { relation: "or", predicates: [{ transition: { operator: "equals", value: "B" } }] },
            }],
          },
        },
      ),
    );
    expect(result.paths.map((path) => path.edgeIds)).toEqual([
      ["activate", "fulfil", "return"],
    ]);
  });

  it("uses transition data for correlated Response search", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["source", "a", "wrong", "target"],
        [
          { id: "submit", source: "source", target: "a", transition: "Submit", inputs: { id: 42 } },
          { id: "wrong", source: "a", target: "wrong", transition: "Complete", outputs: { id: 57 } },
          { id: "right", source: "wrong", target: "target", transition: "Complete", outputs: { id: 42 } },
        ],
        {
          requestedPathCount: 1,
          constraints: {
            declare: [{
              id: "same-request",
              template: "response",
              enabled: true,
              activation: {
                relation: "or",
                predicates: [{
                  transition: { operator: "equals", value: "Submit" },
                  captures: [{ alias: "request_id", source: "inputs", path: ["id"] }],
                }],
              },
              target: { relation: "or", predicates: [{ transition: { operator: "equals", value: "Complete" } }] },
              correlation: {
                type: "comparison",
                left: { kind: "target", source: "outputs", path: ["id"] },
                operator: "=",
                right: { kind: "activation", alias: "request_id" },
              },
            }],
          },
        },
      ),
    );
    expect(result.paths.map((path) => path.edgeIds)).toEqual([
      ["submit", "wrong", "right"],
    ]);
  });

  it("rejects invalid search parameters", () => {
    expect(() =>
      findKShortestBoundedPaths(
        searchInput(["A", "B"], [], { requestedPathCount: 0 }),
      ),
    ).toThrow("Requested path count must be a positive integer.");

    expect(() =>
      findKShortestBoundedPaths(
        searchInput(["A", "B"], [], { maximumVisitsPerState: 0 }),
      ),
    ).toThrow("Maximum visits per state must be a positive integer.");
  });

  it("rejects unknown states and invalid edge references", () => {
    expect(() =>
      findKShortestBoundedPaths(
        searchInput(["A", "B"], [], { sourceNodeId: "missing" }),
      ),
    ).toThrow("Source state missing does not exist.");

    expect(() =>
      findKShortestBoundedPaths(
        searchInput(
          ["A", "B"],
          [{ id: "invalid", source: "A", target: "missing" }],
        ),
      ),
    ).toThrow("Edge invalid references unknown target state missing.");
  });

  it("does not mutate the search input", () => {
    const input = searchInput(
      ["A", "B"],
      [{ id: "ab", source: "A", target: "B" }],
    );
    const original = structuredClone(input);

    findKShortestBoundedPaths(input);

    expect(input).toEqual(original);
  });


  it("prunes large branches that cannot reach the target", () => {
    const deadEndCount = 20_000;
    const nodeIds = [
      "source",
      "target",
      ...Array.from({ length: deadEndCount }, (_, index) => `dead-${index}`),
    ];
    const edges: PathSearchEdge[] = [
      { id: "direct", source: "source", target: "target" },
      ...Array.from({ length: deadEndCount }, (_, index) => ({
        id: `dead-edge-${index}`,
        source: "source",
        target: `dead-${index}`,
      })),
    ];

    const result = findKShortestBoundedPaths(
      searchInput(nodeIds, edges, {
        sourceNodeId: "source",
        targetNodeId: "target",
        requestedPathCount: 1,
      }),
      { maximumQueuedCandidates: 10 },
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([["direct"]]);
    expect(result.resourceLimitReached).toBe(false);
    expect(result.expandedCandidateCount).toBe(2);
  });

  it("uses reverse distance guidance while preserving shortest-first order", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["source", "near", "far-1", "far-2", "target"],
        [
          { id: "to-far", source: "source", target: "far-1" },
          { id: "far-step", source: "far-1", target: "far-2" },
          { id: "far-target", source: "far-2", target: "target" },
          { id: "to-near", source: "source", target: "near" },
          { id: "near-target", source: "near", target: "target" },
        ],
        { requestedPathCount: 2 },
      ),
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([
      ["to-near", "near-target"],
      ["to-far", "far-step", "far-target"],
    ]);
  });

  it("handles a long linear graph", () => {
    const nodeCount = 10_000;
    const nodeIds = Array.from(
      { length: nodeCount },
      (_, index) => String(index),
    );
    const edges = Array.from(
      { length: nodeCount - 1 },
      (_, index) => ({
        id: `edge-${index}`,
        source: String(index),
        target: String(index + 1),
      }),
    );

    const result = findKShortestBoundedPaths(
      searchInput(nodeIds, edges, { requestedPathCount: 1 }),
    );

    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].edgeIds).toHaveLength(nodeCount - 1);
  });
  describe("optional target constraint-satisfaction mode", () => {
    const responseConstraint = {
      id: "response-a-b",
      template: "response" as const,
      enabled: true,
      activation: {
        relation: "or" as const,
        predicates: [
          { transition: { operator: "equals" as const, value: "A" } },
        ],
      },
      target: {
        relation: "or" as const,
        predicates: [
          { transition: { operator: "equals" as const, value: "B" } },
        ],
      },
    };

    it("finds the shortest endpoint where an exercised Response accepts", () => {
      const result = findKShortestBoundedPaths({
        nodeIds: ["source", "after-a", "satisfied", "later"],
        edges: [
          { id: "a", source: "source", target: "after-a", transition: "A" },
          { id: "b", source: "after-a", target: "satisfied", transition: "B" },
          { id: "later", source: "satisfied", target: "later", transition: "X" },
        ],
        sourceNodeId: "source",
        endpointMode: "constraint-satisfaction",
        requestedPathCount: 1,
        maximumVisitsPerState: 1,
        constraints: { declare: [responseConstraint] },
      });

      expect(result.paths).toHaveLength(1);
      expect(result.paths[0]).toMatchObject({
        startNodeId: "source",
        endNodeId: "satisfied",
        edgeIds: ["a", "b"],
      });
    });

    it("rejects vacuous Response satisfaction when exercise is required", () => {
      const result = findKShortestBoundedPaths({
        nodeIds: ["source", "unrelated"],
        edges: [
          { id: "x", source: "source", target: "unrelated", transition: "X" },
        ],
        sourceNodeId: "source",
        endpointMode: "constraint-satisfaction",
        requestedPathCount: 1,
        maximumVisitsPerState: 1,
        constraints: { declare: [responseConstraint] },
      });

      expect(result.paths).toEqual([]);
      expect(result.exhausted).toBe(true);
    });

    it("allows vacuous satisfaction when exercise is explicitly disabled", () => {
      const result = findKShortestBoundedPaths({
        nodeIds: ["source", "unrelated"],
        edges: [
          { id: "x", source: "source", target: "unrelated", transition: "X" },
        ],
        sourceNodeId: "source",
        endpointMode: "constraint-satisfaction",
        requireConstraintExercise: false,
        requestedPathCount: 1,
        maximumVisitsPerState: 1,
        constraints: { declare: [responseConstraint] },
      });

      expect(result.paths).toHaveLength(1);
      expect(result.paths[0]).toMatchObject({
        startNodeId: "source",
        endNodeId: "source",
        edgeIds: [],
      });
    });

    it("does not treat only a Precedence activation as exercise", () => {
      const result = findKShortestBoundedPaths({
        nodeIds: ["source", "after-a"],
        edges: [{ id: "a", source: "source", target: "after-a", transition: "A" }],
        sourceNodeId: "source",
        endpointMode: "constraint-satisfaction",
        requestedPathCount: 1,
        maximumVisitsPerState: 1,
        constraints: {
          declare: [{
            id: "a-before-b",
            template: "precedence",
            enabled: true,
            activation: { relation: "or", predicates: [{ transition: { operator: "equals", value: "A" } }] },
            target: { relation: "or", predicates: [{ transition: { operator: "equals", value: "B" } }] },
          }],
        },
      });

      expect(result.paths).toEqual([]);
    });

    it("accepts Exactly 0 without artificial exercise", () => {
      const result = findKShortestBoundedPaths({
        nodeIds: ["source"],
        edges: [],
        sourceNodeId: "source",
        endpointMode: "constraint-satisfaction",
        requestedPathCount: 1,
        maximumVisitsPerState: 1,
        constraints: {
          declare: [{
            id: "no-a",
            template: "exactly",
            enabled: true,
            count: 0,
            activation: { relation: "or", predicates: [{ transition: { operator: "equals", value: "A" } }] },
          }],
        },
      });

      expect(result.paths).toHaveLength(1);
      expect(result.paths[0]).toMatchObject({
        startNodeId: "source",
        endNodeId: "source",
        edgeIds: [],
      });
    });

    it("requires at least one enabled constraint without a target", () => {
      expect(() =>
        findKShortestBoundedPaths({
          nodeIds: ["source"],
          edges: [],
          sourceNodeId: "source",
          endpointMode: "constraint-satisfaction",
          requestedPathCount: 1,
          maximumVisitsPerState: 1,
          constraints: { declare: [] },
        }),
      ).toThrow(
        "At least one enabled Declare constraint is required when no target state is specified.",
      );
    });

    it("keeps specific-target semantics and reports the actual endpoint", () => {
      const result = findKShortestBoundedPaths({
        nodeIds: ["source", "target"],
        edges: [{ id: "edge", source: "source", target: "target" }],
        sourceNodeId: "source",
        targetNodeId: "target",
        requestedPathCount: 1,
        maximumVisitsPerState: 1,
      });

      expect(result.paths).toEqual([
        { startNodeId: "source", edgeIds: ["edge"] },
      ]);
    });
  });

  it("explains data-aware Response and cardinality satisfaction", () => {
    const result = findKShortestBoundedPaths({
      nodeIds: ["0", "1", "2", "3"],
      edges: [
        { id: "audit", source: "0", target: "1", transition: "Audit", inputs: { events: [[{ type: "login" }]] } },
        { id: "login", source: "1", target: "2", transition: "Login", inputs: { credentials: [{ userName: "xyz" }] } },
        { id: "complete", source: "2", target: "3", transition: "Complete" },
      ],
      sourceNodeId: "0",
      targetNodeId: "3",
      requestedPathCount: 1,
      maximumVisitsPerState: 1,
      constraints: { declare: [
        {
          id: "login-response",
          template: "response",
          enabled: true,
          activation: { relation: "or", predicates: [{ transition: { operator: "equals", value: "Login" }, condition: { type: "source", source: "inputs", condition: { type: "contains-item", path: ["credentials"], condition: { type: "comparison", path: ["userName"], operator: "=", value: "xyz" } } } }] },
          target: { relation: "or", predicates: [{ transition: { operator: "equals", value: "Complete" } }] },
        },
        {
          id: "audit-count",
          template: "at-least",
          enabled: true,
          count: 1,
          activation: { relation: "or", predicates: [{ transition: { operator: "equals", value: "Audit" }, condition: { type: "source", source: "inputs", condition: { type: "contains-item", path: ["events"], condition: { type: "comparison", path: [0, "type"], operator: "=", value: "login" } } } }] },
        },
      ] },
    });
    expect(result.paths[0].explanations).toEqual([
      {
        constraintId: "login-response", template: "response", status: "satisfied", exercised: true,
        summary: "1 activation fulfilled.",
        events: [
          { role: "activation", stepNumber: 2, edgeId: "login", transition: "Login" },
          { role: "fulfillment", stepNumber: 3, edgeId: "complete", transition: "Complete" },
        ],
      },
      {
        constraintId: "audit-count", template: "at-least", status: "satisfied", exercised: true,
        summary: "Matched 1 time; required count 1.",
        events: [{ role: "match", stepNumber: 1, edgeId: "audit", transition: "Audit" }],
      },
    ]);
  });


  it("explains position, choice, and precedence template families", () => {
    const result = findKShortestBoundedPaths({
      nodeIds: ["0", "1", "2", "3"],
      edges: [
        { id: "a", source: "0", target: "1", transition: "A" },
        { id: "x", source: "1", target: "2", transition: "X" },
        { id: "b", source: "2", target: "3", transition: "B" },
      ],
      sourceNodeId: "0",
      targetNodeId: "3",
      requestedPathCount: 1,
      maximumVisitsPerState: 1,
      constraints: { declare: [
        { id: "init-a", template: "init", enabled: true, activation: { relation: "or", predicates: [{ transition: { operator: "equals", value: "A" } }] } },
        { id: "choice-a-c", template: "choice", enabled: true, activation: { relation: "or", predicates: [{ transition: { operator: "equals", value: "A" } }] }, target: { relation: "or", predicates: [{ transition: { operator: "equals", value: "C" } }] } },
        { id: "a-before-b", template: "precedence", enabled: true, activation: { relation: "or", predicates: [{ transition: { operator: "equals", value: "A" } }] }, target: { relation: "or", predicates: [{ transition: { operator: "equals", value: "B" } }] } },
      ] },
    });
    expect(result.paths[0].explanations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        constraintId: "init-a",
        summary: "The first transition matches the Init activation.",
        events: [expect.objectContaining({ role: "position-match", edgeId: "a", stepNumber: 1 })],
      }),
      expect.objectContaining({
        constraintId: "choice-a-c",
        summary: "Activation side occurred, satisfying Choice.",
        events: [expect.objectContaining({ role: "choice-match", edgeId: "a" })],
      }),
      expect.objectContaining({
        constraintId: "a-before-b",
        summary: "Every target had a qualifying preceding activation.",
        events: [
          expect.objectContaining({ role: "preceding-support", edgeId: "a" }),
          expect.objectContaining({ role: "target", edgeId: "b" }),
        ],
      }),
    ]));
  });

  it("explains negative templates as avoided forbidden relationships", () => {
    const result = findKShortestBoundedPaths({
      nodeIds: ["0", "1", "2", "3"],
      edges: [
        { id: "a", source: "0", target: "1", transition: "A", inputs: { id: 10 } },
        { id: "b-wrong", source: "1", target: "2", transition: "B", outputs: { id: 20 } },
        { id: "x", source: "2", target: "3", transition: "X" },
      ],
      sourceNodeId: "0",
      targetNodeId: "3",
      requestedPathCount: 1,
      maximumVisitsPerState: 1,
      constraints: { declare: [{
        id: "not-correlated-response",
        template: "not-response",
        enabled: true,
        activation: { relation: "or", predicates: [{ transition: { operator: "equals", value: "A" }, captures: [{ alias: "id", source: "inputs", path: ["id"] }] }] },
        target: { relation: "or", predicates: [{ transition: { operator: "equals", value: "B" } }] },
        correlation: { type: "comparison", left: { kind: "target", source: "outputs", path: ["id"] }, operator: "=", right: { kind: "activation", alias: "id" } },
      }] },
    });
    expect(result.paths[0].explanations?.[0]).toMatchObject({
      constraintId: "not-correlated-response",
      status: "satisfied",
      exercised: true,
      summary: "No forbidden correlated activation-target relationship occurred.",
    });
  });

});
