import { describe, expect, it } from "vitest";

import {
  analyzeGraph,
  findStronglyConnectedComponents,
  findTerminalNodeIds,
  type GraphAnalysisInput,
} from "./graphAnalysis";

function graph(
  nodeIds: string[],
  edges: GraphAnalysisInput["edges"],
): GraphAnalysisInput {
  return {
    nodeIds,
    edges,
  };
}

describe("findTerminalNodeIds", () => {
  it("returns no terminal states for an empty graph", () => {
    expect(
      findTerminalNodeIds(graph([], [])),
    ).toEqual([]);
  });

  it("returns an isolated state as terminal", () => {
    expect(
      findTerminalNodeIds(graph(["0"], [])),
    ).toEqual(["0"]);
  });

  it("returns the final state of a linear graph", () => {
    expect(
      findTerminalNodeIds(
        graph(
          ["0", "1", "2"],
          [
            {
              id: "edge-0",
              source: "0",
              target: "1",
            },
            {
              id: "edge-1",
              source: "1",
              target: "2",
            },
          ],
        ),
      ),
    ).toEqual(["2"]);
  });

  it("returns multiple terminal states in node order", () => {
    expect(
      findTerminalNodeIds(
        graph(
          ["start", "left", "right"],
          [
            {
              id: "edge-left",
              source: "start",
              target: "left",
            },
            {
              id: "edge-right",
              source: "start",
              target: "right",
            },
          ],
        ),
      ),
    ).toEqual(["left", "right"]);
  });

  it("does not classify a state with a self-loop as terminal", () => {
    expect(
      findTerminalNodeIds(
        graph(
          ["loop"],
          [
            {
              id: "self-loop",
              source: "loop",
              target: "loop",
            },
          ],
        ),
      ),
    ).toEqual([]);
  });

  it("handles parallel outgoing edges", () => {
    expect(
      findTerminalNodeIds(
        graph(
          ["0", "1"],
          [
            {
              id: "edge-a",
              source: "0",
              target: "1",
            },
            {
              id: "edge-b",
              source: "0",
              target: "1",
            },
          ],
        ),
      ),
    ).toEqual(["1"]);
  });

  it("handles disconnected graph regions", () => {
    expect(
      findTerminalNodeIds(
        graph(
          ["a", "b", "c", "d", "isolated"],
          [
            {
              id: "edge-ab",
              source: "a",
              target: "b",
            },
            {
              id: "edge-cd",
              source: "c",
              target: "d",
            },
          ],
        ),
      ),
    ).toEqual(["b", "d", "isolated"]);
  });

  it("supports non-numeric node IDs", () => {
    expect(
      findTerminalNodeIds(
        graph(
          ["ready", "processing", "completed"],
          [
            {
              id: "start-processing",
              source: "ready",
              target: "processing",
            },
            {
              id: "finish-processing",
              source: "processing",
              target: "completed",
            },
          ],
        ),
      ),
    ).toEqual(["completed"]);
  });

  it("does not modify the input", () => {
    const input = graph(
      ["0", "1"],
      [
        {
          id: "edge-0",
          source: "0",
          target: "1",
        },
      ],
    );

    const originalInput = structuredClone(input);

    findTerminalNodeIds(input);

    expect(input).toEqual(originalInput);
  });

  it("returns duplicate node IDs only once", () => {
    expect(
      findTerminalNodeIds(
        graph(
          ["0", "1", "1"],
          [
            {
              id: "edge-0",
              source: "0",
              target: "1",
            },
          ],
        ),
      ),
    ).toEqual(["1"]);
  });

  it("ignores outgoing edges from IDs absent from nodeIds", () => {
    expect(
      findTerminalNodeIds(
        graph(
          ["known"],
          [
            {
              id: "external-edge",
              source: "external",
              target: "known",
            },
          ],
        ),
      ),
    ).toEqual(["known"]);
  });
});

describe("findStronglyConnectedComponents", () => {
  it("returns no components for an empty graph", () => {
    expect(
      findStronglyConnectedComponents(graph([], [])),
    ).toEqual([]);
  });

  it("returns an isolated state as a non-cyclic component", () => {
    expect(
      findStronglyConnectedComponents(
        graph(["0"], []),
      ),
    ).toEqual([
      {
        id: 0,
        nodeIds: ["0"],
        internalEdgeIds: [],
        isCyclic: false,
      },
    ]);
  });

  it("classifies a self-loop component as cyclic", () => {
    expect(
      findStronglyConnectedComponents(
        graph(
          ["0"],
          [
            {
              id: "self-loop",
              source: "0",
              target: "0",
            },
          ],
        ),
      ),
    ).toEqual([
      {
        id: 0,
        nodeIds: ["0"],
        internalEdgeIds: ["self-loop"],
        isCyclic: true,
      },
    ]);
  });

  it("returns one component per state in a linear graph", () => {
    expect(
      findStronglyConnectedComponents(
        graph(
          ["0", "1", "2"],
          [
            {
              id: "edge-0",
              source: "0",
              target: "1",
            },
            {
              id: "edge-1",
              source: "1",
              target: "2",
            },
          ],
        ),
      ),
    ).toEqual([
      {
        id: 0,
        nodeIds: ["0"],
        internalEdgeIds: [],
        isCyclic: false,
      },
      {
        id: 1,
        nodeIds: ["1"],
        internalEdgeIds: [],
        isCyclic: false,
      },
      {
        id: 2,
        nodeIds: ["2"],
        internalEdgeIds: [],
        isCyclic: false,
      },
    ]);
  });

  it("finds a simple directed cycle", () => {
    expect(
      findStronglyConnectedComponents(
        graph(
          ["0", "1", "2"],
          [
            {
              id: "edge-01",
              source: "0",
              target: "1",
            },
            {
              id: "edge-12",
              source: "1",
              target: "2",
            },
            {
              id: "edge-20",
              source: "2",
              target: "0",
            },
          ],
        ),
      ),
    ).toEqual([
      {
        id: 0,
        nodeIds: ["0", "1", "2"],
        internalEdgeIds: [
          "edge-01",
          "edge-12",
          "edge-20",
        ],
        isCyclic: true,
      },
    ]);
  });

  it("finds two disconnected cycles", () => {
    expect(
      findStronglyConnectedComponents(
        graph(
          ["a", "b", "c", "d"],
          [
            {
              id: "edge-ab",
              source: "a",
              target: "b",
            },
            {
              id: "edge-ba",
              source: "b",
              target: "a",
            },
            {
              id: "edge-cd",
              source: "c",
              target: "d",
            },
            {
              id: "edge-dc",
              source: "d",
              target: "c",
            },
          ],
        ),
      ),
    ).toEqual([
      {
        id: 0,
        nodeIds: ["a", "b"],
        internalEdgeIds: ["edge-ab", "edge-ba"],
        isCyclic: true,
      },
      {
        id: 1,
        nodeIds: ["c", "d"],
        internalEdgeIds: ["edge-cd", "edge-dc"],
        isCyclic: true,
      },
    ]);
  });

  it("separates a cycle from its outgoing tail", () => {
    expect(
      findStronglyConnectedComponents(
        graph(
          ["0", "1", "2"],
          [
            {
              id: "edge-01",
              source: "0",
              target: "1",
            },
            {
              id: "edge-10",
              source: "1",
              target: "0",
            },
            {
              id: "edge-12",
              source: "1",
              target: "2",
            },
          ],
        ),
      ),
    ).toEqual([
      {
        id: 0,
        nodeIds: ["0", "1"],
        internalEdgeIds: ["edge-01", "edge-10"],
        isCyclic: true,
      },
      {
        id: 1,
        nodeIds: ["2"],
        internalEdgeIds: [],
        isCyclic: false,
      },
    ]);
  });

  it("separates an incoming state from a cycle", () => {
    expect(
      findStronglyConnectedComponents(
        graph(
          ["entry", "a", "b"],
          [
            {
              id: "edge-entry-a",
              source: "entry",
              target: "a",
            },
            {
              id: "edge-ab",
              source: "a",
              target: "b",
            },
            {
              id: "edge-ba",
              source: "b",
              target: "a",
            },
          ],
        ),
      ),
    ).toEqual([
      {
        id: 0,
        nodeIds: ["entry"],
        internalEdgeIds: [],
        isCyclic: false,
      },
      {
        id: 1,
        nodeIds: ["a", "b"],
        internalEdgeIds: ["edge-ab", "edge-ba"],
        isCyclic: true,
      },
    ]);
  });

  it("preserves parallel internal edge IDs", () => {
    expect(
      findStronglyConnectedComponents(
        graph(
          ["0", "1"],
          [
            {
              id: "edge-forward-a",
              source: "0",
              target: "1",
            },
            {
              id: "edge-forward-b",
              source: "0",
              target: "1",
            },
            {
              id: "edge-back",
              source: "1",
              target: "0",
            },
          ],
        ),
      ),
    ).toEqual([
      {
        id: 0,
        nodeIds: ["0", "1"],
        internalEdgeIds: [
          "edge-forward-a",
          "edge-forward-b",
          "edge-back",
        ],
        isCyclic: true,
      },
    ]);
  });

  it("handles mixed cyclic and acyclic regions", () => {
    const components = findStronglyConnectedComponents(
      graph(
        ["start", "a", "b", "end", "isolated"],
        [
          {
            id: "edge-start-a",
            source: "start",
            target: "a",
          },
          {
            id: "edge-ab",
            source: "a",
            target: "b",
          },
          {
            id: "edge-ba",
            source: "b",
            target: "a",
          },
          {
            id: "edge-b-end",
            source: "b",
            target: "end",
          },
        ],
      ),
    );

    expect(components).toEqual([
      {
        id: 0,
        nodeIds: ["start"],
        internalEdgeIds: [],
        isCyclic: false,
      },
      {
        id: 1,
        nodeIds: ["a", "b"],
        internalEdgeIds: ["edge-ab", "edge-ba"],
        isCyclic: true,
      },
      {
        id: 2,
        nodeIds: ["end"],
        internalEdgeIds: [],
        isCyclic: false,
      },
      {
        id: 3,
        nodeIds: ["isolated"],
        internalEdgeIds: [],
        isCyclic: false,
      },
    ]);
  });

  it("ignores edges that reference unknown nodes", () => {
    expect(
      findStronglyConnectedComponents(
        graph(
          ["known"],
          [
            {
              id: "unknown-source",
              source: "external",
              target: "known",
            },
            {
              id: "unknown-target",
              source: "known",
              target: "external",
            },
          ],
        ),
      ),
    ).toEqual([
      {
        id: 0,
        nodeIds: ["known"],
        internalEdgeIds: [],
        isCyclic: false,
      },
    ]);
  });

  it("does not modify the input", () => {
    const input = graph(
      ["0", "1"],
      [
        {
          id: "edge-01",
          source: "0",
          target: "1",
        },
        {
          id: "edge-10",
          source: "1",
          target: "0",
        },
      ],
    );

    const originalInput = structuredClone(input);

    findStronglyConnectedComponents(input);

    expect(input).toEqual(originalInput);
  });

  it("handles a long graph without recursive calls", () => {
    const nodeCount = 20_000;
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

    const components = findStronglyConnectedComponents(
      graph(nodeIds, edges),
    );

    expect(components).toHaveLength(nodeCount);
    expect(components[0].nodeIds).toEqual(["0"]);
    expect(components[nodeCount - 1].nodeIds).toEqual([
      String(nodeCount - 1),
    ]);
    expect(
      components.every((component) => !component.isCyclic),
    ).toBe(true);
  });

  it("handles one large strongly connected component", () => {
    const nodeCount = 10_000;
    const nodeIds = Array.from(
      { length: nodeCount },
      (_, index) => String(index),
    );

    const edges = Array.from(
      { length: nodeCount },
      (_, index) => ({
        id: `edge-${index}`,
        source: String(index),
        target: String((index + 1) % nodeCount),
      }),
    );

    const components = findStronglyConnectedComponents(
      graph(nodeIds, edges),
    );

    expect(components).toHaveLength(1);
    expect(components[0].nodeIds).toHaveLength(nodeCount);
    expect(components[0].internalEdgeIds).toHaveLength(
      nodeCount,
    );
    expect(components[0].isCyclic).toBe(true);
  });
});

describe("analyzeGraph", () => {
  it("returns an empty result for an empty graph", () => {
    expect(analyzeGraph(graph([], []))).toEqual({
      terminalNodeIds: [],
      components: [],
      cyclicComponents: [],
      statesInCyclicComponents: 0,
      largestCyclicComponentSize: 0,
    });
  });

  it("combines terminal and component analysis", () => {
    const result = analyzeGraph(
      graph(
        ["start", "a", "b", "end", "isolated"],
        [
          {
            id: "edge-start-a",
            source: "start",
            target: "a",
          },
          {
            id: "edge-ab",
            source: "a",
            target: "b",
          },
          {
            id: "edge-ba",
            source: "b",
            target: "a",
          },
          {
            id: "edge-b-end",
            source: "b",
            target: "end",
          },
        ],
      ),
    );

    expect(result.terminalNodeIds).toEqual([
      "end",
      "isolated",
    ]);
    expect(result.components).toEqual([
      {
        id: 0,
        nodeIds: ["start"],
        internalEdgeIds: [],
        isCyclic: false,
      },
      {
        id: 1,
        nodeIds: ["a", "b"],
        internalEdgeIds: ["edge-ab", "edge-ba"],
        isCyclic: true,
      },
      {
        id: 2,
        nodeIds: ["end"],
        internalEdgeIds: [],
        isCyclic: false,
      },
      {
        id: 3,
        nodeIds: ["isolated"],
        internalEdgeIds: [],
        isCyclic: false,
      },
    ]);
    expect(result.cyclicComponents).toEqual([
      {
        id: 1,
        nodeIds: ["a", "b"],
        internalEdgeIds: ["edge-ab", "edge-ba"],
        isCyclic: true,
      },
    ]);
    expect(result.statesInCyclicComponents).toBe(2);
    expect(result.largestCyclicComponentSize).toBe(2);
  });

  it("counts a self-loop as a cyclic component", () => {
    const result = analyzeGraph(
      graph(
        ["loop", "terminal"],
        [
          {
            id: "self-loop",
            source: "loop",
            target: "loop",
          },
        ],
      ),
    );

    expect(result.terminalNodeIds).toEqual(["terminal"]);
    expect(result.cyclicComponents).toHaveLength(1);
    expect(result.cyclicComponents[0].nodeIds).toEqual([
      "loop",
    ]);
    expect(result.statesInCyclicComponents).toBe(1);
    expect(result.largestCyclicComponentSize).toBe(1);
  });

  it("orders cyclic components by descending size", () => {
    const result = analyzeGraph(
      graph(
        ["a", "b", "x", "y", "z"],
        [
          {
            id: "edge-ab",
            source: "a",
            target: "b",
          },
          {
            id: "edge-ba",
            source: "b",
            target: "a",
          },
          {
            id: "edge-xy",
            source: "x",
            target: "y",
          },
          {
            id: "edge-yz",
            source: "y",
            target: "z",
          },
          {
            id: "edge-zx",
            source: "z",
            target: "x",
          },
        ],
      ),
    );

    expect(
      result.cyclicComponents.map(
        (component) => component.nodeIds,
      ),
    ).toEqual([
      ["x", "y", "z"],
      ["a", "b"],
    ]);
    expect(result.statesInCyclicComponents).toBe(5);
    expect(result.largestCyclicComponentSize).toBe(3);
  });

  it("preserves component order when cyclic sizes are equal", () => {
    const result = analyzeGraph(
      graph(
        ["a", "b", "c", "d"],
        [
          {
            id: "edge-ab",
            source: "a",
            target: "b",
          },
          {
            id: "edge-ba",
            source: "b",
            target: "a",
          },
          {
            id: "edge-cd",
            source: "c",
            target: "d",
          },
          {
            id: "edge-dc",
            source: "d",
            target: "c",
          },
        ],
      ),
    );

    expect(
      result.cyclicComponents.map(
        (component) => component.nodeIds,
      ),
    ).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("does not modify the input", () => {
    const input = graph(
      ["0", "1"],
      [
        {
          id: "edge-01",
          source: "0",
          target: "1",
        },
      ],
    );
    const originalInput = structuredClone(input);

    analyzeGraph(input);

    expect(input).toEqual(originalInput);
  });

  it("returns zero cyclic statistics for an acyclic graph", () => {
    const result = analyzeGraph(
      graph(
        ["0", "1", "2"],
        [
          {
            id: "edge-01",
            source: "0",
            target: "1",
          },
          {
            id: "edge-12",
            source: "1",
            target: "2",
          },
        ],
      ),
    );

    expect(result.terminalNodeIds).toEqual(["2"]);
    expect(result.components).toHaveLength(3);
    expect(result.cyclicComponents).toEqual([]);
    expect(result.statesInCyclicComponents).toBe(0);
    expect(result.largestCyclicComponentSize).toBe(0);
  });
});
