import type { TransitionCondition } from "./transitionConditions";
import type {
  CaptureDefinition,
  CorrelationCondition,
} from "./transitionCorrelation";

export type DeclareTemplateId =
  | "at-least"
  | "at-most"
  | "exactly"
  | "exactly-consecutive"
  | "init"
  | "end"
  | "choice"
  | "exclusive-choice"
  | "responded-existence"
  | "not-responded-existence"
  | "coexistence"
  | "not-coexistence"
  | "response"
  | "not-response"
  | "chain-response"
  | "not-chain-response"
  | "alternate-response"
  | "precedence"
  | "not-precedence"
  | "chain-precedence"
  | "not-chain-precedence"
  | "alternate-precedence"
  | "succession"
  | "not-succession"
  | "chain-succession"
  | "not-chain-succession"
  | "alternate-succession";

export type DeclareTemplateCategory =
  | "cardinality"
  | "position"
  | "choice"
  | "existence"
  | "future"
  | "past"
  | "bidirectional";

export type DeclarePredicateRole = "activation" | "target";
export type ActivityRelation = "and" | "or";

export type TransitionNameMatcher = {
  operator: "equals";
  value: string;
};

export type DeclarePredicate = {
  transition?: TransitionNameMatcher;
  condition?: TransitionCondition;
  captures?: CaptureDefinition[];
};

export type DeclarePredicateGroup = {
  relation: ActivityRelation;
  predicates: DeclarePredicate[];
};

export type DeclareConstraint = {
  id: string;
  template: DeclareTemplateId;
  enabled: boolean;
  activation?: DeclarePredicateGroup;
  target?: DeclarePredicateGroup;
  correlation?: CorrelationCondition;
  count?: number;
};

export type DeclareTemplateDefinition = {
  id: DeclareTemplateId;
  displayName: string;
  category: DeclareTemplateCategory;
  requiredRoles: DeclarePredicateRole[];
  supportsCount: boolean;
  supportsCorrelation: boolean;
  description: string;
};

const DEFINITIONS: readonly DeclareTemplateDefinition[] = [
  { id: "at-least", displayName: "At least N", category: "cardinality", requiredRoles: ["activation"], supportsCount: true, supportsCorrelation: false, description: "The activation occurs at least N times." },
  { id: "at-most", displayName: "At most N", category: "cardinality", requiredRoles: ["activation"], supportsCount: true, supportsCorrelation: false, description: "The activation occurs at most N times." },
  { id: "exactly", displayName: "Exactly N", category: "cardinality", requiredRoles: ["activation"], supportsCount: true, supportsCorrelation: false, description: "The activation occurs exactly N times." },
  { id: "exactly-consecutive", displayName: "Exactly N consecutively", category: "cardinality", requiredRoles: ["activation"], supportsCount: true, supportsCorrelation: false, description: "The activation occurs exactly N times consecutively." },
  { id: "init", displayName: "Init", category: "position", requiredRoles: ["activation"], supportsCount: false, supportsCorrelation: false, description: "The first transition matches the activation." },
  { id: "end", displayName: "End", category: "position", requiredRoles: ["activation"], supportsCount: false, supportsCorrelation: false, description: "The last transition matches the activation." },
  { id: "choice", displayName: "Choice", category: "choice", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: false, description: "The activation or target occurs." },
  { id: "exclusive-choice", displayName: "Exclusive choice", category: "choice", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: false, description: "Exactly one of activation and target occurs." },
  { id: "responded-existence", displayName: "Responded existence", category: "existence", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "If the activation occurs, a correlated target occurs before or after it." },
  { id: "not-responded-existence", displayName: "Not responded existence", category: "existence", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "If the activation occurs, no correlated target occurs in the path." },
  { id: "coexistence", displayName: "Coexistence", category: "existence", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Activation and target either both occur or both do not occur." },
  { id: "not-coexistence", displayName: "Not coexistence", category: "existence", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Activation and target do not both occur." },
  { id: "response", displayName: "Response", category: "future", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Every activation is eventually followed by a correlated target." },
  { id: "not-response", displayName: "Not response", category: "future", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "No activation is followed later by a correlated target." },
  { id: "chain-response", displayName: "Chain response", category: "future", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Every activation is immediately followed by a correlated target." },
  { id: "not-chain-response", displayName: "Not chain response", category: "future", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "No activation is immediately followed by a correlated target." },
  { id: "alternate-response", displayName: "Alternate response", category: "future", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Every activation is followed by a correlated target before another qualifying activation occurs." },
  { id: "precedence", displayName: "Precedence", category: "past", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Every target has a correlated activation before it." },
  { id: "not-precedence", displayName: "Not precedence", category: "past", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "No target has a correlated activation before it." },
  { id: "chain-precedence", displayName: "Chain precedence", category: "past", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Every target is immediately preceded by a correlated activation." },
  { id: "not-chain-precedence", displayName: "Not chain precedence", category: "past", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "No target is immediately preceded by a correlated activation." },
  { id: "alternate-precedence", displayName: "Alternate precedence", category: "past", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Every target has a correlated activation before it and after the previous qualifying target." },
  { id: "succession", displayName: "Succession", category: "bidirectional", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Response and precedence both hold." },
  { id: "not-succession", displayName: "Not succession", category: "bidirectional", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Negative succession semantics." },
  { id: "chain-succession", displayName: "Chain succession", category: "bidirectional", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Chain response and chain precedence both hold." },
  { id: "not-chain-succession", displayName: "Not chain succession", category: "bidirectional", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Negative chain-succession semantics." },
  { id: "alternate-succession", displayName: "Alternate succession", category: "bidirectional", requiredRoles: ["activation", "target"], supportsCount: false, supportsCorrelation: true, description: "Alternate response and alternate precedence both hold." },
] as const;

export const DECLARE_TEMPLATE_DEFINITIONS: readonly DeclareTemplateDefinition[] =
  DEFINITIONS;

const DEFINITION_BY_ID = new Map(
  DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function getDeclareTemplateDefinition(
  id: DeclareTemplateId,
): DeclareTemplateDefinition {
  const definition = DEFINITION_BY_ID.get(id);
  if (!definition) {
    throw new Error(`Unknown Declare template: ${id}.`);
  }
  return definition;
}

function validatePredicateGroup(
  group: DeclarePredicateGroup | undefined,
  role: DeclarePredicateRole,
): string[] {
  if (!group) {
    return [`${role} is required.`];
  }
  if (group.predicates.length === 0) {
    return [`${role} must contain at least one predicate.`];
  }
  const errors: string[] = [];
  group.predicates.forEach((predicate, index) => {
    if (!predicate.transition && !predicate.condition) {
      errors.push(
        `${role}.predicates[${index}] must define a transition name or data condition.`,
      );
    }
    if (predicate.transition?.value.trim() === "") {
      errors.push(`${role}.predicates[${index}].transition must not be empty.`);
    }
    if ((predicate.captures?.length ?? 0) > 0 && role !== "activation") {
      errors.push(`${role}.predicates[${index}] must not define activation captures.`);
    }
  });
  return errors;
}

export function validateDeclareConstraint(
  constraint: DeclareConstraint,
): string[] {
  const errors: string[] = [];
  if (constraint.id.trim() === "") {
    errors.push("Constraint ID must not be empty.");
  }

  const definition = getDeclareTemplateDefinition(constraint.template);
  for (const role of definition.requiredRoles) {
    errors.push(...validatePredicateGroup(constraint[role], role));
  }

  if (definition.supportsCount) {
    if (!Number.isInteger(constraint.count) || (constraint.count ?? 0) < 0) {
      errors.push("Count must be a non-negative integer.");
    }
  } else if (constraint.count !== undefined) {
    errors.push(`${definition.displayName} does not support a count.`);
  }

  if (constraint.correlation && !definition.supportsCorrelation) {
    errors.push(`${definition.displayName} does not support correlation conditions.`);
  }

  for (const role of ["activation", "target"] as const) {
    if (!definition.requiredRoles.includes(role) && constraint[role]) {
      errors.push(`${definition.displayName} does not use ${role}.`);
    }
  }

  return errors;
}
