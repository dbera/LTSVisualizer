import {
  evaluateTransitionCondition,
  type TransitionData,
} from "./transitionConditions";
import {
  captureActivationValues,
  type ActivationBindings,
} from "./transitionCorrelation";
import type {
  DeclarePredicate,
  DeclarePredicateGroup,
} from "./declareConstraints";

export type DeclareTransition = TransitionData & {
  transition?: string;
};

export type PredicateMatch = {
  predicateIndex: number;
  bindings: ActivationBindings;
};

export type PredicateGroupEvaluation = {
  matches: boolean;
  predicateMatches: PredicateMatch[];
  errors: string[];
};

export function evaluateDeclarePredicate(
  predicate: DeclarePredicate,
  edge: DeclareTransition,
): { matches: boolean; bindings: ActivationBindings; errors: string[] } {
  if (
    predicate.transition &&
    edge.transition !== predicate.transition.value
  ) {
    return { matches: false, bindings: {}, errors: [] };
  }

  if (predicate.condition) {
    const evaluation = evaluateTransitionCondition(predicate.condition, edge);
    if (evaluation.errors.length > 0 || !evaluation.matches) {
      return {
        matches: false,
        bindings: {},
        errors: evaluation.errors,
      };
    }
  }

  const capture = captureActivationValues(predicate.captures ?? [], edge);
  if (capture.errors.length > 0) {
    return { matches: false, bindings: {}, errors: capture.errors };
  }

  return { matches: true, bindings: capture.bindings, errors: [] };
}

export function evaluateDeclarePredicateGroup(
  group: DeclarePredicateGroup,
  edge: DeclareTransition,
): PredicateGroupEvaluation {
  const predicateMatches: PredicateMatch[] = [];
  const errors: string[] = [];

  group.predicates.forEach((predicate, predicateIndex) => {
    const evaluation = evaluateDeclarePredicate(predicate, edge);
    errors.push(...evaluation.errors);
    if (evaluation.matches) {
      predicateMatches.push({
        predicateIndex,
        bindings: evaluation.bindings,
      });
    }
  });

  return {
    matches:
      group.relation === "or"
        ? predicateMatches.length > 0
        : predicateMatches.length === group.predicates.length,
    predicateMatches,
    errors,
  };
}

export function expandPredicateGroup(
  group: DeclarePredicateGroup,
): DeclarePredicateGroup[] {
  if (group.relation === "or") {
    return [group];
  }

  return group.predicates.map((predicate) => ({
    relation: "or",
    predicates: [predicate],
  }));
}
