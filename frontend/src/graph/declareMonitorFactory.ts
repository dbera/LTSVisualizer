import {
  createAtLeastMonitor,
  createAtMostMonitor,
  createChoiceMonitor,
  createEndMonitor,
  createExactlyConsecutiveMonitor,
  createExactlyMonitor,
  createExclusiveChoiceMonitor,
  createInitMonitor,
} from "./declareBasicMonitors";
import {
  validateDeclareConstraint,
  type DeclareConstraint,
  type DeclarePredicateGroup,
} from "./declareConstraints";
import {
  createCoexistenceMonitor,
  createNotCoexistenceMonitor,
  createNotRespondedExistenceMonitor,
  createRespondedExistenceMonitor,
} from "./declareExistenceMonitors";
import type { DeclareMonitor } from "./declareMonitor";
import {
  evaluateDeclarePredicateGroup,
  type DeclareTransition,
} from "./declarePredicates";
import {
  createAlternatePrecedenceMonitor,
  createChainPrecedenceMonitor,
  createNotAlternatePrecedenceMonitor,
  createNotChainPrecedenceMonitor,
  createNotPrecedenceMonitor,
  createPrecedenceMonitor,
} from "./declarePrecedenceMonitors";
import {
  createAlternateResponseMonitor,
  createChainResponseMonitor,
  createNotAlternateResponseMonitor,
  createNotChainResponseMonitor,
  createNotResponseMonitor,
  createResponseMonitor,
} from "./declareResponseMonitors";
import {
  createAlternateSuccessionMonitor,
  createChainSuccessionMonitor,
  createNotAlternateSuccessionMonitor,
  createNotChainSuccessionMonitor,
  createNotSuccessionMonitor,
  createSuccessionMonitor,
} from "./declareSuccessionMonitors";
import {
  validateCaptureDefinitions,
  validateCorrelationCondition,
} from "./transitionCorrelation";

export type CompiledDeclareConstraint = {
  id: string;
  monitor: DeclareMonitor<unknown>;
  requiresExercise: boolean;
  isExercisedBy(edge: DeclareTransition): boolean;
};

function requireGroup(
  constraint: DeclareConstraint,
  role: "activation" | "target" | "between",
): DeclarePredicateGroup {
  const group = constraint[role];
  if (!group) {
    throw new Error(`${role} is required.`);
  }
  return group;
}

function collectActivationAliases(constraint: DeclareConstraint): string[] {
  return (
    constraint.activation?.predicates.flatMap((predicate) =>
      (predicate.captures ?? []).map((capture) => capture.alias),
    ) ?? []
  );
}

export function validateExecutableDeclareConstraint(
  constraint: DeclareConstraint,
): string[] {
  const errors = [...validateDeclareConstraint(constraint)];
  const captures =
    constraint.activation?.predicates.flatMap(
      (predicate) => predicate.captures ?? [],
    ) ?? [];
  errors.push(...validateCaptureDefinitions(captures));

  if (constraint.correlation) {
    errors.push(
      ...validateCorrelationCondition(
        constraint.correlation,
        collectActivationAliases(constraint),
      ),
    );
  }

  return [...new Set(errors)];
}

export function createDeclareMonitor(
  constraint: DeclareConstraint,
): DeclareMonitor<unknown> {
  const errors = validateExecutableDeclareConstraint(constraint);
  if (errors.length > 0) {
    throw new Error(
      `Declare constraint ${constraint.id || "<unnamed>"} is invalid:\n${errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }

  const activation = requireGroup(constraint, "activation");
  const target = () => requireGroup(constraint, "target");
  const between = () => requireGroup(constraint, "between");
  const count = () => constraint.count ?? 0;
  const correlation = constraint.correlation;

  switch (constraint.template) {
    case "at-least":
      return createAtLeastMonitor(activation, count());
    case "at-most":
      return createAtMostMonitor(activation, count());
    case "exactly":
      return createExactlyMonitor(activation, count());
    case "exactly-consecutive":
      return createExactlyConsecutiveMonitor(activation, count());
    case "init":
      return createInitMonitor(activation);
    case "end":
      return createEndMonitor(activation);
    case "choice":
      return createChoiceMonitor(activation, target());
    case "exclusive-choice":
      return createExclusiveChoiceMonitor(activation, target());
    case "responded-existence":
      return createRespondedExistenceMonitor(
        activation,
        target(),
        correlation,
      );
    case "not-responded-existence":
      return createNotRespondedExistenceMonitor(
        activation,
        target(),
        correlation,
      );
    case "coexistence":
      return createCoexistenceMonitor(activation, target(), correlation);
    case "not-coexistence":
      return createNotCoexistenceMonitor(activation, target(), correlation);
    case "response":
      return createResponseMonitor(activation, target(), correlation);
    case "not-response":
      return createNotResponseMonitor(activation, target(), correlation);
    case "chain-response":
      return createChainResponseMonitor(activation, target(), correlation);
    case "not-chain-response":
      return createNotChainResponseMonitor(
        activation,
        target(),
        correlation,
      );
    case "alternate-response":
      return createAlternateResponseMonitor(
        activation,
        target(),
        between(),
        correlation,
      );
    case "not-alternate-response":
      return createNotAlternateResponseMonitor(
        activation,
        target(),
        between(),
        correlation,
      );
    case "precedence":
      return createPrecedenceMonitor(activation, target(), correlation);
    case "not-precedence":
      return createNotPrecedenceMonitor(activation, target(), correlation);
    case "chain-precedence":
      return createChainPrecedenceMonitor(activation, target(), correlation);
    case "not-chain-precedence":
      return createNotChainPrecedenceMonitor(
        activation,
        target(),
        correlation,
      );
    case "alternate-precedence":
      return createAlternatePrecedenceMonitor(
        activation,
        target(),
        between(),
        correlation,
      );
    case "not-alternate-precedence":
      return createNotAlternatePrecedenceMonitor(
        activation,
        target(),
        between(),
        correlation,
      );
    case "succession":
      return createSuccessionMonitor(activation, target(), correlation);
    case "not-succession":
      return createNotSuccessionMonitor(activation, target(), correlation);
    case "chain-succession":
      return createChainSuccessionMonitor(activation, target(), correlation);
    case "not-chain-succession":
      return createNotChainSuccessionMonitor(
        activation,
        target(),
        correlation,
      );
    case "alternate-succession":
      return createAlternateSuccessionMonitor(
        activation,
        target(),
        between(),
        correlation,
      );
    case "not-alternate-succession":
      return createNotAlternateSuccessionMonitor(
        activation,
        target(),
        between(),
        correlation,
      );
  }
}


function groupMatches(
  group: DeclarePredicateGroup | undefined,
  edge: DeclareTransition,
): boolean {
  return group !== undefined && evaluateDeclarePredicateGroup(group, edge).matches;
}

function createExercisePolicy(constraint: DeclareConstraint): Pick<
  CompiledDeclareConstraint,
  "requiresExercise" | "isExercisedBy"
> {
  const activationMatches = (edge: DeclareTransition) =>
    groupMatches(constraint.activation, edge);
  const targetMatches = (edge: DeclareTransition) =>
    groupMatches(constraint.target, edge);
  const eitherMatches = (edge: DeclareTransition) =>
    activationMatches(edge) || targetMatches(edge);

  switch (constraint.template) {
    case "at-most":
      return { requiresExercise: false, isExercisedBy: activationMatches };
    case "at-least":
    case "exactly":
    case "exactly-consecutive":
      return {
        requiresExercise: (constraint.count ?? 0) > 0,
        isExercisedBy: activationMatches,
      };
    case "init":
    case "end":
      return { requiresExercise: true, isExercisedBy: activationMatches };
    case "precedence":
    case "not-precedence":
    case "chain-precedence":
    case "not-chain-precedence":
    case "alternate-precedence":
    case "not-alternate-precedence":
      return { requiresExercise: true, isExercisedBy: targetMatches };
    case "response":
    case "not-response":
    case "chain-response":
    case "not-chain-response":
    case "alternate-response":
    case "not-alternate-response":
    case "responded-existence":
    case "not-responded-existence":
      return { requiresExercise: true, isExercisedBy: activationMatches };
    case "choice":
    case "exclusive-choice":
    case "coexistence":
    case "not-coexistence":
    case "succession":
    case "not-succession":
    case "chain-succession":
    case "not-chain-succession":
    case "alternate-succession":
    case "not-alternate-succession":
      return { requiresExercise: true, isExercisedBy: eitherMatches };
  }
}
export function compileDeclareConstraints(
  constraints: readonly DeclareConstraint[],
): CompiledDeclareConstraint[] {
  const enabled = constraints.filter((constraint) => constraint.enabled);
  const seenIds = new Set<string>();

  enabled.forEach((constraint) => {
    if (seenIds.has(constraint.id)) {
      throw new Error(`Duplicate enabled Declare constraint ID: ${constraint.id}.`);
    }
    seenIds.add(constraint.id);
  });

  return enabled.map((constraint) => ({
    id: constraint.id,
    monitor: createDeclareMonitor(constraint),
    ...createExercisePolicy(constraint),
  }));
}
