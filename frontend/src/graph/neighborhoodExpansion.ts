export type NeighborhoodEdge = {
  id: string;
  source: string;
  target: string;
};

export type NeighborhoodGraph = {
  nodes: { id: string }[];
  edges: NeighborhoodEdge[];
};

export type Neighborhood = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  distanceByNodeId: Map<string, number>;
};

/**
 * Collects the same undirected hop neighborhood used by the main graph view.
 * Edge identity is preserved, including parallel edges and self-loops.
 */
export function collectUndirectedNeighborhood(
  graph: NeighborhoodGraph,
  startNodeId: string,
  maximumHops: number,
): Neighborhood {
  const knownNodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!knownNodeIds.has(startNodeId)) {
    return {
      nodeIds: new Set(),
      edgeIds: new Set(),
      distanceByNodeId: new Map(),
    };
  }

  const nodeIds = new Set<string>([startNodeId]);
  const distanceByNodeId = new Map<string, number>([[startNodeId, 0]]);
  let frontier = new Set<string>([startNodeId]);
  const safeMaximumHops = Math.max(0, Math.floor(maximumHops));

  for (let distance = 1; distance <= safeMaximumHops; distance += 1) {
    const nextFrontier = new Set<string>();
    for (const edge of graph.edges) {
      if (frontier.has(edge.source) && !nodeIds.has(edge.target)) {
        nodeIds.add(edge.target);
        distanceByNodeId.set(edge.target, distance);
        nextFrontier.add(edge.target);
      }
      if (frontier.has(edge.target) && !nodeIds.has(edge.source)) {
        nodeIds.add(edge.source);
        distanceByNodeId.set(edge.source, distance);
        nextFrontier.add(edge.source);
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  const edgeIds = new Set(
    graph.edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => edge.id),
  );
  return { nodeIds, edgeIds, distanceByNodeId };
}
