import { describe, expect, it } from "vitest";
import {
  PathExportError,
  resolveSelectedPath,
  serializePathToPlantUml,
  type ExportGraphData,
} from "./pathExport";

const graph: ExportGraphData = {
  nodes: [
    {
      id: "0",
      marking_raw: `{input={'{"id": 42}'}}`,
      marking: { input: [{ id: 42 }] },
    },
    {
      id: "1",
      marking_raw: `{processing={'{"id": 42, "active": true}'}}`,
      marking: { processing: [{ id: 42, active: true }] },
    },
    {
      id: "2",
      marking_raw: null,
      marking: { output: [{ id: 42, status: "complete" }] },
    },
  ],
  edges: [
    {
      id: "edge-0",
      source: "0",
      target: "1",
      transition: "StartProcessing",
      color: null,
      inputs_raw: `{request -> '{"id": 42}'}`,
      inputs: { request: { id: 42 } },
    },
    {
      id: "edge-1",
      source: "1",
      target: "2",
      transition: "CompleteProcessing",
      color: "darkorange",
      inputs_raw: null,
      inputs: { activeRequest: { id: 42, active: true } },
    },
    {
      id: "edge-2",
      source: "1",
      target: "0",
      transition: "Retry",
      color: null,
      inputs_raw: null,
      inputs: null,
    },
    {
      id: "edge-parallel",
      source: "0",
      target: "1",
      transition: "AlternativeStart",
      color: "#darkorange",
      inputs_raw: null,
      inputs: null,
    },
  ],
};

describe("resolveSelectedPath", () => {
  it("resolves an ordered path by edge ID", () => {
    const path = resolveSelectedPath(graph, {
      startNodeId: "0",
      edgeIds: ["edge-0", "edge-1"],
    });

    expect(path.nodeIds).toEqual(["0", "1", "2"]);
    expect(path.edgeIds).toEqual(["edge-0", "edge-1"]);
    expect(path.endNodeId).toBe("2");
  });

  it("supports paths that revisit a state", () => {
    const path = resolveSelectedPath(graph, {
      startNodeId: "0",
      edgeIds: ["edge-0", "edge-2", "edge-parallel"],
    });

    expect(path.nodeIds).toEqual(["0", "1", "0", "1"]);
    expect(path.edgeIds).toEqual([
      "edge-0",
      "edge-2",
      "edge-parallel",
    ]);
  });

  it("preserves the selected parallel edge", () => {
    const path = resolveSelectedPath(graph, {
      startNodeId: "0",
      edgeIds: ["edge-parallel"],
    });

    expect(path.steps[0].transition).toBe("AlternativeStart");
    expect(path.steps[0].edgeId).toBe("edge-parallel");
  });

  it("rejects a disconnected edge sequence", () => {
    expect(() =>
      resolveSelectedPath(graph, {
        startNodeId: "0",
        edgeIds: ["edge-1"],
      })
    ).toThrow(PathExportError);
  });
});

describe("serializePathToPlantUml", () => {
  it("preserves raw comments, colors, labels, and final marking", () => {
    const result = serializePathToPlantUml(graph, {
      startNodeId: "0",
      edgeIds: ["edge-0", "edge-1"],
    });

    expect(result.content).toContain("@startuml");
    expect(result.content).toContain(
      `'Transition Inputs: {request -> '{"id": 42}'}`
    );
    expect(result.content).toContain(
      `'Marking (State): {input={'{"id": 42}'}}`
    );
    expect(result.content).toContain(
      "(0) --> (1): StartProcessing"
    );
    expect(result.content).toContain(
      "(1) -[#darkorange]-> (2): CompleteProcessing"
    );
    expect(result.content).toContain(
      `'Marking (State): {output={'{"id":42,"status":"complete"}'}}`
    );
    expect(result.content).toContain(
      "title Selected path: 3 states and 2 transitions"
    );
    expect(result.content).toContain("@enduml");
    expect(result.fileName).toBe("LTSVisualizer-path-0-to-2.puml");
  });

  it("exports a single selected state", () => {
    const result = serializePathToPlantUml(graph, {
      startNodeId: "0",
      edgeIds: [],
    });

    expect(result.content).toContain("(0)");
    expect(result.content).toContain(
      "title Selected path: 1 state and 0 transitions"
    );
  });

  it("normalizes a color that already contains a hash", () => {
    const result = serializePathToPlantUml(graph, {
      startNodeId: "0",
      edgeIds: ["edge-parallel"],
    });

    expect(result.content).toContain(
      "(0) -[#darkorange]-> (1): AlternativeStart"
    );
    expect(result.content).not.toContain("##darkorange");
  });
});
