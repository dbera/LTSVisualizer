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

type SeenActivation = {
  bindings: ActivationBindings;
};

export type RespondedExistenceState = {
  activations: SeenActivation[];
  pendingActivations: SeenActivation[];
  seenTargets: DeclareTransition[];
  violated: boolean;
};

export type CoexistenceState = RespondedExistenceState & {
  unmatchedTargets: DeclareTransition[];
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

function anyCorrelatedTarget(
  targets: readonly DeclareTransition[],
  activation: SeenActivation,
  correlation: CorrelationCondition | undefined,
): boolean {
  return targets.some((target) => correlates(correlation, activation, target));
}

function anyCorrelatedActivation(
  activations: readonly SeenActivation[],
  target: DeclareTransition,
  correlation: CorrelationCondition | undefined,
): boolean {
  return activations.some((activation) =>
    correlates(correlation, activation, target),
  );
}

export function createRespondedExistenceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<RespondedExistenceState> {
  return {
    initialState: () => ({
      activations: [],
      pendingActivations: [],
      seenTargets: [],
      violated: false,
    }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const targetOccurs = groupMatches(target, edge);
      const seenTargets = targetOccurs
        ? [...state.seenTargets, edge]
        : state.seenTargets;
      const existingPending = targetOccurs
        ? state.pendingActivations.filter(
            (candidate) => !correlates(correlation, candidate, edge),
          )
        : state.pendingActivations;
      const newActivations = activationMatches(activation, edge);
      const newPending = newActivations.filter(
        (candidate) =>
          !anyCorrelatedTarget(seenTargets, candidate, correlation),
      );

      return {
        activations: [...state.activations, ...newActivations],
        pendingActivations: [...existingPending, ...newPending],
        seenTargets,
        violated: false,
      };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting:
        !state.violated && state.pendingActivations.length === 0,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createNotRespondedExistenceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<RespondedExistenceState> {
  return {
    initialState: () => ({
      activations: [],
      pendingActivations: [],
      seenTargets: [],
      violated: false,
    }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const targetOccurs = groupMatches(target, edge);
      const newActivations = activationMatches(activation, edge);
      const targetViolates =
        targetOccurs &&
        anyCorrelatedActivation(state.activations, edge, correlation);
      const activationViolates = newActivations.some((candidate) =>
        anyCorrelatedTarget(state.seenTargets, candidate, correlation),
      );

      return {
        activations: [...state.activations, ...newActivations],
        pendingActivations: [],
        seenTargets: targetOccurs
          ? [...state.seenTargets, edge]
          : state.seenTargets,
        violated: targetViolates || activationViolates,
      };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createCoexistenceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<CoexistenceState> {
  return {
    initialState: () => ({
      activations: [],
      pendingActivations: [],
      seenTargets: [],
      unmatchedTargets: [],
      violated: false,
    }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }

      const targetOccurs = groupMatches(target, edge);
      const newActivations = activationMatches(activation, edge);
      const allActivations = [...state.activations, ...newActivations];
      const allTargets = targetOccurs
        ? [...state.seenTargets, edge]
        : state.seenTargets;

      const pendingActivations = [
        ...state.pendingActivations.filter(
          (candidate) =>
            !targetOccurs || !correlates(correlation, candidate, edge),
        ),
        ...newActivations.filter(
          (candidate) =>
            !anyCorrelatedTarget(allTargets, candidate, correlation),
        ),
      ];

      const unmatchedTargets = [
        ...state.unmatchedTargets.filter(
          (candidate) =>
            !newActivations.some((newActivation) =>
              correlates(correlation, newActivation, candidate),
            ),
        ),
        ...(targetOccurs &&
        !anyCorrelatedActivation(allActivations, edge, correlation)
          ? [edge]
          : []),
      ];

      return {
        activations: allActivations,
        pendingActivations,
        seenTargets: allTargets,
        unmatchedTargets,
        violated: false,
      };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting:
        !state.violated &&
        state.pendingActivations.length === 0 &&
        state.unmatchedTargets.length === 0,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createNotCoexistenceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<RespondedExistenceState> {
  return createNotRespondedExistenceMonitor(
    activation,
    target,
    correlation,
  );
}
