import type { DeclarePredicateGroup } from "./declareConstraints";
import {
  canonicalMonitorStateKey,
  type DeclareMonitor,
} from "./declareMonitor";
import {
  evaluateDeclarePredicateGroup,
  type DeclareTransition,
} from "./declarePredicates";
import {
  evaluateCorrelationCondition,
  type ActivationBindings,
  type CorrelationCondition,
} from "./transitionCorrelation";

export type PendingActivation = {
  bindings: ActivationBindings;
};

export type ResponseMonitorState = {
  pending: PendingActivation[];
  violated: boolean;
};

export type ChainResponseMonitorState = {
  pending: PendingActivation | null;
  violated: boolean;
};

export type AlternateResponseMonitorState = {
  pending: PendingActivation | null;
  possibleTargets: DeclareTransition[];
  violated: boolean;
};

function groupMatches(
  group: DeclarePredicateGroup,
  edge: DeclareTransition,
): boolean {
  return evaluateDeclarePredicateGroup(group, edge).matches;
}

function activationMatches(
  activation: DeclarePredicateGroup,
  edge: DeclareTransition,
): PendingActivation[] {
  const evaluation = evaluateDeclarePredicateGroup(activation, edge);
  if (!evaluation.matches) {
    return [];
  }

  return evaluation.predicateMatches.map((match) => ({
    bindings: match.bindings,
  }));
}

function targetCorrelates(
  target: DeclarePredicateGroup,
  correlation: CorrelationCondition | undefined,
  activation: PendingActivation,
  edge: DeclareTransition,
): boolean {
  if (!groupMatches(target, edge)) {
    return false;
  }

  return correlation
    ? evaluateCorrelationCondition(correlation, edge, activation.bindings).matches
    : true;
}

function fulfillPending(
  pending: readonly PendingActivation[],
  target: DeclarePredicateGroup,
  correlation: CorrelationCondition | undefined,
  edge: DeclareTransition,
): PendingActivation[] {
  return pending.filter(
    (activation) => !targetCorrelates(target, correlation, activation, edge),
  );
}

export function createResponseMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<ResponseMonitorState> {
  return {
    initialState: () => ({ pending: [], violated: false }),
    advance: (state, edge) => {
      const stillPending = fulfillPending(
        state.pending,
        target,
        correlation,
        edge,
      );
      return {
        pending: [...stillPending, ...activationMatches(activation, edge)],
        violated: state.violated,
      };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated && state.pending.length === 0,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createNotResponseMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<ResponseMonitorState> {
  return {
    initialState: () => ({ pending: [], violated: false }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const forbiddenTarget = state.pending.some((pending) =>
        targetCorrelates(target, correlation, pending, edge),
      );
      return {
        pending: [...state.pending, ...activationMatches(activation, edge)],
        violated: forbiddenTarget,
      };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createChainResponseMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<ChainResponseMonitorState> {
  return {
    initialState: () => ({ pending: null, violated: false }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const violated =
        state.pending !== null &&
        !targetCorrelates(target, correlation, state.pending, edge);
      const activations = activationMatches(activation, edge);
      return {
        pending: activations[0] ?? null,
        violated,
      };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated && state.pending === null,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createNotChainResponseMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<ChainResponseMonitorState> {
  return {
    initialState: () => ({ pending: null, violated: false }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const violated =
        state.pending !== null &&
        targetCorrelates(target, correlation, state.pending, edge);
      const activations = activationMatches(activation, edge);
      return {
        pending: activations[0] ?? null,
        violated,
      };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createAlternateResponseMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  between: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<AlternateResponseMonitorState> {
  return {
    initialState: () => ({
      pending: null,
      possibleTargets: [],
      violated: false,
    }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const newActivations = activationMatches(activation, edge);
      if (newActivations.length > 0) {
        const fulfilled =
          state.pending === null ||
          state.possibleTargets.some((candidate) =>
            targetCorrelates(target, correlation, state.pending!, candidate),
          );
        return {
          pending: newActivations[0],
          possibleTargets: [],
          violated: !fulfilled,
        };
      }

      if (state.pending !== null && groupMatches(between, edge)) {
        return { ...state, violated: true };
      }

      return state.pending !== null && groupMatches(target, edge)
        ? {
            ...state,
            possibleTargets: [...state.possibleTargets, edge],
          }
        : state;
    },
    status: (state) => {
      const pendingFulfilled =
        state.pending === null ||
        state.possibleTargets.some((candidate) =>
          targetCorrelates(target, correlation, state.pending!, candidate),
        );
      return {
        viable: !state.violated,
        accepting: !state.violated && pendingFulfilled,
      };
    },
    stateKey: canonicalMonitorStateKey,
  };
}

export function createNotAlternateResponseMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  allowedBetween: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<AlternateResponseMonitorState> {
  return {
    initialState: () => ({
      pending: null,
      possibleTargets: [],
      violated: false,
    }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const newActivations = activationMatches(activation, edge);
      if (newActivations.length > 0) {
        const forbiddenSequenceCompleted =
          state.pending !== null &&
          state.possibleTargets.some((candidate) =>
            targetCorrelates(target, correlation, state.pending!, candidate),
          );
        return {
          pending: newActivations[0],
          possibleTargets: [],
          violated: forbiddenSequenceCompleted,
        };
      }

      if (state.pending === null) {
        return state;
      }

      if (groupMatches(target, edge)) {
        return {
          ...state,
          possibleTargets: [...state.possibleTargets, edge],
        };
      }

      if (!groupMatches(allowedBetween, edge)) {
        return {
          pending: null,
          possibleTargets: [],
          violated: false,
        };
      }

      return state;
    },
    status: (state) => {
      const forbiddenSequenceCompleted =
        state.pending !== null &&
        state.possibleTargets.some((candidate) =>
          targetCorrelates(target, correlation, state.pending!, candidate),
        );
      return {
        viable: !state.violated,
        accepting: !state.violated && !forbiddenSequenceCompleted,
      };
    },
    stateKey: canonicalMonitorStateKey,
  };
}
