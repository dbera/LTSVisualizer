export type PathSearchEdge = {
  id: string;
  source: string;
  target: string;
  transition?: string;
  inputs?: unknown;
  outputs?: unknown;
};

/**
 * Reserved for ordered transition constraints in a future release.
 *
 * The current search accepts only an empty requiredTransitions array. Keeping
 * the constraint model in the public API now avoids changing the search input
 * and worker protocol when transition-name and partial-data matching are added.
 */
export type TransitionPattern = {
  transition?: string;
  inputs?: unknown;
  outputs?: unknown;
};

export type PathConstraints = {
  requiredTransitions?: TransitionPattern[];
};

export type PathSearchInput = {
  nodeIds: string[];
  edges: PathSearchEdge[];
  sourceNodeId: string;
  targetNodeId: string;
  requestedPathCount: number;
  maximumVisitsPerState: number;
  constraints?: PathConstraints;
};

export type BoundedPath = {
  startNodeId: string;
  edgeIds: string[];
};

export type PathSearchStopReason =
  | "requested-count-reached"
  | "exhausted"
  | "resource-limit-reached"
  | "cancelled";

export type PathSearchResult = {
  paths: BoundedPath[];
  exhausted: boolean;
  resourceLimitReached: boolean;
  cancelled: boolean;
  stopReason: PathSearchStopReason;
  expandedCandidateCount: number;
  peakQueuedCandidateCount: number;
};

export type PathSearchOptions = {
  maximumExpandedCandidates?: number;
  maximumQueuedCandidates?: number;
  shouldCancel?: () => boolean;
};

type NormalizedTopology = {
  nodeIds: string[];
  outgoingEdgesByNodeId: Map<string, PathSearchEdge[]>;
};

type ConstraintProgress = {
  nextRequiredTransitionIndex: number;
};

type SearchCandidate = {
  currentNodeId: string;
  parent: SearchCandidate | null;
  incomingEdgeId: string | null;
  depth: number;
  constraintProgress: ConstraintProgress;
  insertionSequence: number;
};

const DEFAULT_MAXIMUM_EXPANDED_CANDIDATES = 1_000_000;
const DEFAULT_MAXIMUM_QUEUED_CANDIDATES = 100_000;

class CandidateMinHeap {
  private readonly items: SearchCandidate[] = [];

  public get size(): number {
    return this.items.length;
  }

  public push(candidate: SearchCandidate): void {
    this.items.push(candidate);
    this.bubbleUp(this.items.length - 1);
  }

  public pop(): SearchCandidate | undefined {
    if (this.items.length === 0) {
      return undefined;
    }

    const first = this.items[0];
    const last = this.items.pop();

    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return first;
  }

  private bubbleUp(startIndex: number): void {
    let index = startIndex;

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (!hasHigherPriority(this.items[index], this.items[parentIndex])) {
        return;
      }

      [this.items[index], this.items[parentIndex]] =
        [this.items[parentIndex], this.items[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(startIndex: number): void {
    let index = startIndex;

    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      let bestIndex = index;

      if (
        leftIndex < this.items.length &&
        hasHigherPriority(this.items[leftIndex], this.items[bestIndex])
      ) {
        bestIndex = leftIndex;
      }

      if (
        rightIndex < this.items.length &&
        hasHigherPriority(this.items[rightIndex], this.items[bestIndex])
      ) {
        bestIndex = rightIndex;
      }

      if (bestIndex === index) {
        return;
      }

      [this.items[index], this.items[bestIndex]] =
        [this.items[bestIndex], this.items[index]];
      index = bestIndex;
    }
  }
}

function hasHigherPriority(
  left: SearchCandidate,
  right: SearchCandidate,
): boolean {
  if (left.depth !== right.depth) {
    return left.depth < right.depth;
  }

  return left.insertionSequence < right.insertionSequence;
}

function buildTopology(input: PathSearchInput): NormalizedTopology {
  const nodeIds: string[] = [];
  const knownNodeIds = new Set<string>();

  for (const nodeId of input.nodeIds) {
    if (!knownNodeIds.has(nodeId)) {
      knownNodeIds.add(nodeId);
      nodeIds.push(nodeId);
    }
  }

  if (!knownNodeIds.has(input.sourceNodeId)) {
    throw new Error(`Source state ${input.sourceNodeId} does not exist.`);
  }

  if (!knownNodeIds.has(input.targetNodeId)) {
    throw new Error(`Target state ${input.targetNodeId} does not exist.`);
  }

  if (!Number.isInteger(input.requestedPathCount) || input.requestedPathCount < 1) {
    throw new Error("Requested path count must be a positive integer.");
  }

  if (
    !Number.isInteger(input.maximumVisitsPerState) ||
    input.maximumVisitsPerState < 1
  ) {
    throw new Error("Maximum visits per state must be a positive integer.");
  }

  const requiredTransitions = input.constraints?.requiredTransitions ?? [];

  if (requiredTransitions.length > 0) {
    throw new Error("Transition constraints are not implemented yet.");
  }

  const outgoingEdgesByNodeId = new Map<string, PathSearchEdge[]>();

  for (const nodeId of nodeIds) {
    outgoingEdgesByNodeId.set(nodeId, []);
  }

  const knownEdgeIds = new Set<string>();

  for (const edge of input.edges) {
    if (knownEdgeIds.has(edge.id)) {
      throw new Error(`Duplicate edge ID: ${edge.id}.`);
    }

    knownEdgeIds.add(edge.id);

    if (!knownNodeIds.has(edge.source)) {
      throw new Error(
        `Edge ${edge.id} references unknown source state ${edge.source}.`,
      );
    }

    if (!knownNodeIds.has(edge.target)) {
      throw new Error(
        `Edge ${edge.id} references unknown target state ${edge.target}.`,
      );
    }

    outgoingEdgesByNodeId.get(edge.source)?.push(edge);
  }

  return {
    nodeIds,
    outgoingEdgesByNodeId,
  };
}

function validateResourceLimit(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return value;
}

function advanceConstraintProgress(
  progress: ConstraintProgress,
  _edge: PathSearchEdge,
  _constraints: PathConstraints | undefined,
): ConstraintProgress | null {
  // Future implementation: match the next required transition pattern against
  // name, inputs, outputs, and other transition data using partial matching.
  return progress;
}

function countNodeVisits(
  candidate: SearchCandidate,
  nodeId: string,
): number {
  let count = 0;
  let current: SearchCandidate | null = candidate;

  while (current !== null) {
    if (current.currentNodeId === nodeId) {
      count += 1;
    }

    current = current.parent;
  }

  return count;
}

function reconstructEdgeIds(candidate: SearchCandidate): string[] {
  const edgeIds = new Array<string>(candidate.depth);
  let current: SearchCandidate | null = candidate;
  let index = candidate.depth - 1;

  while (current !== null && current.incomingEdgeId !== null) {
    edgeIds[index] = current.incomingEdgeId;
    index -= 1;
    current = current.parent;
  }

  return edgeIds;
}

function createPathKey(edgeIds: string[]): string {
  return JSON.stringify(edgeIds);
}

/**
 * Finds up to K shortest unique paths with bounded state visits.
 *
 * All transitions currently have equal cost, so candidates are expanded in
 * increasing transition count. Equal-length candidates follow input edge order.
 * Path uniqueness is based on the ordered edge-ID sequence.
 */
export function findKShortestBoundedPaths(
  input: PathSearchInput,
  options: PathSearchOptions = {},
): PathSearchResult {
  const topology = buildTopology(input);
  const maximumExpandedCandidates = validateResourceLimit(
    options.maximumExpandedCandidates,
    DEFAULT_MAXIMUM_EXPANDED_CANDIDATES,
    "Maximum expanded candidates",
  );
  const maximumQueuedCandidates = validateResourceLimit(
    options.maximumQueuedCandidates,
    DEFAULT_MAXIMUM_QUEUED_CANDIDATES,
    "Maximum queued candidates",
  );

  const queue = new CandidateMinHeap();
  let nextInsertionSequence = 1;
  let expandedCandidateCount = 0;
  let peakQueuedCandidateCount = 1;
  let resourceLimitReached = false;
  let cancelled = false;

  queue.push({
    currentNodeId: input.sourceNodeId,
    parent: null,
    incomingEdgeId: null,
    depth: 0,
    constraintProgress: {
      nextRequiredTransitionIndex: 0,
    },
    insertionSequence: 0,
  });

  const paths: BoundedPath[] = [];
  const emittedPathKeys = new Set<string>();

  while (queue.size > 0 && paths.length < input.requestedPathCount) {
    if (options.shouldCancel?.()) {
      cancelled = true;
      break;
    }

    if (expandedCandidateCount >= maximumExpandedCandidates) {
      resourceLimitReached = true;
      break;
    }

    const candidate = queue.pop();

    if (candidate === undefined) {
      break;
    }

    expandedCandidateCount += 1;
    const isZeroTransitionSourceTargetPath =
      candidate.depth === 0 &&
      input.sourceNodeId === input.targetNodeId;

    if (candidate.currentNodeId === input.targetNodeId) {
      const edgeIds = reconstructEdgeIds(candidate);
      const pathKey = createPathKey(edgeIds);

      if (!emittedPathKeys.has(pathKey)) {
        emittedPathKeys.add(pathKey);
        paths.push({
          startNodeId: input.sourceNodeId,
          edgeIds,
        });
      }

      // The initial source-equals-target candidate must still be expanded so
      // non-empty returning paths can be found. All other target arrivals end.
      if (!isZeroTransitionSourceTargetPath) {
        continue;
      }
    }

    const outgoingEdges =
      topology.outgoingEdgesByNodeId.get(candidate.currentNodeId) ?? [];

    for (const edge of outgoingEdges) {
      if (queue.size >= maximumQueuedCandidates) {
        resourceLimitReached = true;
        break;
      }

      const existingVisitCount = countNodeVisits(candidate, edge.target);

      if (existingVisitCount >= input.maximumVisitsPerState) {
        continue;
      }

      const nextConstraintProgress = advanceConstraintProgress(
        candidate.constraintProgress,
        edge,
        input.constraints,
      );

      if (nextConstraintProgress === null) {
        continue;
      }

      queue.push({
        currentNodeId: edge.target,
        parent: candidate,
        incomingEdgeId: edge.id,
        depth: candidate.depth + 1,
        constraintProgress: nextConstraintProgress,
        insertionSequence: nextInsertionSequence,
      });
      nextInsertionSequence += 1;
      peakQueuedCandidateCount = Math.max(
        peakQueuedCandidateCount,
        queue.size,
      );
    }

    if (resourceLimitReached) {
      break;
    }
  }

  const requestedCountReached = paths.length >= input.requestedPathCount;
  const exhausted =
    !requestedCountReached &&
    !resourceLimitReached &&
    !cancelled &&
    queue.size === 0;

  let stopReason: PathSearchStopReason;

  if (cancelled) {
    stopReason = "cancelled";
  } else if (resourceLimitReached) {
    stopReason = "resource-limit-reached";
  } else if (requestedCountReached) {
    stopReason = "requested-count-reached";
  } else {
    stopReason = "exhausted";
  }

  return {
    paths,
    exhausted,
    resourceLimitReached,
    cancelled,
    stopReason,
    expandedCandidateCount,
    peakQueuedCandidateCount,
  };
}
