import { describe, expect, it } from "vitest";

import {
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
