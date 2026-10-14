import { describe, expect, it } from "vitest";
import { collectUndirectedNeighborhood } from "./neighborhoodExpansion";

const graph = {
  nodes: ["0", "1", "2", "3", "4"].map((id) => ({ id })),
  edges: [
    { id: "e01a", source: "0", target: "1" },
    { id: "e01b", source: "0", target: "1" },
    { id: "e12", source: "1", target: "2" },
    { id: "e23", source: "2", target: "3" },
    { id: "loop3", source: "3", target: "3" },
  ],
};

describe("collectUndirectedNeighborhood", () => {
  it("collects one, two, and three hop neighborhoods", () => {
    expect([...collectUndirectedNeighborhood(graph, "0", 1).nodeIds]).toEqual(["0", "1"]);
    expect([...collectUndirectedNeighborhood(graph, "0", 2).nodeIds]).toEqual(["0", "1", "2"]);
    expect([...collectUndirectedNeighborhood(graph, "0", 3).nodeIds]).toEqual(["0", "1", "2", "3"]);
  });

  it("uses incoming and outgoing adjacency like the existing neighborhood view", () => {
    const result = collectUndirectedNeighborhood(graph, "2", 1);
    expect([...result.nodeIds]).toEqual(["2", "1", "3"]);
    expect(result.distanceByNodeId.get("1")).toBe(1);
    expect(result.distanceByNodeId.get("3")).toBe(1);
  });

  it("preserves parallel edges and self-loops by exact edge ID", () => {
    expect([...collectUndirectedNeighborhood(graph, "0", 1).edgeIds]).toEqual(["e01a", "e01b"]);
    expect(collectUndirectedNeighborhood(graph, "3", 0).edgeIds.has("loop3")).toBe(true);
  });

  it("does not mutate the graph and safely handles unknown states", () => {
    const original = structuredClone(graph);
    expect(collectUndirectedNeighborhood(graph, "missing", 2).nodeIds.size).toBe(0);
    expect(graph).toEqual(original);
  });
});
