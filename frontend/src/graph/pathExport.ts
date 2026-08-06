export interface ExportGraphNode {
  id: string;
  marking_raw: string | null;
  marking: Record<string, unknown[]> | null;
}

export interface ExportGraphEdge {
  id: string;
  source: string;
  target: string;
  transition: string;
  color: string | null;
  inputs_raw: string | null;
  inputs: Record<string, unknown> | null;
  outputs_raw: string | null;
  outputs: Record<string, unknown[]> | null;
}

export interface ExportGraphData {
  nodes: ExportGraphNode[];
  edges: ExportGraphEdge[];
}

export interface SelectedPath {
  startNodeId: string;
  edgeIds: string[];
}

export interface ResolvedPathStep {
  edgeId: string;
  source: string;
  target: string;
  transition: string;
  color: string | null;
}

export interface ResolvedPath {
  startNodeId: string;
  endNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  steps: ResolvedPathStep[];
}

export interface PlantUmlPathExport {
  fileName: string;
  content: string;
  path: ResolvedPath;
}

export class PathExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathExportError";
  }
}

function buildNodeMap(graph: ExportGraphData): Map<string, ExportGraphNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function buildEdgeMap(graph: ExportGraphData): Map<string, ExportGraphEdge> {
  return new Map(graph.edges.map((edge) => [edge.id, edge]));
}

export function resolveSelectedPath(
  graph: ExportGraphData,
  selection: SelectedPath
): ResolvedPath {
  const nodeMap = buildNodeMap(graph);
  const edgeMap = buildEdgeMap(graph);

  if (!nodeMap.has(selection.startNodeId)) {
    throw new PathExportError(
      `The selected start state ${selection.startNodeId} does not exist.`
    );
  }

  const nodeIds = [selection.startNodeId];
  const steps: ResolvedPathStep[] = [];
  let currentNodeId = selection.startNodeId;

  for (const edgeId of selection.edgeIds) {
    const edge = edgeMap.get(edgeId);

    if (!edge) {
      throw new PathExportError(
        `The selected transition ${edgeId} does not exist.`
      );
    }

    if (edge.source !== currentNodeId) {
      throw new PathExportError(
        `Transition ${edgeId} starts at state ${edge.source}, but the current path endpoint is state ${currentNodeId}.`
      );
    }

    if (!nodeMap.has(edge.target)) {
      throw new PathExportError(
        `Transition ${edgeId} targets missing state ${edge.target}.`
      );
    }

    steps.push({
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
      transition: edge.transition,
      color: edge.color,
    });
    currentNodeId = edge.target;
    nodeIds.push(currentNodeId);
  }

  return {
    startNodeId: selection.startNodeId,
    endNodeId: currentNodeId,
    nodeIds,
    edgeIds: [...selection.edgeIds],
    steps,
  };
}

function normalizeRawComment(raw: string): string {
  return raw
    .trim()
    .replace(/^'(?:Transition Inputs|Transition Outputs|Marking \(State\)):\s*/, "");
}

function quoteToken(value: unknown): string {
  return `'${JSON.stringify(value)}'`;
}

function serializeMarking(marking: Record<string, unknown[]>): string {
  const places = Object.entries(marking).map(([place, tokens]) => {
    const serializedTokens = tokens.map(quoteToken).join(", ");
    return `${place}={${serializedTokens}}`;
  });

  return `{${places.join(", ")}}`;
}

function serializeInputs(inputs: Record<string, unknown>): string {
  const entries = Object.entries(inputs).map(
    ([variable, value]) => `${variable} -> ${quoteToken(value)}`
  );

  return `{${entries.join(", ")}}`;
}

function markingComment(node: ExportGraphNode): string | null {
  if (node.marking_raw?.trim()) {
    return `'Marking (State): ${normalizeRawComment(node.marking_raw)}`;
  }

  if (node.marking !== null) {
    return `'Marking (State): ${serializeMarking(node.marking)}`;
  }

  return null;
}

function inputsComment(edge: ExportGraphEdge): string | null {
  if (edge.inputs_raw?.trim()) {
    return `'Transition Inputs: ${normalizeRawComment(edge.inputs_raw)}`;
  }

  if (edge.inputs !== null) {
    return `'Transition Inputs: ${serializeInputs(edge.inputs)}`;
  }

  return null;
}

function outputsComment(edge: ExportGraphEdge): string | null {
  if (edge.outputs_raw?.trim()) {
    return `'Transition Outputs: ${normalizeRawComment(edge.outputs_raw)}`;
  }

  if (edge.outputs !== null) {
    return `'Transition Outputs: ${serializeMarking(edge.outputs)}`;
  }

  return null;
}

function plantUmlArrow(color: string | null): string {
  const normalizedColor = color?.trim().replace(/^#/, "");
  return normalizedColor ? `-[#${normalizedColor}]->` : "-->";
}

function sanitizeTransitionLabel(label: string): string {
  return label.replace(/\r?\n/g, " ").trim();
}

function sanitizeTitle(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

export function serializePathToPlantUml(
  graph: ExportGraphData,
  selection: SelectedPath,
  title = "Selected path"
): PlantUmlPathExport {
  const path = resolveSelectedPath(graph, selection);
  const nodeMap = buildNodeMap(graph);
  const edgeMap = buildEdgeMap(graph);
  const lines: string[] = ["@startuml", ""];

  if (path.steps.length === 0) {
    const onlyNode = nodeMap.get(path.startNodeId);
    if (!onlyNode) {
      throw new PathExportError(
        `The selected state ${path.startNodeId} does not exist.`
      );
    }

    const marking = markingComment(onlyNode);
    if (marking) {
      lines.push(marking);
    }
    lines.push(`(${onlyNode.id})`);
  } else {
    path.steps.forEach((step, index) => {
      const edge = edgeMap.get(step.edgeId);
      const sourceNode = nodeMap.get(step.source);

      if (!edge || !sourceNode) {
        throw new PathExportError(
          `Path step ${index + 1} could not be resolved for export.`
        );
      }

      const inputs = inputsComment(edge);
      const outputs = outputsComment(edge);
      const marking = markingComment(sourceNode);

      if (inputs) {
        lines.push(inputs);
      }
      if (outputs) {
        lines.push(outputs);
      }
      if (marking) {
        lines.push(marking);
      }

      lines.push(
        `(${edge.source}) ${plantUmlArrow(edge.color)} (${edge.target}): ${sanitizeTransitionLabel(edge.transition)}`
      );
      lines.push("");
    });

    const finalNode = nodeMap.get(path.endNodeId);
    if (!finalNode) {
      throw new PathExportError(
        `The final state ${path.endNodeId} does not exist.`
      );
    }

    const finalMarking = markingComment(finalNode);
    if (finalMarking) {
      lines.push(finalMarking);
      lines.push("");
    }
  }

  lines.push(
    `title ${sanitizeTitle(title)}: ${path.nodeIds.length} state${path.nodeIds.length === 1 ? "" : "s"} and ${path.steps.length} transition${path.steps.length === 1 ? "" : "s"}`
  );
  lines.push("@enduml", "");

  return {
    fileName: createPathFileName(path),
    content: lines.join("\n"),
    path,
  };
}

export function createPathFileName(path: ResolvedPath): string {
  const safeStart = path.startNodeId.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const safeEnd = path.endNodeId.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `LTSVisualizer-path-${safeStart}-to-${safeEnd}.puml`;
}

export function downloadPlantUmlPath(exportedPath: PlantUmlPathExport): void {
  const blob = new Blob([exportedPath.content], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = exportedPath.fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
