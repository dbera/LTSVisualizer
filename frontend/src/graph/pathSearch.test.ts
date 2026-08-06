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

  it("accepts an empty future constraint model", () => {
    const result = findKShortestBoundedPaths(
      searchInput(
        ["A", "B"],
        [{ id: "ab", source: "A", target: "B" }],
        { constraints: { requiredTransitions: [] } },
      ),
    );

    expect(result.paths.map((path) => path.edgeIds)).toEqual([["ab"]]);
  });

  it("rejects non-empty transition constraints until matching is implemented", () => {
    expect(() =>
      findKShortestBoundedPaths(
        searchInput(
          ["A", "B"],
          [{ id: "ab", source: "A", target: "B" }],
          {
            constraints: {
              requiredTransitions: [{ transition: "Approve" }],
            },
          },
        ),
      ),
    ).toThrow("Transition constraints are not implemented yet.");
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
  }, 15000);
});
