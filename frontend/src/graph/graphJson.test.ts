import { describe, expect, it } from "vitest";
import {
  createGraphJsonDocument,
  createSelectedPathJsonDocument,
  parseGraphJsonText,
  parseGraphJsonValue,
  serializeGraphJson,
  type JsonGraphData,
} from "./graphJson";

const graph: JsonGraphData = {
  nodes: [
    { id: "0", marking_raw: "{input={}}", marking: { input: [] } },
    { id: "1", marking_raw: null, marking: { processing: [{ id: 42 }] } },
    { id: "2", marking_raw: null, marking: null },
  ],
  edges: [
    {
      id: "e01a",
      source: "0",
      target: "1",
      transition: "Start",
      color: null,
      inputs_raw: null,
      inputs: { request: { id: 42 } },
    },
    {
      id: "e01b",
      source: "0",
      target: "1",
      transition: "Start",
      color: "darkorange",
      inputs_raw: "{request -> '{}'}",
      inputs: null,
    },
    {
      id: "e12",
      source: "1",
      target: "2",
      transition: "Continue",
      color: null,
      inputs_raw: null,
      inputs: null,
    },
    {
      id: "e21",
      source: "2",
      target: "1",
      transition: "LoopBack",
      color: null,
      inputs_raw: null,
      inputs: null,
    },
  ],
};

describe("graph JSON parsing", () => {
  it("parses a canonical graph document", () => {
    const result = parseGraphJsonValue({
      format: "ltsvisualizer",
      version: 1,
      type: "graph",
      nodes: graph.nodes,
      edges: graph.edges,
    });
    expect(result.graph).toEqual(graph);
    expect(result.selectedPath).toBeNull();
  });

  it("normalizes a plain nodes-and-edges document", () => {
    const result = parseGraphJsonValue({ nodes: graph.nodes, edges: graph.edges });
    expect(result.document).toMatchObject({
      format: "ltsvisualizer",
      version: 1,
      type: "graph",
    });
  });

  it("defaults omitted optional semantic fields to null", () => {
    const result = parseGraphJsonValue({
      nodes: [{ id: "0" }, { id: "1" }],
      edges: [{ id: "e", source: "0", target: "1", transition: "Go" }],
    });
    expect(result.graph.nodes[0]).toEqual({
      id: "0",
      marking_raw: null,
      marking: null,
    });
    expect(result.graph.edges[0]).toEqual({
      id: "e",
      source: "0",
      target: "1",
      transition: "Go",
      color: null,
      inputs_raw: null,
      inputs: null,
    });
  });

  it("preserves unknown metadata", () => {
    const result = parseGraphJsonValue({
      format: "ltsvisualizer",
      version: 1,
      type: "graph",
      metadata: { title: "Example", producer: "OfflineMBT" },
      nodes: graph.nodes,
      edges: graph.edges,
    });
    expect(result.document.metadata).toEqual({
      title: "Example",
      producer: "OfflineMBT",
    });
  });

  it("reports malformed JSON text", () => {
    expect(() => parseGraphJsonText("{broken")).toThrow(/Invalid JSON/);
  });
});

describe("graph validation", () => {
  it("requires a JSON object root", () => {
    expect(() => parseGraphJsonValue([])).toThrow(/JSON root must be a JSON object/);
  });

  it("requires nodes and edges arrays", () => {
    expect(() => parseGraphJsonValue({ edges: [] })).toThrow(/nodes array/);
    expect(() => parseGraphJsonValue({ nodes: [] })).toThrow(/edges array/);
  });

  it("rejects duplicate node IDs", () => {
    expect(() =>
      parseGraphJsonValue({
        nodes: [{ id: "0" }, { id: "0" }],
        edges: [],
      })
    ).toThrow(/Duplicate node ID: 0/);
  });

  it("rejects duplicate edge IDs", () => {
    expect(() =>
      parseGraphJsonValue({
        nodes: [{ id: "0" }, { id: "1" }],
        edges: [
          { id: "e", source: "0", target: "1", transition: "A" },
          { id: "e", source: "0", target: "1", transition: "B" },
        ],
      })
    ).toThrow(/Duplicate edge ID: e/);
  });

  it("rejects missing source and target states", () => {
    expect(() =>
      parseGraphJsonValue({
        nodes: [{ id: "0" }],
        edges: [{ id: "e", source: "9", target: "0", transition: "A" }],
      })
    ).toThrow(/missing source state 9/);
    expect(() =>
      parseGraphJsonValue({
        nodes: [{ id: "0" }],
        edges: [{ id: "e", source: "0", target: "9", transition: "A" }],
      })
    ).toThrow(/missing target state 9/);
  });

  it("requires non-empty string IDs and transition names", () => {
    expect(() =>
      parseGraphJsonValue({ nodes: [{ id: 0 }], edges: [] })
    ).toThrow(/nodes\[0\].id/);
    expect(() =>
      parseGraphJsonValue({
        nodes: [{ id: "0" }, { id: "1" }],
        edges: [{ id: "e", source: "0", target: "1", transition: "" }],
      })
    ).toThrow(/transition must be a non-empty string/);
  });

  it("requires marking places to contain token arrays", () => {
    expect(() =>
      parseGraphJsonValue({
        nodes: [{ id: "0", marking: { place: "not-array" } }],
        edges: [],
      })
    ).toThrow(/marking.place must be an array/);
  });

  it("validates envelope format, version, and type", () => {
    expect(() =>
      parseGraphJsonValue({ format: "other", version: 1, type: "graph", nodes: [], edges: [] })
    ).toThrow(/format must be/);
    expect(() =>
      parseGraphJsonValue({ format: "ltsvisualizer", version: 2, type: "graph", nodes: [], edges: [] })
    ).toThrow(/version 1/);
    expect(() =>
      parseGraphJsonValue({ format: "ltsvisualizer", version: 1, type: "other", nodes: [], edges: [] })
    ).toThrow(/type must be/);
  });
});

describe("selected-path JSON", () => {
  it("parses and validates an ordered selected path", () => {
    const result = parseGraphJsonValue({
      format: "ltsvisualizer",
      version: 1,
      type: "selected-path",
      nodes: graph.nodes,
      edges: graph.edges,
      path: { startNodeId: "0", edgeIds: ["e01a", "e12"] },
    });
    expect(result.selectedPath).toEqual({
      startNodeId: "0",
      edgeIds: ["e01a", "e12"],
    });
  });

  it("preserves an exact parallel edge selection", () => {
    const result = parseGraphJsonValue({
      type: "selected-path",
      nodes: graph.nodes,
      edges: graph.edges,
      path: { startNodeId: "0", edgeIds: ["e01b"] },
    });
    expect(result.selectedPath?.edgeIds).toEqual(["e01b"]);
  });

  it("supports loops and repeated states", () => {
    const result = parseGraphJsonValue({
      type: "selected-path",
      nodes: graph.nodes,
      edges: graph.edges,
      path: { startNodeId: "0", edgeIds: ["e01a", "e12", "e21"] },
    });
    expect(result.selectedPath?.edgeIds).toEqual(["e01a", "e12", "e21"]);
  });

  it("rejects an unknown path edge", () => {
    expect(() =>
      parseGraphJsonValue({
        type: "selected-path",
        nodes: graph.nodes,
        edges: graph.edges,
        path: { startNodeId: "0", edgeIds: ["missing"] },
      })
    ).toThrow(/Invalid selected path/);
  });

  it("rejects a disconnected path", () => {
    expect(() =>
      parseGraphJsonValue({
        type: "selected-path",
        nodes: graph.nodes,
        edges: graph.edges,
        path: { startNodeId: "0", edgeIds: ["e12"] },
      })
    ).toThrow(/current endpoint is state 0/);
  });
});

describe("serialization and round trips", () => {
  it("creates and round-trips a graph document", () => {
    const document = createGraphJsonDocument(graph, { title: "Graph" });
    const reparsed = parseGraphJsonText(serializeGraphJson(document));
    expect(reparsed.graph).toEqual(graph);
    expect(reparsed.document.metadata).toMatchObject({
      title: "Graph",
      stateCount: 3,
      transitionCount: 4,
    });
  });

  it("preserves every node, edge, parallel transition, and semantic field", () => {
    const document = createGraphJsonDocument(graph);
    const reparsed = parseGraphJsonText(serializeGraphJson(document));

    expect(reparsed.graph.nodes).toEqual(graph.nodes);
    expect(reparsed.graph.edges).toEqual(graph.edges);
    expect(reparsed.graph.edges.filter((edge) => edge.source === "0" && edge.target === "1"))
      .toEqual([graph.edges[0], graph.edges[1]]);
    expect(reparsed.graph.nodes[0].marking_raw).toBe("{input={}}");
    expect(reparsed.graph.edges[0].inputs).toEqual({ request: { id: 42 } });
    expect(reparsed.graph.edges[1].color).toBe("darkorange");
  });

  it("creates a self-contained selected-path subset", () => {
    const document = createSelectedPathJsonDocument(
      graph,
      { startNodeId: "0", edgeIds: ["e01a", "e12"] },
      { title: "Selected path" }
    );
    expect(document.nodes.map((node) => node.id)).toEqual(["0", "1", "2"]);
    expect(document.edges.map((edge) => edge.id)).toEqual(["e01a", "e12"]);
    expect(document.metadata).toMatchObject({
      title: "Selected path",
      startStateId: "0",
      endStateId: "2",
      stateCount: 3,
      transitionCount: 2,
    });
  });

  it("deduplicates repeated states in a loop document", () => {
    const document = createSelectedPathJsonDocument(graph, {
      startNodeId: "0",
      edgeIds: ["e01a", "e12", "e21"],
    });
    expect(document.nodes.map((node) => node.id)).toEqual(["0", "1", "2"]);
    expect(document.path.edgeIds).toEqual(["e01a", "e12", "e21"]);
  });

  it("round-trips semantic data and exact path order", () => {
    const document = createSelectedPathJsonDocument(graph, {
      startNodeId: "0",
      edgeIds: ["e01b", "e12", "e21"],
    });
    const reparsed = parseGraphJsonText(serializeGraphJson(document));
    expect(reparsed.graph).toEqual({
      nodes: graph.nodes,
      edges: [graph.edges[1], graph.edges[2], graph.edges[3]],
    });
    expect(reparsed.selectedPath?.edgeIds).toEqual(["e01b", "e12", "e21"]);
  });

  it("writes formatted JSON with a trailing newline", () => {
    const text = serializeGraphJson(createGraphJsonDocument(graph));
    expect(text).toContain('\n  "nodes": [');
    expect(text.endsWith("\n")).toBe(true);
  });
});
