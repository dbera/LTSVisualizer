export interface PathNode {
  id: string;
}

export interface PathEdge {
  id: string;
  source: string;
  target: string;
  transition: string;
}

export interface PathGraph {
  nodes: PathNode[];
  edges: PathEdge[];
}

export interface SelectedPath {
  startNodeId: string;
  edgeIds: string[];
}

export interface ResolvedPath<TNode extends PathNode, TEdge extends PathEdge> {
  startNodeId: string;
  endNodeId: string;
  nodeIds: string[];
  nodes: TNode[];
  edgeIds: string[];
  edges: TEdge[];
  stateCount: number;
  transitionCount: number;
}

export class PathSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathSelectionError";
  }
}

function nodeMap<TNode extends PathNode>(graph: { nodes: TNode[] }): Map<string, TNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function edgeMap<TEdge extends PathEdge>(graph: { edges: TEdge[] }): Map<string, TEdge> {
  return new Map(graph.edges.map((edge) => [edge.id, edge]));
}

export function startPath<TNode extends PathNode, TEdge extends PathEdge>(
  graph: { nodes: TNode[]; edges: TEdge[] },
  startNodeId: string
): SelectedPath {
  if (!nodeMap(graph).has(startNodeId)) {
    throw new PathSelectionError(`Start state ${startNodeId} does not exist.`);
  }

  return { startNodeId, edgeIds: [] };
}

export function resolvePath<TNode extends PathNode, TEdge extends PathEdge>(
  graph: { nodes: TNode[]; edges: TEdge[] },
  path: SelectedPath
): ResolvedPath<TNode, TEdge> {
  const nodesById = nodeMap(graph);
  const edgesById = edgeMap(graph);
  const startNode = nodesById.get(path.startNodeId);

  if (!startNode) {
    throw new PathSelectionError(`Start state ${path.startNodeId} does not exist.`);
  }

  const nodeIds = [path.startNodeId];
  const nodes = [startNode];
  const edges: TEdge[] = [];
  let currentNodeId = path.startNodeId;

  path.edgeIds.forEach((edgeId, index) => {
    const edge = edgesById.get(edgeId);
    if (!edge) {
      throw new PathSelectionError(
        `Path step ${index + 1} references unknown transition ${edgeId}.`
      );
    }
    if (edge.source !== currentNodeId) {
      throw new PathSelectionError(
        `Path step ${index + 1} uses transition ${edgeId} from state ${edge.source}, but the current endpoint is state ${currentNodeId}.`
      );
    }

    const targetNode = nodesById.get(edge.target);
    if (!targetNode) {
      throw new PathSelectionError(
        `Transition ${edgeId} targets missing state ${edge.target}.`
      );
    }

    edges.push(edge);
    currentNodeId = edge.target;
    nodeIds.push(currentNodeId);
    nodes.push(targetNode);
  });

  return {
    startNodeId: path.startNodeId,
    endNodeId: currentNodeId,
    nodeIds,
    nodes,
    edgeIds: [...path.edgeIds],
    edges,
    stateCount: nodeIds.length,
    transitionCount: edges.length,
  };
}

export function getPathEndpoint<TNode extends PathNode, TEdge extends PathEdge>(
  graph: { nodes: TNode[]; edges: TEdge[] },
  path: SelectedPath
): string {
  return resolvePath(graph, path).endNodeId;
}

export function getPathNodeIds<TNode extends PathNode, TEdge extends PathEdge>(
  graph: { nodes: TNode[]; edges: TEdge[] },
  path: SelectedPath
): string[] {
  return resolvePath(graph, path).nodeIds;
}

export function getSelectedEdges<TNode extends PathNode, TEdge extends PathEdge>(
  graph: { nodes: TNode[]; edges: TEdge[] },
  path: SelectedPath
): TEdge[] {
  return resolvePath(graph, path).edges;
}

export function getCandidateEdges<TNode extends PathNode, TEdge extends PathEdge>(
  graph: { nodes: TNode[]; edges: TEdge[] },
  path: SelectedPath
): TEdge[] {
  const endpoint = getPathEndpoint(graph, path);
  return graph.edges.filter((edge) => edge.source === endpoint);
}

export function extendPath<TNode extends PathNode, TEdge extends PathEdge>(
  graph: { nodes: TNode[]; edges: TEdge[] },
  path: SelectedPath,
  edgeId: string
): SelectedPath {
  const candidate = graph.edges.find((edge) => edge.id === edgeId);
  if (!candidate) {
    throw new PathSelectionError(`Transition ${edgeId} does not exist.`);
  }

  const endpoint = getPathEndpoint(graph, path);
  if (candidate.source !== endpoint) {
    throw new PathSelectionError(
      `Transition ${edgeId} starts at state ${candidate.source}, but the current endpoint is state ${endpoint}.`
    );
  }

  if (!graph.nodes.some((node) => node.id === candidate.target)) {
    throw new PathSelectionError(
      `Transition ${edgeId} targets missing state ${candidate.target}.`
    );
  }

  return { ...path, edgeIds: [...path.edgeIds, edgeId] };
}

export function undoPath(path: SelectedPath): SelectedPath {
  if (path.edgeIds.length === 0) {
    return { ...path, edgeIds: [] };
  }

  return { ...path, edgeIds: path.edgeIds.slice(0, -1) };
}

export function isValidPath<TNode extends PathNode, TEdge extends PathEdge>(
  graph: { nodes: TNode[]; edges: TEdge[] },
  path: SelectedPath
): boolean {
  try {
    resolvePath(graph, path);
    return true;
  } catch {
    return false;
  }
}
