import type { DeclareConstraint, DeclareTemplateId } from "./declareConstraints";
import { evaluateDeclarePredicateGroup } from "./declarePredicates";
import { evaluateCorrelationCondition, type ActivationBindings } from "./transitionCorrelation";
import {
  advanceMonitorSet,
  createMonitorSet,
  getMonitorSetStatus,
  type MonitorSetEntry,
} from "./declareMonitor";
import {
  compileDeclareConstraints,
  type CompiledDeclareConstraint,
} from "./declareMonitorFactory";

export type PathSearchEdge = {
  id: string;
  source: string;
  target: string;
  transition?: string;
  inputs?: unknown;
  outputs?: unknown;
};

export type PathConstraints = {
  declare?: DeclareConstraint[];
};

export type PathSearchEndpointMode =
  | "specific-target"
  | "constraint-satisfaction";

export type PathSearchInput = {
  nodeIds: string[];
  edges: PathSearchEdge[];
  sourceNodeId: string;
  targetNodeId?: string;
  endpointMode?: PathSearchEndpointMode;
  requireConstraintExercise?: boolean;
  requestedPathCount: number;
  maximumVisitsPerState: number;
  constraints?: PathConstraints;
};

export type ConstraintExplanationEvent = {
  role:
    | "activation"
    | "target"
    | "fulfillment"
    | "match"
    | "preceding-support"
    | "immediate-support"
    | "position-match"
    | "choice-match"
    | "forbidden-pair-avoided";
  stepNumber: number;
  edgeId: string;
  transition: string;
};
export type ConstraintExplanation = {
  constraintId: string;
  template: DeclareTemplateId;
  status: "satisfied";
  exercised: boolean;
  summary: string;
  events: ConstraintExplanationEvent[];
};
export type BoundedPath = {
  startNodeId: string;
  endNodeId?: string;
  edgeIds: string[];
  explanations?: ConstraintExplanation[];
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
  incomingNodeIdsByNodeId: Map<string, string[]>;
};

type SearchCandidate = {
  currentNodeId: string;
  parent: SearchCandidate | null;
  incomingEdgeId: string | null;
  depth: number;
  estimatedTotalCost: number;
  monitorEntries: MonitorSetEntry[];
  exercisedConstraintIds: ReadonlySet<string>;
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
  if (left.estimatedTotalCost !== right.estimatedTotalCost) {
    return left.estimatedTotalCost < right.estimatedTotalCost;
  }

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

  const endpointMode = input.endpointMode ??
    (input.targetNodeId === undefined
      ? "constraint-satisfaction"
      : "specific-target");

  if (endpointMode === "specific-target") {
    if (input.targetNodeId === undefined || input.targetNodeId.length === 0) {
      throw new Error("A target state is required in specific-target mode.");
    }

    if (!knownNodeIds.has(input.targetNodeId)) {
      throw new Error(`Target state ${input.targetNodeId} does not exist.`);
    }
  } else if (input.targetNodeId !== undefined) {
    throw new Error(
      "Target state must be omitted in constraint-satisfaction mode.",
    );
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

  const outgoingEdgesByNodeId = new Map<string, PathSearchEdge[]>();
  const incomingNodeIdsByNodeId = new Map<string, string[]>();

  for (const nodeId of nodeIds) {
    outgoingEdgesByNodeId.set(nodeId, []);
    incomingNodeIdsByNodeId.set(nodeId, []);
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
    incomingNodeIdsByNodeId.get(edge.target)?.push(edge.source);
  }

  return {
    nodeIds,
    outgoingEdgesByNodeId,
    incomingNodeIdsByNodeId,
  };
}

function computeDistancesToTarget(
  topology: NormalizedTopology,
  targetNodeId: string,
): Map<string, number> {
  const distances = new Map<string, number>([[targetNodeId, 0]]);
  const queue: string[] = [targetNodeId];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const nodeId = queue[queueIndex];
    queueIndex += 1;
    const nextDistance = (distances.get(nodeId) ?? 0) + 1;
    const predecessors =
      topology.incomingNodeIdsByNodeId.get(nodeId) ?? [];

    for (const predecessor of predecessors) {
      if (distances.has(predecessor)) {
        continue;
      }

      distances.set(predecessor, nextDistance);
      queue.push(predecessor);
    }
  }

  return distances;
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
type IndexedPredicateMatch = {
  stepNumber: number;
  edge: PathSearchEdge;
  bindings: ActivationBindings;
};
function predicateMatches(
  group: DeclareConstraint["activation"],
  edges: readonly PathSearchEdge[],
): IndexedPredicateMatch[] {
  if (!group) return [];
  return edges.flatMap((edge, index) => {
    const evaluation = evaluateDeclarePredicateGroup(group, edge);
    return evaluation.matches
      ? evaluation.predicateMatches.map((match) => ({
          stepNumber: index + 1,
          edge,
          bindings: match.bindings,
        }))
      : [];
  });
}
function event(
  role: ConstraintExplanationEvent["role"],
  match: IndexedPredicateMatch,
): ConstraintExplanationEvent {
  return {
    role,
    stepNumber: match.stepNumber,
    edgeId: match.edge.id,
    transition: match.edge.transition ?? match.edge.id,
  };
}
function matchesCorrelation(
  constraint: DeclareConstraint,
  activation: IndexedPredicateMatch,
  target: IndexedPredicateMatch,
): boolean {
  return !constraint.correlation || evaluateCorrelationCondition(
    constraint.correlation,
    target.edge,
    activation.bindings,
  ).matches;
}
function explainConstraint(
  constraint: DeclareConstraint,
  edges: readonly PathSearchEdge[],
  compiled: CompiledDeclareConstraint,
): ConstraintExplanation {
  const activations = predicateMatches(constraint.activation, edges);
  const targets = predicateMatches(constraint.target, edges);
  const exercised = edges.some((edge) => compiled.isExercisedBy(edge));
  const events: ConstraintExplanationEvent[] = [];
  let summary: string;
  switch (constraint.template) {
    case "at-least":
    case "at-most":
    case "exactly":
    case "exactly-consecutive":
      events.push(...activations.map((match) => event("match", match)));
      summary = constraint.template === "exactly-consecutive"
        ? `Matched one consecutive run of ${activations.length}; required count ${constraint.count ?? 0}.`
        : `Matched ${activations.length} time${activations.length === 1 ? "" : "s"}; required count ${constraint.count ?? 0}.`;
      break;
    case "init":
      if (activations[0]) events.push(event("position-match", activations[0]));
      summary = "The first transition matches the Init activation.";
      break;
    case "end": {
      const last = activations.find((match) => match.stepNumber === edges.length);
      if (last) events.push(event("position-match", last));
      summary = "The final transition matches the End activation.";
      break;
    }
    case "choice":
    case "exclusive-choice":
      events.push(...activations.map((match) => event("choice-match", match)));
      events.push(...targets.map((match) => event("choice-match", match)));
      summary = constraint.template === "choice"
        ? `${activations.length > 0 ? "Activation" : "Target"} side occurred, satisfying Choice.`
        : `Exactly one side occurred: ${activations.length > 0 ? "activation" : "target"}.`;
      break;
    case "response":
    case "chain-response":
    case "alternate-response":
    case "responded-existence":
    case "succession":
    case "chain-succession":
    case "alternate-succession": {
      for (const activation of activations) {
        events.push(event("activation", activation));
        const fulfillment = targets.find((target) => {
          const orderOkay = constraint.template === "responded-existence"
            ? true
            : target.stepNumber > activation.stepNumber;
          const chainOkay = !["chain-response", "chain-succession"].includes(constraint.template) ||
            target.stepNumber === activation.stepNumber + 1;
          return orderOkay && chainOkay &&
            matchesCorrelation(constraint, activation, target);
        });
        if (fulfillment) events.push(event("fulfillment", fulfillment));
      }
      if (constraint.template.includes("succession")) {
        summary = activations.length === 0 && targets.length === 0
          ? "Satisfied vacuously: neither side occurred."
          : `${activations.length} activation${activations.length === 1 ? "" : "s"} fulfilled, and every target had the required preceding activation.`;
      } else {
        summary = activations.length === 0
          ? "Satisfied vacuously: no matching activation occurred."
          : `${activations.length} activation${activations.length === 1 ? "" : "s"} fulfilled.`;
      }
      break;
    }
    case "precedence":
    case "chain-precedence":
    case "alternate-precedence": {
      for (const target of targets) {
        const support = [...activations].reverse().find((activation) => {
          const orderOkay = activation.stepNumber < target.stepNumber;
          const chainOkay = constraint.template !== "chain-precedence" ||
            activation.stepNumber === target.stepNumber - 1;
          return orderOkay && chainOkay &&
            matchesCorrelation(constraint, activation, target);
        });
        if (support) {
          events.push(event(
            constraint.template === "chain-precedence"
              ? "immediate-support"
              : "preceding-support",
            support,
          ));
        }
        events.push(event("target", target));
      }
      summary = targets.length === 0
        ? "Satisfied vacuously: no matching target occurred."
        : `Every target had ${constraint.template === "chain-precedence" ? "an immediate" : "a qualifying"} preceding activation.`;
      break;
    }
    case "coexistence": {
      events.push(...activations.map((match) => event("activation", match)));
      events.push(...targets.map((match) => event("target", match)));
      summary = activations.length === 0 && targets.length === 0
        ? "Satisfied vacuously: neither side occurred."
        : "Activation and target both occurred with correlated counterparts.";
      break;
    }
    case "not-response":
    case "not-chain-response":
    case "not-precedence":
    case "not-chain-precedence":
    case "not-responded-existence":
    case "not-coexistence":
    case "not-succession":
    case "not-chain-succession":
      events.push(...activations.map((match) => event("activation", match)));
      events.push(...targets.map((match) => event("target", match)));
      if (events[0]) events[0] = { ...events[0], role: "forbidden-pair-avoided" };
      summary = activations.length === 0 && targets.length === 0
        ? "Satisfied vacuously: neither constrained event occurred."
        : "No forbidden correlated activation-target relationship occurred.";
      break;
  }
  return {
    constraintId: constraint.id,
    template: constraint.template,
    status: "satisfied",
    exercised,
    summary,
    events,
  };
}
function explainAcceptedPath(
  edgeIds: readonly string[],
  edgesById: ReadonlyMap<string, PathSearchEdge>,
  constraints: readonly DeclareConstraint[],
  compiledConstraints: readonly CompiledDeclareConstraint[],
): ConstraintExplanation[] {
  const edges = edgeIds.map((edgeId) => {
    const edge = edgesById.get(edgeId);
    if (!edge) throw new Error(`Cannot explain unknown edge ${edgeId}.`);
    return edge;
  });
  const compiledById = new Map(compiledConstraints.map((item) => [item.id, item]));
  return constraints
    .filter((constraint) => constraint.enabled)
    .map((constraint) => {
      const compiled = compiledById.get(constraint.id);
      if (!compiled) throw new Error(`Cannot explain uncompiled constraint ${constraint.id}.`);
      return explainConstraint(constraint, edges, compiled);
    });
}

function resolveEndpointMode(input: PathSearchInput): PathSearchEndpointMode {
  return input.endpointMode ??
    (input.targetNodeId === undefined
      ? "constraint-satisfaction"
      : "specific-target");
}

function updateExercisedConstraintIds(
  compiledConstraints: readonly CompiledDeclareConstraint[],
  edge: PathSearchEdge,
  exercisedConstraintIds: ReadonlySet<string>,
): ReadonlySet<string> {
  let updated: Set<string> | null = null;

  for (const constraint of compiledConstraints) {
    if (
      !exercisedConstraintIds.has(constraint.id) &&
      constraint.isExercisedBy(edge)
    ) {
      updated ??= new Set(exercisedConstraintIds);
      updated.add(constraint.id);
    }
  }

  return updated ?? exercisedConstraintIds;
}

function areRequiredConstraintsExercised(
  compiledConstraints: readonly CompiledDeclareConstraint[],
  exercisedConstraintIds: ReadonlySet<string>,
  required: boolean,
): boolean {
  return !required || compiledConstraints.every(
    (constraint) =>
      !constraint.requiresExercise || exercisedConstraintIds.has(constraint.id),
  );
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
  const endpointMode = resolveEndpointMode(input);
  const distancesToTarget =
    endpointMode === "specific-target" && input.targetNodeId !== undefined
      ? computeDistancesToTarget(topology, input.targetNodeId)
      : new Map<string, number>();
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

  const declareConstraints = input.constraints?.declare ?? [];
  const compiledConstraints = compileDeclareConstraints(declareConstraints);
  const edgesById = new Map(input.edges.map((edge) => [edge.id, edge]));
  const initialMonitorEntries = createMonitorSet(compiledConstraints);
  const requireConstraintExercise = input.requireConstraintExercise ?? true;

  if (
    endpointMode === "constraint-satisfaction" &&
    initialMonitorEntries.length === 0
  ) {
    throw new Error(
      "At least one enabled Declare constraint is required when no target state is specified.",
    );
  }

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
    estimatedTotalCost:
      endpointMode === "specific-target"
        ? distancesToTarget.get(input.sourceNodeId) ?? Number.POSITIVE_INFINITY
        : 0,
    monitorEntries: initialMonitorEntries,
    exercisedConstraintIds: new Set<string>(),
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
      endpointMode === "specific-target" &&
      input.sourceNodeId === input.targetNodeId;
    const endpointMatches =
      endpointMode === "constraint-satisfaction" ||
      candidate.currentNodeId === input.targetNodeId;

    if (endpointMatches) {
      const monitorStatus = getMonitorSetStatus(candidate.monitorEntries);
      const exerciseSatisfied = areRequiredConstraintsExercised(
        compiledConstraints,
        candidate.exercisedConstraintIds,
        requireConstraintExercise,
      );

      if (monitorStatus.accepting && exerciseSatisfied) {
        const edgeIds = reconstructEdgeIds(candidate);
        const pathKey = createPathKey(edgeIds);

        if (!emittedPathKeys.has(pathKey)) {
          emittedPathKeys.add(pathKey);
          paths.push({
            startNodeId: input.sourceNodeId,
            ...(endpointMode === "constraint-satisfaction"
              ? { endNodeId: candidate.currentNodeId }
              : {}),
            edgeIds,
            ...(compiledConstraints.length > 0
              ? {
                  explanations: explainAcceptedPath(
                    edgeIds,
                    edgesById,
                    declareConstraints,
                    compiledConstraints,
                  ),
                }
              : {}),
          });
        }

        // A non-empty specific-target arrival ends at that target. In
        // constraint-satisfaction mode the candidate remains expandable so
        // additional, longer satisfying paths can still be enumerated.
        if (
          endpointMode === "specific-target" &&
          !isZeroTransitionSourceTargetPath
        ) {
          continue;
        }
      }
      // A specific-target arrival with pending obligations remains expandable
      // because a later transition may satisfy them before returning.
    }

    const outgoingEdges =
      topology.outgoingEdgesByNodeId.get(candidate.currentNodeId) ?? [];

    for (const edge of outgoingEdges) {
      const remainingDistance =
        endpointMode === "specific-target"
          ? distancesToTarget.get(edge.target)
          : 0;

      if (
        endpointMode === "specific-target" &&
        remainingDistance === undefined
      ) {
        continue;
      }

      if (queue.size >= maximumQueuedCandidates) {
        resourceLimitReached = true;
        break;
      }

      const existingVisitCount = countNodeVisits(candidate, edge.target);

      if (existingVisitCount >= input.maximumVisitsPerState) {
        continue;
      }

      const nextMonitorEntries = advanceMonitorSet(
        candidate.monitorEntries,
        edge,
      );

      if (!getMonitorSetStatus(nextMonitorEntries).viable) {
        continue;
      }

      const nextExercisedConstraintIds = updateExercisedConstraintIds(
        compiledConstraints,
        edge,
        candidate.exercisedConstraintIds,
      );

      queue.push({
        currentNodeId: edge.target,
        parent: candidate,
        incomingEdgeId: edge.id,
        depth: candidate.depth + 1,
        estimatedTotalCost:
          candidate.depth + 1 + (remainingDistance ?? 0),
        monitorEntries: nextMonitorEntries,
        exercisedConstraintIds: nextExercisedConstraintIds,
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
