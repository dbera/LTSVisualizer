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

type GraphTopology = {
  nodeIds: string[];
  nodeOrder: Map<string, number>;
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
  validEdges: GraphAnalysisEdge[];
  selfLoopNodeIds: Set<string>;
};

/**
 * Builds a normalized topology containing only unique nodes listed in
 * input.nodeIds and edges whose source and target are both known nodes.
 *
 * Normal graph validation should reject unknown references before analysis.
 * Ignoring unknown references here keeps the pure analysis functions robust
 * when used independently.
 */
function buildTopology(input: GraphAnalysisInput): GraphTopology {
  const nodeIds: string[] = [];
  const nodeOrder = new Map<string, number>();

  for (const nodeId of input.nodeIds) {
    if (nodeOrder.has(nodeId)) {
      continue;
    }

    nodeOrder.set(nodeId, nodeIds.length);
    nodeIds.push(nodeId);
  }

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const nodeId of nodeIds) {
    outgoing.set(nodeId, []);
    incoming.set(nodeId, []);
  }

  const validEdges: GraphAnalysisEdge[] = [];
  const selfLoopNodeIds = new Set<string>();

  for (const edge of input.edges) {
    if (
      !nodeOrder.has(edge.source) ||
      !nodeOrder.has(edge.target)
    ) {
      continue;
    }

    outgoing.get(edge.source)?.push(edge.target);
    incoming.get(edge.target)?.push(edge.source);
    validEdges.push(edge);

    if (edge.source === edge.target) {
      selfLoopNodeIds.add(edge.source);
    }
  }

  return {
    nodeIds,
    nodeOrder,
    outgoing,
    incoming,
    validEdges,
    selfLoopNodeIds,
  };
}

function findTerminalNodeIdsFromTopology(
  topology: GraphTopology,
): string[] {
  return topology.nodeIds.filter(
    (nodeId) => topology.outgoing.get(nodeId)?.length === 0,
  );
}

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
  return findTerminalNodeIdsFromTopology(buildTopology(input));
}

/**
 * Computes the finishing order of an iterative depth-first traversal.
 *
 * An explicit stack is used instead of recursive calls so long paths do not
 * risk exceeding the JavaScript call-stack limit.
 */
function computeFinishingOrder(
  nodeIds: string[],
  adjacency: Map<string, string[]>,
): string[] {
  const visited = new Set<string>();
  const finishingOrder: string[] = [];

  for (const startNodeId of nodeIds) {
    if (visited.has(startNodeId)) {
      continue;
    }

    visited.add(startNodeId);

    const stack: Array<{
      nodeId: string;
      nextNeighborIndex: number;
    }> = [
      {
        nodeId: startNodeId,
        nextNeighborIndex: 0,
      },
    ];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = adjacency.get(frame.nodeId) ?? [];

      if (frame.nextNeighborIndex < neighbors.length) {
        const neighborId = neighbors[frame.nextNeighborIndex];
        frame.nextNeighborIndex += 1;

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          stack.push({
            nodeId: neighborId,
            nextNeighborIndex: 0,
          });
        }

        continue;
      }

      finishingOrder.push(frame.nodeId);
      stack.pop();
    }
  }

  return finishingOrder;
}

/** Collects one component using an iterative traversal. */
function collectComponent(
  startNodeId: string,
  adjacency: Map<string, string[]>,
  assignedNodeIds: Set<string>,
): string[] {
  const componentNodeIds: string[] = [];
  const stack = [startNodeId];

  assignedNodeIds.add(startNodeId);

  while (stack.length > 0) {
    const nodeId = stack.pop();

    if (nodeId === undefined) {
      continue;
    }

    componentNodeIds.push(nodeId);

    const neighbors = adjacency.get(nodeId) ?? [];

    // Reverse iteration preserves adjacency order with a LIFO stack.
    for (
      let neighborIndex = neighbors.length - 1;
      neighborIndex >= 0;
      neighborIndex -= 1
    ) {
      const neighborId = neighbors[neighborIndex];

      if (!assignedNodeIds.has(neighborId)) {
        assignedNodeIds.add(neighborId);
        stack.push(neighborId);
      }
    }
  }

  return componentNodeIds;
}

function findStronglyConnectedComponentsFromTopology(
  topology: GraphTopology,
): StronglyConnectedComponent[] {
  if (topology.nodeIds.length === 0) {
    return [];
  }

  const finishingOrder = computeFinishingOrder(
    topology.nodeIds,
    topology.outgoing,
  );

  const assignedNodeIds = new Set<string>();
  const componentNodeIdGroups: string[][] = [];

  for (
    let orderIndex = finishingOrder.length - 1;
    orderIndex >= 0;
    orderIndex -= 1
  ) {
    const startNodeId = finishingOrder[orderIndex];

    if (assignedNodeIds.has(startNodeId)) {
      continue;
    }

    const componentNodeIds = collectComponent(
      startNodeId,
      topology.incoming,
      assignedNodeIds,
    );

    componentNodeIds.sort(
      (leftNodeId, rightNodeId) =>
        (topology.nodeOrder.get(leftNodeId) ?? 0) -
        (topology.nodeOrder.get(rightNodeId) ?? 0),
    );

    componentNodeIdGroups.push(componentNodeIds);
  }

  componentNodeIdGroups.sort((left, right) => {
    const leftOrder = topology.nodeOrder.get(left[0]) ?? 0;
    const rightOrder = topology.nodeOrder.get(right[0]) ?? 0;

    return leftOrder - rightOrder;
  });

  const componentIndexByNodeId = new Map<string, number>();

  componentNodeIdGroups.forEach(
    (componentNodeIds, componentIndex) => {
      for (const nodeId of componentNodeIds) {
        componentIndexByNodeId.set(nodeId, componentIndex);
      }
    },
  );

  const internalEdgeIdsByComponent =
    componentNodeIdGroups.map(() => [] as string[]);

  for (const edge of topology.validEdges) {
    const sourceComponentIndex =
      componentIndexByNodeId.get(edge.source);
    const targetComponentIndex =
      componentIndexByNodeId.get(edge.target);

    if (
      sourceComponentIndex !== undefined &&
      sourceComponentIndex === targetComponentIndex
    ) {
      internalEdgeIdsByComponent[sourceComponentIndex].push(
        edge.id,
      );
    }
  }

  return componentNodeIdGroups.map(
    (componentNodeIds, componentIndex) => ({
      id: componentIndex,
      nodeIds: componentNodeIds,
      internalEdgeIds:
        internalEdgeIdsByComponent[componentIndex],
      isCyclic:
        componentNodeIds.length > 1 ||
        topology.selfLoopNodeIds.has(componentNodeIds[0]),
    }),
  );
}

/**
 * Finds all strongly connected components in a directed graph.
 *
 * The implementation uses an iterative two-pass depth-first traversal.
 * Explicit stacks avoid recursion-depth failures on long graphs.
 * Components are returned in deterministic graph-node order.
 */
export function findStronglyConnectedComponents(
  input: GraphAnalysisInput,
): StronglyConnectedComponent[] {
  return findStronglyConnectedComponentsFromTopology(
    buildTopology(input),
  );
}

/**
 * Computes the complete topology analysis while constructing the normalized
 * graph topology only once.
 *
 * Cyclic components are ordered by descending state count. Components with
 * the same size retain their deterministic component order.
 */
export function analyzeGraph(
  input: GraphAnalysisInput,
): GraphAnalysisResult {
  const topology = buildTopology(input);
  const terminalNodeIds =
    findTerminalNodeIdsFromTopology(topology);
  const components =
    findStronglyConnectedComponentsFromTopology(topology);

  const cyclicComponents = components
    .filter((component) => component.isCyclic)
    .sort((left, right) => {
      const sizeDifference =
        right.nodeIds.length - left.nodeIds.length;

      if (sizeDifference !== 0) {
        return sizeDifference;
      }

      return left.id - right.id;
    });

  const statesInCyclicComponents = cyclicComponents.reduce(
    (total, component) => total + component.nodeIds.length,
    0,
  );

  const largestCyclicComponentSize =
    cyclicComponents[0]?.nodeIds.length ?? 0;

  return {
    terminalNodeIds,
    components,
    cyclicComponents,
    statesInCyclicComponents,
    largestCyclicComponentSize,
  };
}
