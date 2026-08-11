import type { DeclareConstraint } from "./declareConstraints";
import type { PathSearchEndpointMode, PathSearchStrategy } from "./pathSearch";
import { parseDeclareConstraintsJson } from "./declareConstraintJson";
import {
  resolvePath,
  type PathEdge,
  type PathNode,
  type SelectedPath,
} from "./pathSelection";

export type JsonObject = Record<string, unknown>;

export interface JsonGraphNode extends PathNode {
  marking_raw: string | null;
  marking: Record<string, unknown[]> | null;
}

export interface JsonGraphEdge extends PathEdge {
  color: string | null;
  inputs_raw: string | null;
  inputs: Record<string, unknown> | null;
  outputs_raw: string | null;
  outputs: Record<string, unknown[]> | null;
}

export interface JsonGraphData {
  nodes: JsonGraphNode[];
  edges: JsonGraphEdge[];
}

export interface GraphJsonMetadata {
  title?: string;
  createdAt?: string;
  [key: string]: unknown;
}
export interface PersistedPathSearchConfiguration {
  sourceNodeId: string;
  endpointMode: PathSearchEndpointMode;
  strategy?: PathSearchStrategy;
  targetNodeId?: string;
  requestedPathCount: number;
  maximumVisitsPerState: number;
  requireConstraintExercise: boolean;
}

export interface GraphJsonDocument {
  format: "ltsvisualizer";
  version: 1;
  type: "graph";
  metadata?: GraphJsonMetadata;
  nodes: JsonGraphNode[];
  edges: JsonGraphEdge[];
  declareConstraints?: DeclareConstraint[];
  pathSearch?: PersistedPathSearchConfiguration;
}

export interface SelectedPathJsonDocument {
  format: "ltsvisualizer";
  version: 1;
  type: "selected-path";
  metadata?: GraphJsonMetadata & {
    startStateId?: string;
    endStateId?: string;
    stateCount?: number;
    transitionCount?: number;
  };
  nodes: JsonGraphNode[];
  edges: JsonGraphEdge[];
  path: SelectedPath;
  declareConstraints?: DeclareConstraint[];
  pathSearch?: PersistedPathSearchConfiguration;
}

export type LtsVisualizerJsonDocument =
  | GraphJsonDocument
  | SelectedPathJsonDocument;

export interface ParsedGraphJson {
  document: LtsVisualizerJsonDocument;
  graph: JsonGraphData;
  selectedPath: SelectedPath | null;
  declareConstraints: DeclareConstraint[];
  pathSearch: PersistedPathSearchConfiguration | null;
}

export class GraphJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphJsonError";
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) {
    throw new GraphJsonError(`${label} must be a JSON object.`);
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new GraphJsonError(`${label} must be a non-empty string.`);
  }
  return value;
}

function optionalNullableString(value: unknown, label: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new GraphJsonError(`${label} must be a string or null.`);
  }
  return value;
}

function optionalNullableObject(
  value: unknown,
  label: string
): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isObject(value)) {
    throw new GraphJsonError(`${label} must be an object or null.`);
  }
  return value;
}

function parseNode(value: unknown, index: number): JsonGraphNode {
  const node = requireObject(value, `nodes[${index}]`);
  const marking = optionalNullableObject(node.marking, `nodes[${index}].marking`);

  if (marking) {
    Object.entries(marking).forEach(([place, tokens]) => {
      if (!Array.isArray(tokens)) {
        throw new GraphJsonError(
          `nodes[${index}].marking.${place} must be an array.`
        );
      }
    });
  }

  return {
    id: requireString(node.id, `nodes[${index}].id`),
    marking_raw: optionalNullableString(
      node.marking_raw,
      `nodes[${index}].marking_raw`
    ),
    marking: marking as Record<string, unknown[]> | null,
  };
}

function parseEdge(value: unknown, index: number): JsonGraphEdge {
  const edge = requireObject(value, `edges[${index}]`);
  const outputs = optionalNullableObject(
    edge.outputs,
    `edges[${index}].outputs`
  );

  if (outputs) {
    Object.entries(outputs).forEach(([place, tokens]) => {
      if (!Array.isArray(tokens)) {
        throw new GraphJsonError(
          `edges[${index}].outputs.${place} must be an array.`
        );
      }
    });
  }

  return {
    id: requireString(edge.id, `edges[${index}].id`),
    source: requireString(edge.source, `edges[${index}].source`),
    target: requireString(edge.target, `edges[${index}].target`),
    transition: requireString(
      edge.transition,
      `edges[${index}].transition`
    ),
    color: optionalNullableString(edge.color, `edges[${index}].color`),
    inputs_raw: optionalNullableString(
      edge.inputs_raw,
      `edges[${index}].inputs_raw`
    ),
    inputs: optionalNullableObject(edge.inputs, `edges[${index}].inputs`),
    outputs_raw: optionalNullableString(
      edge.outputs_raw,
      `edges[${index}].outputs_raw`
    ),
    outputs: outputs as Record<string, unknown[]> | null,
  };
}

function validateUniqueIds(values: { id: string }[], label: string): void {
  const seen = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value.id)) {
      throw new GraphJsonError(`Duplicate ${label} ID: ${value.id}.`);
    }
    seen.add(value.id);
  });
}

function validateGraph(graph: JsonGraphData): void {
  validateUniqueIds(graph.nodes, "node");
  validateUniqueIds(graph.edges, "edge");

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  graph.edges.forEach((edge) => {
    if (!nodeIds.has(edge.source)) {
      throw new GraphJsonError(
        `Edge ${edge.id} references missing source state ${edge.source}.`
      );
    }
    if (!nodeIds.has(edge.target)) {
      throw new GraphJsonError(
        `Edge ${edge.id} references missing target state ${edge.target}.`
      );
    }
  });
}

function parseSelectedPath(value: unknown): SelectedPath {
  const path = requireObject(value, "path");
  if (!Array.isArray(path.edgeIds)) {
    throw new GraphJsonError("path.edgeIds must be an array.");
  }

  return {
    startNodeId: requireString(path.startNodeId, "path.startNodeId"),
    edgeIds: path.edgeIds.map((edgeId, index) =>
      requireString(edgeId, `path.edgeIds[${index}]`)
    ),
  };
}

function parseMetadata(value: unknown): GraphJsonMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireObject(value, "metadata") as GraphJsonMetadata;
}
function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new GraphJsonError(`${label} must be a positive integer.`);
  }
  return value as number;
}
function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new GraphJsonError(`${label} must be a boolean.`);
  }
  return value;
}
function parsePathSearchConfiguration(
  value: unknown,
  graph: JsonGraphData,
): PersistedPathSearchConfiguration | undefined {
  if (value === undefined) return undefined;
  const configuration = requireObject(value, "pathSearch");
  const sourceNodeId = requireString(
    configuration.sourceNodeId,
    "pathSearch.sourceNodeId",
  );
  const endpointMode = configuration.endpointMode;
  if (
    endpointMode !== "specific-target" &&
    endpointMode !== "constraint-satisfaction"
  ) {
    throw new GraphJsonError(
      'pathSearch.endpointMode must be either "specific-target" or "constraint-satisfaction".',
    );
  }
  const strategyValue = configuration.strategy;
  if (
    strategyValue !== undefined &&
    strategyValue !== "shortest" &&
    strategyValue !== "any-witness"
  ) {
    throw new GraphJsonError(
      'pathSearch.strategy must be either "shortest" or "any-witness".',
    );
  }
  const strategy = strategyValue as PathSearchStrategy | undefined;
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(sourceNodeId)) {
    throw new GraphJsonError(
      `pathSearch.sourceNodeId references missing state ${sourceNodeId}.`,
    );
  }
  let targetNodeId: string | undefined;
  if (endpointMode === "specific-target") {
    targetNodeId = requireString(
      configuration.targetNodeId,
      "pathSearch.targetNodeId",
    );
    if (!nodeIds.has(targetNodeId)) {
      throw new GraphJsonError(
        `pathSearch.targetNodeId references missing state ${targetNodeId}.`,
      );
    }
  } else if (configuration.targetNodeId !== undefined) {
    throw new GraphJsonError(
      "pathSearch.targetNodeId must be omitted in constraint-satisfaction mode.",
    );
  }
  return {
    sourceNodeId,
    endpointMode,
    ...(strategy ? { strategy } : {}),
    ...(targetNodeId ? { targetNodeId } : {}),
    requestedPathCount: requirePositiveInteger(
      configuration.requestedPathCount,
      "pathSearch.requestedPathCount",
    ),
    maximumVisitsPerState: requirePositiveInteger(
      configuration.maximumVisitsPerState,
      "pathSearch.maximumVisitsPerState",
    ),
    requireConstraintExercise: requireBoolean(
      configuration.requireConstraintExercise,
      "pathSearch.requireConstraintExercise",
    ),
  };
}

function normalizeDocument(value: unknown): LtsVisualizerJsonDocument {
  const root = requireObject(value, "JSON root");

  if (!Array.isArray(root.nodes)) {
    throw new GraphJsonError("The JSON graph must contain a nodes array.");
  }
  if (!Array.isArray(root.edges)) {
    throw new GraphJsonError("The JSON graph must contain an edges array.");
  }

  const nodes = root.nodes.map(parseNode);
  const edges = root.edges.map(parseEdge);
  const graph = { nodes, edges };
  validateGraph(graph);

  if (root.format !== undefined && root.format !== "ltsvisualizer") {
    throw new GraphJsonError('format must be "ltsvisualizer".');
  }
  if (root.version !== undefined && root.version !== 1) {
    throw new GraphJsonError("Only JSON format version 1 is supported.");
  }
  if (
    root.type !== undefined &&
    root.type !== "graph" &&
    root.type !== "selected-path"
  ) {
    throw new GraphJsonError(
      'type must be either "graph" or "selected-path".'
    );
  }

  const type = root.type === "selected-path" || root.path !== undefined
    ? "selected-path"
    : "graph";
  const metadata = parseMetadata(root.metadata);
  const declareConstraints =
    root.declareConstraints === undefined
      ? []
      : parseDeclareConstraintsJson(root.declareConstraints);
  const pathSearch = parsePathSearchConfiguration(root.pathSearch, graph);

  if (type === "selected-path") {
    const selectedPath = parseSelectedPath(root.path);
    try {
      resolvePath(graph, selectedPath);
    } catch (error) {
      throw new GraphJsonError(
        error instanceof Error
          ? `Invalid selected path: ${error.message}`
          : "Invalid selected path."
      );
    }

    return {
      format: "ltsvisualizer",
      version: 1,
      type,
      ...(metadata ? { metadata } : {}),
      nodes,
      edges,
      path: selectedPath,
      ...(declareConstraints.length > 0 ? { declareConstraints } : {}),
      ...(pathSearch ? { pathSearch } : {}),
    };
  }

  return {
    format: "ltsvisualizer",
    version: 1,
    type,
    ...(metadata ? { metadata } : {}),
    nodes,
    edges,
    ...(declareConstraints.length > 0 ? { declareConstraints } : {}),
    ...(pathSearch ? { pathSearch } : {}),
  };
}

export function parseGraphJsonText(text: string): ParsedGraphJson {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new GraphJsonError(
      error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON."
    );
  }

  return parseGraphJsonValue(value);
}

export function parseGraphJsonValue(value: unknown): ParsedGraphJson {
  const document = normalizeDocument(value);
  return {
    document,
    graph: { nodes: document.nodes, edges: document.edges },
    selectedPath: document.type === "selected-path" ? document.path : null,
    declareConstraints: document.declareConstraints ?? [],
    pathSearch: document.pathSearch ?? null,
  };
}

export function createGraphJsonDocument(
  graph: JsonGraphData,
  metadata?: GraphJsonMetadata,
  declareConstraints: readonly DeclareConstraint[] = [],
  pathSearch?: PersistedPathSearchConfiguration,
): GraphJsonDocument {
  return parseGraphJsonValue({
    format: "ltsvisualizer",
    version: 1,
    type: "graph",
    metadata: {
      ...(metadata ?? {}),
      stateCount: graph.nodes.length,
      transitionCount: graph.edges.length,
    },
    nodes: graph.nodes,
    edges: graph.edges,
    ...(declareConstraints.length > 0
      ? { declareConstraints: structuredClone(declareConstraints) }
      : {}),
    ...(pathSearch ? { pathSearch: structuredClone(pathSearch) } : {}),
  }).document as GraphJsonDocument;
}

export function createSelectedPathJsonDocument(
  graph: JsonGraphData,
  path: SelectedPath,
  metadata?: GraphJsonMetadata,
  declareConstraints: readonly DeclareConstraint[] = [],
  pathSearch?: PersistedPathSearchConfiguration,
): SelectedPathJsonDocument {
  const resolved = resolvePath(graph, path);
  const selectedNodeIds = new Set(resolved.nodeIds);
  const selectedEdgeIds = new Set(path.edgeIds);
  const pathGraph: JsonGraphData = {
    nodes: graph.nodes.filter((node) => selectedNodeIds.has(node.id)),
    edges: graph.edges.filter((edge) => selectedEdgeIds.has(edge.id)),
  };

  return parseGraphJsonValue({
    format: "ltsvisualizer",
    version: 1,
    type: "selected-path",
    metadata: {
      ...(metadata ?? {}),
      startStateId: resolved.startNodeId,
      endStateId: resolved.endNodeId,
      stateCount: resolved.stateCount,
      transitionCount: resolved.transitionCount,
    },
    nodes: pathGraph.nodes,
    edges: pathGraph.edges,
    path,
    ...(declareConstraints.length > 0
      ? { declareConstraints: structuredClone(declareConstraints) }
      : {}),
    ...(pathSearch ? { pathSearch: structuredClone(pathSearch) } : {}),
  }).document as SelectedPathJsonDocument;
}

export function serializeGraphJson(
  document: LtsVisualizerJsonDocument
): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
