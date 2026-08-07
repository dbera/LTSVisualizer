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

export type SeenActivation = {
  bindings: ActivationBindings;
};

export type PrecedenceMonitorState = {
  seenActivations: SeenActivation[];
  violated: boolean;
};

export type ChainPrecedenceMonitorState = {
  previousActivations: SeenActivation[];
  violated: boolean;
};

export type AlternatePrecedenceMonitorState = {
  candidateActivations: SeenActivation[];
  blocked: boolean;
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
): SeenActivation[] {
  const evaluation = evaluateDeclarePredicateGroup(activation, edge);
  if (!evaluation.matches) {
    return [];
  }

  return evaluation.predicateMatches.map((match) => ({
    bindings: match.bindings,
  }));
}

function correlates(
  correlation: CorrelationCondition | undefined,
  activation: SeenActivation,
  targetEdge: DeclareTransition,
): boolean {
  return correlation
    ? evaluateCorrelationCondition(
        correlation,
        targetEdge,
        activation.bindings,
      ).matches
    : true;
}

function hasCorrelatedActivation(
  activations: readonly SeenActivation[],
  correlation: CorrelationCondition | undefined,
  targetEdge: DeclareTransition,
): boolean {
  return activations.some((activation) =>
    correlates(correlation, activation, targetEdge),
  );
}

export function createPrecedenceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<PrecedenceMonitorState> {
  return {
    initialState: () => ({ seenActivations: [], violated: false }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const targetOccurs = groupMatches(target, edge);
      const violated =
        targetOccurs &&
        !hasCorrelatedActivation(state.seenActivations, correlation, edge);

      return {
        seenActivations: [
          ...state.seenActivations,
          ...activationMatches(activation, edge),
        ],
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

export function createNotPrecedenceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<PrecedenceMonitorState> {
  return {
    initialState: () => ({ seenActivations: [], violated: false }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const targetOccurs = groupMatches(target, edge);
      const violated =
        targetOccurs &&
        hasCorrelatedActivation(state.seenActivations, correlation, edge);

      return {
        seenActivations: [
          ...state.seenActivations,
          ...activationMatches(activation, edge),
        ],
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

export function createChainPrecedenceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<ChainPrecedenceMonitorState> {
  return {
    initialState: () => ({ previousActivations: [], violated: false }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const targetOccurs = groupMatches(target, edge);
      const violated =
        targetOccurs &&
        !hasCorrelatedActivation(state.previousActivations, correlation, edge);

      return {
        previousActivations: activationMatches(activation, edge),
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

export function createNotChainPrecedenceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<ChainPrecedenceMonitorState> {
  return {
    initialState: () => ({ previousActivations: [], violated: false }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const targetOccurs = groupMatches(target, edge);
      const violated =
        targetOccurs &&
        hasCorrelatedActivation(state.previousActivations, correlation, edge);

      return {
        previousActivations: activationMatches(activation, edge),
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

export function createAlternatePrecedenceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  between: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<AlternatePrecedenceMonitorState> {
  return {
    initialState: () => ({
      candidateActivations: [],
      blocked: false,
      violated: false,
    }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const targetOccurs = groupMatches(target, edge);
      if (targetOccurs) {
        const fulfilled =
          !state.blocked &&
          hasCorrelatedActivation(
            state.candidateActivations,
            correlation,
            edge,
          );
        return {
          candidateActivations: activationMatches(activation, edge),
          blocked: false,
          violated: !fulfilled,
        };
      }

      const newActivations = activationMatches(activation, edge);
      if (newActivations.length > 0) {
        return {
          candidateActivations: newActivations,
          blocked: false,
          violated: false,
        };
      }

      if (
        state.candidateActivations.length > 0 &&
        groupMatches(between, edge)
      ) {
        return { ...state, blocked: true };
      }

      return state;
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createNotAlternatePrecedenceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  allowedBetween: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<AlternatePrecedenceMonitorState> {
  return {
    initialState: () => ({
      candidateActivations: [],
      blocked: false,
      violated: false,
    }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const targetOccurs = groupMatches(target, edge);
      if (targetOccurs) {
        const forbiddenSequence =
          !state.blocked &&
          hasCorrelatedActivation(
            state.candidateActivations,
            correlation,
            edge,
          );
        return {
          candidateActivations: activationMatches(activation, edge),
          blocked: false,
          violated: forbiddenSequence,
        };
      }

      const newActivations = activationMatches(activation, edge);
      if (newActivations.length > 0) {
        return {
          candidateActivations: newActivations,
          blocked: false,
          violated: false,
        };
      }

      if (
        state.candidateActivations.length > 0 &&
        !groupMatches(allowedBetween, edge)
      ) {
        return { ...state, blocked: true };
      }

      return state;
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}
