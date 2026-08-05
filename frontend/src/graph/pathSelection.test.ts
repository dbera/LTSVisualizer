import { describe, expect, it } from "vitest";
import {
  PathSelectionError,
  extendPath,
  getCandidateEdges,
  getPathEndpoint,
  getPathNodeIds,
  getSelectedEdges,
  isValidPath,
  resolvePath,
  startPath,
  undoPath,
  type PathGraph,
  type SelectedPath,
} from "./pathSelection";

const graph: PathGraph = {
  nodes: ["0", "1", "2", "3", "4"].map((id) => ({ id })),
  edges: [
    { id: "e01", source: "0", target: "1", transition: "Start" },
    { id: "e02", source: "0", target: "2", transition: "StartAlternative" },
    { id: "e12a", source: "1", target: "2", transition: "Retry" },
    { id: "e12b", source: "1", target: "2", transition: "Retry" },
    { id: "e13", source: "1", target: "3", transition: "Continue" },
    { id: "e21", source: "2", target: "1", transition: "LoopBack" },
    { id: "e24", source: "2", target: "4", transition: "Finish" },
    { id: "e34", source: "3", target: "4", transition: "Finish" },
  ],
};

function path(startNodeId: string, ...edgeIds: string[]): SelectedPath {
  return { startNodeId, edgeIds };
}

describe("startPath", () => {
  it("starts at a valid state", () => {
    expect(startPath(graph, "0")).toEqual({ startNodeId: "0", edgeIds: [] });
  });

  it("rejects an unknown start state", () => {
    expect(() => startPath(graph, "missing")).toThrow(PathSelectionError);
  });
});

describe("path endpoint and extension", () => {
  it("returns the start state for a path with no transitions", () => {
    expect(getPathEndpoint(graph, path("0"))).toBe("0");
  });

  it("returns the target of the final selected transition", () => {
    expect(getPathEndpoint(graph, path("0", "e01", "e13"))).toBe("3");
  });

  it("adds a connected transition without mutating the original path", () => {
    const original = path("0");
    const extended = extendPath(graph, original, "e01");
    expect(extended).toEqual(path("0", "e01"));
    expect(original).toEqual(path("0"));
  });

  it("rejects a transition from a different source state", () => {
    expect(() => extendPath(graph, path("0"), "e13")).toThrow(
      /current endpoint is state 0/
    );
  });

  it("rejects an unknown transition ID", () => {
    expect(() => extendPath(graph, path("0"), "unknown")).toThrow(
      /does not exist/
    );
  });
});

describe("undo", () => {
  it("removes only the final transition", () => {
    expect(undoPath(path("0", "e01", "e13"))).toEqual(path("0", "e01"));
  });

  it("is safe for a start-only path", () => {
    expect(undoPath(path("0"))).toEqual(path("0"));
  });
});

describe("candidate transitions", () => {
  it("returns every outgoing transition from the current endpoint", () => {
    expect(getCandidateEdges(graph, path("0")).map((edge) => edge.id)).toEqual([
      "e01",
      "e02",
    ]);
  });

  it("returns candidates from the new endpoint after extension", () => {
    expect(
      getCandidateEdges(graph, path("0", "e01")).map((edge) => edge.id)
    ).toEqual(["e12a", "e12b", "e13"]);
  });

  it("preserves transitions having the same name", () => {
    const retries = getCandidateEdges(graph, path("0", "e01")).filter(
      (edge) => edge.transition === "Retry"
    );
    expect(retries).toHaveLength(2);
    expect(retries.map((edge) => edge.id)).toEqual(["e12a", "e12b"]);
  });

  it("preserves parallel transitions with identical endpoints", () => {
    const parallel = getCandidateEdges(graph, path("0", "e01")).filter(
      (edge) => edge.source === "1" && edge.target === "2"
    );
    expect(parallel.map((edge) => edge.id)).toEqual(["e12a", "e12b"]);
  });

  it("selects the exact parallel transition by edge ID", () => {
    expect(extendPath(graph, path("0", "e01"), "e12b").edgeIds).toEqual([
      "e01",
      "e12b",
    ]);
  });

  it("returns no candidates at a terminal state", () => {
    expect(getCandidateEdges(graph, path("0", "e02", "e24"))).toEqual([]);
  });
});

describe("loops and repeated states", () => {
  it("adds a transition returning to an earlier state", () => {
    const loop = extendPath(graph, path("0", "e02"), "e21");
    expect(loop.edgeIds).toEqual(["e02", "e21"]);
    expect(getPathEndpoint(graph, loop)).toBe("1");
  });

  it("preserves repeated state occurrences in traversal order", () => {
    expect(getPathNodeIds(graph, path("0", "e01", "e12a", "e21"))).toEqual([
      "0",
      "1",
      "2",
      "1",
    ]);
  });

  it("undoes from a loop to the preceding occurrence", () => {
    const loop = path("0", "e01", "e12a", "e21");
    const undone = undoPath(loop);
    expect(getPathNodeIds(graph, undone)).toEqual(["0", "1", "2"]);
    expect(getPathEndpoint(graph, undone)).toBe("2");
  });

  it("continues selecting after completing a loop", () => {
    const loop = path("0", "e01", "e12a", "e21");
    const continued = extendPath(graph, loop, "e13");
    expect(getPathNodeIds(graph, continued)).toEqual(["0", "1", "2", "1", "3"]);
  });
});

describe("resolved information and validation", () => {
  it("resolves selected edges in traversal order", () => {
    expect(getSelectedEdges(graph, path("0", "e01", "e13")).map((edge) => edge.id)).toEqual([
      "e01",
      "e13",
    ]);
  });

  it("calculates counts and start/end states", () => {
    expect(resolvePath(graph, path("0", "e01", "e13"))).toMatchObject({
      startNodeId: "0",
      endNodeId: "3",
      stateCount: 3,
      transitionCount: 2,
    });
  });

  it("detects a disconnected saved path", () => {
    const malformed = path("0", "e01", "e24");
    expect(isValidPath(graph, malformed)).toBe(false);
    expect(() => resolvePath(graph, malformed)).toThrow(/current endpoint is state 1/);
  });

  it("detects a saved path containing an unknown edge", () => {
    expect(isValidPath(graph, path("0", "missing"))).toBe(false);
  });

  it("detects a saved path with an unknown start state", () => {
    expect(isValidPath(graph, path("missing"))).toBe(false);
  });

  it("rejects an edge whose target node is missing", () => {
    const invalidGraph: PathGraph = {
      nodes: [{ id: "0" }],
      edges: [{ id: "broken", source: "0", target: "9", transition: "Broken" }],
    };
    expect(() => extendPath(invalidGraph, path("0"), "broken")).toThrow(
      /targets missing state 9/
    );
  });
});
