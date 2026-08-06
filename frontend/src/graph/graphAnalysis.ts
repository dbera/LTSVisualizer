export type GraphAnalysisEdge = {
  id: string;
  source: string;
  target: string;
};

export type GraphAnalysisInput = {
  nodeIds: string[];
  edges: GraphAnalysisEdge[];
};

export type StronglyConnectedComponent = {
  id: number;
  nodeIds: string[];
  internalEdgeIds: string[];
  isCyclic: boolean;
};

export type GraphAnalysisResult = {
  terminalNodeIds: string[];
  components: StronglyConnectedComponent[];
  cyclicComponents: StronglyConnectedComponent[];
  statesInCyclicComponents: number;
  largestCyclicComponentSize: number;
};

/**
 * Returns states with no outgoing transitions.
 *
 * The result follows the order of input.nodeIds. Duplicate node IDs in the
 * input are returned only once. A state with a self-loop is not terminal.
 *
 * This function intentionally performs only topology analysis. It does not
 * decide whether a terminal state represents successful completion or a
 * deadlock.
 */
export function findTerminalNodeIds(
  input: GraphAnalysisInput,
): string[] {
  const nodesWithOutgoingEdges = new Set<string>();

  for (const edge of input.edges) {
    nodesWithOutgoingEdges.add(edge.source);
  }

  const seenNodeIds = new Set<string>();
  const terminalNodeIds: string[] = [];

  for (const nodeId of input.nodeIds) {
    if (seenNodeIds.has(nodeId)) {
      continue;
    }

    seenNodeIds.add(nodeId);

    if (!nodesWithOutgoingEdges.has(nodeId)) {
      terminalNodeIds.push(nodeId);
    }
  }

  return terminalNodeIds;
}
